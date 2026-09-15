import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AceStepBackend,
  ACE_SIDECAR_PROBE_URL,
  ACE_SIDECAR_RENDER_URL,
  ACE_INFERENCE_STEPS,
  ACE_GUIDANCE_SCALE,
  ACE_SHIFT,
  ACE_DCW_ENABLED,
  ACE_DCW_MODE,
  ACE_COVER_STRENGTH,
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

  it('sends named inference params and enables DCW (off by default on base models)', async () => {
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
    expect(body.inferenceSteps).toBe(ACE_INFERENCE_STEPS);
    // The plan's section map is what the bridge turns into section-tag lyrics.
    expect(body.structureRef).toBeTruthy();
    expect(body.guidanceScale).toBe(ACE_GUIDANCE_SCALE);
    expect(body.shift).toBe(ACE_SHIFT);
    // DCW ships off for non-Turbo models unless we ask for it.
    expect(body.dcwEnabled).toBe(ACE_DCW_ENABLED);
    expect(body.dcwEnabled).toBe(true);
    expect(body.dcwMode).toBe(ACE_DCW_MODE);
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

  it('never sends audio without ownership attestation', async () => {
    const { sentBody, result } = await renderWith({
      file: new Blob([fakeWav], { type: 'audio/wav' }),
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
    expect(sentBody?.audioCoverStrength).toBeUndefined();
  });
});
