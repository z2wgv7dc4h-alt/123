/**
 * Candidate take scoring — ranks best-of-N renders without re-rendering.
 * Uses the existing onset grid for tempo, 8-bar RMS for drop contrast,
 * a hard-clip ratio, and spectral tilt vs a per-genre target.
 */
import type { GenreId, StructureMap } from '../types';
import { detectOnsetTimesSec } from './onsetGrid';
import { spectralTiltDb } from './spectrum';

export interface TakeScoreBreakdown {
  /** 0..1 share of onset IOIs landing on the 60/bpm grid. */
  tempoStability: number;
  /** 0..1: loudest 8-bar RMS above the intro window (6 dB → 1.0). */
  dropContrast: number;
  /** 0..1: 1 − clip ratio (0.997 hard-clip threshold). */
  clipping: number;
  /** 0..1: closeness of the high/low tilt to the genre target. */
  spectralTilt: number;
  /** Weighted total 0..1. */
  total: number;
}

export const TAKE_SCORE_WEIGHTS = {
  tempoStability: 0.3,
  dropContrast: 0.3,
  clipping: 0.25,
  spectralTilt: 0.15,
} as const;

/** High-band minus low-band energy (dB) each genre should roughly sit at. */
export const GENRE_TILT_TARGET_DB: Record<GenreId, number> = {
  dnb: -6,
  dubstep: -8,
  halftime: -7,
  jungle: -5,
  trap: -9,
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function toMono(channels: readonly Float32Array[]): Float32Array {
  const n = channels[0]?.length ?? 0;
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (const ch of channels) sum += ch[i] ?? 0;
    mono[i] = sum / channels.length;
  }
  return mono;
}

function rms(samples: Float32Array, start: number, end: number): number {
  if (end <= start) return 0;
  let sum = 0;
  for (let i = start; i < end; i++) sum += samples[i]! * samples[i]!;
  return Math.sqrt(sum / (end - start));
}

function tempoStability(mono: Float32Array, sampleRateHz: number, bpm: number): number {
  const onsets = detectOnsetTimesSec(mono, sampleRateHz, { hopSec: 0.005 });
  if (onsets.length < 3 || bpm <= 0) return 0.5;
  const beat = 60 / bpm;
  let good = 0;
  let total = 0;
  for (let i = 1; i < onsets.length; i++) {
    const ioi = onsets[i]! - onsets[i - 1]!;
    if (ioi <= 0) continue;
    total++;
    const nearest = Math.max(1, Math.round(ioi / beat));
    const dev = Math.abs(ioi - nearest * beat) / beat;
    if (dev <= 0.12) good++;
  }
  return total > 0 ? good / total : 0.5;
}

function dropContrast(mono: Float32Array, sampleRateHz: number, bpm: number): number {
  const windowSec = (8 * 240) / Math.max(1, bpm);
  const winN = Math.max(1, Math.round(windowSec * sampleRateHz));
  const intro = rms(mono, 0, Math.min(winN, mono.length));
  let loudest = 0;
  for (let start = 0; start + winN <= mono.length; start += winN) {
    loudest = Math.max(loudest, rms(mono, start, start + winN));
  }
  if (loudest <= 0) return 0;
  if (intro <= 1e-6) return loudest > 1e-3 ? 1 : 0;
  return clamp01((20 * Math.log10(loudest / intro)) / 6);
}

function clipScore(channels: readonly Float32Array[]): number {
  let clipped = 0;
  let total = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      total++;
      if (Math.abs(ch[i]!) >= 0.997) clipped++;
    }
  }
  if (!total) return 1;
  return clamp01(1 - (clipped / total) * 20);
}

function tiltScore(channels: readonly Float32Array[], sampleRateHz: number, genre: GenreId): number {
  const tilt = spectralTiltDb(channels, sampleRateHz);
  const target = GENRE_TILT_TARGET_DB[genre] ?? GENRE_TILT_TARGET_DB.dnb;
  return clamp01(1 - Math.abs(tilt - target) / 12);
}

export function scoreTake(input: {
  channels: readonly Float32Array[];
  sampleRateHz: number;
  bpm: number;
  genre?: GenreId;
  structure?: StructureMap;
}): TakeScoreBreakdown {
  const { channels, sampleRateHz, bpm } = input;
  const genre = input.genre ?? 'dnb';
  if (!channels.length || !channels[0]!.length) {
    return { tempoStability: 0, dropContrast: 0, clipping: 0, spectralTilt: 0, total: 0 };
  }
  const mono = toMono(channels);
  const t = tempoStability(mono, sampleRateHz, bpm);
  const d = dropContrast(mono, sampleRateHz, bpm);
  const c = clipScore(channels);
  const s = tiltScore(channels, sampleRateHz, genre);
  const total =
    t * TAKE_SCORE_WEIGHTS.tempoStability +
    d * TAKE_SCORE_WEIGHTS.dropContrast +
    c * TAKE_SCORE_WEIGHTS.clipping +
    s * TAKE_SCORE_WEIGHTS.spectralTilt;
  return { tempoStability: t, dropContrast: d, clipping: c, spectralTilt: s, total: clamp01(total) };
}
