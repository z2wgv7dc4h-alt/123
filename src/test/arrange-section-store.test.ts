/**
 * E-1 store path: arrangeSection decodes the take, splices in the browser and
 * issues ONE repaint edit; the op pushes takeHistory and Undo restores.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RenderResult, Section, StructureMap } from '../core/types';
import { useStudioStore } from '../ui/hooks/useStudioStore';
import { aceStepBackend } from '../core/backends';
import { previewPlayer } from '../core/audio';
import { encodeWav } from '../core/export';

vi.mock('../core/audio', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../core/audio')>();
  return {
    ...orig,
    loadPreviewFromMixer: vi.fn(async () => {}),
    acquireRenderWakeLock: vi.fn(async () => {}),
    releaseRenderWakeLock: vi.fn(async () => {}),
    startRenderHeartbeat: vi.fn(() => ({ stop: () => {} })),
  };
});

const SR = 48000;
const BPM = 120;
const FPB = Math.round((240 / BPM) * SR); // 96000

function structureOf(pairs: Array<[Section['name'], number]>): StructureMap {
  let bar = 0;
  const sections = pairs.map(([name, lengthBars]) => {
    const s: Section = { name, startBar: bar, lengthBars };
    bar += lengthBars;
    return s;
  });
  return {
    version: 'hard-grid-v0',
    bpm: BPM,
    bars: bar,
    ppq: 480,
    samplesPerBar: FPB,
    snapPolicy: 'hard',
    sampleRateHz: SR,
    sections,
    drumRole: {} as StructureMap['drumRole'],
    drums: [],
    bassRole: {} as StructureMap['bassRole'],
    energyCurve: [],
    keyRoot: 'A',
    seed: 5,
  };
}

const baseStructure = structureOf([
  ['intro', 4],
  ['drop', 4],
]);
const channels = [new Float32Array(baseStructure.bars * FPB), new Float32Array(baseStructure.bars * FPB)];
const mixBlob = encodeWav(channels, SR, 16);

const fakeStudioResult = {
  jobId: 'take1',
  seed: 5,
  bpmMeasured: BPM,
  backendId: 'ace-step-1.5',
  stems: [{ id: 'mix', blob: mixBlob, url: 'blob:mix', channels: 2, sampleRateHz: SR, bitDepth: 16, durationSec: 16 }],
  warnings: [],
  structure: baseStructure,
  manifest: { gpuUsed: true, prompt: { energy: 0.7 }, structureVersion: 'hard-grid-v0' },
} as unknown as RenderResult;

describe('store arrangeSection', () => {
  let renderSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(aceStepBackend, 'probe').mockResolvedValue({
      hasGpu: true,
      backend: 'ace-step-1.5',
      notes: [],
      checkpoint: 'acestep-v15-turbo',
    });
    renderSpy = vi
      .spyOn(aceStepBackend, 'render')
      .mockImplementation(
        async (job) =>
          ({ ...fakeStudioResult, jobId: job.jobId, structure: job.structureRef! }) as RenderResult,
      );
    vi.spyOn(previewPlayer, 'loadMix').mockResolvedValue();
    useStudioStore.setState({
      productTier: 'studio',
      aceHasGpu: true,
      backendId: 'ace-step-1.5',
      busy: false,
      result: fakeStudioResult,
      takeHistory: [],
      keepSeed: false,
      editedSections: null,
      vibe: null,
      ownerConfirmed: false,
      previousResult: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('splices then sends one repaint edit, and Undo restores without a re-splice', async () => {
    await useStudioStore.getState().arrangeSection({ kind: 'delete', sectionIndex: 1 });

    expect(renderSpy).toHaveBeenCalledTimes(1);
    const job = renderSpy.mock.calls[0]![0] as {
      edit: { kind: string; source: Blob; startSec: number; endSec: number };
      structureRef: StructureMap;
    };
    expect(job.edit.kind).toBe('repaint');
    expect(job.edit.source).toBeInstanceOf(Blob);
    // Delete the 4-bar drop from an 8-bar take.
    expect(job.structureRef.bars).toBe(4);
    expect(job.structureRef.sections.map((s) => s.name)).toEqual(['intro']);
    expect(useStudioStore.getState().takeHistory.length).toBe(1);

    await useStudioStore.getState().undoTakeEdit();
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(useStudioStore.getState().result).toBe(fakeStudioResult);
    expect(useStudioStore.getState().takeHistory.length).toBe(0);
  });

  it('resize splices once and Undo restores without a render', async () => {
    await useStudioStore.getState().arrangeSection({ kind: 'resize', sectionIndex: 1, lengthBars: 2 });

    expect(renderSpy).toHaveBeenCalledTimes(1);
    const job = renderSpy.mock.calls[0]![0] as { structureRef: StructureMap };
    expect(job.structureRef.bars).toBe(6);
    expect(job.structureRef.sections.map((s) => s.lengthBars)).toEqual([4, 2]);
    expect(useStudioStore.getState().takeHistory.length).toBe(1);

    await useStudioStore.getState().undoTakeEdit();
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(useStudioStore.getState().result).toBe(fakeStudioResult);
    expect(useStudioStore.getState().takeHistory.length).toBe(0);
  });

  it('refuses on a Sketch take without rendering', async () => {
    useStudioStore.setState({ result: { ...fakeStudioResult, backendId: 'offline-stub' } as RenderResult });
    await useStudioStore.getState().arrangeSection({ kind: 'duplicate', sectionIndex: 0 });
    expect(renderSpy).not.toHaveBeenCalled();
  });
});
