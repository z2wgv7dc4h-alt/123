/**
 * Offline spectrum helpers for mastering tone-match and take scoring.
 * Hand-rolled FFT (no Tone.js / Web Audio) so this runs in Node tests too.
 */

const FFT_SIZE = 8192;
const MAX_FRAMES_PER_CHANNEL = 48;

/** 1/3-octave band centers from 20 Hz to 20 kHz (inclusive). */
export function oneThirdOctaveCenters(minHz = 20, maxHz = 20000): number[] {
  const out: number[] = [];
  for (let i = 0; ; i++) {
    const fc = minHz * Math.pow(2, i / 3);
    if (fc > maxHz * 1.0001) break;
    out.push(fc);
  }
  return out;
}

/** Geometric band edges around a center list (half-band out from each end). */
export function bandEdges(centers: readonly number[]): number[] {
  const edges: number[] = [];
  const half = Math.pow(2, 1 / 6);
  edges.push(centers[0]! / half);
  for (let i = 1; i < centers.length; i++) {
    edges.push(Math.sqrt(centers[i - 1]! * centers[i]!));
  }
  edges.push(centers[centers.length - 1]! * half);
  return edges;
}

function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cwr = 1;
      let cwi = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k]!;
        const ui = im[i + k]!;
        const vr = re[i + k + len / 2]! * cwr - im[i + k + len / 2]! * cwi;
        const vi = re[i + k + len / 2]! * cwi + im[i + k + len / 2]! * cwr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const nwr = cwr * wr - cwi * wi;
        cwi = cwr * wi + cwi * wr;
        cwr = nwr;
      }
    }
  }
}

/**
 * Average power spectrum in 1/3-octave bands, as dB (10·log10). Frames are
 * Hann-windowed and capped so this stays fast enough for offline mastering.
 */
export function spectrumDb(
  channels: readonly Float32Array[],
  sampleRate: number,
  centers: readonly number[] = oneThirdOctaveCenters(),
): number[] {
  const nBands = centers.length;
  const acc = new Float64Array(nBands);
  if (!channels.length || channels[0]!.length < FFT_SIZE) {
    return new Array(nBands).fill(-120);
  }
  const edges = bandEdges(centers);
  const win = new Float64Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FFT_SIZE);

  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  const binHz = sampleRate / FFT_SIZE;
  let frameCount = 0;

  for (const ch of channels) {
    let perChannel = 0;
    for (let start = 0; start + FFT_SIZE <= ch.length && perChannel < MAX_FRAMES_PER_CHANNEL; start += FFT_SIZE / 2) {
      for (let i = 0; i < FFT_SIZE; i++) {
        re[i] = (ch[start + i] ?? 0) * win[i]!;
        im[i] = 0;
      }
      fftInPlace(re, im);
      for (let k = 1; k < FFT_SIZE / 2; k++) {
        const f = k * binHz;
        // Bands are contiguous; find via edges.
        let band = -1;
        for (let b = 0; b < nBands; b++) {
          if (f >= edges[b]! && f < edges[b + 1]!) {
            band = b;
            break;
          }
        }
        if (band < 0) continue;
        acc[band] += re[k]! * re[k]! + im[k]! * im[k]!;
      }
      perChannel++;
      frameCount++;
    }
  }
  if (frameCount === 0) return new Array(nBands).fill(-120);
  const out: number[] = [];
  for (let b = 0; b < nBands; b++) {
    out.push(10 * Math.log10(acc[b]! / frameCount + 1e-12));
  }
  return out;
}

/**
 * Broad spectral tilt: energy above 4 kHz minus energy below 400 Hz (dB).
 * Negative = bass-heavy, positive = bright.
 */
export function spectralTiltDb(channels: readonly Float32Array[], sampleRate: number): number {
  const centers = oneThirdOctaveCenters();
  const db = spectrumDb(channels, sampleRate, centers);
  let lowSum = 0;
  let highSum = 0;
  let lowN = 0;
  let highN = 0;
  for (let i = 0; i < centers.length; i++) {
    const fc = centers[i]!;
    if (fc < 400) {
      lowSum += Math.pow(10, db[i]! / 10);
      lowN++;
    } else if (fc > 4000) {
      highSum += Math.pow(10, db[i]! / 10);
      highN++;
    }
  }
  if (!lowN || !highN) return 0;
  return 10 * Math.log10(highSum / highN + 1e-12) - 10 * Math.log10(lowSum / lowN + 1e-12);
}

/**
 * Per-band tone-match gains: reference − take, 3-band smoothed, clamped to
 * ±6 dB (bass < 60 Hz clamped to ±3 dB so sub weight is not rewritten).
 */
export function toneMatchGains(
  referenceDb: readonly number[],
  takeDb: readonly number[],
  centers: readonly number[] = oneThirdOctaveCenters(),
): number[] {
  const raw = referenceDb.map((r, i) => r - (takeDb[i] ?? r));
  const smoothed = raw.map((_, i) => {
    const a = raw[Math.max(0, i - 1)]!;
    const b = raw[i]!;
    const c = raw[Math.min(raw.length - 1, i + 1)]!;
    return (a + b + c) / 3;
  });
  return smoothed.map((g, i) => {
    const limit = centers[i]! < 60 ? 3 : 6;
    return Math.max(-limit, Math.min(limit, g));
  });
}

/** RBJ peaking EQ coefficients (A = 10^(gainDb/40)). */
export function peakingCoeffs(
  gainDb: number,
  fc: number,
  sampleRate: number,
  q = 4.3,
): { b0: number; b1: number; b2: number; a0: number; a1: number; a2: number } {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * fc) / sampleRate;
  const alpha = Math.sin(w0) / (2 * q);
  const cosw = Math.cos(w0);
  return {
    b0: 1 + alpha * A,
    b1: -2 * cosw,
    b2: 1 - alpha * A,
    a0: 1 + alpha / A,
    a1: -2 * cosw,
    a2: 1 - alpha / A,
  };
}

/** RBJ high-shelf coefficients. */
export function highShelfCoeffs(
  gainDb: number,
  fc: number,
  sampleRate: number,
  slope = 1,
): { b0: number; b1: number; b2: number; a0: number; a1: number; a2: number } {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * fc) / sampleRate;
  const cosw = Math.cos(w0);
  const alpha = (Math.sin(w0) / 2) * Math.sqrt((A + 1 / A) * (1 / slope - 1) + 2);
  const twoSqrtAalpha = 2 * Math.sqrt(A) * alpha;
  return {
    b0: A * (A + 1 + (A - 1) * cosw + twoSqrtAalpha),
    b1: -2 * A * (A - 1 + (A + 1) * cosw),
    b2: A * (A + 1 + (A - 1) * cosw - twoSqrtAalpha),
    a0: A + 1 - (A - 1) * cosw + twoSqrtAalpha,
    a1: 2 * (A - 1 - (A + 1) * cosw),
    a2: A + 1 - (A - 1) * cosw - twoSqrtAalpha,
  };
}
