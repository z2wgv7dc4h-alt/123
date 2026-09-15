/**
 * Browser-local style reference analysis.
 * File API + Web Audio decode only — never fetches external / YouTube / catalog audio.
 * Pure helpers (Float32Array in → metrics out) are Node-testable without AudioContext.
 */

import type { StyleReferenceAnalysis } from '../types';
import { bufferRms } from '../audio/waveformPeaks';

export const STYLE_REF_ACCEPT =
  'audio/mpeg,audio/mp3,audio/wav,audio/wave,audio/x-wav,audio/flac,audio/x-flac,.mp3,.wav,.flac';

const ALLOWED_EXT = new Set(['mp3', 'wav', 'flac']);
const ALLOWED_MIME_PREFIXES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/flac', 'audio/x-flac'];

/** Product DnB band used when nudging tempo from a reference. */
export const STYLE_BPM_BAND = { min: 170, max: 176 } as const;

export function isAllowedStyleAudioFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
  if (ALLOWED_EXT.has(ext)) return true;
  const mime = (file.type || '').toLowerCase();
  return ALLOWED_MIME_PREFIXES.some((p) => mime === p || mime.startsWith(p + ';'));
}

/** Downmix AudioBuffer-like channel data to mono (copy). */
export function toMono(channels: Float32Array[]): Float32Array {
  if (!channels.length) return new Float32Array(0);
  const len = channels[0]!.length;
  if (channels.length === 1) return channels[0]!.slice();
  const out = new Float32Array(len);
  const n = channels.length;
  for (let i = 0; i < len; i++) {
    let s = 0;
    for (let c = 0; c < n; c++) s += channels[c]![i] ?? 0;
    out[i] = s / n;
  }
  return out;
}

export function peakAbs(mono: Float32Array): number {
  let p = 0;
  for (let i = 0; i < mono.length; i++) p = Math.max(p, Math.abs(mono[i]!));
  return p;
}

/**
 * Rough energy 0..1 from RMS relative to a soft ceiling.
 * Quiet files stay low; hot masters approach 1 without hard clipping the UI.
 */
export function estimateEnergyFromRms(rms: number): number {
  // ~-24 dBFS ≈ 0.063 → mid; ~-12 dBFS ≈ 0.25 → high
  const mapped = Math.log10(1 + rms * 18) / Math.log10(1 + 18);
  return Math.min(1, Math.max(0, mapped));
}

/**
 * Onset-strength envelope via spectral-flux proxy (frame RMS deltas).
 * Cheap CPU — good enough for a rough BPM guess in-browser.
 */
export function onsetEnvelope(
  mono: Float32Array,
  sampleRateHz: number,
  hopSec = 0.01,
): Float32Array {
  const hop = Math.max(1, Math.floor(sampleRateHz * hopSec));
  const frame = hop * 4;
  if (mono.length < frame + hop) return new Float32Array(0);
  const nFrames = Math.floor((mono.length - frame) / hop);
  const env = new Float32Array(nFrames);
  let prev = 0;
  for (let f = 0; f < nFrames; f++) {
    const start = f * hop;
    let sum = 0;
    for (let i = 0; i < frame; i++) {
      const x = mono[start + i]!;
      sum += x * x;
    }
    const rms = Math.sqrt(sum / frame);
    const flux = Math.max(0, rms - prev);
    env[f] = flux;
    prev = rms * 0.85 + prev * 0.15;
  }
  return env;
}

/**
 * Autocorrelation BPM estimate in [bpmMin, bpmMax].
 * Returns null if signal is too short / silent / ambiguous.
 */
export function estimateBpmFromMono(
  mono: Float32Array,
  sampleRateHz: number,
  bpmMin = 70,
  bpmMax = 200,
): number | null {
  if (!mono.length || sampleRateHz <= 0) return null;
  const rms = bufferRms(mono);
  if (rms < 1e-5) return null;

  const hopSec = 0.01;
  const env = onsetEnvelope(mono, sampleRateHz, hopSec);
  if (env.length < 64) return null;

  // Mean-center
  let mean = 0;
  for (let i = 0; i < env.length; i++) mean += env[i]!;
  mean /= env.length;
  const centered = new Float32Array(env.length);
  for (let i = 0; i < env.length; i++) centered[i] = env[i]! - mean;

  const minLag = Math.max(1, Math.floor(60 / (bpmMax * hopSec)));
  const maxLag = Math.min(centered.length - 1, Math.ceil(60 / (bpmMin * hopSec)));
  if (maxLag <= minLag) return null;

  let bestLag = minLag;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    const n = centered.length - lag;
    for (let i = 0; i < n; i++) corr += centered[i]! * centered[i + lag]!;
    corr /= n;
    if (corr > bestScore) {
      bestScore = corr;
      bestLag = lag;
    }
  }
  if (bestScore <= 0) return null;

  let bpm = 60 / (bestLag * hopSec);
  // Prefer DnB double-time / half-time into product-ish range when obvious
  // Threshold 100 (not 85): 87 half-time of 174 must fold up
  while (bpm < 100 && bpm * 2 <= bpmMax) bpm *= 2;
  while (bpm > 190 && bpm / 2 >= bpmMin) bpm /= 2;

  if (bpm < bpmMin || bpm > bpmMax) return null;
  return Math.round(bpm * 10) / 10;
}

