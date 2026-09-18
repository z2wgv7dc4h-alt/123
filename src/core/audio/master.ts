/**
 * Loudness mastering for Studio (ACE) mixes.
 * ITU-R BS.1770 LUFS measurement + glue compression + peak limiting.
 */

import type { GenreId, MasterReport } from '../types';
import {
  oneThirdOctaveCenters,
  spectrumDb,
  toneMatchGains,
  peakingCoeffs,
  highShelfCoeffs,
} from './spectrum';

type ToneFilter = { kind: 'highshelf' | 'peaking'; fc: number; gainDb: number; q?: number };

/** Gentle default tone tilt per genre when no reference is attached. */
const GENRE_TONE_TARGETS: Record<GenreId, ToneFilter[]> = {
  dnb: [
    { kind: 'highshelf', fc: 8000, gainDb: 1.5 },
    { kind: 'peaking', fc: 300, gainDb: -1.5, q: 1.0 },
  ],
  dubstep: [
    { kind: 'highshelf', fc: 8000, gainDb: 1.5 },
    { kind: 'peaking', fc: 300, gainDb: -1.5, q: 1.0 },
  ],
  halftime: [
    { kind: 'highshelf', fc: 8000, gainDb: 1.5 },
    { kind: 'peaking', fc: 300, gainDb: -1.5, q: 1.0 },
  ],
  jungle: [
    { kind: 'highshelf', fc: 8000, gainDb: 1.0 },
    { kind: 'peaking', fc: 300, gainDb: -1.0, q: 1.0 },
  ],
  trap: [
    { kind: 'highshelf', fc: 9000, gainDb: 1.0 },
    { kind: 'peaking', fc: 250, gainDb: -1.5, q: 1.0 },
  ],
};

function applyFilters(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  filters: readonly ToneFilter[],
): { left: Float32Array; right: Float32Array } {
  let l = left;
  let r = right;
  for (const f of filters) {
    const c =
      f.kind === 'highshelf'
        ? highShelfCoeffs(f.gainDb, f.fc, sampleRate)
        : peakingCoeffs(f.gainDb, f.fc, sampleRate, f.q ?? 4.3);
    l = biquad(l, c.b0, c.b1, c.b2, c.a0, c.a1, c.a2);
    r = biquad(r, c.b0, c.b1, c.b2, c.a0, c.a1, c.a2);
  }
  return { left: l, right: r };
}

/** Turn per-band gains into a peaking-biquad cascade (skips near-zero bands). */
function applyBandGains(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  centers: readonly number[],
  gains: readonly number[],
): { left: Float32Array; right: Float32Array } {
  const filters: ToneFilter[] = [];
  for (let i = 0; i < centers.length; i++) {
    const g = gains[i] ?? 0;
    if (Math.abs(g) >= 0.25) filters.push({ kind: 'peaking', fc: centers[i]!, gainDb: g });
  }
  return applyFilters(left, right, sampleRate, filters);
}

/**
 * One biquad section, direct form I. Coefficients are normalized by a0.
 * Shared by both K-weighting stages.
 */
function biquad(
  input: Float32Array,
  b0: number,
  b1: number,
  b2: number,
  a0: number,
  a1: number,
  a2: number,
): Float32Array {
  const out = new Float32Array(input.length);
  const nb0 = b0 / a0;
  const nb1 = b1 / a0;
  const nb2 = b2 / a0;
  const na1 = a1 / a0;
  const na2 = a2 / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x0 = input[i]!;
    const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    out[i] = y0;
  }
  return out;
}

/**
 * ITU-R BS.1770-4 K-weighting = high-shelf (head pre-filter) then RLB
 * high-pass, both designed from the standard's analog prototype (the
 * libebur128 coefficients), so they are valid at any sample rate and hit the
 * published 48 kHz values exactly. The old hand-rolled "simplified" filter
 * attenuated everything by ~1e6, which made every measurement -Infinity and
 * silently no-opped mastering.
 */
