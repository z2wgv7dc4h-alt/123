import { describe, it, expect } from 'vitest';
import {
  offlineStubBackend,
  buildRealBreakBus,
  breakLoopNameForFamily,
  REAL_BREAK_GAIN,
} from '../core/backends/OfflineStubBackend';
import { structureEngine } from '../core/structure/StructureEngine';
import { DEFAULT_BIT_DEPTH, DEFAULT_BPM, DEFAULT_SAMPLE_RATE } from '../core/types';

/**
 * `src/test/break-loop.test.ts` covers the WAV decoder and loader in
 * isolation. Nothing covered the integration point: that the real break
 * actually reaches the rendered mix, only inside drop bars, and that the
 * export manifest admits it. Without this, deleting the `buildRealBreakBus`
 * call in `render()` would pass the whole suite.
 */
async function planFor(seed: number, songShape = 'classic') {
  return structureEngine.plan({
    seed,
    bpm: 174,
    bars: 32,
    energy: 0.75,
    darkness: 0.45,
    chaos: 0.25,
    breakDensity: 0.55,
    sampleRateHz: 48000,
    songShape,
  });
}

async function findSeedForFamily(target: string): Promise<number> {
  for (let seed = 1; seed < 200; seed++) {
    const map = await planFor(seed);
    if (map.patternFamily === target) return seed;
  }
  throw new Error(`no seed found for pattern family ${target}`);
}

function renderJob(seed: number) {
  return {
    jobId: `real-break-${seed}`,
    seed,
    bpm: DEFAULT_BPM,
    bpmTolerance: 2,
    durationBars: 32,
    sampleRateHz: DEFAULT_SAMPLE_RATE,
    bitDepth: DEFAULT_BIT_DEPTH,
    channels: 2,
    songShape: 'classic' as const,
    prompt: {
      descriptors: [],
      energy: 0.75,
      darkness: 0.45,
      chaos: 0.25,
      text: 'energetic dancefloor drum and bass',
    },
    stemSchemaVersion: 'v0' as const,
  };
}

describe('buildRealBreakBus', () => {
  it('maps only amen/twoStep families to a loop; syncopated stays pure synth', () => {
    expect(breakLoopNameForFamily('amen')).toBe('amen_174bpm_1bar');
    expect(breakLoopNameForFamily('twoStep')).toBe('funky_drummer_174bpm_1bar');
    expect(breakLoopNameForFamily('syncopated')).toBeNull();
  });

  it('returns null for a family with no break, so nothing is blended', async () => {
    const map = await planFor(await findSeedForFamily('amen'));
    const bus = await buildRealBreakBus(
      'syncopated',
      map.sections,
      map.bars,
      map.samplesPerBar,
    );
    expect(bus).toBeNull();
  });

  it('writes audio into drop bars only, leaving every other bar silent', async () => {
    const seed = await findSeedForFamily('amen');
    const map = await planFor(seed);
    const result = await buildRealBreakBus('amen', map.sections, map.bars, map.samplesPerBar);
    expect(result).not.toBeNull();
    const { bus } = result!;

    const barPeak = (bar: number) => {
      let peak = 0;
      const start = bar * map.samplesPerBar;
      for (let i = 0; i < map.samplesPerBar; i++) peak = Math.max(peak, Math.abs(bus[start + i]!));
      return peak;
    };

    const dropBars: number[] = [];
    const otherBars: number[] = [];
    for (let bar = 0; bar < map.bars; bar++) {
      const sec = [...map.sections].reverse().find((s) => bar >= s.startBar)!;
      (sec.name === 'drop' ? dropBars : otherBars).push(bar);
    }

    expect(dropBars.length, 'plan produced no drop bars').toBeGreaterThan(0);
    for (const bar of dropBars) expect(barPeak(bar), `drop bar ${bar} silent`).toBeGreaterThan(0.01);
    for (const bar of otherBars) expect(barPeak(bar), `non-drop bar ${bar} not silent`).toBe(0);
  });

  it('honours a zero gain as "disabled"', async () => {
    const map = await planFor(await findSeedForFamily('amen'));
    const bus = await buildRealBreakBus('amen', map.sections, map.bars, map.samplesPerBar, 0);
    expect(bus).toBeNull();
  });

  it('scales output by the requested gain', async () => {
    const seed = await findSeedForFamily('amen');
    const map = await planFor(seed);
    const loud = await buildRealBreakBus('amen', map.sections, map.bars, map.samplesPerBar, REAL_BREAK_GAIN);
    const quiet = await buildRealBreakBus('amen', map.sections, map.bars, map.samplesPerBar, REAL_BREAK_GAIN / 4);
    const peak = (a: Float32Array) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(peak(quiet!.bus)).toBeLessThan(peak(loud!.bus));
  });
});

describe('real break reaches the rendered mix + manifest', () => {
  it('labels the manifest when a real loop was blended in', async () => {
    const seed = await findSeedForFamily('amen');
    const result = await offlineStubBackend.render(renderJob(seed));
    expect(result.manifest.realBreakLoop).toBeDefined();
    expect(result.manifest.realBreakLoop?.used).toBe(true);
    expect(result.manifest.realBreakLoop?.loopName).toBe('amen_174bpm_1bar');
    expect(result.manifest.realBreakLoop?.patternFamily).toBe('amen');
    expect(result.manifest.realBreakLoop?.note).toMatch(/not 100% synthesized/i);
  }, 20000);

  it('omits the label entirely when no real loop was used', async () => {
    const seed = await findSeedForFamily('syncopated');
    const result = await offlineStubBackend.render(renderJob(seed));
    expect(result.manifest.realBreakLoop).toBeUndefined();
  }, 20000);
});

describe('real break layer toggle (opt-out)', () => {
  it('layers.realBreak === false disables the blend and drops the manifest label', async () => {
    const seed = await findSeedForFamily('amen');
    const off = await offlineStubBackend.render({
      ...renderJob(seed),
      layers: { realBreak: false },
    });
    expect(off.manifest.realBreakLoop).toBeUndefined();
  }, 20000);

  it('omitting layers keeps the blend on — it shipped always-on, absence must not disable it', async () => {
    const seed = await findSeedForFamily('amen');
    const on = await offlineStubBackend.render(renderJob(seed));
    expect(on.manifest.realBreakLoop?.used).toBe(true);
  }, 20000);
});
