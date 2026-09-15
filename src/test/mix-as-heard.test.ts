/**
 * heard=exported E2E smoke (CPU / OfflineStub):
 * generate → (preview remix path) → mute/dirty mixer → export asserts mix_as_heard.
 *
 * Soft-pass forbidden: this file must fail if asHeard is missing when mixer dirty.
 * Browser manual G→P→E mute→export artifact is still unchecked in docs/ACCEPTANCE.md
 * (leave unchecked until a real browser artifact exists).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { offlineStubBackend } from '../core/backends';
import { audibleStemIds, renderRemixedWavBlob } from '../core/audio';
import { buildZip, blobToUint8, exportZip } from '../core/export';
import {
  DEFAULT_BIT_DEPTH,
  DEFAULT_BPM,
  DEFAULT_SAMPLE_RATE,
  type RenderResult,
  type StemId,
} from '../core/types';

/** Mirror useStudioStore remix stem sets (exportStems ~517–535). */
const ELEMENTAL_STEM_IDS = ['kick', 'snare', 'hats', 'perc', 'bass'] as const;
const REMIX_STEM_IDS = [...ELEMENTAL_STEM_IDS, 'drums'] as const;
const STEM_IDS: StemId[] = [...REMIX_STEM_IDS, 'mix'];

type RemixStemId = (typeof REMIX_STEM_IDS)[number];

function resolveRemixStemIds(audible: readonly StemId[]): RemixStemId[] {
  const elementals = ELEMENTAL_STEM_IDS.filter((id) => audible.includes(id));
  if (elementals.length > 0) return [...elementals];
  if (audible.includes('drums')) return ['drums'];
  return [];
}

function isRemixStem(id: string): id is RemixStemId {
  return (REMIX_STEM_IDS as readonly string[]).includes(id);
}

/** Parse local-file-header names from an uncompressed ZIP (PK\\x03\\x04). */
function listZipNames(buf: Uint8Array): string[] {
  const names: string[] = [];
  let i = 0;
  const sig = 0x04034b50;
  while (i + 30 <= buf.length) {
    const magic = buf[i]! | (buf[i + 1]! << 8) | (buf[i + 2]! << 16) | (buf[i + 3]! << 24);
    if (magic !== sig) break;
    const comp = buf[i + 8]! | (buf[i + 9]! << 8);
    const nameLen = buf[i + 26]! | (buf[i + 27]! << 8);
    const extraLen = buf[i + 28]! | (buf[i + 29]! << 8);
    const size = buf[i + 18]! | (buf[i + 19]! << 8) | (buf[i + 20]! << 16) | (buf[i + 21]! << 24);
    const nameBytes = buf.slice(i + 30, i + 30 + nameLen);
    names.push(new TextDecoder().decode(nameBytes));
    // STORE only (method 0) — our buildZip always uses STORE
    if (comp !== 0) throw new Error(`unexpected compression method ${comp}`);
    i += 30 + nameLen + extraLen + size;
  }
  return names;
}

function assertRiffWave(bytes: Uint8Array) {
  expect(String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!)).toBe('RIFF');
  expect(String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!)).toBe('WAVE');
}

/** Rough PCM sample energy after 44-byte WAV header (16-bit LE). */
function pcmEnergyAfterHeader(bytes: Uint8Array): number {
  let e = 0;
  for (let i = 44; i + 1 < bytes.length; i += 2) {
    const s = (bytes[i]! | (bytes[i + 1]! << 8)) << 16 >> 16;
    e += Math.abs(s);
  }
  return e;
}

