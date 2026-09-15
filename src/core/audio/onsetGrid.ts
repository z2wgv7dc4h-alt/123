/**
 * Kick/snare onset vs hard-grid timing (Critic A13 / ACCEPTANCE).
 * Uses onsetEnvelope (spectral-flux proxy) — no Matchering/Pedalboard.
 * StructureMap / hard-grid-v0 remains authority for expected hit times @ 174.
 */
import type { DrumRole, StructureMap } from '../types';
import { onsetEnvelope } from '../styleRef/analyzeAudio';

/** 2.5 ms hop — fine enough for ≤15 ms median without soft-passing. */
const DEFAULT_HOP_SEC = 0.0025;
const MATCH_WINDOW_SEC = 0.04; // ±40 ms match radius around expected grid hit

export interface DecodedWav {
  mono: Float32Array;
  /** Left channel (undelayed for Haas stems) — preferred for onset timing. */
  left: Float32Array;
  sampleRateHz: number;
  channels: number;
  bitDepth: number;
}

/** Decode PCM WAV (16/24-bit LE, mono or interleaved stereo) → mono + left. */
export function decodeWavToMono(arrayBuffer: ArrayBuffer): DecodedWav {
  const view = new DataView(arrayBuffer);
  if (view.byteLength < 44) throw new Error('WAV too short');
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (riff !== 'RIFF' || wave !== 'WAVE') throw new Error('Not a RIFF/WAVE file');

  let offset = 12;
  let channels = 0;
  let sampleRateHz = 0;
  let bitDepth = 0;
  let dataOffset = -1;
  let dataSize = 0;
  while (offset + 8 <= view.byteLength) {
    const id = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      channels = view.getUint16(body + 2, true);
      sampleRateHz = view.getUint32(body + 4, true);
      bitDepth = view.getUint16(body + 14, true);
    } else if (id === 'data') {
      dataOffset = body;
      dataSize = size;
      break;
    }
    offset = body + size + (size % 2);
  }
  if (!channels || !sampleRateHz || !bitDepth || dataOffset < 0) {
    throw new Error('WAV missing fmt/data');
  }
  if (bitDepth !== 16 && bitDepth !== 24) {
    throw new Error(`Unsupported bit depth ${bitDepth}`);
  }

  const bytesPerSample = bitDepth / 8;
  const frameBytes = bytesPerSample * channels;
  const nFrames = Math.floor(dataSize / frameBytes);
  const left = new Float32Array(nFrames);
  const mono = new Float32Array(nFrames);
  let o = dataOffset;
  for (let i = 0; i < nFrames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      let s: number;
      if (bitDepth === 16) {
        s = view.getInt16(o, true) / 0x8000;
        o += 2;
      } else {
        const b0 = view.getUint8(o);
        const b1 = view.getUint8(o + 1);
        const b2 = view.getUint8(o + 2);
        o += 3;
        let v = b0 | (b1 << 8) | (b2 << 16);
        if (v & 0x800000) v |= ~0xffffff;
        s = v / 0x800000;
      }
      if (c === 0) left[i] = s;
      sum += s;
    }
    mono[i] = sum / channels;
  }
  return { mono, left, sampleRateHz, channels, bitDepth };
}

/** Expected hit times (seconds) from StructureMap hard grid for a drum role. */
export function expectedHitTimesSec(
  structure: StructureMap,
  role: Extract<DrumRole, 'kick' | 'snare'>,
): number[] {
  const plan = structure.drums.find((d) => d.role === role);
  if (!plan) return [];
  const secPerBeat = 60 / structure.bpm;
  return plan.hits.map((h) => (h.bar * 4 + h.beat) * secPerBeat);
}

/**
 * Peak-pick local maxima on an onsetEnvelope (flux) series.
 * Returns times in seconds at frame starts (hop-aligned).
 */
export function peakPickOnsetTimes(
  env: Float32Array,
  hopSec: number,
  opts?: { relativeThreshold?: number; minSeparationSec?: number },
): number[] {
  const relativeThreshold = opts?.relativeThreshold ?? 0.18;
  const minSeparationSec = opts?.minSeparationSec ?? 0.045;
  if (!env.length) return [];

  let peak = 0;
  for (let i = 0; i < env.length; i++) peak = Math.max(peak, env[i]!);
  if (peak < 1e-12) return [];

  const thr = peak * relativeThreshold;
  const minSepFrames = Math.max(1, Math.floor(minSeparationSec / hopSec));
  const picked: { frame: number; value: number }[] = [];

  for (let i = 1; i < env.length - 1; i++) {
    const v = env[i]!;
    if (v < thr) continue;
    if (v < env[i - 1]! || v < env[i + 1]!) continue;
    const last = picked[picked.length - 1];
    if (last && i - last.frame < minSepFrames) {
      if (v > last.value) {
        last.frame = i;
        last.value = v;
      }
      continue;
    }
    picked.push({ frame: i, value: v });
  }
  return picked.map((p) => p.frame * hopSec);
}

/**
 * Sample-accurate refine: first threshold crossing of |x| near a coarse onset.
 * Pulls hop-quantized peaks onto the transient edge (typical Offline stub attack ~1 ms).
 */
