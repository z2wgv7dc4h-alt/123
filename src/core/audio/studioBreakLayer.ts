/**
 * Studio real break layer: tiles the repo's licensed 174 BPM break loops
 * under drop sections of a Studio (ACE) mix, using the R-3 bar-grid offset so
 * the loop lands on the real bar lines. Additive and pre-mastering only —
 * the unlayered raw mix stays the edit source.
 */
import type { Section, StructureMap } from '../types';
import { loadBreakLoopMono, type BreakLoopName } from './loadBreakLoop';

/** Loops are cut at 174 BPM; beyond ±6 the tile would need time-stretching. */
export const STUDIO_BREAK_BPM = 174;
export const STUDIO_BREAK_TEMPO_TOLERANCE = 6;
/** Default loop-bus level; UI trim range 0 to -6 dB below/around this. */
export const STUDIO_BREAK_GAIN_DB_DEFAULT = -12;
export const STUDIO_BREAK_GAIN_DB_MIN = -18;
export const STUDIO_BREAK_GAIN_DB_MAX = 0;
const TILE_FADE_SEC = 0.004; // ~4 ms click guard at tile joins
export const STUDIO_BREAK_HP_HZ = 150;

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

export function clampBreakGainDb(db: number): number {
  if (!Number.isFinite(db)) return STUDIO_BREAK_GAIN_DB_DEFAULT;
  return Math.min(STUDIO_BREAK_GAIN_DB_MAX, Math.max(STUDIO_BREAK_GAIN_DB_MIN, db));
}

/** Busy chaos → amen; tidy chaos → two-step (matches Sketch's family choice). */
export function breakLoopForChaos(chaos: number): BreakLoopName {
  return chaos >= 0.34 ? 'amen_174bpm_1bar' : 'funky_drummer_174bpm_1bar';
}

export function breakFamilyForChaos(chaos: number): 'amen' | 'twoStep' {
  return chaos >= 0.34 ? 'amen' : 'twoStep';
}

export function breakTempoOk(bpm: number): boolean {
  return Math.abs(bpm - STUDIO_BREAK_BPM) <= STUDIO_BREAK_TEMPO_TOLERANCE;
}

/** One-pole high-pass (RC), keeps the loop out of the sub band. */
export function highPassMono(
  input: Float32Array,
  sampleRate: number,
  cutoffHz = STUDIO_BREAK_HP_HZ,
): Float32Array {
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

/**
 * Tile a one-bar loop into drop-section bars, aligned to `offsetSample`
 * (barGrid offset). Pure and sample-exact; 4 ms fades at each tile join.
 */
export function tileBreakLoop(opts: {
  loop: Float32Array;
  sections: readonly Section[];
  samplesPerBar: number;
  totalSamples: number;
  offsetSample: number;
  gain: number;
  sampleRate: number;
}): Float32Array {
  const { loop, sections, samplesPerBar, totalSamples, offsetSample, gain, sampleRate } = opts;
  const out = new Float32Array(totalSamples);
  if (gain <= 0 || samplesPerBar <= 0) return out;
  const fade = Math.min(
    Math.max(1, Math.round(TILE_FADE_SEC * sampleRate)),
    Math.floor(samplesPerBar / 2),
  );
  for (const sec of sections) {
    if (sec.name !== 'drop') continue;
    for (let b = 0; b < sec.lengthBars; b++) {
      const barStart = offsetSample + (sec.startBar + b) * samplesPerBar;
      for (let i = 0; i < samplesPerBar; i++) {
        const idx = barStart + i;
        if (idx < 0 || idx >= totalSamples) continue;
        let g = gain;
        if (i < fade) g *= i / fade;
        else if (i >= samplesPerBar - fade) g *= (samplesPerBar - i) / fade;
        out[idx] = out[idx]! + (loop[i] ?? 0) * g;
      }
    }
  }
  return out;
}

export interface StudioBreakLayer {
  /** Mono layer, same length as the mix, ready to add. */
  bus: Float32Array;
  loopName: BreakLoopName;
  patternFamily: 'amen' | 'twoStep';
  gain: number;
  gainDb: number;
  offsetSec: number;
}

/**
 * Build the pre-mastering break layer for a Studio take. Returns null when the
 * layer is off, off-tempo, or the loop asset is unavailable.
 */
export async function buildStudioBreakLayer(opts: {
  totalSamples: number;
  sampleRateHz: number;
  bpm: number;
  chaos: number;
  sections: readonly Section[];
  samplesPerBar: number;
  offsetSec: number;
  gainDb?: number;
  enabled?: boolean;
}): Promise<StudioBreakLayer | null> {
  if (opts.enabled === false) return null;
  if (!breakTempoOk(opts.bpm)) return null;
  const gainDb = clampBreakGainDb(opts.gainDb ?? STUDIO_BREAK_GAIN_DB_DEFAULT);
  const gain = dbToGain(gainDb);
  const loopName = breakLoopForChaos(opts.chaos);
  let loop: Float32Array;
  try {
    loop = await loadBreakLoopMono(loopName, opts.samplesPerBar);
  } catch {
    return null; // missing asset must never break a render
  }
  const offsetSample = Math.round(opts.offsetSec * opts.sampleRateHz);
  const tiled = tileBreakLoop({
    loop,
    sections: opts.sections,
    samplesPerBar: opts.samplesPerBar,
    totalSamples: opts.totalSamples,
    offsetSample,
    gain,
    sampleRate: opts.sampleRateHz,
  });
  return {
    bus: highPassMono(tiled, opts.sampleRateHz),
    loopName,
    patternFamily: breakFamilyForChaos(opts.chaos),
    gain,
    gainDb,
    offsetSec: opts.offsetSec,
  };
}

/** Convenience for the backend: does this structure have any drop bars? */
export function hasDropSections(structure: Pick<StructureMap, 'sections'>): boolean {
  return structure.sections.some((s) => s.name === 'drop' && s.lengthBars > 0);
}
