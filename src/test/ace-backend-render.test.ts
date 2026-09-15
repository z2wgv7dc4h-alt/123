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
    expect(body.inferenceSteps).toBe(ACE_INFERENCE_STEPS);
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
