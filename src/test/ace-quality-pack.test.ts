/**
 * ACE quality pack: caption says concrete 174 DnB (Reese/growl, amen or
 * two-step, tight drums), no guitar unless asked, shape words only for the
 * selected shape; payload runs the LM (thinking on) for a track plan with
 * 64 steps + ADG on base and the caption/CoT rewrite locked off;
 * header chip labels the buffer that exists.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { buildAceCaption, LEGACY_STARTER_GUITAR_PHRASES } from '../core/prompt/buildAceCaption';
import { DEFAULT_DESCRIPTORS, DEFAULT_BARS } from '../core/types';
import {
  AceStepBackend,
  ACE_BASE_INFERENCE_STEPS,
  ACE_SIDECAR_PROBE_URL,
  ACE_SIDECAR_RENDER_URL,
  aceSamplerFor,
} from '../core/backends/AceStepBackend';
import { heardAudioPathChip } from '../ui/lib/retailLabels';
import { GENRE_TEMPLATES } from '../ui/lib/genreTemplates';

const STARTER = DEFAULT_DESCRIPTORS.slice(0, 4).join(', ');
const OLD_STARTER = 'energetic dancefloor drum and bass, rock-dnb crossover, distorted guitar riffs, reese bass';
const knobs = { energy: 0.75, darkness: 0.45, chaos: 0.25 };

describe('buildAceCaption quality pack', () => {
  it('default caption is concrete DnB, no guitar, no bpm poetry', () => {
    const cap = buildAceCaption({ ...knobs, userText: STARTER });
    expect(cap).not.toMatch(/guitar|rock/i);
    expect(cap).toMatch(/^An instrumental drum and bass track/);
    expect(cap).toMatch(/reese|growl/i);
    expect(cap).toMatch(/amen|two-step/i);
    expect(cap).toMatch(/tight punchy drums/);
    expect(cap).not.toMatch(/bpm/i);
    expect(cap).not.toMatch(/mood|controlled fills|jump up|precise breakbeat/i);
    expect(cap).toMatch(/no vocals\.$/);
  });

  it('strips bpm, stray shape words and rock from user text', () => {
    const user = '174 bpm, half-time break, rock-dnb crossover, snare on 3';
    const normal = buildAceCaption({ ...knobs, userText: user });
    expect(normal).not.toMatch(/bpm|half-time|rock|snare on 3/i);
    expect(normal).toMatch(/two-step|amen/i);
    const htd = buildAceCaption({ ...knobs, userText: user, songShape: 'half-time-drop' });
    expect(htd).toMatch(/half-time snare on 3/);
    expect(htd).not.toMatch(/bpm|rock/i);
  });

  it('default length leaves room for build and drop; festival template keeps its sound words', () => {
    expect(DEFAULT_BARS).toBe(96);
    expect((DEFAULT_BARS * 4 * 60) / 174).toBeGreaterThan(80);
    const t = GENRE_TEMPLATES.find((g) => g.id === 'festival-anthem');
    expect(t).toBeTruthy();
    const cap = buildAceCaption({ energy: 0.9, darkness: 0.4, chaos: 0.3, userText: t!.promptText });
    expect(cap).toMatch(/supersaw/);
    expect(cap).toMatch(/distorted guitars/);
    expect(cap).toMatch(/anthemic stadium drop/);
    expect(cap).not.toMatch(/bpm/i);
  });

  it('old saved starter text no longer smuggles guitar in', () => {
    expect(STARTER).not.toMatch(/guitar/i);
    const cap = buildAceCaption({ ...knobs, userText: OLD_STARTER, layers: { guitar: false } });
    for (const p of LEGACY_STARTER_GUITAR_PHRASES) expect(cap).not.toContain(p);
    expect(cap).not.toMatch(/guitar/i);
  });

  it('guitar appears when the user typed it or turned the layer on', () => {
    expect(buildAceCaption({ ...knobs, userText: 'screaming guitar lead' })).toContain('screaming guitar lead');
    const layered = buildAceCaption({ ...knobs, userText: OLD_STARTER, layers: { guitar: true } });
    expect(layered).toMatch(/distorted guitar riffs/);
    expect(layered).toMatch(/rhythm guitar/);
  });

  it('every darkness band names a Reese or growl bass', () => {
    for (const darkness of [0.1, 0.5, 0.9]) {
      for (const seed of [0, 1]) {
        expect(buildAceCaption({ ...knobs, darkness, seed })).toMatch(/reese|growl/i);
      }
    }
  });

  it('tidy chaos is two-step, busy chaos is amen', () => {
    expect(buildAceCaption({ ...knobs, chaos: 0.1 })).toMatch(/two-step/);
    expect(buildAceCaption({ ...knobs, chaos: 0.8 })).toMatch(/chopped amen/);
  });

  it('shape tags only for the selected shape', () => {
    const none = buildAceCaption({ ...knobs });
    expect(none).not.toMatch(/half-time|dubstep|808/i);

    const htd = buildAceCaption({ ...knobs, songShape: 'half-time-drop' });
    expect(htd).toMatch(/half-time snare on 3/);
    expect(htd).not.toMatch(/dubstep|two-step|808/i);

    const dub = buildAceCaption({ ...knobs, songShape: 'dubstep' });
    expect(dub).toMatch(/dubstep/);
    expect(dub).not.toMatch(/two-step|808/i);

    const trap = buildAceCaption({ ...knobs, songShape: 'trap-bounce' });
    expect(trap).toMatch(/808/);
    expect(trap).not.toMatch(/dubstep|half-time/i);
  });
});

describe('heard-backend chip', () => {
  it('labels the buffer, not the latest probe', () => {
    expect(heardAudioPathChip('offline-stub', true)).toEqual({ live: false, label: 'Sketch · CPU' });
    expect(heardAudioPathChip('ace-step-1.5', false)).toEqual({ live: true, label: 'Studio · GPU' });
    expect(heardAudioPathChip(null, true)).toEqual({ live: true, label: 'Studio ready · GPU' });
    expect(heardAudioPathChip(undefined, false)).toEqual({ live: false, label: 'Sketch · CPU' });
  });
});

describe('ACE payload quality pack', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const wavB64 = btoa(String.fromCharCode(82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69));

  async function renderAfterProbe(checkpoint: string | undefined, extra: Record<string, unknown> = {}) {
    const backend = new AceStepBackend();
    let body: Record<string, unknown> | null = null;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === ACE_SIDECAR_PROBE_URL) {
        return new Response(JSON.stringify({ hasGpu: true, checkpoint }), { status: 200 });
      }
      if (url === ACE_SIDECAR_RENDER_URL) {
        body = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ jobId: 'j', seed: 1, mixWavBase64: wavB64 }), { status: 200 });
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;
    const probe = await backend.probe();
    const result = await backend.render({
      jobId: 'j',
      seed: 1,
      bpm: 174,
      bpmTolerance: 2,
      durationBars: 8,
      sampleRateHz: 48000,
      bitDepth: 16,
      channels: 2,
      prompt: { descriptors: [], ...knobs, text: OLD_STARTER },
      layers: { guitar: false, solo: false, vocalish: false, extraDrums: false },
      stemSchemaVersion: 'v0',
      ...extra,
    });
    return { body: body as unknown as Record<string, unknown>, probe, result };
  }

  it('base: thinking on, 64 steps, ADG on, loaded checkpoint named, no default guitar', async () => {
    const { body, probe, result } = await renderAfterProbe('acestep-v15-base', { songShape: 'half-time-drop' });
    expect(probe.checkpoint).toBe('acestep-v15-base');
    expect(body.thinking).toBe(true);
    expect(body.inferenceSteps).toBe(64);
    expect(body.inferenceSteps).toBe(ACE_BASE_INFERENCE_STEPS);
    expect(body.useAdg).toBe(true);
    expect(body.dcwEnabled).toBe(false);
    expect(body.checkpointId).toBe('acestep-v15-base');
    const text = (body.prompt as { text: string }).text;
    expect(text).not.toMatch(/guitar/i);
    expect(text).not.toMatch(/dubstep/i);
    const sections = (body.structureRef as { sections: Array<{ name: string }> }).sections;
    expect(sections.map((s) => s.name)).toContain('drop');
    expect(result.checkpointId).toBe('acestep-v15-base');
    expect(result.acePayload).toEqual({
      thinking: true,
      captionFamily: 'DnB',
      steps: 64,
      model: 'acestep-v15-base',
    });
  });

  it('SFT on disk: same 64-step ADG path, SFT named (never overridden to base)', async () => {
    const { body } = await renderAfterProbe('acestep-v15-sft');
    expect(body.checkpointId).toBe('acestep-v15-sft');
    expect(body.inferenceSteps).toBe(64);
    expect(body.useAdg).toBe(true);
  });

  it('turbo only when the server loaded turbo: 8 steps, ADG off', async () => {
    const { body, result } = await renderAfterProbe('acestep-v15-turbo');
    expect(body.checkpointId).toBe('acestep-v15-turbo');
    expect(body.inferenceSteps).toBe(8);
    expect(body.useAdg).toBe(false);
    expect(body.dcwEnabled).toBe(true);
    expect(body.thinking).toBe(true);
    expect(result.acePayload).toEqual({
      thinking: true,
      captionFamily: 'DnB',
      steps: 8,
      model: 'acestep-v15-turbo',
    });
  });

  it('unknown checkpoint: no checkpointId sent, turbo sampler', async () => {
    const { body, result } = await renderAfterProbe(undefined);
    expect(body.checkpointId).toBeUndefined();
    expect(body.inferenceSteps).toBe(8);
    expect(result.checkpointId).toBe('unknown');
    expect(result.acePayload?.model).toBe('acestep-v15-turbo');
    expect(aceSamplerFor('ACE-Step/Ace-Step1.5:acestep-v15-turbo').inferenceSteps).toBe(8);
  });
});