export function refineOnsetSec(
  samples: Float32Array,
  sampleRateHz: number,
  coarseSec: number,
  searchRadiusSec = 0.012,
): number {
  const center = Math.round(coarseSec * sampleRateHz);
  const radius = Math.max(1, Math.round(searchRadiusSec * sampleRateHz));
  const start = Math.max(1, center - radius);
  const end = Math.min(samples.length - 1, center + radius);

  let localPeak = 0;
  for (let i = start; i <= end; i++) {
    localPeak = Math.max(localPeak, Math.abs(samples[i]!));
  }
  if (localPeak < 1e-8) return coarseSec;

  const thr = localPeak * 0.22;
  // Prefer rising edge just before coarse peak
  for (let i = start; i <= end; i++) {
    if (Math.abs(samples[i]!) >= thr) {
      return i / sampleRateHz;
    }
  }
  return coarseSec;
}

/** Detect onset times (sec) from a mono/left buffer via onsetEnvelope + sample refine. */
export function detectOnsetTimesSec(
  samples: Float32Array,
  sampleRateHz: number,
  opts?: { hopSec?: number; relativeThreshold?: number; minSeparationSec?: number },
): number[] {
  const hopSec = opts?.hopSec ?? DEFAULT_HOP_SEC;
  const env = onsetEnvelope(samples, sampleRateHz, hopSec);
  const coarse = peakPickOnsetTimes(env, hopSec, opts);
  return coarse.map((t) => refineOnsetSec(samples, sampleRateHz, t));
}

/** Absolute errors (ms) matching each expected hit to nearest detection within window. */
export function matchAbsErrorsMs(
  expectedSec: number[],
  detectedSec: number[],
  matchWindowSec = MATCH_WINDOW_SEC,
): { errorsMs: number[]; matched: number; missed: number } {
  const errorsMs: number[] = [];
  let missed = 0;
  for (const e of expectedSec) {
    let best = Infinity;
    for (const d of detectedSec) {
      const abs = Math.abs(d - e);
      if (abs < best) best = abs;
    }
    if (!Number.isFinite(best) || best > matchWindowSec) {
      missed++;
      continue;
    }
    errorsMs.push(best * 1000);
  }
  return { errorsMs, matched: errorsMs.length, missed };
}

export function median(values: number[]): number {
  if (!values.length) return NaN;
  const a = [...values].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 === 1 ? a[mid]! : (a[mid - 1]! + a[mid]!) / 2;
}

export interface OnsetGridRoleReport {
  role: 'kick' | 'snare';
  expectedCount: number;
  detectedCount: number;
  matched: number;
  missed: number;
  medianAbsErrorMs: number;
  maxAbsErrorMs: number;
  errorsMs: number[];
}

export interface OnsetGridReport {
  sampleRateHz: number;
  bpm: number;
  hopSec: number;
  kick: OnsetGridRoleReport;
  snare: OnsetGridRoleReport;
  /** Combined kick+snare matched errors median (ms). */
  combinedMedianAbsErrorMs: number;
}

function reportRole(
  role: 'kick' | 'snare',
  structure: StructureMap,
  samples: Float32Array,
  sampleRateHz: number,
  hopSec: number,
): OnsetGridRoleReport {
  const expected = expectedHitTimesSec(structure, role);
  const detected = detectOnsetTimesSec(samples, sampleRateHz, {
    hopSec,
    minSeparationSec: role === 'kick' ? 0.05 : 0.07,
    relativeThreshold: 0.16,
  });
  const { errorsMs, matched, missed } = matchAbsErrorsMs(expected, detected);
  return {
    role,
    expectedCount: expected.length,
    detectedCount: detected.length,
    matched,
    missed,
    medianAbsErrorMs: median(errorsMs),
    maxAbsErrorMs: errorsMs.length ? Math.max(...errorsMs) : NaN,
    errorsMs,
  };
}

/**
 * Measure kick + snare median |onset − grid| from stem samples + StructureMap.
 * Prefer left/undelayed channel for Haas-encoded stems (snare).
 * Structure authority: hard-grid-v0 @ structure.bpm (product 174).
 */
export function measureKickSnareOnsetGrid(args: {
  structure: StructureMap;
  kickMono: Float32Array;
  snareMono: Float32Array;
  sampleRateHz: number;
  hopSec?: number;
}): OnsetGridReport {
  const hopSec = args.hopSec ?? DEFAULT_HOP_SEC;
  const kick = reportRole('kick', args.structure, args.kickMono, args.sampleRateHz, hopSec);
  const snare = reportRole('snare', args.structure, args.snareMono, args.sampleRateHz, hopSec);
  const combined = [...kick.errorsMs, ...snare.errorsMs];
  return {
    sampleRateHz: args.sampleRateHz,
    bpm: args.structure.bpm,
    hopSec,
    kick,
    snare,
    combinedMedianAbsErrorMs: median(combined),
  };
}

/** A13 gate: median abs error must be ≤ 15 ms @ 48 kHz (hard fail — no soft band). */
export const ONSET_GRID_MEDIAN_MAX_MS = 15;
