/**
 * A-1: section roles in captions, "Redo as…" presets + own words, trap genre.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAceCaption } from '../core/prompt/buildAceCaption';
import { GENRES, type RenderResult, type StructureMap } from '../core/types';
import { planTakeEdit, REDO_PRESETS, roleForSectionName } from '../ui/lib/takeEdit';
import { GENRE_TEMPLATES } from '../ui/lib/genreTemplates';
import { useStudioStore } from '../ui/hooks/useStudioStore';
import {
  AceStepBackend,
  aceStepBackend,
  ACE_SIDECAR_PROBE_URL,
  ACE_SIDECAR_RENDER_URL,
} from '../core/backends';
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

describe('section role captions', () => {
  it('build role adds snare roll + riser', () => {
    const cap = buildAceCaption({ energy: 0.9, darkness: 0.5, chaos: 0.2, sectionRole: 'build' });
    expect(cap).toMatch(/snare roll/);
    expect(cap).toMatch(/riser/);
  });

  it('drop role adds the massive epic drop words', () => {
    expect(buildAceCaption({ energy: 0.9, darkness: 0.5, chaos: 0.2, sectionRole: 'drop' })).toMatch(
      /massive epic drop/,
    );
  });

  it('breakdown role drops the drum pattern tags', () => {
    const cap = buildAceCaption({ energy: 0.9, darkness: 0.5, chaos: 0.2, sectionRole: 'breakdown' });
    expect(cap).toMatch(/stripped-back breakdown/);
    expect(cap).not.toMatch(/two-step|amen/);
  });

  it('trap genre leads trap with 808s and hi-hats', () => {
    const cap = buildAceCaption({ energy: 0.9, darkness: 0.6, chaos: 0.3, genre: 'trap' });
    expect(cap.startsWith('An instrumental trap track')).toBe(true);
    expect(cap).toMatch(/808/);
    expect(cap).toMatch(/hi-hats/);
    expect(cap).not.toMatch(/drum and bass|two-step/);
  });

  it('dubstep + drop role keeps the genre lead then the role words', () => {
    const cap = buildAceCaption({ energy: 0.9, darkness: 0.5, chaos: 0.2, genre: 'dubstep', sectionRole: 'drop' });
    expect(cap.startsWith('An instrumental dubstep drop — massive epic drop')).toBe(true);
  });

  it('no role keeps the previous whole-song caption', () => {
    const cap = buildAceCaption({ energy: 0.9, darkness: 0.5, chaos: 0.2, seed: 0 });
    expect(cap.startsWith('An instrumental drum and bass track')).toBe(true);
    expect(cap).toMatch(/driven by controlled two-step/);
  });
});

const sections = [
  { name: 'intro' as const, startBar: 0, lengthBars: 8 },
  { name: 'drop' as const, startBar: 8, lengthBars: 16 },
  { name: 'outro' as const, startBar: 24, lengthBars: 8 },
];

function structureOf(secs: StructureMap['sections'], bars: number, bpm = 140): StructureMap {
  return {
    version: 'hard-grid-v0',
    bpm,
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

/** Switch genre must not reset tempo: this take is 174, not the dubstep default 140. */
const storeTake = {
  ...fakeStudioResult,
  bpmMeasured: 174,
  structure: structureOf(sections, 32, 174),
} as RenderResult;

describe('Redo-as planning', () => {
  it('roleForSectionName maps break → breakdown, drop → drop', () => {
    expect(roleForSectionName('break')).toBe('breakdown');
    expect(roleForSectionName('breakdown')).toBe('breakdown');
    expect(roleForSectionName('drop')).toBe('drop');
  });

  it('REDO_PRESETS carries the switch options', () => {
    const ids = REDO_PRESETS.map((p) => p.id);
    for (const id of ['epic-drop', 'build-up', 'dubstep-switch', 'trap-switch']) {
      expect(ids).toContain(id);
    }
  });

  it('redo infers the role from the section name', () => {
    const plan = planTakeEdit(fakeStudioResult, { kind: 'redo', sectionIndex: 1 });
    expect(plan).not.toBeNull();
    expect(plan!.style?.role).toBe('drop');
  });

  it('redo keeps an explicit style (genre + role + words)', () => {
    const plan = planTakeEdit(fakeStudioResult, {
      kind: 'redo',
      sectionIndex: 1,
      style: { genre: 'dubstep', role: 'switch', words: 'heavy growls' },
    });
    expect(plan!.style).toEqual({ genre: 'dubstep', role: 'switch', words: 'heavy growls' });
  });
});

describe('genre table', () => {
  it('trap default tempo and template', () => {
    expect(GENRES.trap.defaultBpm).toBe(140);
    const t = GENRE_TEMPLATES.find((g) => g.id === 'trap-heat');
    expect(t).toBeTruthy();
    expect(t!.genre).toBe('trap');
    expect(t!.bpm).toBe(140);
  });
});

describe('store Redo-as', () => {
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
      .mockImplementation(async (job) => ({ ...storeTake, jobId: job.jobId, structure: job.structureRef! }) as RenderResult);
    vi.spyOn(previewPlayer, 'loadMix').mockResolvedValue();
    useStudioStore.setState({
      productTier: 'studio',
      aceHasGpu: true,
      backendId: 'ace-step-1.5',
      busy: false,
      result: storeTake,
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

  it('passes style genre/role/words into the repaint job at the take tempo', async () => {
    await useStudioStore.getState().redoSection(1, { genre: 'dubstep', role: 'switch', words: 'heavy growls' });
    expect(renderSpy).toHaveBeenCalledTimes(1);
    const job = renderSpy.mock.calls[0]![0] as {
      genre: string;
      sectionRole: string;
      prompt: { text: string };
      bpm: number;
      edit: { kind: string };
    };
    expect(job.genre).toBe('dubstep');
    expect(job.sectionRole).toBe('switch');
    expect(job.prompt.text.startsWith('heavy growls')).toBe(true);
    expect(job.bpm).toBe(storeTake.bpmMeasured);
    expect(job.bpm).not.toBe(140);
    expect(job.edit.kind).toBe('repaint');
  });
});

describe('ACE payload section role + trap', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const wavB64 = btoa(String.fromCharCode(82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69));

  it('trap genre + drop role leads the caption and labels captionFamily Trap', async () => {
    const backend = new AceStepBackend();
    let body: Record<string, unknown> | null = null;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === ACE_SIDECAR_PROBE_URL) {
        return new Response(JSON.stringify({ hasGpu: true, checkpoint: 'acestep-v15-turbo' }), { status: 200 });
      }
      if (url === ACE_SIDECAR_RENDER_URL) {
        body = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ jobId: 'j', seed: 1, mixWavBase64: wavB64 }), { status: 200 });
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;

    await backend.probe();
    const result = await backend.render({
      jobId: 'j',
      seed: 1,
      bpm: 140,
      bpmTolerance: 2,
      durationBars: 8,
      sampleRateHz: 48000,
      bitDepth: 16,
      channels: 2,
      prompt: { descriptors: [], energy: 0.9, darkness: 0.6, chaos: 0.3, text: '' },
      genre: 'trap',
      sectionRole: 'drop',
      stemSchemaVersion: 'v0',
    });

    const sent = body as unknown as Record<string, unknown>;
    const text = (sent.prompt as { text: string }).text;
    expect(text.startsWith('An instrumental trap drop — massive epic drop')).toBe(true);
    expect(result.acePayload?.captionFamily).toBe('Trap');
  });
});
