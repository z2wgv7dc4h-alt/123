/**
 * Studio real break layer: sample-exact tiling at the barGrid offset, chaos
 * family choice, tempo gate, and gain.
 */
import { describe, expect, it } from 'vitest';
import {
  tileBreakLoop,
  breakLoopForChaos,
  breakFamilyForChaos,
  breakTempoOk,
  buildStudioBreakLayer,
  clampBreakGainDb,
  STUDIO_BREAK_GAIN_DB_DEFAULT,
} from '../core/audio/studioBreakLayer';
import type { Section } from '../core/types';

const sections: Section[] = [
  { name: 'intro', startBar: 0, lengthBars: 1 },
  { name: 'drop', startBar: 1, lengthBars: 1 },
];

describe('tileBreakLoop (sample-exact)', () => {
  it('tiles only drop bars, aligned to the barGrid offset, with 4 ms fades', () => {
    const samplesPerBar = 1000;
    const sampleRate = 1000; // 4 ms → 4 samples
    const loop = new Float32Array(samplesPerBar).fill(1);
    const out = tileBreakLoop({
      loop,
      sections,
      samplesPerBar,
      totalSamples: 3000,
      offsetSample: 100,
      gain: 1,
      sampleRate,
    });

    const dropStart = 100 + 1 * samplesPerBar; // offset + drop bar
    expect(out[100 + 500]).toBe(0); // intro bar untouched
    expect(out[dropStart + 0]).toBe(0); // fade-in start
    expect(out[dropStart + 1]).toBeCloseTo(1 / 4, 6);
    expect(out[dropStart + 500]).toBe(1); // steady middle
    expect(out[dropStart + 999]).toBeCloseTo(1 / 4, 6); // fade-out tail
    expect(out[dropStart + samplesPerBar]).toBe(0); // next bar not a drop
  });

  it('scales every tiled sample by the gain', () => {
    const samplesPerBar = 1000;
    const loop = new Float32Array(samplesPerBar).fill(1);
    const out = tileBreakLoop({
      loop,
      sections,
      samplesPerBar,
      totalSamples: 3000,
      offsetSample: 0,
      gain: 0.25,
      sampleRate: 1000,
    });
    expect(out[1000 + 500]).toBeCloseTo(0.25, 6);
  });
});

describe('family + tempo', () => {
  it('amen for busy chaos, two-step for tidy', () => {
    expect(breakLoopForChaos(0.5)).toBe('amen_174bpm_1bar');
    expect(breakFamilyForChaos(0.5)).toBe('amen');
    expect(breakLoopForChaos(0.2)).toBe('funky_drummer_174bpm_1bar');
    expect(breakFamilyForChaos(0.2)).toBe('twoStep');
  });

  it('only within ±6 BPM of 174', () => {
    expect(breakTempoOk(174)).toBe(true);
    expect(breakTempoOk(180)).toBe(true);
    expect(breakTempoOk(181)).toBe(false);
    expect(breakTempoOk(165)).toBe(false);
  });

  it('clamps gain dB', () => {
    expect(clampBreakGainDb(-99)).toBe(-18);
    expect(clampBreakGainDb(6)).toBe(0);
    expect(clampBreakGainDb(Number.NaN)).toBe(STUDIO_BREAK_GAIN_DB_DEFAULT);
  });
});

describe('buildStudioBreakLayer', () => {
  const base = {
    totalSamples: 200000,
    sampleRateHz: 48000,
    bpm: 174,
    chaos: 0.2,
    sections,
    samplesPerBar: 66207,
    offsetSec: 0,
  };

  it('skips when disabled or off-tempo', async () => {
    expect(await buildStudioBreakLayer({ ...base, enabled: false })).toBeNull();
    expect(await buildStudioBreakLayer({ ...base, bpm: 181 })).toBeNull();
  });

  it('applies the requested dB gain', async () => {
    const loud = await buildStudioBreakLayer({ ...base, gainDb: -12 });
    const quiet = await buildStudioBreakLayer({ ...base, gainDb: -18 });
    expect(loud).not.toBeNull();
    expect(quiet).not.toBeNull();
    const peak = (a: Float32Array) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    const ratio = peak(quiet!.bus) / peak(loud!.bus);
    expect(ratio).toBeCloseTo(0.501, 2); // 6 dB
    expect(loud!.patternFamily).toBe('twoStep');
  });
});