/** Minimal AudioContext that decodes our encodeWav PCM blobs (Node vitest has no Web Audio). */
function installWavAudioContextMock() {
  class MockAudioBuffer {
    sampleRate: number;
    numberOfChannels: number;
    length: number;
    private channels: Float32Array[];
    constructor(sr: number, ch: Float32Array[]) {
      this.sampleRate = sr;
      this.numberOfChannels = ch.length;
      this.length = ch[0]?.length ?? 0;
      this.channels = ch;
    }
    getChannelData(c: number): Float32Array {
      return this.channels[Math.min(c, this.channels.length - 1)]!;
    }
  }

  function decodePcmWav(ab: ArrayBuffer): MockAudioBuffer {
    const view = new DataView(ab);
    if (view.byteLength < 44) throw new Error('WAV too short');
    const numChannels = view.getUint16(22, true);
    const sampleRate = view.getUint32(24, true);
    const bitDepth = view.getUint16(34, true);
    // Find 'data' chunk (tolerate non-canonical layouts)
    let offset = 12;
    let dataOffset = 44;
    let dataSize = view.byteLength - 44;
    while (offset + 8 <= view.byteLength) {
      const id =
        String.fromCharCode(view.getUint8(offset)) +
        String.fromCharCode(view.getUint8(offset + 1)) +
        String.fromCharCode(view.getUint8(offset + 2)) +
        String.fromCharCode(view.getUint8(offset + 3));
      const size = view.getUint32(offset + 4, true);
      if (id === 'data') {
        dataOffset = offset + 8;
        dataSize = size;
        break;
      }
      offset += 8 + size;
    }
    const bytesPerSample = bitDepth / 8;
    const frameCount = Math.floor(dataSize / (numChannels * bytesPerSample));
    const channels: Float32Array[] = Array.from({ length: numChannels }, () => new Float32Array(frameCount));
    let o = dataOffset;
    for (let i = 0; i < frameCount; i++) {
      for (let c = 0; c < numChannels; c++) {
        let sample = 0;
        if (bitDepth === 16) {
          sample = view.getInt16(o, true) / 0x8000;
          o += 2;
        } else if (bitDepth === 24) {
          const b0 = view.getUint8(o);
          const b1 = view.getUint8(o + 1);
          const b2 = view.getUint8(o + 2);
          let v = b0 | (b1 << 8) | (b2 << 16);
          if (v & 0x800000) v |= ~0xffffff;
          sample = v / 0x800000;
          o += 3;
        } else {
          throw new Error(`unsupported bit depth ${bitDepth}`);
        }
        channels[c]![i] = sample;
      }
    }
    return new MockAudioBuffer(sampleRate, channels);
  }

  class MockAudioContext {
    decodeAudioData(ab: ArrayBuffer): Promise<MockAudioBuffer> {
      return Promise.resolve(decodePcmWav(ab));
    }
    close(): Promise<void> {
      return Promise.resolve();
    }
  }

  (globalThis as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;
}

function installUrlPolyfill() {
  if (typeof URL.createObjectURL !== 'function') {
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => 'node://blob';
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
  }
}

/** Capture exportZip triggerDownload blob bytes via minimal DOM mocks. */
function installDownloadCapture() {
  const captured: { filename: string; blob: Blob }[] = [];
  const urls = new Map<string, Blob>();
  let urlSeq = 0;

  const createObjectURL = (blob: Blob) => {
    const u = `blob:mock-${++urlSeq}`;
    urls.set(u, blob);
    return u;
  };
  const revokeObjectURL = (u: string) => {
    urls.delete(u);
  };

  (URL as unknown as { createObjectURL: typeof createObjectURL }).createObjectURL = createObjectURL;
  (URL as unknown as { revokeObjectURL: typeof revokeObjectURL }).revokeObjectURL = revokeObjectURL;

  const doc = {
    body: {
      appendChild: (_n: unknown) => _n,
    },
    createElement: (tag: string) => {
      if (tag !== 'a') throw new Error(`unexpected element ${tag}`);
      const el: {
        href: string;
        download: string;
        rel: string;
        click: () => void;
        remove: () => void;
      } = {
        href: '',
        download: '',
        rel: '',
        click: () => {
          const blob = urls.get(el.href);
          if (!blob) throw new Error(`no blob for ${el.href}`);
          captured.push({ filename: el.download, blob });
        },
        remove: () => {},
      };
      return el;
    },
  };
  (globalThis as unknown as { document: typeof doc }).document = doc;

  return {
    captured,
    restore: () => {
      delete (globalThis as { document?: unknown }).document;
      installUrlPolyfill();
    },
  };
}

async function renderStub(): Promise<RenderResult> {
  return offlineStubBackend.render({
    jobId: 'mix_as_heard_smoke',
    seed: 17400,
    bpm: DEFAULT_BPM,
    bpmTolerance: 2,
    durationBars: 16,
    sampleRateHz: DEFAULT_SAMPLE_RATE,
    bitDepth: DEFAULT_BIT_DEPTH,
    channels: 2,
    prompt: { descriptors: ['test heard export'], energy: 0.75, darkness: 0.45, chaos: 0.2 },
    stemSchemaVersion: 'v0',
  });
}

/** Same bake path as useStudioStore.exportStems when needsRemix. */
async function bakeAsHeard(
  result: RenderResult,
  mute: Partial<Record<StemId, boolean>>,
  solo: Partial<Record<StemId, boolean>> = {},
  gainDb: Partial<Record<string, number>> = {},
): Promise<Blob | undefined> {
  const ids = audibleStemIds(mute, solo, STEM_IDS);
  const anyMute = STEM_IDS.some((id) => mute[id]);
  const anySolo = STEM_IDS.some((id) => solo[id]);
  const anyGain = REMIX_STEM_IDS.some((id) => (gainDb[id] ?? 0) !== 0);
  const needsRemix = anyMute || anySolo || anyGain;
  if (!needsRemix) return undefined;
  const remixIds = resolveRemixStemIds(ids);
  const stems = result.stems.filter((s) => remixIds.includes(s.id as RemixStemId));
  if (!stems.length) return undefined;
  const gains: Partial<Record<string, number>> = {};
  for (const s of stems) {
    if (isRemixStem(s.id)) gains[s.id] = gainDb[s.id] ?? 0;
  }
  const { blob } = await renderRemixedWavBlob(stems, gains, DEFAULT_BIT_DEPTH);
  return blob;
}

beforeAll(() => {
  installUrlPolyfill();
  installWavAudioContextMock();
});

describe('heard=exported: audibleStemIds', () => {
  it('mute kick drops kick; solo hats keeps only hats', () => {
    expect(audibleStemIds({ kick: true }, {}, STEM_IDS)).not.toContain('kick');
    expect(audibleStemIds({ kick: true }, {}, STEM_IDS)).toContain('hats');
    expect(audibleStemIds({}, { hats: true }, STEM_IDS)).toEqual(['hats']);
  });
});

describe('heard=exported: OfflineStub generate → mix_as_heard', () => {
  it('clean mixer ZIP must NOT include mix_as_heard', async () => {
    const result = await renderStub();
    const prefix = `offline_stub_sketch_${result.seed}`;
    const asHeard = await bakeAsHeard(result, {});
    expect(asHeard).toBeUndefined();

    const entries = [];
    for (const stem of result.stems) {
      if (!stem.blob) continue;
      entries.push({ name: `${prefix}_${stem.id}.wav`, data: await blobToUint8(stem.blob) });
    }
    // clean path: no asHeard entry (mirrors exportZip without opts.asHeardMix)
    const zip = buildZip(entries);
    const names = listZipNames(await blobToUint8(zip));
    expect(names.some((n) => n.includes('mix_as_heard'))).toBe(false);
    expect(names.some((n) => n.endsWith('_mix.wav'))).toBe(true);
  }, 60_000);

  it('mute-kick dirty: asHeard WAV in zip, RIFF, size>1000, differs from full remix', async () => {
    const result = await renderStub();
    const prefix = `offline_stub_sketch_${result.seed}`;

    const muteKick = { kick: true } as Partial<Record<StemId, boolean>>;
    const asHeard = await bakeAsHeard(result, muteKick);
    expect(asHeard).toBeDefined();
    expect(asHeard!.size).toBeGreaterThan(1000);
    const asHeardBytes = await blobToUint8(asHeard!);
    assertRiffWave(asHeardBytes);

    // Full audible remix (no mute) for energy comparison — proves mute mattered
    const fullIds = audibleStemIds({}, {}, STEM_IDS);
    const fullRemixIds = resolveRemixStemIds(fullIds);
    const fullStems = result.stems.filter((s) => fullRemixIds.includes(s.id as RemixStemId));
    const { blob: fullMix } = await renderRemixedWavBlob(fullStems, {}, DEFAULT_BIT_DEPTH);
    const fullBytes = await blobToUint8(fullMix);
    assertRiffWave(fullBytes);

    const energyMuted = pcmEnergyAfterHeader(asHeardBytes);
    const energyFull = pcmEnergyAfterHeader(fullBytes);
    expect(energyMuted).toBeGreaterThan(0);
    expect(energyFull).toBeGreaterThan(0);
    // Mute kick must change the summed mix (energy and/or byte length)
    expect(
      energyMuted !== energyFull || asHeardBytes.length !== fullBytes.length,
    ).toBe(true);
    expect(Math.abs(energyMuted - energyFull)).toBeGreaterThan(1000);

    const entries = [];
    for (const stem of result.stems) {
      if (!stem.blob) continue;
      entries.push({ name: `${prefix}_${stem.id}.wav`, data: await blobToUint8(stem.blob) });
    }
    entries.push({ name: `${prefix}_mix_as_heard.wav`, data: asHeardBytes });
    const zip = buildZip(entries);
    const names = listZipNames(await blobToUint8(zip));
    expect(names).toContain(`${prefix}_mix_as_heard.wav`);
    // Dry stems still present
    expect(names.some((n) => n.endsWith('_kick.wav'))).toBe(true);
    expect(names.some((n) => n.endsWith('_mix.wav'))).toBe(true);
  }, 60_000);

  it('solo hats OR non-zero gain also dirty → mix_as_heard present', async () => {
    const result = await renderStub();
    const soloHeard = await bakeAsHeard(result, {}, { hats: true });
    expect(soloHeard).toBeDefined();
    expect(soloHeard!.size).toBeGreaterThan(1000);

    const gainHeard = await bakeAsHeard(result, {}, {}, { bass: -6 });
    expect(gainHeard).toBeDefined();
    expect(gainHeard!.size).toBeGreaterThan(1000);
  }, 60_000);
});

describe('heard=exported: exportZip({ asHeardMix }) download path', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloaded zip bytes contain mix_as_heard entry name', async () => {
    const result = await renderStub();
    const prefix = `offline_stub_sketch_${result.seed}`;
    const asHeard = await bakeAsHeard(result, { kick: true });
    expect(asHeard).toBeDefined();

    const cap = installDownloadCapture();
    try {
      await exportZip(result, prefix, { asHeardMix: asHeard });
      expect(cap.captured.length).toBe(1);
      expect(cap.captured[0]!.filename).toBe(`${prefix}_export.zip`);
      const zipBytes = await blobToUint8(cap.captured[0]!.blob);
      expect(zipBytes[0]).toBe(0x50); // P
      expect(zipBytes[1]).toBe(0x4b); // K
      const names = listZipNames(zipBytes);
      expect(names).toContain(`${prefix}_mix_as_heard.wav`);
      expect(names.some((n) => n.endsWith('_manifest.json'))).toBe(true);
    } finally {
      cap.restore();
    }
  }, 60_000);

  it('exportZip without asHeardMix omits mix_as_heard', async () => {
    const result = await renderStub();
    const prefix = `offline_stub_sketch_${result.seed}`;
    const cap = installDownloadCapture();
    try {
      await exportZip(result, prefix);
      const names = listZipNames(await blobToUint8(cap.captured[0]!.blob));
      expect(names.some((n) => n.includes('mix_as_heard'))).toBe(false);
    } finally {
      cap.restore();
    }
  }, 60_000);
});
