/**
 * Best-of-N audit: every candidate is mastered + gridded; picking keeps
 * raw/mix/barGrid in sync so the next Redo edits that candidate's raw audio.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  AceStepBackend,
  aceStepBackend,
  ACE_SIDECAR_RENDER_URL,
} from '../core/backends/AceStepBackend';
import type { RenderResult, StructureMap } from '../core/types';
import { useStudioStore } from '../ui/hooks/useStudioStore';
import { planTakeEdit } from '../ui/lib/takeEdit';
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

function writeAscii(view: DataView, offset: number, str: string): number {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  return offset + str.length;
}

/** 2 s, 32-bit float stereo WAV (fmt tag 3) — what ACE returns. */
function buildFloat32Wav(left: Float32Array, right: Float32Array): ArrayBuffer {
  const numChannels = 2;
  const dataSize = left.length * numChannels * 4;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  let o = 0;
  o = writeAscii(view, o, 'RIFF');
  view.setUint32(o, 36 + dataSize, true);
  o += 4;
  o = writeAscii(view, o, 'WAVE');
  o = writeAscii(view, o, 'fmt ');
  view.setUint32(o, 16, true);
  o += 4;
  view.setUint16(o, 3, true); // IEEE float
  o += 2;
  view.setUint16(o, numChannels, true);
  o += 2;
  view.setUint32(o, SR, true);
  o += 4;
  view.setUint32(o, SR * numChannels * 4, true);
  o += 4;
  view.setUint16(o, numChannels * 4, true);
  o += 2;
  view.setUint16(o, 32, true);
  o += 2;
  o = writeAscii(view, o, 'data');
  view.setUint32(o, dataSize, true);
  o += 4;
  for (let i = 0; i < left.length; i++) {
    view.setFloat32(o, left[i]!, true);
    o += 4;
    view.setFloat32(o, right[i]!, true);
    o += 4;
  }
  return buf;
}

function toneBuffer(freq: number, amp: number): Float32Array {
  const n = SR * 2;
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
  return a;
}

