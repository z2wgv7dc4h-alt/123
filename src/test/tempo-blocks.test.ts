/**
 * A-3 tempo blocks: per-section bar↔frame math, join frame counts, block
 * render (bpm + reference_audio), and undo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RenderResult, StructureMap } from '../core/types';
import { framesPerBar, structureBarToFrame } from '../ui/lib/arrangeTake';
import {
  planTempoJoinFrames,
  withTempoBlock,
  sectionBpm,
} from '../ui/lib/tempoBlocks';
import { encodeWav } from '../core/export/wav';
import { aceStepBackend } from '../core/backends';
import { useStudioStore } from '../ui/hooks/useStudioStore';
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

if (typeof URL.createObjectURL !== 'function') {
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => 'node://blob';
  (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
}

const SR = 48000;
const FPB_174 = framesPerBar(174, SR);
const FPB_140 = framesPerBar(140, SR);

function structureOf(): StructureMap {
  return {
    version: 'hard-grid-v0',
    bpm: 174,
    bars: 4,
    ppq: 480,
    samplesPerBar: FPB_174,
    snapPolicy: 'hard',
    sampleRateHz: SR,
    sections: [{ name: 'drop', startBar: 0, lengthBars: 4, bpm: 174 }],
    drumRole: {} as StructureMap['drumRole'],
    drums: [],
    bassRole: {} as StructureMap['bassRole'],
    energyCurve: [],
    keyRoot: 'A',
    seed: 5,
  };
}

function wavOf(frames: number): Blob {
  const l = new Float32Array(frames);
  for (let i = 0; i < frames; i++) l[i] = 0.2 * Math.sin((2 * Math.PI * 120 * i) / SR);
  return encodeWav([l, l.slice()], SR, 16);
}

describe('A-3 per-section time math', () => {
  it('bar↔frame uses each section BPM (174 then 140, exact frames)', () => {
    const structure: StructureMap = {
      ...structureOf(),
      bars: 8,
      sections: [
        { name: 'drop', startBar: 0, lengthBars: 4, bpm: 174 },
        { name: 'drop', startBar: 4, lengthBars: 4, bpm: 140 },
      ],
    };
    expect(sectionBpm(structure.sections[0], structure.bpm)).toBe(174);
    expect(sectionBpm(structure.sections[1], structure.bpm)).toBe(140);
    // bar 4 = 4 × 174 fpb; bar 8 = that + 4 × 140 fpb.
    expect(structureBarToFrame(structure, 4, 0, SR)).toBe(4 * FPB_174);
    expect(structureBarToFrame(structure, 8, 0, SR)).toBe(4 * FPB_174 + 4 * FPB_140);
  });
});

describe('A-3 tempo block plan + join frames', () => {
  it('inserts a block section carrying its own bpm/genre', () => {
    const planned = withTempoBlock(structureOf(), 0, {
      genre: 'dubstep',
      bpm: 140,
      bars: 4,
      role: 'drop',
    })!;
    expect(planned).not.toBeNull();
    expect(planned.blockIndex).toBe(1);
    expect(planned.blockStartBar).toBe(4);
    expect(planned.structure.sections.map((s) => s.bpm)).toEqual([174, 140]);
    expect(planned.structure.sections[1]).toMatchObject({ genre: 'dubstep', lengthBars: 4 });
  });

  it('join frame counts are exact for [before][transition][block][after]', () => {
    const planned = withTempoBlock(structureOf(), 0, {
      genre: 'dubstep',
      bpm: 140,
      bars: 4,
      role: 'drop',
    })!;
    const join = planTempoJoinFrames({
      structure: planned.structure,
      blockIndex: planned.blockIndex,
      offsetSec: 0,
      sampleRateHz: SR,
    })!;
    expect(join.beforeEnd).toBe(3 * FPB_174);
    expect(join.transitionStart).toBe(join.beforeEnd);
    expect(join.transitionEnd).toBe(4 * FPB_174);
    expect(join.blockStart).toBe(4 * FPB_174);
    expect(join.blockEnd).toBe(4 * FPB_174 + 4 * FPB_140);
    expect(join.afterStart).toBe(join.blockEnd);
  });
});

describe('A-3 store: switchTempoHere', () => {
  let renderSpy: ReturnType<typeof vi.spyOn>;
  const base = structureOf();
  const raw = wavOf(base.sections[0]!.lengthBars * FPB_174);
  const blockMix = wavOf(4 * FPB_140);

  const baseResult = {
    jobId: 'take1',
    seed: 5,
    bpmMeasured: 174,
    backendId: 'ace-step-1.5',
    stems: [{ id: 'mix', blob: raw, url: 'blob:raw', channels: 2, sampleRateHz: SR, bitDepth: 16, durationSec: 10 }],
    warnings: [],
    structure: base,
    manifest: {},
    rawMixBlob: raw,
  } as unknown as RenderResult;

  beforeEach(() => {
    vi.restoreAllMocks();
    renderSpy = vi.spyOn(aceStepBackend, 'render').mockImplementation(async (job) => {
      return {
        ...baseResult,
        jobId: job.jobId,
        structure: job.structureRef!,
        candidates: [
          { raw: blockMix, mix: blockMix, barGrid: { offsetSec: 0, confidence: 0.9, bpm: 140 } },
        ],
        candidateScores: [0.9],
      } as unknown as RenderResult;
    });
    vi.spyOn(previewPlayer, 'loadMix').mockResolvedValue();
    useStudioStore.setState({
      productTier: 'studio',
      aceHasGpu: true,
      backendId: 'ace-step-1.5',
      busy: false,
      result: baseResult,
      takeHistory: [],
      energy: 0.8,
      darkness: 0.4,
      chaos: 0.3,
      promptText: 'dnb',
      masterTarget: 'balanced',
      sampler: 'ode',
      coherence: 'balanced',
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders the block at 140 BPM with a reference_audio and pushes history', async () => {
    await useStudioStore.getState().switchTempoHere(0, {
      genre: 'dubstep',
      bpm: 140,
      bars: 4,
      role: 'drop',
    });

    expect(renderSpy).toHaveBeenCalledTimes(1);
    const job = renderSpy.mock.calls[0]![0] as {
      bpm: number;
      genre?: string;
      sectionRole?: string;
      batchSize?: number;
      styleReference?: { file?: Blob; mode?: string; ownerAttested?: boolean };
    };
    expect(job.bpm).toBe(140);
    expect(job.genre).toBe('dubstep');
    expect(job.sectionRole).toBe('switch');
    expect(job.batchSize).toBe(2);
    expect(job.styleReference?.mode).toBe('reference');
    expect(job.styleReference?.ownerAttested).toBe(true);
    expect(job.styleReference?.file).toBeTruthy();

    const next = useStudioStore.getState().result!;
    expect(next.structure!.sections.map((s) => s.bpm)).toEqual([174, 140]);
    expect(useStudioStore.getState().takeHistory.length).toBe(1);
  });

  it('undo restores the pre-block take (raw unchanged)', async () => {
    await useStudioStore.getState().switchTempoHere(0, {
      genre: 'dubstep',
      bpm: 140,
      bars: 4,
      role: 'drop',
    });
    await useStudioStore.getState().undoTakeEdit();
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(useStudioStore.getState().result).toBe(baseResult);
    expect(useStudioStore.getState().result!.rawMixBlob).toBe(raw);
    expect(useStudioStore.getState().takeHistory.length).toBe(0);
  });
});