/** Clamp a reference BPM into the product UI band, or null if far outside. */
export function nudgeBpmTowardReference(
  currentBpm: number,
  estimatedBpm: number | null,
  intensity: number,
): number {
  if (estimatedBpm == null || intensity <= 0) return currentBpm;
  // Map half-time (~87) / double into band when close
  let target = estimatedBpm;
  if (target < 100) target *= 2;
  if (target > 200) target /= 2;
  if (target < STYLE_BPM_BAND.min - 8 || target > STYLE_BPM_BAND.max + 8) {
    // Far outside DnB band — keep product tempo; reference still biases energy/timbre
    return currentBpm;
  }
  target = Math.max(STYLE_BPM_BAND.min, Math.min(STYLE_BPM_BAND.max, target));
  const blended = currentBpm + (target - currentBpm) * Math.min(1, intensity);
  return Math.round(Math.max(STYLE_BPM_BAND.min, Math.min(STYLE_BPM_BAND.max, blended)));
}

/** Blend UI energy with reference energy by intensity. */
export function blendEnergy(uiEnergy: number, refEnergy: number, intensity: number): number {
  const t = Math.min(1, Math.max(0, intensity));
  return Math.min(1, Math.max(0, uiEnergy * (1 - t * 0.85) + refEnergy * t * 0.85));
}

export function analyzeMonoBuffer(
  mono: Float32Array,
  sampleRateHz: number,
  channels: number,
): StyleReferenceAnalysis {
  const rms = bufferRms(mono);
  return {
    durationSec: mono.length / sampleRateHz,
    estimatedBpm: estimateBpmFromMono(mono, sampleRateHz),
    energy: estimateEnergyFromRms(rms),
    peak: peakAbs(mono),
    sampleRateHz,
    channels,
  };
}

/**
 * Decode a user File via Web Audio (browser only).
 * Yields to the event loop between decode and analysis so Generate UI stays responsive.
 */
export async function analyzeStyleReferenceFile(file: File): Promise<{
  analysis: StyleReferenceAnalysis;
  arrayBuffer: ArrayBuffer;
  blob: Blob;
}> {
  if (!isAllowedStyleAudioFile(file)) {
    throw new Error('Style reference must be an MP3, WAV, or FLAC you own (browser upload only).');
  }
  const arrayBuffer = await file.arrayBuffer();
  // Copy for decodeAudioData (some browsers detach the original)
  const copy = arrayBuffer.slice(0);

  const AC =
    typeof AudioContext !== 'undefined'
      ? AudioContext
      : (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) {
    throw new Error('Web Audio is required to analyze a style reference in this browser.');
  }

  const ctx = new AC();
  let audioBuf: AudioBuffer;
  try {
    audioBuf = await ctx.decodeAudioData(copy);
  } finally {
    await ctx.close().catch(() => undefined);
  }

  // Yield so UI can paint before CPU analysis
  await new Promise<void>((r) => setTimeout(r, 0));

  const chans: Float32Array[] = [];
  for (let c = 0; c < audioBuf.numberOfChannels; c++) {
    chans.push(audioBuf.getChannelData(c));
  }
  // Cap analysis window (~45s) so long files don't freeze the tab
  const maxSamples = Math.min(chans[0]!.length, Math.floor(audioBuf.sampleRate * 45));
  const clipped = chans.map((ch) => ch.subarray(0, maxSamples));
  const mono = toMono(clipped);
  const analysis = analyzeMonoBuffer(mono, audioBuf.sampleRate, audioBuf.numberOfChannels);
  // Restore true duration even if we truncated analysis
  analysis.durationSec = audioBuf.duration;

  return {
    analysis,
    arrayBuffer,
    blob: new Blob([arrayBuffer], { type: file.type || 'audio/mpeg' }),
  };
}

/** Peak level in dBFS from linear absolute peak (0..1). */
export function peakDbFromLinear(peak: number): number {
  if (peak < 1e-12) return -120;
  return 20 * Math.log10(peak);
}

/**
 * Clamp a measured BPM into the product DnB band (170–176).
 * Half/double-time folded first when clearly outside.
 * Returns null if still far from the band after folding.
 */
export function clampBpmToDnBBand(measuredBpm: number | null): number | null {
  if (measuredBpm == null || !Number.isFinite(measuredBpm)) return null;
  let t = measuredBpm;
  if (t < 100) t *= 2;
  if (t > 200) t /= 2;
  if (t < STYLE_BPM_BAND.min - 8 || t > STYLE_BPM_BAND.max + 8) return null;
  return Math.round(Math.max(STYLE_BPM_BAND.min, Math.min(STYLE_BPM_BAND.max, t)));
}