function kWeight(channel: Float32Array, sampleRate: number): Float32Array {
  // Stage 1: high-shelf (~+4 dB above ~1.7 kHz).
  const shelfF0 = 1681.974450955533;
  const shelfGain = 3.999843853973347;
  const shelfQ = 0.7071752369554196;
  const kShelf = Math.tan((Math.PI * shelfF0) / sampleRate);
  const vh = Math.pow(10, shelfGain / 20);
  const vb = Math.pow(vh, 0.4996667741545416);
  const shelfA0 = 1 + kShelf / shelfQ + kShelf * kShelf;
  const shelfB0 = vh + (vb * kShelf) / shelfQ + kShelf * kShelf;
  const shelfB1 = 2 * (kShelf * kShelf - vh);
  const shelfB2 = vh - (vb * kShelf) / shelfQ + kShelf * kShelf;
  const shelfA1 = 2 * (kShelf * kShelf - 1);
  const shelfA2 = 1 - kShelf / shelfQ + kShelf * kShelf;
  const shelved = biquad(channel, shelfB0, shelfB1, shelfB2, shelfA0, shelfA1, shelfA2);

  // Stage 2: RLB high-pass (~38 Hz).
  const hpF0 = 38.13547087602444;
  const hpQ = 0.5003270373238773;
  const kHp = Math.tan((Math.PI * hpF0) / sampleRate);
  const hpA0 = 1 + kHp / hpQ + kHp * kHp;
  const hpA1 = 2 * (kHp * kHp - 1);
  const hpA2 = 1 - kHp / hpQ + kHp * kHp;
  return biquad(shelved, 1, -2, 1, hpA0, hpA1, hpA2);
}

/**
 * Compute integrated loudness per ITU-R BS.1770-4 (simplified gating).
 * Applies K-weighting (high-shelf + RLB high-pass) and measures RMS in 400 ms
 * blocks with 75% overlap. Returns -Infinity for silence.
 */
export function integratedLufs(left: Float32Array, right: Float32Array, sampleRate: number): number {
  if (left.length === 0 || right.length === 0) return -Infinity;

  const leftHp = kWeight(left, sampleRate);
  const rightHp = kWeight(right, sampleRate);

  // Measure RMS in 400 ms blocks with 75% overlap
  const blockMs = Math.round((400 * sampleRate) / 1000);
  const hopMs = Math.round(blockMs * 0.25);

  const blockRms: number[] = [];
  for (let start = 0; start + blockMs <= leftHp.length; start += hopMs) {
    let sum = 0;
    for (let i = start; i < start + blockMs; i++) {
      sum += (leftHp[i]! * leftHp[i]! + rightHp[i]! * rightHp[i]!) / 2;
    }
    const rms = Math.sqrt(sum / blockMs);
    blockRms.push(rms);
  }

  if (blockRms.length === 0) return -Infinity;

  // Gating: -70 LUFS absolute, -10 LU relative
  const gateAbsLinear = Math.pow(10, -70 / 10);
  const gated = blockRms.filter((rms) => rms > Math.sqrt(gateAbsLinear));
  if (gated.length === 0) return -Infinity;

  const meanRms = gated.reduce((a, b) => a + b) / gated.length;
  const gateRelLinear = Math.sqrt(meanRms * meanRms * Math.pow(10, -10 / 10));
  const final = gated.filter((rms) => rms > gateRelLinear);
  if (final.length === 0) return -Infinity;

  const finalMean = final.reduce((a, b) => a + b) / final.length;
  // LUFS = -0.691 + 10 * log10(mean-square); use RMS directly
  return 20 * Math.log10(finalMean) - 0.691;
}

/** One-pole high-pass (RC), used to keep the width side band out of the bass. */
function highPassOnePole(input: Float32Array, sampleRate: number, cutoffHz: number): Float32Array {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const a = rc / (rc + dt);
  const out = new Float32Array(input.length);
  let prevX = 0;
  let prevY = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i]!;
    const y = a * (prevY + x - prevX);
    prevX = x;
    prevY = y;
    out[i] = y;
  }
  return out;
}

/** Side high-pass corner for stereo width — below this the mix stays mono. */
export const MASTER_WIDTH_SIDE_HP_HZ = 150;
/** Side-channel gain for the width stage (mild: +25%). */
export const MASTER_WIDTH_SIDE_GAIN = 1.25;

/**
 * Mild mid/side width: side is high-passed at 150 Hz (bass stays mono) and
 * gained x1.25, then recombined. Center content is untouched.
 */