function toB64(ab: ArrayBuffer): string {
  const bytes = new Uint8Array(ab);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function structureOf(): StructureMap {
  return {
    version: 'hard-grid-v0',
    bpm: 174,
    bars: 32,
    ppq: 480,
    samplesPerBar: 1,
    snapPolicy: 'hard',
    sampleRateHz: SR,
    sections: [
      { name: 'intro', startBar: 0, lengthBars: 8 },
      { name: 'drop', startBar: 8, lengthBars: 16 },
      { name: 'outro', startBar: 24, lengthBars: 8 },
    ],
    drumRole: {} as StructureMap['drumRole'],
    drums: [],
    bassRole: {} as StructureMap['bassRole'],
    energyCurve: [],
    keyRoot: 'A',
    seed: 5,
  };
}

describe('AceStepBackend masters + grids every candidate', () => {
  const backend = new AceStepBackend();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('2 float32 candidates → both mastered (report) and both gridded', async () => {
    const b64A = toB64(buildFloat32Wav(toneBuffer(220, 0.3), toneBuffer(220, 0.3)));
    const b64B = toB64(buildFloat32Wav(toneBuffer(330, 0.25), toneBuffer(330, 0.25)));

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === ACE_SIDECAR_RENDER_URL) {
        return new Response(
          JSON.stringify({
            jobId: 'j',
            seed: 7,
            bpmMeasured: 174,
            checkpointId: 'acestep-v15-turbo',
            gpuUsed: true,
            mixWavBase64: b64A,
            stems: [{ id: 'mix', wavBase64: b64A, durationSec: 2 }],
            candidates: [{ wavBase64: b64A, durationSec: 2 }, { wavBase64: b64B, durationSec: 2 }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(`unexpected fetch ${input}`);
    }) as typeof fetch;

    const result = await backend.render({
      jobId: 'j',
      seed: 7,
      bpm: 174,
      bpmTolerance: 2,
      durationBars: 32,
      sampleRateHz: 48000,
      bitDepth: 16,
      channels: 2,
      prompt: { descriptors: ['dnb'], energy: 0.8, darkness: 0.3, chaos: 0.4, text: 'dnb' },
      stemSchemaVersion: 'v0',
      master: true,
    });

    expect(result.candidates).toHaveLength(2);
    for (const c of result.candidates!) {
      expect(c.master).toBeDefined();
      expect(Number.isFinite(c.master!.lufsAfter)).toBe(true);
      expect(c.barGrid).toBeDefined();
      expect(c.raw).toBeInstanceOf(Blob);
      expect(c.mix).toBeInstanceOf(Blob);
    }
    // Candidate A drives the heard take and its raw mix is kept for edits.
    expect(result.rawMixBlob).toBeDefined();
    expect(result.barGrid).toBeDefined();
    expect(result.master).toBeDefined();
    expect(result.candidateScores).toHaveLength(2);
  });
});

describe('pickCandidate keeps raw/barGrid in sync through Redo + Undo', () => {
  let renderSpy: ReturnType<typeof vi.spyOn>;

  const structure = structureOf();
  const makeCandidate = (tag: number, offset: number) => ({
    raw: new Blob([new Uint8Array([tag, 1])], { type: 'audio/wav' }),
    mix: new Blob([new Uint8Array([tag, 2])], { type: 'audio/wav' }),
    barGrid: { offsetSec: offset, confidence: 0.9, bpm: 174 },
    master: {
      lufsBefore: -14,
      lufsAfter: -9,
      peakDbAfter: -1,
      gainDb: 5,
      widthApplied: true,
      matchApplied: false,
      maxCorrectionDb: 0,
    },
  });

  const candA = makeCandidate(1, 0.1);
  const candB = makeCandidate(2, 0.25);

  const baseResult: RenderResult = {
    jobId: 'take1',
    seed: 5,
    bpmMeasured: 174,
    backendId: 'ace-step-1.5',
    stems: [{ id: 'mix', blob: candA.mix, url: 'blob:a-mix', durationSec: 2, channels: 2, sampleRateHz: SR, bitDepth: 16 }],
    warnings: [],
    waveformPeaks: [],
    structure,
    manifest: {} as RenderResult['manifest'],
    rawMixBlob: candA.raw,
    barGrid: candA.barGrid,
    master: candA.master,
    candidates: [candA, candB],
    candidateScores: [0.9, 0.7],
  };

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
      .mockImplementation(async (job) =>
        ({ ...baseResult, jobId: job.jobId, structure: job.structureRef! }) as RenderResult,
      );
    vi.spyOn(previewPlayer, 'loadMix').mockResolvedValue();
    useStudioStore.setState({
      productTier: 'studio',
      aceHasGpu: true,
      backendId: 'ace-step-1.5',
      busy: false,
      result: baseResult,
      takeHistory: [],
      keepSeed: false,
      editedSections: null,
      vibe: null,
      ownerConfirmed: false,
      previousResult: null,
      activeCandidate: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pick B, then Redo sends B raw as edit.source; undo restores A', async () => {
    await useStudioStore.getState().pickCandidate(1);
    const picked = useStudioStore.getState().result!;
    expect(picked.rawMixBlob).toBe(candB.raw);
    expect(picked.stems.find((s) => s.id === 'mix')!.blob).toBe(candB.mix);
    expect(picked.barGrid).toEqual(candB.barGrid);
    expect(picked.master).toEqual(candB.master);

    await useStudioStore.getState().redoSection(1);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    const job = renderSpy.mock.calls[0]![0] as { edit?: { source?: Blob } };
    expect(job.edit?.source).toBe(candB.raw);

    // Undo the Redo → back to the picked B take; undo the pick → back to A.
    await useStudioStore.getState().undoTakeEdit();
    expect(useStudioStore.getState().result!.rawMixBlob).toBe(candB.raw);

    await useStudioStore.getState().undoTakeEdit();
    const restored = useStudioStore.getState().result!;
    expect(restored.rawMixBlob).toBe(candA.raw);
    expect(restored.stems.find((s) => s.id === 'mix')!.blob).toBe(candA.mix);
    expect(restored.barGrid).toEqual(candA.barGrid);
  });

  it('planTakeEdit warns and falls back to the mastered mix without raw', () => {
    // Sanity: a Studio take missing rawMixBlob still edits, with a warning.
    const noRaw = { ...baseResult, rawMixBlob: undefined } as RenderResult;
    const plan = planTakeEdit(noRaw, { kind: 'redo', sectionIndex: 1 });
    expect(plan).not.toBeNull();
    expect(plan!.edit.source).toBe(candA.mix);
    expect(plan!.warning).toMatch(/raw mix/i);
  });
});
