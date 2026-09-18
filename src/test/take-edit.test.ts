/**
 * R-2 Studio take edits — Redo section (repaint), Extend last section, Undo edit.
 * Pure planning tests + real store behavior with the ACE backend mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RenderResult, StructureMap } from '../core/types';
import {
  secondsPerBar,
  sectionWindowSec,
  extendStructure,
  planTakeEdit,
  clampRedoStrength,
} from '../ui/lib/takeEdit';
import { useStudioStore } from '../ui/hooks/useStudioStore';
import { aceStepBackend } from '../core/backends';
import { previewPlayer } from '../core/audio';

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

const sections = [
  { name: 'intro' as const, startBar: 0, lengthBars: 8 },
  { name: 'drop' as const, startBar: 8, lengthBars: 16 },
  { name: 'outro' as const, startBar: 24, lengthBars: 8 },
];

function structureOf(secs: StructureMap['sections'], bars: number): StructureMap {
  return {
    version: 'hard-grid-v0',
    bpm: 140,
    bars,
    ppq: 480,
    samplesPerBar: 1,
    snapPolicy: 'hard',
    sampleRateHz: 48000,
    sections: secs.map((s) => ({ ...s })),
    drumRole: {} as StructureMap['drumRole'],
    drums: [],
    bassRole: {} as StructureMap['bassRole'],
    energyCurve: [],
    keyRoot: 'A',
    seed: 5,
  };
}

const baseStructure = structureOf(sections, 32);
const mixBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });

const fakeStudioResult = {
  jobId: 'take1',
  seed: 5,
  bpmMeasured: 140,
  backendId: 'ace-step-1.5',
  stems: [{ id: 'mix', blob: mixBlob }],
  warnings: [],
  waveformPeaks: [],
  structure: baseStructure,
  manifest: {},
} as unknown as RenderResult;

describe('takeEdit pure planning', () => {
  it('secondsPerBar + sectionWindowSec use 0-based bars', () => {
    expect(secondsPerBar(174)).toBeCloseTo(1.37931, 5);
    const winStruct = structureOf(
      [
        { name: 'intro', startBar: 0, lengthBars: 16 },
        { name: 'drop', startBar: 16, lengthBars: 8 },
      ],
      24,
    );
    const w = sectionWindowSec(winStruct, 1, 174);
    expect(w).not.toBeNull();
    expect(w!.startSec).toBeCloseTo((16 * 240) / 174, 5);
    expect(w!.endSec).toBeCloseTo((24 * 240) / 174, 5);
  });

  it('extendStructure grows one section, shifts later ones, grows total bars', () => {
    const out = extendStructure(baseStructure, 1, 8);
    expect(out.sections[1]!.lengthBars).toBe(24);
    expect(out.sections[2]!.startBar).toBe(32);
    expect(out.bars).toBe(40);
    expect(baseStructure.sections[1]!.lengthBars).toBe(16);
  });

  it('planTakeEdit redo repaints the section window on the take', () => {
    const plan = planTakeEdit(fakeStudioResult, { kind: 'redo', sectionIndex: 1 });
    expect(plan).not.toBeNull();
    expect(plan!.edit.kind).toBe('repaint');
    expect(plan!.edit.startSec).toBeCloseTo((8 * 240) / 140, 5);
    expect(plan!.edit.endSec).toBeCloseTo((24 * 240) / 140, 5);
    expect(plan!.edit.source).toBe(mixBlob);
    expect(plan!.seed).toBe(5);
    expect(plan!.bpm).toBe(140);
    expect(plan!.structureRef).toBe(baseStructure);
  });

  it('planTakeEdit redo carries repaint mode + clamped strength', () => {
    const custom = planTakeEdit(fakeStudioResult, {
      kind: 'redo',
      sectionIndex: 1,
      style: { strength: 0.8 },
    });
    expect(custom!.edit.mode).toBe('balanced');
    expect(custom!.edit.strength).toBe(0.8);
    const dflt = planTakeEdit(fakeStudioResult, { kind: 'redo', sectionIndex: 1 });
    expect(dflt!.edit.strength).toBe(0.5);
    expect(clampRedoStrength(0.1)).toBe(0.2);
    expect(clampRedoStrength(5)).toBe(1);
  });

  it('planTakeEdit extend only matches the last section', () => {
    const plan = planTakeEdit(fakeStudioResult, { kind: 'extend', sectionIndex: 2, deltaBars: 16 });
    expect(plan).not.toBeNull();
    expect(plan!.edit.startSec).toBeCloseTo((31 * 240) / 140, 5);
    expect(plan!.edit.endSec).toBeCloseTo((48 * 240) / 140, 5);
    expect(plan!.structureRef.bars).toBe(48);
    expect(planTakeEdit(fakeStudioResult, { kind: 'extend', sectionIndex: 1, deltaBars: 8 })).toBeNull();
  });

  it('planTakeEdit refuses a non-Studio (Sketch) result', () => {
    const sketch = { ...fakeStudioResult, backendId: 'offline-stub' } as RenderResult;
    expect(planTakeEdit(sketch, { kind: 'redo', sectionIndex: 1 })).toBeNull();
  });
});

describe('take edit store actions', () => {
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
      .mockImplementation(async (job) => ({ ...fakeStudioResult, jobId: job.jobId, structure: job.structureRef! }) as RenderResult);
    // Fake 3-byte blob can't decode; the store's preview load must still succeed.
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

  it('redoSection renders a repaint edit, then undo restores the take without a render', async () => {
    await useStudioStore.getState().redoSection(1);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    const job = renderSpy.mock.calls[0]![0] as {
      edit: { kind: string; startSec: number; endSec: number };
      seed: number;
    };
    expect(job.edit.kind).toBe('repaint');
    expect(job.edit.startSec).toBeCloseTo((8 * 240) / 140, 5);
    expect(job.edit.endSec).toBeCloseTo((24 * 240) / 140, 5);
    expect(job.seed).toBe(fakeStudioResult.seed);
    expect(useStudioStore.getState().takeHistory.length).toBe(1);

    await useStudioStore.getState().undoTakeEdit();
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(useStudioStore.getState().result).toBe(fakeStudioResult);
    expect(useStudioStore.getState().takeHistory.length).toBe(0);
  });

  it('redoSection on a Sketch take warns and never renders', async () => {
    useStudioStore.setState({ result: { ...fakeStudioResult, backendId: 'offline-stub' } as RenderResult });
    await useStudioStore.getState().redoSection(1);
    expect(renderSpy).not.toHaveBeenCalled();
  });

  it('pickCandidate swaps the heard take to the chosen candidate without a render', async () => {
    const candA = {
      raw: new Blob([new Uint8Array([1])], { type: 'audio/wav' }),
      mix: new Blob([new Uint8Array([3])], { type: 'audio/wav' }),
    };
    const candB = {
      raw: new Blob([new Uint8Array([2])], { type: 'audio/wav' }),
      mix: new Blob([new Uint8Array([4])], { type: 'audio/wav' }),
      barGrid: { offsetSec: 0.2, confidence: 0.9, bpm: 140 },
      master: {
        lufsBefore: -14,
        lufsAfter: -9,
        peakDbAfter: -1,
        gainDb: 5,
        widthApplied: true,
        matchApplied: false,
        maxCorrectionDb: 1.5,
      },
    };
    const redoTake = { ...fakeStudioResult, candidates: [candA, candB] } as RenderResult;
    useStudioStore.setState({ result: redoTake, takeHistory: [], activeCandidate: 0 });

    await useStudioStore.getState().pickCandidate(1);

    expect(renderSpy).not.toHaveBeenCalled();
    const next = useStudioStore.getState().result!;
    expect(next.stems.find((s) => s.id === 'mix')!.blob).toBe(candB.mix);
    // Raw mix, barGrid and master report follow the picked candidate.
    expect(next.rawMixBlob).toBe(candB.raw);
    expect(next.barGrid).toEqual(candB.barGrid);
    expect(next.master).toEqual(candB.master);
    // Picking = a new take version (pushes history) and marks which take is heard.
    expect(useStudioStore.getState().takeHistory).toEqual([redoTake]);
    expect(useStudioStore.getState().activeCandidate).toBe(1);

    await useStudioStore.getState().undoTakeEdit();
    expect(renderSpy).not.toHaveBeenCalled();
    // Undo restores A's raw/mix/barGrid (the pre-pick take).
    const restored = useStudioStore.getState().result!;
    expect(restored).toBe(redoTake);
    expect(restored.rawMixBlob).toBe(redoTake.rawMixBlob);
    expect(restored.stems.find((s) => s.id === 'mix')!.blob).toBe(redoTake.stems.find((s) => s.id === 'mix')!.blob);
    expect(useStudioStore.getState().takeHistory.length).toBe(0);
    expect(useStudioStore.getState().activeCandidate).toBe(0);
  });

  it('pickCandidate ignores a result with no candidates', async () => {
    await useStudioStore.getState().pickCandidate(0);
    expect(renderSpy).not.toHaveBeenCalled();
    expect(useStudioStore.getState().result).toBe(fakeStudioResult);
  });

  it('applies the LoRA selection only once while it is unchanged', async () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    try {
      useStudioStore.setState({
        loraPath: '/loras/dnb-a',
        loraScale: 0.7,
        appliedLoraPath: null,
        appliedLoraScale: 0.7,
      });
      await useStudioStore.getState().generate();
      await useStudioStore.getState().generate();
      const loraCalls = fetchSpy.mock.calls.filter((c) => String(c[0]).includes('/lora'));
      expect(loraCalls).toHaveLength(1);
      expect(useStudioStore.getState().appliedLoraPath).toBe('/loras/dnb-a');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('polishDrops repaints each drop once with role drop + batchSize 2', async () => {
    const twoDrops = structureOf(
      [
        { name: 'intro', startBar: 0, lengthBars: 8 },
        { name: 'drop', startBar: 8, lengthBars: 8 },
        { name: 'break', startBar: 16, lengthBars: 4 },
        { name: 'drop', startBar: 20, lengthBars: 8 },
        { name: 'outro', startBar: 28, lengthBars: 4 },
      ],
      32,
    );
    useStudioStore.setState({
      result: { ...fakeStudioResult, structure: twoDrops } as RenderResult,
      takeHistory: [],
    });

    await useStudioStore.getState().polishDrops();

    expect(renderSpy).toHaveBeenCalledTimes(2);
    for (const call of renderSpy.mock.calls) {
      const job = call[0] as {
        sectionRole?: string;
        batchSize?: number;
        edit?: { kind: string };
      };
      expect(job.sectionRole).toBe('drop');
      expect(job.edit?.kind).toBe('repaint');
      expect(job.batchSize).toBe(2);
    }
    // One take version per drop; Undo steps back one drop at a time.
    expect(useStudioStore.getState().takeHistory.length).toBe(2);
    await useStudioStore.getState().undoTakeEdit();
    expect(useStudioStore.getState().takeHistory.length).toBe(1);
  });
});