function applyStereoWidth(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
): { left: Float32Array; right: Float32Array } {
  const n = left.length;
  const mid = new Float32Array(n);
  const side = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    mid[i] = (left[i]! + right[i]!) * 0.5;
    side[i] = (left[i]! - right[i]!) * 0.5;
  }
  const sideHp = highPassOnePole(side, sampleRate, MASTER_WIDTH_SIDE_HP_HZ);
  const outL = new Float32Array(n);
  const outR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = sideHp[i]! * MASTER_WIDTH_SIDE_GAIN;
    outL[i] = mid[i]! + s;
    outR[i] = mid[i]! - s;
  }
  return { left: outL, right: outR };
}

/** Look-ahead peak limiter (5 ms lookahead, 60 ms release), stereo-linked. */
function limitPeak(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  ceilingLinear: number,
): { left: Float32Array; right: Float32Array } {
  const lookAheadSamples = Math.max(1, Math.round((5 * sampleRate) / 1000));
  const releaseSamples = Math.max(1, Math.round((60 * sampleRate) / 1000));
  const outL = new Float32Array(left.length);
  const outR = new Float32Array(right.length);
  let limiterGain = 1;

  for (let i = 0; i < left.length; i++) {
    const lookAheadEnd = Math.min(left.length, i + lookAheadSamples);
    let maxAhead = 0;
    for (let j = i; j < lookAheadEnd; j++) {
      maxAhead = Math.max(maxAhead, Math.abs(left[j]!), Math.abs(right[j]!));
    }

    if (maxAhead > ceilingLinear) {
      limiterGain = Math.min(ceilingLinear / maxAhead, 1);
    } else {
      limiterGain = Math.min(limiterGain + (1 - limiterGain) / releaseSamples, 1);
    }

    outL[i] = left[i]! * limiterGain;
    outR[i] = right[i]! * limiterGain;
  }
  return { left: outL, right: outR };
}

/**
 * Master a stereo mix: glue compression → gain to target loudness →
 * look-ahead peak limiter → mid/side width → re-limit → re-measure.
 * Defaults: targetLufs -9, ceilingDb -1.
 * Inputs never mutated; output arrays are new.
 * Silence in → silence out, report.gainDb 0.
 */
