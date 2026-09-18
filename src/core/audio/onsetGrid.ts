/**
 * Kick/snare onset vs hard-grid timing (Critic A13 / ACCEPTANCE).
 * Uses onsetEnvelope (spectral-flux proxy) — no Matchering/Pedalboard.
 * StructureMap / hard-grid-v0 remains authority for expected hit times @ 174.
 */
import type { DrumRole, StructureMap } from '../types';
import { onsetEnvelope } from '../styleRef/analyzeAudio';
import { decodeWavChannels } from '../export/wav';

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

/** Decode WAV (16/24/32-bit PCM or 32-bit float, mono or interleaved) → mono + left. */
export function decodeWavToMono(arrayBuffer: ArrayBuffer): DecodedWav {
  const { channels, sampleRate, bitDepth } = decodeWavChannels(arrayBuffer);
  const nFrames = channels[0]?.length ?? 0;
  const left = channels[0] ?? new Float32Array(nFrames);
  const mono = new Float32Array(nFrames);
  for (let i = 0; i < nFrames; i++) {
    let sum = 0;
    for (const ch of channels) sum += ch[i]!;
    mono[i] = sum / channels.length;
  }
  return { mono, left, sampleRateHz: sampleRate, channels: channels.length, bitDepth };
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
