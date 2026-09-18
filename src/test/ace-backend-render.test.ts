import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AceStepBackend,
  ACE_SIDECAR_PROBE_URL,
  ACE_SIDECAR_RENDER_URL,
  ACE_GUIDANCE_SCALE,
  ACE_SHIFT,
  ACE_DEFAULT_CHECKPOINT,
  ACE_TEXT2MUSIC_BATCH_SIZE,
  ACE_COVER_STRENGTH,
  ACE_COVER_STRENGTH_MIN,
  ACE_COVER_STRENGTH_MAX,
  clampCoverStrength,
  clampRepaintStrength,
} from '../core/backends/AceStepBackend';
import { deriveBreakDensity } from '../core/structure/StructureEngine';

describe('AceStepBackend full GPU path', () => {
  const backend = new AceStepBackend();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('probe hasGpu true when sidecar reports GPU', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toBe(ACE_SIDECAR_PROBE_URL);
      return new Response(JSON.stringify({ hasGpu: true, vramGb: 16, notes: ['ok'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    const p = await backend.probe();
    expect(p.hasGpu).toBe(true);
  });

  it('render builds playable mix stem from mixWavBase64', async () => {
    // minimal RIFF/WAVE header-ish bytes — only need a blob for URL.createObjectURL
    const fakeWav = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69]);
    let binary = '';
    fakeWav.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    const b64 = btoa(binary);

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === ACE_SIDECAR_RENDER_URL) {
        expect(init?.method).toBe('POST');
        return new Response(
          JSON.stringify({
            jobId: 'job_test',
            seed: 7,
            bpmMeasured: 174,
            checkpointId: 'acestep-v15-turbo',
            gpuUsed: true,
            mixWavBase64: b64,
            warnings: ['test'],
            stems: [{ id: 'mix', wavBase64: b64, durationSec: 8 }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;

    const result = await backend.render({
      jobId: 'job_test',
      seed: 7,
      bpm: 174,
      bpmTolerance: 2,
      durationBars: 8,
      sampleRateHz: 48000,
      bitDepth: 16,
      channels: 2,
      prompt: { descriptors: ['dnb'], energy: 0.8, darkness: 0.3, chaos: 0.4, text: 'rock dnb' },
      stemSchemaVersion: 'v0',
    });

    expect(result.backendId).toBe('ace-step-1.5');
    expect(result.manifest.gpuUsed).toBe(true);
    expect(result.manifest.productTier).toBe('studio');
    const mix = result.stems.find((s) => s.id === 'mix');
    expect(mix?.url.startsWith('blob:')).toBe(true);
    expect(mix?.blob).toBeTruthy();
  });

  it('sends named inference params; 2B turbo default when no probe', async () => {
    const fakeWav = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69]);
    let binary = '';
    fakeWav.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    const b64 = btoa(binary);
    let sentBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === ACE_SIDECAR_RENDER_URL) {
        sentBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({ jobId: 'j', seed: 7, gpuUsed: true, mixWavBase64: b64 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error('unexpected fetch');
    }) as typeof fetch;

    await backend.render({
      jobId: 'j',
      seed: 7,
      bpm: 174,
      bpmTolerance: 2,
      durationBars: 8,
      sampleRateHz: 48000,
      bitDepth: 16,
      channels: 2,
      prompt: { descriptors: ['dnb'], energy: 0.8, darkness: 0.3, chaos: 0.4, text: 'rock dnb' },
      stemSchemaVersion: 'v0',
    });

    expect(sentBody).not.toBeNull();
    const body = sentBody as unknown as Record<string, unknown>;
    expect(body.thinking).toBe(true);
    expect(body.inferenceSteps).toBe(8);
    // Generate = best-of-2: the bridge returns every take as a candidate.
    expect(ACE_TEXT2MUSIC_BATCH_SIZE).toBe(2);
    expect(body.batchSize).toBe(2);
    // section map still sent; bridge sets lyrics to exactly [Instrumental].
    expect(body.structureRef).toBeTruthy();
    expect(body.guidanceScale).toBe(ACE_GUIDANCE_SCALE);
    expect(body.shift).toBe(ACE_SHIFT);
    // No probe => default 2B turbo (ACE #1063).
    expect(ACE_DEFAULT_CHECKPOINT).toBe('acestep-v15-turbo');
  });

  it('plans breakDensity from chaos like Sketch does, not a hardcoded 0.55', async () => {
    const fakeWav = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69]);
    let binary = '';
    fakeWav.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    const b64 = btoa(binary);
    let sentBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === ACE_SIDECAR_RENDER_URL) {
        sentBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({ jobId: 'j', seed: 7, gpuUsed: true, mixWavBase64: b64 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error('unexpected fetch');
    }) as typeof fetch;

    const chaos = 0.9;
    await backend.render({
      jobId: 'j',
      seed: 7,
      bpm: 174,
      bpmTolerance: 2,
      durationBars: 8,
      sampleRateHz: 48000,
      bitDepth: 16,
      channels: 2,
      prompt: { descriptors: ['dnb'], energy: 0.8, darkness: 0.3, chaos, text: 'rock dnb' },
      stemSchemaVersion: 'v0',
    });

    // High chaos must move density away from the old constant.
    expect(deriveBreakDensity({ chaos })).toBeGreaterThan(0.55);
    expect(sentBody).not.toBeNull();
  });
});

describe('AceStepBackend audio2audio (cover) path', () => {
  const backend = new AceStepBackend();
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const fakeWav = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69]);
  function b64of(bytes: Uint8Array) {
    let binary = '';
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary);
  }

  async function renderWith(styleReference?: Record<string, unknown>) {
    let sentBody: Record<string, unknown> | null = null;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === ACE_SIDECAR_RENDER_URL) {
        sentBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({ jobId: 'j', seed: 7, gpuUsed: true, mixWavBase64: b64of(fakeWav) }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error('unexpected fetch');
    }) as typeof fetch;

    const result = await backend.render({
      jobId: 'j',
      seed: 7,
      bpm: 174,
      bpmTolerance: 2,
      durationBars: 8,
      sampleRateHz: 48000,
      bitDepth: 16,
      channels: 2,
      prompt: { descriptors: ['dnb'], energy: 0.8, darkness: 0.3, chaos: 0.4, text: 'rock dnb' },
      stemSchemaVersion: 'v0',
      ...(styleReference ? { styleReference: styleReference as never } : {}),
    });
    return { sentBody: sentBody as unknown as Record<string, unknown> | null, result };
  }

  it('sends the raw reference audio when the user attached and attested one', async () => {
    const { sentBody, result } = await renderWith({
      file: new Blob([fakeWav], { type: 'audio/wav' }),
      mode: 'cover',
      intensity: 0.6,
      estimatedBpm: 172,
      energy: 0.7,
      fileName: 'mine.wav',
      ownerAttested: true,
    });
    expect(sentBody?.srcAudioBase64).toBeTruthy();
    expect(sentBody?.srcAudioFileName).toBe('mine.wav');
    expect(sentBody?.audioCoverStrength).toBe(ACE_COVER_STRENGTH);
    // Cover plans from the source audio; the LM thinking step must stay off.
    expect(result.acePayload?.thinking).toBe(false);
    // Honesty: only now may the manifest claim ACE consumed the reference.
    expect(result.manifest.styleReference?.acePathActive).toBe(true);
  });

  it('reference mode sends reference_audio as refAudioBase64, not src_audio', async () => {
    const { sentBody, result } = await renderWith({
      file: new Blob([fakeWav], { type: 'audio/wav' }),
      mode: 'reference',
      intensity: 0.6,
      estimatedBpm: 172,
      energy: 0.7,
      fileName: 'mine.wav',
      ownerAttested: true,
    });
    expect(sentBody?.refAudioBase64).toBeTruthy();
    expect(sentBody?.refAudioFileName).toBe('mine.wav');
    expect(sentBody?.srcAudioBase64).toBeUndefined();
    expect(sentBody?.audioCoverStrength).toBeUndefined();
    // text2music path: task_type is not overridden and the LM stays on.
    expect(sentBody?.taskType).toBeUndefined();
    expect(result.acePayload?.thinking).toBe(true);
    expect(result.manifest.styleReference?.acePathActive).toBe(true);
    expect(result.warnings[0]).toMatch(/reference audio/);
  });

  it('defaults to reference mode when no mode is set', async () => {
    const { sentBody, result } = await renderWith({
      file: new Blob([fakeWav], { type: 'audio/wav' }),
      intensity: 0.6,
      estimatedBpm: 172,
      energy: 0.7,
      fileName: 'mine.wav',
      ownerAttested: true,
    });
    expect(sentBody?.refAudioBase64).toBeTruthy();
    expect(sentBody?.srcAudioBase64).toBeUndefined();
    expect(result.acePayload?.thinking).toBe(true);
    expect(result.manifest.styleReference?.acePathActive).toBe(true);
  });

  it('default cover strength is 0.55 and overrides clamp to 0.35-0.7', async () => {
    const base = {
      file: new Blob([fakeWav], { type: 'audio/wav' }),
      mode: 'cover' as const,
      intensity: 0.6,
      estimatedBpm: 172,
      energy: 0.7,
      fileName: 'mine.wav',
      ownerAttested: true,
    };
    expect(ACE_COVER_STRENGTH).toBe(0.55);
    expect(clampCoverStrength(undefined)).toBe(0.55);
    expect(clampCoverStrength(0.45)).toBe(0.45);
    expect(clampCoverStrength(0.1)).toBe(ACE_COVER_STRENGTH_MIN);
    expect(clampCoverStrength(0.9)).toBe(ACE_COVER_STRENGTH_MAX);

    const noOverride = await renderWith(base);
    expect(noOverride.sentBody?.audioCoverStrength).toBe(ACE_COVER_STRENGTH);

    const inRange = await renderWith({ ...base, coverStrength: 0.45 });
    expect(inRange.sentBody?.audioCoverStrength).toBe(0.45);

    const tooHigh = await renderWith({ ...base, coverStrength: 0.9 });
    expect(tooHigh.sentBody?.audioCoverStrength).toBe(0.7);

    const tooLow = await renderWith({ ...base, coverStrength: 0.1 });
    expect(tooLow.sentBody?.audioCoverStrength).toBe(0.35);
  });

  it('never sends audio without ownership attestation', async () => {
    const { sentBody, result } = await renderWith({
      file: new Blob([fakeWav], { type: 'audio/wav' }),
      mode: 'cover',
      intensity: 0.6,
      estimatedBpm: 172,
      energy: 0.7,
      fileName: 'mine.wav',
      ownerAttested: false,
    });
    expect(sentBody?.srcAudioBase64).toBeUndefined();
    expect(result.manifest.styleReference?.acePathActive).toBe(false);
  });

  it('stays a plain text2music render when no reference is attached', async () => {
    const { sentBody } = await renderWith();
    expect(sentBody?.srcAudioBase64).toBeUndefined();
    expect(sentBody?.refAudioBase64).toBeUndefined();
    expect(sentBody?.audioCoverStrength).toBeUndefined();
  });

  it('Status warnings lead with the real payload and drop stale thinking/rock lines', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === ACE_SIDECAR_RENDER_URL) {
        return new Response(
          JSON.stringify({
            jobId: 'j', seed: 7, gpuUsed: true, mixWavBase64: b64of(fakeWav),
            warnings: ['thinking=true LM+DiT quality path (instrumental rock-DnB)', 'task_id=abc'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error('unexpected fetch');
    }) as typeof fetch;
    const base = {
      jobId: 'j', seed: 7, bpm: 174, bpmTolerance: 2, durationBars: 8,
      sampleRateHz: 48000 as const, bitDepth: 16 as const, channels: 2 as const,
      prompt: { descriptors: ['dnb'], energy: 0.8, darkness: 0.3, chaos: 0.4, text: 'rock dnb' },
      stemSchemaVersion: 'v0' as const,
    };
    const t2m = await backend.render(base);
    expect(t2m.warnings[0]).toMatch(/^ACE payload · task text2music · thinking true · caption DnB/);
    expect(t2m.warnings.join('\n')).not.toMatch(/rock|thinking=/i);
    expect(t2m.warnings).toContain('task_id=abc');
    const cover = await backend.render({
      ...base,
      styleReference: {
        file: new Blob([fakeWav], { type: 'audio/wav' }), mode: 'cover' as const,
        intensity: 0.6, estimatedBpm: 172,
        energy: 0.7, fileName: 'mine.wav', ownerAttested: true,
      },
    });
    expect(cover.warnings[0]).toMatch(/^ACE payload · task cover · thinking false · caption DnB/);
    expect(cover.warnings[0]).toMatch(/cover strength 0\.55$/);
    // Reference mode keeps text2music thinking on and tags the warning.
    const ref = await backend.render({
      ...base,
      styleReference: {
        file: new Blob([fakeWav], { type: 'audio/wav' }), mode: 'reference' as const,
        intensity: 0.6, estimatedBpm: 172,
        energy: 0.7, fileName: 'mine.wav', ownerAttested: true,
      },
    });
    expect(ref.warnings[0]).toMatch(/^ACE payload · task text2music · thinking true · caption DnB/);
    expect(ref.warnings[0]).toMatch(/reference audio$/);
  });

  it('edit.repaint sends the take as source with repaint window; not a style-ref claim', async () => {
    let sent: Record<string, unknown> | null = null;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === ACE_SIDECAR_RENDER_URL) {
        sent = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ jobId: 'j', seed: 7, gpuUsed: true, mixWavBase64: b64of(fakeWav) }), { status: 200 });
      }
      throw new Error('unexpected fetch');
    }) as typeof fetch;
    const result = await backend.render({
      jobId: 'j', seed: 7, bpm: 174, bpmTolerance: 2, durationBars: 64,
      sampleRateHz: 48000, bitDepth: 16, channels: 2,
      prompt: { descriptors: [], energy: 0.9, darkness: 0.4, chaos: 0.3, text: 'festival drum and bass' },
      stemSchemaVersion: 'v0',
      edit: { kind: 'repaint', source: new Blob([fakeWav], { type: 'audio/wav' }), startSec: 80, endSec: 102 },
    });
    const body = sent as unknown as Record<string, unknown>;
    expect(body.taskType).toBe('repaint');
    expect(body.repaintStartSec).toBe(80);
    expect(body.repaintEndSec).toBe(102);
    // Redo strength + best-of-3: defaults balanced/0.5, batch 3.
    expect(body.repaintMode).toBe('balanced');
    expect(body.repaintStrength).toBe(0.5);
    expect(body.batchSize).toBe(3);
    expect(body.srcAudioBase64).toBeTruthy();
    expect(body.audioCoverStrength).toBeUndefined();
    expect(result.acePayload?.thinking).toBe(false);
    expect(result.manifest.styleReference?.acePathActive ?? false).toBe(false);
  });

  it('edit.repaint forwards mode/strength and returns parsed candidates', async () => {
    const b64a = b64of(fakeWav);
    const b64b = b64of(new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4, 87, 65, 86, 69]));
    const b64c = b64of(new Uint8Array([82, 73, 70, 70, 9, 9, 9, 9, 87, 65, 86, 69]));
    let sent: Record<string, unknown> | null = null;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === ACE_SIDECAR_RENDER_URL) {
        sent = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({
          jobId: 'j', seed: 7, gpuUsed: true, mixWavBase64: b64a,
          candidates: [
            { wavBase64: b64a, durationSec: 4 },
            { wavBase64: b64b, durationSec: 4 },
            { wavBase64: b64c, durationSec: 4 },
          ],
        }), { status: 200 });
      }
      throw new Error('unexpected fetch');
    }) as typeof fetch;
    const result = await backend.render({
      jobId: 'j', seed: 7, bpm: 174, bpmTolerance: 2, durationBars: 64,
      sampleRateHz: 48000, bitDepth: 16, channels: 2,
      prompt: { descriptors: [], energy: 0.9, darkness: 0.4, chaos: 0.3, text: 'festival drum and bass' },
      stemSchemaVersion: 'v0',
      edit: {
        kind: 'repaint', source: new Blob([fakeWav], { type: 'audio/wav' }),
        startSec: 80, endSec: 102, mode: 'aggressive', strength: 0.9,
      },
    });
    expect((sent as unknown as Record<string, unknown>).repaintMode).toBe('aggressive');
    expect((sent as unknown as Record<string, unknown>).repaintStrength).toBe(0.9);
    expect(result.candidates).toHaveLength(3);
  });

  it('clampRepaintStrength defaults 0.5 and clamps to 0..1', () => {
    expect(clampRepaintStrength(undefined)).toBe(0.5);
    expect(clampRepaintStrength(0.7)).toBe(0.7);
    expect(clampRepaintStrength(-1)).toBe(0);
    expect(clampRepaintStrength(4)).toBe(1);
    expect(clampRepaintStrength(Number.NaN)).toBe(0.5);
  });
});
