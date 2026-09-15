/**
 * ACE captions must change with energy/darkness/chaos knobs (Vary path).
 * Soft-pass forbidden — strings must differ including energy words.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  buildAceCaption,
  buildAceTags,
  energyWords,
  chaosWords,
} from '../core/prompt';
import { AceStepBackend, ACE_SIDECAR_RENDER_URL } from '../core/backends/AceStepBackend';

describe('buildAceCaption knob sensitivity', () => {
  it('different energy produces different captions with energy words', () => {
    const low = buildAceCaption({ energy: 0.15, darkness: 0.4, chaos: 0.3 });
    const high = buildAceCaption({ energy: 0.9, darkness: 0.4, chaos: 0.3 });
    expect(low).not.toBe(high);
    expect(low).toContain(energyWords(0.15).split(',')[0]!.trim());
    expect(high).toContain(energyWords(0.9).split(',')[0]!.trim());
    expect(high).toMatch(/stadium energy|high-drive/i);
    expect(low).toMatch(/laid-back|soft drive/i);
  });

  it('different chaos produces different captions (Vary ×2)', () => {
    const a = buildAceCaption({ energy: 0.7, darkness: 0.45, chaos: 0.1 });
    const b = buildAceCaption({ energy: 0.7, darkness: 0.45, chaos: 0.85 });
    expect(a).not.toBe(b);
    expect(a).toContain(chaosWords(0.1).split(',')[0]!.trim());
    expect(b).toContain(chaosWords(0.85).split(',')[0]!.trim());
  });

  it('guitar/solo layers add honest vibe tags (no artist names)', () => {
    const cap = buildAceCaption({
      energy: 0.7,
      darkness: 0.4,
      chaos: 0.3,
      layers: { guitar: true, solo: true },
    });
    expect(cap.toLowerCase()).toMatch(/guitar/);
    expect(cap.toLowerCase()).toMatch(/solo|lead/);
    expect(cap).not.toMatch(/Pendulum|Suno|Noisia/i);
    const tags = buildAceTags({
      energy: 0.7,
      darkness: 0.4,
      chaos: 0.3,
      layers: { guitar: true, solo: true },
    });
    expect(tags).toContain('guitar');
    expect(tags).toContain('lead solo');
  });

  it('same knobs different seed produce different captions (Vary)', () => {
    const a = buildAceCaption({ energy: 0.7, darkness: 0.45, chaos: 0.3, seed: 0 });
    const b = buildAceCaption({ energy: 0.7, darkness: 0.45, chaos: 0.3, seed: 1 });
    expect(a).not.toBe(b);
    // seed 0 keeps first in-band phrase (legacy tests)
    expect(a).toContain(energyWords(0.7, 0).split(',')[0]!.trim());
    expect(b).toContain(energyWords(0.7, 1).split(',')[0]!.trim());
  });
});

describe('AceStepBackend render posts knob-sensitive caption', () => {
  const backend = new AceStepBackend();
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('two renders with different chaos post different prompt.text', async () => {
    const fakeWav = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69]);
    let binary = '';
    fakeWav.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    const b64 = btoa(binary);
    const texts: string[] = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === ACE_SIDECAR_RENDER_URL) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { prompt?: { text?: string } };
        texts.push(body.prompt?.text ?? '');
        return new Response(
          JSON.stringify({
            jobId: 'job_cap',
            seed: 1,
            bpmMeasured: 174,
            mixWavBase64: b64,
            stems: [{ id: 'mix', wavBase64: b64, durationSec: 8 }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;

    const base = {
      jobId: 'job_cap',
      seed: 1,
      bpm: 174,
      bpmTolerance: 2,
      durationBars: 8,
      sampleRateHz: 48000,
      bitDepth: 16 as const,
      channels: 2 as const,
      stemSchemaVersion: 'v0' as const,
    };

    await backend.render({
      ...base,
      prompt: { descriptors: ['dnb'], energy: 0.75, darkness: 0.4, chaos: 0.1 },
      layers: { guitar: true, solo: false, vocalish: false, extraDrums: false },
    });
    await backend.render({
      ...base,
      jobId: 'job_cap2',
      prompt: { descriptors: ['dnb'], energy: 0.75, darkness: 0.4, chaos: 0.9 },
      layers: { guitar: true, solo: false, vocalish: false, extraDrums: false },
    });

    expect(texts).toHaveLength(2);
    expect(texts[0]).not.toBe(texts[1]);
    expect(texts[0]).toMatch(/guitar/i);
    expect(texts[1]).toMatch(/guitar/i);
    expect(texts[0]).toMatch(/tight edits|controlled/i);
    expect(texts[1]).toMatch(/chaotic|dense percussion/i);
  });
});
