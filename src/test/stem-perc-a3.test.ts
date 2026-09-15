/**
 * Critic A3 — perc stem honesty (stem-v0). Soft-pass forbidden.
 * Gates: StemId+WAV, mixer/compact elemental, mix_as_heard remix includes perc when unmuted.
 * Critic P1 follow-up (does NOT reopen A3): empty perc hits → no silent perc.wav + omit note.
 */
import { describe, expect, it } from 'vitest';
import { offlineStubBackend } from '../core/backends';
import { structureEngine } from '../core/structure';
import { structureToMidiBlob } from '../core/midi';
import { audibleStemIds } from '../core/audio';
import { DEFAULT_BPM, DEFAULT_SAMPLE_RATE, type StemId } from '../core/types';
import {
  ELEMENTAL_STEM_IDS,
  resolveRemixStemIds,
  REMIX_STEM_IDS,
} from '../ui/hooks/useStudioStore';

const CORE_STEM_IDS = ['kick', 'snare', 'hats', 'bass', 'drums', 'mix'] as const;
const STEM_IDS: StemId[] = [...REMIX_STEM_IDS, 'mix'];

describe('A3 perc stem honesty (stem-v0)', () => {
  it('schema+render: perc StemId+WAV when structure has perc hits; core stems intact', async () => {
    const seed = 17403;
    const structure = await structureEngine.plan({
      seed,
      bpm: DEFAULT_BPM,
      bars: 32,
      energy: 0.8,
      breakDensity: 0.55,
      darkness: 0.4,
      chaos: 0.45,
    });

    const percPlan = structure.drums.find((d) => d.role === 'perc');
    expect(percPlan).toBeTruthy();
    expect(percPlan!.hits.length).toBeGreaterThan(0);

    expect(structureToMidiBlob(structure).size).toBeGreaterThan(20);

    const result = await offlineStubBackend.render({
      jobId: 'a3_perc',
      seed,
      bpm: DEFAULT_BPM,
      bpmTolerance: 2,
      durationBars: 32,
      sampleRateHz: DEFAULT_SAMPLE_RATE,
      bitDepth: 16,
      channels: 2,
      prompt: { descriptors: ['a3-perc'], energy: 0.8, darkness: 0.4, chaos: 0.45 },
      stemSchemaVersion: 'v0',
      structureRef: structure,
    });

    expect(result.manifest.schemaVersion).toBe('stem-v0');
    expect(result.manifest.productTier).toBe('sketch');
    expect(result.manifest.gpuUsed).toBe(false);

    for (const id of CORE_STEM_IDS) {
      const stem = result.stems.find((s) => s.id === id);
      expect(stem, `missing core stem ${id}`).toBeTruthy();
      expect(stem!.blob, `core stem ${id} blob`).toBeTruthy();
      expect(stem!.blob!.size).toBeGreaterThan(44);
    }

    const percStem = result.stems.find((s) => s.id === 'perc');
    expect(percStem, 'perc StemId missing').toBeTruthy();
    expect(percStem!.blob, 'perc WAV blob').toBeTruthy();
    expect(percStem!.blob!.size).toBeGreaterThan(44);
    expect(percStem!.sampleRateHz).toBe(48000);

    const manifestPerc = result.manifest.stems.find((s) => s.id === 'perc');
    expect(manifestPerc?.path).toBe('perc.wav');

    const notes = result.manifest.notes ?? [];
    expect(notes.some((n) => /drums bus.*0\.85/i.test(n))).toBe(true);
    expect(notes.some((n) => /perc StemId/i.test(n))).toBe(true);

    expect(result.backendId).toBe('offline-stub');
    expect(result.warnings.some((w) => /Studio/i.test(w))).toBe(true);
  });

  it('compact+full mixer: perc is elemental; remix includes perc when unmuted', () => {
    expect(ELEMENTAL_STEM_IDS).toContain('perc');
    expect(ELEMENTAL_STEM_IDS).toEqual(['kick', 'snare', 'hats', 'perc', 'bass']);

    const unmuted = audibleStemIds({}, {}, STEM_IDS);
    expect(unmuted).toContain('perc');
    const remix = resolveRemixStemIds(unmuted);
    expect(remix).toContain('perc');
    expect(remix).toEqual(['kick', 'snare', 'hats', 'perc', 'bass']);

    const mutePerc = audibleStemIds({ perc: true }, {}, STEM_IDS);
    expect(mutePerc).not.toContain('perc');
    expect(resolveRemixStemIds(mutePerc)).not.toContain('perc');
  });

  it('default OfflineStub stem set keeps kick/snare/hats/bass/drums/mix + perc', async () => {
    const result = await offlineStubBackend.render({
      jobId: 'a3_core_order',
      seed: 99,
      bpm: DEFAULT_BPM,
      bpmTolerance: 2,
      durationBars: 16,
      sampleRateHz: DEFAULT_SAMPLE_RATE,
      bitDepth: 16,
      channels: 2,
      prompt: { descriptors: ['core'], energy: 0.6, darkness: 0.4 },
      stemSchemaVersion: 'v0',
    });
    const ids = result.stems.map((s) => s.id);
    for (const id of CORE_STEM_IDS) {
      expect(ids).toContain(id);
    }
    expect(ids).toContain('perc');
    expect(result.structure?.drums.some((d) => d.role === 'perc')).toBe(true);
  });

  /** Critic P1 follow-up (does not reopen A3): empty perc hits omit stem + note. Soft-pass forbidden. */
  it('empty perc hits: no perc stem / no silent perc.wav + schema omit note (structureHasPerc = percHits > 0)', async () => {
    const seed = 17403;
    const planned = await structureEngine.plan({
      seed,
      bpm: DEFAULT_BPM,
      bars: 32,
      energy: 0.8,
      breakDensity: 0.55,
      darkness: 0.4,
      chaos: 0.45,
    });

    const structure = {
      ...planned,
      drums: planned.drums.map((d) =>
        d.role === 'perc' ? { ...d, hits: [] } : d,
      ),
    };

    const percPlan = structure.drums.find((d) => d.role === 'perc');
    expect(percPlan).toBeTruthy();
    expect(percPlan!.hits.length).toBe(0);

    const result = await offlineStubBackend.render({
      jobId: 'a3_perc_empty',
      seed,
      bpm: DEFAULT_BPM,
      bpmTolerance: 2,
      durationBars: 32,
      sampleRateHz: DEFAULT_SAMPLE_RATE,
      bitDepth: 16,
      channels: 2,
      prompt: { descriptors: ['a3-perc-empty'], energy: 0.8, darkness: 0.4, chaos: 0.45 },
      stemSchemaVersion: 'v0',
      structureRef: structure,
    });

    expect(result.manifest.schemaVersion).toBe('stem-v0');

    for (const id of CORE_STEM_IDS) {
      const stem = result.stems.find((s) => s.id === id);
      expect(stem, `missing core stem ${id}`).toBeTruthy();
      expect(stem!.blob, `core stem ${id} blob`).toBeTruthy();
      expect(stem!.blob!.size).toBeGreaterThan(44);
    }

    expect(result.stems.find((s) => s.id === 'perc'), 'silent perc stem must not exist').toBeUndefined();
    expect(result.manifest.stems.find((s) => s.id === 'perc')).toBeUndefined();
    expect(result.manifest.stems.some((s) => s.path === 'perc.wav')).toBe(false);

    const notes = result.manifest.notes ?? [];
    expect(notes.some((n) => /drums bus.*0\.85/i.test(n))).toBe(true);
    expect(notes.some((n) => /no perc hits.*perc WAV omitted/i.test(n))).toBe(true);

    // Mixer still lists perc as elemental (UI); export simply omits empty WAV
    expect(ELEMENTAL_STEM_IDS).toContain('perc');
  });
});
