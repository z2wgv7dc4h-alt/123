/**
 * P-1 prompt v2 — paragraph captions, structure-tag lyrics, longer songs.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { buildAceCaption, buildAceLyrics, arrangementSentence } from '../core/prompt/buildAceCaption';
import {
  AceStepBackend,
  ACE_SIDECAR_PROBE_URL,
  ACE_SIDECAR_RENDER_URL,
} from '../core/backends/AceStepBackend';

const knobs = { energy: 0.75, darkness: 0.45, chaos: 0.25 };
const MAP = ['intro', 'build', 'drop', 'breakdown', 'build', 'drop', 'outro'];

describe('P-1 paragraph captions', () => {
  it('whole-song caption is a paragraph with narrative, no duplicates, no vocals', () => {
    const cap = buildAceCaption({
      ...knobs,
      sections: MAP,
      userText: 'energetic dancefloor drum and bass, rolling reese bass, tight punchy drums, heavy sub bass',
    });
    expect(cap).toMatch(/^An instrumental drum and bass track with /);
    expect(cap).toMatch(/explodes into a massive drop/);
    expect(cap).toMatch(/hits another full-energy drop/);
    expect(cap).toMatch(/no vocals\.$/);
    expect(cap.match(/reese bass/g)!.length).toBe(1);
    expect(cap.match(/sub bass/g)!.length).toBe(1);
    expect(cap.match(/drum and bass/g)!.length).toBe(1);
    const words = cap.split(/\s+/).length;
    expect(words).toBeGreaterThan(40);
    // Production sentence added; keep a generous ceiling (ACE examples run 60-110).
    expect(words).toBeLessThan(170);
    expect(cap).not.toMatch(/bpm|guitar/i);
  });

  it('section caption leads with the role, no arrangement sentence', () => {
    const cap = buildAceCaption({ ...knobs, genre: 'dubstep', sectionRole: 'drop', sections: MAP });
    expect(cap.startsWith('An instrumental dubstep drop — massive epic drop')).toBe(true);
    expect(cap).not.toMatch(/The arrangement/);
  });

  it('user words land in an extras sentence; guitar only when typed', () => {
    const cap = buildAceCaption({ ...knobs, userText: 'huge supersaw synth leads, screaming guitar lead' });
    expect(cap).toMatch(/It also features huge supersaw synth leads and screaming guitar lead\./);
  });

  it('lyrics are structure tags only', () => {
    expect(buildAceLyrics(MAP)).toBe(
      '[Intro - atmospheric]\n\n[Build - rising tension]\n\n[Drop - explosive]\n\n[Breakdown - stripped back]\n\n[Build - rising tension]\n\n[Drop - explosive]\n\n[Outro - fade out]',
    );
    expect(buildAceLyrics([])).toBe('[Instrumental]');
    expect(arrangementSentence([])).toBe('');
  });
});

describe('P-1 ACE payload lyrics + arrangement', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const wavB64 = btoa(String.fromCharCode(82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69));

  async function renderAfterProbe(extra: Record<string, unknown> = {}) {
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
    await backend.render({
      jobId: 'j',
      seed: 1,
      bpm: 174,
      bpmTolerance: 2,
      durationBars: 8,
      sampleRateHz: 48000,
      bitDepth: 16,
      channels: 2,
      prompt: { descriptors: [], ...knobs, text: '' },
      stemSchemaVersion: 'v0',
      ...extra,
    });
    return body as unknown as Record<string, unknown>;
  }

  it('whole-song: arrangement sentence in the caption, structure tags in lyrics', async () => {
    const body = await renderAfterProbe();
    expect(String(body.lyrics)).toContain('[Drop - explosive]');
    expect((body.prompt as { text: string }).text).toContain('The arrangement');
  });

  it('section redo: no arrangement sentence, lyrics still structure tags', async () => {
    const body = await renderAfterProbe({ sectionRole: 'drop' });
    expect((body.prompt as { text: string }).text).not.toContain('The arrangement');
    expect(String(body.lyrics)).toContain('[Drop - explosive]');
  });
});
