import { afterEach, describe, expect, it, vi } from 'vitest';
import { structureEngine } from '../core/structure';
import { DEFAULT_BPM, ARTIST_NAME_BLOCKLIST } from '../core/types';
import { scrubArtistNames } from '../core/prompt';
import { encodeWav } from '../core/export';
import { buildZip } from '../core/export/zip';
import { offlineStubBackend, aceStepBackend, ACE_SIDECAR_PROBE_URL } from '../core/backends';
import { backendRegistry } from '../core/registry';
import { loraPackManager } from '../core/lora';

describe('honesty: structure seed + version', () => {
  it('same seed → identical StructureMap (deterministic)', async () => {
    const input = {
      seed: 17400,
      bpm: DEFAULT_BPM,
      bars: 32,
      energy: 0.75,
      breakDensity: 0.4,
      darkness: 0.45,
      chaos: 0.25,
    };
    const a = await structureEngine.plan(input);
    const b = await structureEngine.plan(input);
    expect(a.version).toBe('hard-grid-v0');
    expect(a.bpm).toBe(174);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('different seed → different plan', async () => {
    const base = { bpm: DEFAULT_BPM, bars: 32, energy: 0.7, breakDensity: 0.4 };
    const a = await structureEngine.plan({ ...base, seed: 1 });
    const b = await structureEngine.plan({ ...base, seed: 2 });
    expect(JSON.stringify(a.drums)).not.toBe(JSON.stringify(b.drums));
  });
});

describe('honesty: WAV header', () => {
  it('encodeWav writes RIFF/WAVE PCM 16-bit stereo', async () => {
    const L = new Float32Array(48);
    const R = new Float32Array(48);
    L[0] = 0.5;
    R[0] = -0.25;
    const blob = encodeWav([L, R], 48000, 16);
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(String.fromCharCode(...buf.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...buf.slice(8, 12))).toBe('WAVE');
    expect(buf[22]).toBe(2); // channels
    expect(buf[34]).toBe(16); // bit depth
    const sr = buf[24]! | (buf[25]! << 8) | (buf[26]! << 16) | (buf[27]! << 24);
    expect(sr).toBe(48000);
    expect(blob.size).toBeGreaterThan(44);
  });
});

describe('honesty: OfflineStub caps + tempo', () => {
  it('legoStems is false (no LEGO extract/repaint on CPU stub)', () => {
    expect(offlineStubBackend.capabilities.legoStems).toBe(false);
    expect(offlineStubBackend.capabilities.extract).toBe(false);
    expect(offlineStubBackend.capabilities.repaint).toBe(false);
    expect(offlineStubBackend.capabilities.requiresGpu).toBe(false);
  });

  it('honors the job BPM (no 174 lock) and recomputes samplesPerBar', async () => {
    const result = await offlineStubBackend.render({
      jobId: 'test_bpm_unlock',
      seed: 99,
      bpm: 140,
      bpmTolerance: 2,
      durationBars: 16,
      sampleRateHz: 48000,
      bitDepth: 16,
      channels: 2,
      prompt: { descriptors: ['test'], energy: 0.5, darkness: 0.4 },
      stemSchemaVersion: 'v0',
    });
    expect(result.structure?.bpm).toBe(140);
    expect(result.bpmMeasured).toBe(140);
    expect(result.structure?.samplesPerBar).toBe(Math.round((60 / 140) * 4 * 48000));
    expect(result.warnings.join('\n')).toMatch(/Real break loop off at 140 BPM/);
    expect(result.manifest.structureVersion).toBe('hard-grid-v0');
    expect(result.stems.some((s) => s.id === 'mix' && s.blob)).toBe(true);
  });
});

describe('honesty: AceStep GPU gate', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('probe reports no GPU when sidecar unreachable; render throws actionable error', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const probe = await aceStepBackend.probe();
    expect(probe.hasGpu).toBe(false);
    expect(probe.notes.some((n) => /5080|CUDA|GPU/i.test(n))).toBe(true);
    await expect(
      aceStepBackend.render({
        jobId: 'ace_fail',
        seed: 1,
        bpm: 174,
        bpmTolerance: 2,
        durationBars: 16,
        sampleRateHz: 48000,
        bitDepth: 16,
        channels: 2,
        prompt: { descriptors: [], energy: 0.5, darkness: 0.5 },
        stemSchemaVersion: 'v0',
      }),
    ).rejects.toThrow(/GPU|CUDA|sidecar/i);
  });

  it('probe returns hasGpu true when sidecar /probe reports GPU', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toBe(ACE_SIDECAR_PROBE_URL);
      return new Response(
        JSON.stringify({
          hasGpu: true,
          vramGb: 16,
          backend: 'ace-step-1.5',
          notes: ['CUDA available on cuda:0', 'RTX 5080 detected'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;
    const probe = await aceStepBackend.probe();
    expect(probe.hasGpu).toBe(true);
    expect(probe.vramGb).toBe(16);
    expect(probe.notes.some((n) => /5080|cuda:0/i.test(n))).toBe(true);
  });

  it('probe fail-soft when sidecar reports hasGpu false', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ hasGpu: false, notes: ['Stub'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;
    const probe = await aceStepBackend.probe();
    expect(probe.hasGpu).toBe(false);
  });

  it('probe fail-soft on HTTP error / abort', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('nope', { status: 503 }),
    ) as unknown as typeof fetch;
    expect((await aceStepBackend.probe()).hasGpu).toBe(false);

    globalThis.fetch = vi.fn(async () => {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }) as unknown as typeof fetch;
    expect((await aceStepBackend.probe()).hasGpu).toBe(false);
  });

  it('AceStep claims legoStems for future GPU path', () => {
    expect(aceStepBackend.capabilities.legoStems).toBe(true);
    expect(aceStepBackend.capabilities.requiresGpu).toBe(true);
  });
});


describe('honesty: registry + provenance + artist blocklist', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('selectBest keeps OfflineStub without GPU', async () => {
    vi.spyOn(aceStepBackend, 'probe').mockResolvedValue({ hasGpu: false, notes: [] });
    const best = await backendRegistry.selectBest();
    expect(best.id).toBe('offline-stub');
  });

  it('stub LoRA provenance gates are false until real corpus', () => {
    const pack = loraPackManager.get('rock-dnb-energy-v0');
    expect(pack).toBeTruthy();
    expect(pack!.provenance.ownerAttestation).toBe(false);
    expect(pack!.provenance.licenseScanOk).toBe(false);
    expect(pack!.provenance.memorizationReview).toBe('pending');
    const issues = loraPackManager.validateProvenance(pack!);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('artist style descriptors are kept (no scrub)', () => {
    expect(ARTIST_NAME_BLOCKLIST.length).toBe(0);
    const { clean, blocked } = scrubArtistNames(
      'energetic Pendulum style drop with Suno vibes and Noisia bass',
    );
    expect(blocked).toEqual([]);
    expect(clean).toContain('Pendulum');
    expect(clean).toContain('Noisia');
  });
});

describe('honesty: zip export bytes', () => {
  it('buildZip produces PK zip signature', () => {
    const data = new TextEncoder().encode('hello');
    const zip = buildZip([{ name: 'a.txt', data }]);
    expect(zip.type).toContain('zip');
    return zip.arrayBuffer().then((ab) => {
      const u8 = new Uint8Array(ab);
      expect(u8[0]).toBe(0x50); // P
      expect(u8[1]).toBe(0x4b); // K
      expect(u8[2]).toBe(0x03);
      expect(u8[3]).toBe(0x04);
    });
  });
});
