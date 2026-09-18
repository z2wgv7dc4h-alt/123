/**
 * B-2 genres: DnB 174, dubstep 140, half-time, jungle.
 * Captions, presets, genre picker and tempo defaults; the retired dubstep shape.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { buildAceCaption, PRODUCTION_WORDS } from '../core/prompt/buildAceCaption';
import type { GenreId } from '../core/types';
import { GENRES } from '../core/types';
import { GENRE_TEMPLATES, templateParams } from '../ui/lib/genreTemplates';
import { SONG_SHAPES } from '../ui/lib/songShapes';
import { useStudioStore } from '../ui/hooks/useStudioStore';
import {
  AceStepBackend,
  ACE_SIDECAR_PROBE_URL,
  ACE_SIDECAR_RENDER_URL,
} from '../core/backends/AceStepBackend';

const knobs = { energy: 0.9, darkness: 0.7, chaos: 0.4 };

describe('genre captions', () => {
  it('default (no genre) still starts DnB', () => {
    expect(buildAceCaption({ ...knobs })).toMatch(/^An instrumental drum and bass track/);
  });

  it('dubstep leads with dubstep, wobble and half-time snare', () => {
    const cap = buildAceCaption({ ...knobs, genre: 'dubstep' });
    expect(cap.startsWith('An instrumental dubstep track')).toBe(true);
    expect(cap).toMatch(/wobble/);
    expect(cap).toMatch(/half-time drums, snare on 3/);
    expect(cap).not.toMatch(/drum and bass|two-step|reese/);
  });

  it('dubstep user text keeps "massive drop" and dedups the lead word', () => {
    const cap = buildAceCaption({ ...knobs, genre: 'dubstep', userText: 'dubstep, massive drop' });
    expect(cap).toContain('massive drop');
    expect(cap.match(/dubstep/g)?.length).toBe(1);
  });

  it('halftime leads with halftime drum and bass, snare on 3', () => {
    const cap = buildAceCaption({ ...knobs, genre: 'halftime' });
    expect(cap.startsWith('An instrumental halftime drum and bass track')).toBe(true);
    expect(cap).toMatch(/snare on 3/);
    expect(cap).not.toMatch(/two-step/);
  });

  it('jungle leads with jungle and amen breaks', () => {
    const cap = buildAceCaption({ ...knobs, genre: 'jungle' });
    expect(cap.startsWith('An instrumental jungle track')).toBe(true);
    expect(cap).toMatch(/amen/);
  });

  it('adds the genre production sentence just before the mix close', () => {
    const genres: GenreId[] = ['dnb', 'dubstep', 'trap', 'jungle', 'halftime'];
    for (const genre of genres) {
      const cap = buildAceCaption({ ...knobs, genre });
      expect(cap).toContain(PRODUCTION_WORDS[genre]);
      expect(cap.indexOf(PRODUCTION_WORDS[genre])).toBeLessThan(cap.indexOf('The mix is polished'));
    }
    expect(PRODUCTION_WORDS.dnb).toMatch(/reese.*ducks under the kick/i);
    expect(PRODUCTION_WORDS.dnb).toMatch(/mono sub below 60 Hz/i);
    expect(PRODUCTION_WORDS.trap).toMatch(/808s with long tails/i);
  });
});

describe('genre defaults + presets', () => {
  it('GENRES tempo defaults', () => {
    expect(GENRES.dubstep.defaultBpm).toBe(140);
    expect(GENRES.dnb.defaultBpm).toBe(174);
  });

  it('every template has no bpm in its text and matches its genre tempo', () => {
    for (const t of GENRE_TEMPLATES) {
      expect(t.promptText, t.id).not.toMatch(/bpm/i);
      expect(t.bpm, t.id).toBe(GENRES[t.genre].defaultBpm);
    }
  });

  it('templateParams(dubstep-drop) carries genre + tempo', () => {
    const p = templateParams('dubstep-drop');
    expect(p).not.toBeNull();
    expect(p!.genre).toBe('dubstep');
    expect(p!.bpm).toBe(140);
  });

  it('SONG_SHAPES retires the dubstep shape', () => {
    expect(SONG_SHAPES.some((s) => s.id === 'dubstep')).toBe(false);
  });
});

describe('store genre -> tempo', () => {
  it('setGenre applies that genre default tempo', () => {
    useStudioStore.getState().setGenre('dubstep');
    expect(useStudioStore.getState().genre).toBe('dubstep');
    expect(useStudioStore.getState().bpm).toBe(140);
    useStudioStore.getState().setGenre('dnb');
    expect(useStudioStore.getState().bpm).toBe(174);
  });
});

describe('ACE payload genre', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const wavB64 = btoa(String.fromCharCode(82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69));

  it('dubstep genre: caption leads dubstep, bpm 140, captionFamily Dubstep', async () => {
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
      prompt: { descriptors: [], ...knobs, text: '' },
      genre: 'dubstep',
      stemSchemaVersion: 'v0',
    });

    const sent = body as unknown as Record<string, unknown>;
    const text = (sent.prompt as { text: string }).text;
    expect(text.startsWith('An instrumental dubstep track')).toBe(true);
    expect(sent.bpm).toBe(140);
    expect(result.acePayload?.captionFamily).toBe('Dubstep');
  });
});
