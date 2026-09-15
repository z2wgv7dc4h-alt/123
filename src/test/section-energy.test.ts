/**
 * Critic A7 — automated drop section RMS > intro gate.
 * OfflineStub CPU only; energyCurve drives gains. Soft-pass forbidden.
 */
import { describe, expect, it } from 'vitest';
import {
  offlineStubBackend,
  sampleEnergyCurve,
  applyEnergyCurveGains,
} from '../core/backends';
import {
  decodeWavToMono,
  DROP_INTRO_RMS_MIN_RATIO,
  measureDropVsIntroRms,
  findSection,
} from '../core/audio';
import {
  DEFAULT_BIT_DEPTH,
  DEFAULT_BPM,
  DEFAULT_SAMPLE_RATE,
  type StructureMap,
} from '../core/types';

if (typeof URL.createObjectURL !== 'function') {
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () =>
    'node://blob';
  (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
}

/** Fixed seed/structure for A7 — same as A13 sample path for reproducibility. */
const SEED = 17400;
const BARS = 32;

const RENDER_JOB = {
  seed: SEED,
  bpm: DEFAULT_BPM,
  bpmTolerance: 2,
  durationBars: BARS,
  sampleRateHz: DEFAULT_SAMPLE_RATE,
  bitDepth: DEFAULT_BIT_DEPTH,
  channels: 2 as const,
  prompt: {
    descriptors: ['energetic dancefloor drum and bass'],
    energy: 0.75,
    darkness: 0.45,
    chaos: 0.2,
  },
  stemSchemaVersion: 'v0' as const,
};

describe('Critic A7: drop RMS > intro (energyCurve)', () => {
  it('applyEnergyCurveGains: constant buffer → drop window louder than intro', () => {
    // Minimal structure with known curve levels (intro low, drop high)
    const spb = 100;
    const bars = 16;
    const structure: StructureMap = {
      version: 'hard-grid-v0',
      bpm: 174,
      bars,
      ppq: 480,
      samplesPerBar: spb,
      snapPolicy: 'hard',
      sampleRateHz: 48000,
      sections: [
        { name: 'intro', startBar: 0, lengthBars: 4 },
        { name: 'build', startBar: 4, lengthBars: 4 },
        { name: 'drop', startBar: 8, lengthBars: 4 },
        { name: 'break', startBar: 12, lengthBars: 2 },
        { name: 'outro', startBar: 14, lengthBars: 2 },
      ],
      drumRole: { role: 'kick', hits: [] },
      drums: [],
      bassRole: { notes: [], character: 'sub' },
      energyCurve: [
        { bar: 0, level: 0.35 },
        { bar: 2, level: 0.4 },
        { bar: 3, level: 0.38 },
        { bar: 4, level: 0.55 },
        { bar: 6, level: 0.65 },
        { bar: 7, level: 0.62 },
        { bar: 8, level: 0.95 },
        { bar: 10, level: 1.0 },
        { bar: 11, level: 0.95 },
        { bar: 12, level: 0.35 },
        { bar: 14, level: 0.3 },
      ],
      keyRoot: 'Am',
      seed: SEED,
    };

    const n = bars * spb;
    const flat = () => new Float32Array(n).fill(0.2);
    const buffers = {
      kick: flat(),
      snare: flat(),
      hats: flat(),
      bass: flat(),
      perc: flat(),
    };
    applyEnergyCurveGains(buffers, structure);

    const intro = findSection(structure, 'intro')!;
    const drop = findSection(structure, 'drop')!;
    const eIntro = sampleEnergyCurve(structure.energyCurve, intro.startBar + intro.lengthBars / 2);
    const eDrop = sampleEnergyCurve(structure.energyCurve, drop.startBar + drop.lengthBars / 2);
    expect(eDrop).toBeGreaterThan(eIntro);

    const kickReport = measureDropVsIntroRms({
      structure,
      mono: buffers.kick,
      sampleRateHz: structure.sampleRateHz,
    });
    expect(kickReport.intro.rms).toBeGreaterThan(0);
    expect(kickReport.drop.rms).toBeGreaterThan(kickReport.intro.rms);
    expect(kickReport.ratio).toBeGreaterThanOrEqual(DROP_INTRO_RMS_MIN_RATIO);
    expect(kickReport.passes).toBe(true);
  });

  it(
    'OfflineStub seed-stable mix+kick: drop section RMS ≥ intro × 1.25',
    async () => {
      const result = await offlineStubBackend.render({
        ...RENDER_JOB,
        jobId: 'a7_drop_intro_rms',
      });

      expect(result.structure?.version).toBe('hard-grid-v0');
      expect(result.structure?.bpm).toBe(174);
      expect(result.bpmMeasured).toBe(174);

      const structure = result.structure!;
      const intro = findSection(structure, 'intro');
      const drop = findSection(structure, 'drop');
      expect(intro).toBeTruthy();
      expect(drop).toBeTruthy();
      expect(intro!.lengthBars).toBeGreaterThan(0);
      expect(drop!.lengthBars).toBeGreaterThan(0);

      // energyCurve itself must place drop above intro (gain driver)
      const eIntro = sampleEnergyCurve(
        structure.energyCurve,
        intro!.startBar + intro!.lengthBars / 2,
      );
      const eDrop = sampleEnergyCurve(
        structure.energyCurve,
        drop!.startBar + drop!.lengthBars / 2,
      );
      expect(eDrop).toBeGreaterThan(eIntro);

      const mixStem = result.stems.find((s) => s.id === 'mix');
      const kickStem = result.stems.find((s) => s.id === 'kick');
      expect(mixStem?.blob).toBeTruthy();
      expect(kickStem?.blob).toBeTruthy();

      const mixWav = decodeWavToMono(await mixStem!.blob!.arrayBuffer());
      const kickWav = decodeWavToMono(await kickStem!.blob!.arrayBuffer());
      expect(mixWav.sampleRateHz).toBe(48000);
      expect(kickStem!.sampleRateHz).toBe(48000);

      // Prefer left (undelayed) — mix is effectively mono-summed stereo
      const mixReport = measureDropVsIntroRms({
        structure,
        mono: mixWav.left,
        sampleRateHz: mixWav.sampleRateHz,
      });
      const kickReport = measureDropVsIntroRms({
        structure,
        mono: kickWav.left,
        sampleRateHz: kickWav.sampleRateHz,
      });

      // Hard gate — no soft toBeGreaterThan(1.0)
      expect(mixReport.intro.rms).toBeGreaterThan(1e-6);
      expect(kickReport.intro.rms).toBeGreaterThan(1e-6);
      expect(mixReport.ratio).toBeGreaterThanOrEqual(DROP_INTRO_RMS_MIN_RATIO);
      expect(kickReport.ratio).toBeGreaterThanOrEqual(DROP_INTRO_RMS_MIN_RATIO);
      expect(mixReport.passes).toBe(true);
      expect(kickReport.passes).toBe(true);

      // Seed-stable structure (same seed → same section bounds)
      const again = await offlineStubBackend.render({
        ...RENDER_JOB,
        jobId: 'a7_drop_intro_rms_b',
      });
      expect(JSON.stringify(again.structure?.sections)).toBe(
        JSON.stringify(result.structure?.sections),
      );
      expect(JSON.stringify(again.structure?.energyCurve)).toBe(
        JSON.stringify(result.structure?.energyCurve),
      );

      console.log(
        'A7 drop>intro RMS',
        JSON.stringify({
          seed: SEED,
          bars: structure.bars,
          minRatio: DROP_INTRO_RMS_MIN_RATIO,
          energyMid: { intro: eIntro, drop: eDrop },
          mix: {
            introRms: mixReport.intro.rms,
            dropRms: mixReport.drop.rms,
            ratio: mixReport.ratio,
          },
          kick: {
            introRms: kickReport.intro.rms,
            dropRms: kickReport.drop.rms,
            ratio: kickReport.ratio,
          },
        }),
      );
    },
    120_000,
  );
});