export function masterStereo(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  opts?: {
    targetLufs?: number;
    ceilingDb?: number;
    /** Style-reference audio for tone match (any channels; averaged). */
    reference?: { channels: Float32Array[]; sampleRate: number };
    /** Genre target for the default tilt when no reference is attached. */
    genre?: GenreId;
  },
): {
  left: Float32Array;
  right: Float32Array;
  report: MasterReport;
} {
  const targetLufs = opts?.targetLufs ?? -9;
  const ceilingDb = opts?.ceilingDb ?? -1;
  const ceilingLinear = Math.pow(10, ceilingDb / 20);

  // Measure source
  const lufsBefore = integratedLufs(left, right, sampleRate);
  if (!Number.isFinite(lufsBefore) || left.length === 0) {
    return {
      left: new Float32Array(left),
      right: new Float32Array(right),
      report: {
        lufsBefore: 0,
        lufsAfter: 0,
        peakDbAfter: ceilingDb,
        gainDb: 0,
        widthApplied: false,
        matchApplied: false,
        maxCorrectionDb: 0,
      },
    };
  }

  let outL = new Float32Array(left);
  let outR = new Float32Array(right);
  let gainDb = 0;

  // Reference tone match (or gentle default tilt) before the compressor.
  let matchApplied = false;
  let maxCorrectionDb = 0;
  const centers = oneThirdOctaveCenters();
  const ref = opts?.reference;
  if (ref?.channels?.length) {
    const refDb = spectrumDb(ref.channels, ref.sampleRate, centers);
    // Closed loop: peaking biquads do not track 1/3-octave averages exactly,
    // so match, re-measure and trim the residual. Cumulative gain per band
    // still respects the ±6 dB (±3 below 60 Hz) clamp.
    const cumulative = centers.map(() => 0);
    let cur = { left: outL, right: outR };
    for (let pass = 0; pass < 2; pass++) {
      const takeDb = spectrumDb([cur.left, cur.right], sampleRate, centers);
      const gains = toneMatchGains(refDb, takeDb, centers);
      const applied = gains.map((g, i) => {
        const limit = centers[i]! < 60 ? 3 : 6;
        const total = Math.max(-limit, Math.min(limit, cumulative[i]! + g));
        const delta = total - cumulative[i]!;
        cumulative[i] = total;
        return delta;
      });
      cur = applyBandGains(cur.left, cur.right, sampleRate, centers, applied);
    }
    outL = cur.left;
    outR = cur.right;
    maxCorrectionDb = cumulative.reduce((m, g) => Math.max(m, Math.abs(g)), 0);
    matchApplied = true;
  } else {
    const filters = GENRE_TONE_TARGETS[opts?.genre ?? 'dnb'] ?? GENRE_TONE_TARGETS.dnb;
    maxCorrectionDb = filters.reduce((m, f) => Math.max(m, Math.abs(f.gainDb)), 0);
    const tilted = applyFilters(outL, outR, sampleRate, filters);
    outL = tilted.left;
    outR = tilted.right;
  }

  // Glue compressor: gentle, stereo-linked, RMS detector
  // Attack 10 ms, release 120 ms, ratio 2:1, threshold 6 dB below track RMS
  const attackSamples = Math.max(1, Math.round((10 * sampleRate) / 1000));
  const releaseSamples = Math.max(1, Math.round((120 * sampleRate) / 1000));
  const windowSamples = Math.max(100, Math.round((200 * sampleRate) / 1000));

  // Measure RMS level
  let sumRms = 0;
  const checkEnd = Math.min(outL.length, windowSamples);
  for (let i = 0; i < checkEnd; i++) {
    sumRms += (outL[i]! * outL[i]! + outR[i]! * outR[i]!) / 2;
  }
  const trackRms = Math.sqrt(sumRms / checkEnd);
  const trackRmsDb = trackRms > 0 ? 20 * Math.log10(trackRms) : -60;
  const threshold = trackRmsDb - 6;

  let gainReductionDb = 0;
  for (let i = 0; i < outL.length; i++) {
    const s = Math.sqrt((outL[i]! * outL[i]! + outR[i]! * outR[i]!) / 2);
    const sDb = s > 0 ? 20 * Math.log10(s) : -60;

    let target = 0;
    if (sDb > threshold + 3) {
      target = (sDb - threshold) * (1 - 0.5); // 2:1 ratio
    } else if (sDb > threshold - 3) {
      // Soft knee
      const t = (sDb - threshold + 3) / 6;
      target = t * t * (sDb - threshold) * (1 - 0.5);
    }

    const coeff = target > gainReductionDb ? 1 / attackSamples : 1 / releaseSamples;
    gainReductionDb = target * coeff + gainReductionDb * (1 - coeff);

    const linearGain = Math.pow(10, -gainReductionDb / 20);
    outL[i] = outL[i]! * linearGain;
    outR[i] = outR[i]! * linearGain;
  }

  // Gain to target loudness (up to 2 passes with iterative correction)
  for (let pass = 0; pass < 2; pass++) {
    const lufs = integratedLufs(outL, outR, sampleRate);
    if (!Number.isFinite(lufs)) break;

    const lufsError = targetLufs - lufs;
    if (Math.abs(lufsError) <= 1) break;

    gainDb += lufsError;
    const gain = Math.pow(10, gainDb / 20);
    for (let i = 0; i < outL.length; i++) {
      outL[i] = (outL[i] || 0) * gain;
      outR[i] = (outR[i] || 0) * gain;
    }
  }

  // Look-ahead peak limiter: 5 ms lookahead, 60 ms release
  const limited = limitPeak(outL, outR, sampleRate, ceilingLinear);

  // Mild stereo width after the limiter, then re-limit to the ceiling.
  const widened = applyStereoWidth(limited.left, limited.right, sampleRate);
  const relimited = limitPeak(widened.left, widened.right, sampleRate, ceilingLinear);

  // Measure final loudness and peak
  const lufsAfter = integratedLufs(relimited.left, relimited.right, sampleRate);
  let peakDbAfter = ceilingDb;
  for (let i = 0; i < relimited.left.length; i++) {
    const s = Math.max(Math.abs(relimited.left[i]!), Math.abs(relimited.right[i]!));
    if (s > 0) {
      const sDb = 20 * Math.log10(s);
      peakDbAfter = Math.max(peakDbAfter, sDb);
    }
  }

  return {
    left: relimited.left,
    right: relimited.right,
    report: {
      lufsBefore: Number.isFinite(lufsBefore) ? lufsBefore : 0,
      lufsAfter: Number.isFinite(lufsAfter) ? lufsAfter : 0,
      peakDbAfter: Number.isFinite(peakDbAfter) ? peakDbAfter : ceilingDb,
      gainDb,
      widthApplied: true,
      matchApplied,
      maxCorrectionDb,
    },
  };
}
