/**
 * Critic P1: Sketch 16|24-bit export — soft-pass forbidden.
 * 24-bit path must produce valid WAV headers with bitDepth 24 (not Studio).
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { offlineStubBackend } from '../core/backends';
import { renderRemixedWavBlob } from '../core/audio';
import {
  encodeWav,
  ensureWavBitDepth,
  exportZip,
  blobToUint8,
} from '../core/export';
import {
  DEFAULT_BPM,
  DEFAULT_SAMPLE_RATE,
  type RenderResult,
} from '../core/types';
import { HELP } from '../ui/lib/helpCopy';
import { useStudioStore } from '../ui/hooks/useStudioStore';

function wavBitDepth(bytes: Uint8Array): number {
  return bytes[34]! | (bytes[35]! << 8);
}

function assertRiffWave(bytes: Uint8Array) {
  expect(String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!)).toBe('RIFF');
  expect(String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!)).toBe('WAVE');
}

function listZipEntries(buf: Uint8Array): { name: string; data: Uint8Array }[] {
  const out: { name: string; data: Uint8Array }[] = [];
  let i = 0;
  const sig = 0x04034b50;
  while (i + 30 <= buf.length) {
    const magic = buf[i]! | (buf[i + 1]! << 8) | (buf[i + 2]! << 16) | (buf[i + 3]! << 24);
    if (magic !== sig) break;
    const nameLen = buf[i + 26]! | (buf[i + 27]! << 8);
    const extraLen = buf[i + 28]! | (buf[i + 29]! << 8);
    const size = buf[i + 18]! | (buf[i + 19]! << 8) | (buf[i + 20]! << 16) | (buf[i + 21]! << 24);
    const name = new TextDecoder().decode(buf.slice(i + 30, i + 30 + nameLen));
    const data = buf.slice(i + 30 + nameLen + extraLen, i + 30 + nameLen + extraLen + size);
    out.push({ name, data });
    i += 30 + nameLen + extraLen + size;
  }
  return out;
}

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
    const numChannels = view.getUint16(22, true);
    const sampleRate = view.getUint32(24, true);
    const bitDepth = view.getUint16(34, true);
    let offset = 12;
    let dataOffset = 44;
    while (offset + 8 <= view.byteLength) {
      const id = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3),
      );
      const size = view.getUint32(offset + 4, true);
      const body = offset + 8;
      if (id === 'data') {
        dataOffset = body;
        break;
      }
      offset = body + size + (size % 2);
    }
    const bytesPerSample = bitDepth / 8;
    const nFrames = Math.floor((view.byteLength - dataOffset) / (bytesPerSample * numChannels));
    const channels: Float32Array[] = Array.from({ length: numChannels }, () => new Float32Array(nFrames));
    let o = dataOffset;
    for (let i = 0; i < nFrames; i++) {
      for (let c = 0; c < numChannels; c++) {
        let s: number;
        if (bitDepth === 16) {
          s = view.getInt16(o, true) / 0x8000;
          o += 2;
        } else if (bitDepth === 24) {
          const b0 = view.getUint8(o);
          const b1 = view.getUint8(o + 1);
          const b2 = view.getUint8(o + 2);
          o += 3;
          let v = b0 | (b1 << 8) | (b2 << 16);
          if (v & 0x800000) v |= ~0xffffff;
          s = v / 0x800000;
        } else {
          throw new Error(`unsupported bit depth ${bitDepth}`);
        }
        channels[c]![i] = s;
      }
    }
    return new MockAudioBuffer(sampleRate, channels);
  }

  class MockAudioContext {
    sampleRate = 48000;
    async decodeAudioData(ab: ArrayBuffer) {
      return decodePcmWav(ab.slice(0));
    }
    async close() {}
  }
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;
}

function installUrlPolyfill() {
  if (typeof URL.createObjectURL !== 'function') {
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => 'node://blob';
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
  }
}

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
    body: { appendChild: (_n: unknown) => _n },
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
    jobId: 'bit_depth_24',
    seed: 17424,
    bpm: DEFAULT_BPM,
    bpmTolerance: 2,
    durationBars: 8,
    sampleRateHz: DEFAULT_SAMPLE_RATE,
    bitDepth: 16,
    channels: 2,
    prompt: { descriptors: ['test'], energy: 0.6, darkness: 0.4, chaos: 0.2 },
    stemSchemaVersion: 'v0',
  });
}

beforeAll(() => {
  installUrlPolyfill();
  installWavAudioContextMock();
});

describe('encodeWav / ensureWavBitDepth 24', () => {
  it('encodeWav writes PCM bitDepth 24 in header', async () => {
    const L = new Float32Array(32);
    const R = new Float32Array(32);
    L[0] = 0.25;
    R[0] = -0.5;
    const blob = encodeWav([L, R], 48000, 24);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    assertRiffWave(bytes);
    expect(wavBitDepth(bytes)).toBe(24);
    expect(bytes[22]).toBe(2);
    expect(bytes[32]).toBe(6); // blockAlign 24-bit stereo
  });

  it('ensureWavBitDepth re-encodes 16 → 24', async () => {
    const src = encodeWav([new Float32Array(16), new Float32Array(16)], 48000, 16);
    expect(wavBitDepth(new Uint8Array(await src.arrayBuffer()))).toBe(16);
    const out = await ensureWavBitDepth(src, 24);
    const bytes = new Uint8Array(await out.arrayBuffer());
    assertRiffWave(bytes);
    expect(wavBitDepth(bytes)).toBe(24);
  });
});

describe('Sketch 24-bit export path', () => {
  afterEach(() => {
    delete (globalThis as { document?: unknown }).document;
  });

  it('exportZip bitDepth 24: stems + mix_as_heard are WAV bitDepth 24; manifest honest Sketch', async () => {
    const result = await renderStub();
    const mix = result.stems.find((s) => s.id === 'mix');
    expect(mix?.blob).toBeTruthy();
    expect(wavBitDepth(new Uint8Array(await mix!.blob!.arrayBuffer()))).toBe(16);

    const kick = result.stems.filter((s) => s.id === 'kick');
    expect(kick.length).toBeGreaterThan(0);
    expect(kick[0]?.blob).toBeTruthy();
    const { blob: asHeard, preGluePeak } = await renderRemixedWavBlob(kick, {}, 24);
    expect(asHeard).toBeInstanceOf(Blob);
    expect(preGluePeak).toBeGreaterThanOrEqual(0);
    const asHeardBytes = await blobToUint8(asHeard);
    expect(wavBitDepth(asHeardBytes)).toBe(24);

    const prefix = `offline_stub_sketch_${result.seed}`;
    const cap = installDownloadCapture();
    try {
      await exportZip(result, prefix, { bitDepth: 24, asHeardMix: asHeard });
      expect(cap.captured.length).toBe(1);
      const zipBytes = await blobToUint8(cap.captured[0]!.blob);
      const entries = listZipEntries(zipBytes);
      expect(entries.some((e) => e.name.endsWith('_mix_as_heard.wav'))).toBe(true);

      for (const e of entries) {
        if (e.name.endsWith('.wav')) {
          assertRiffWave(e.data);
          expect(wavBitDepth(e.data), e.name).toBe(24);
        }
        if (e.name.endsWith('_manifest.json')) {
          const json = JSON.parse(new TextDecoder().decode(e.data));
          expect(json.bitDepth).toBe(24);
          expect(json.productTier).toBe('sketch');
          expect(json.gpuUsed).toBe(false);
        }
      }
    } finally {
      cap.restore();
    }
  }, 60_000);

  it('store exportBitDepth defaults 16 and accepts 24', () => {
    useStudioStore.setState({ exportBitDepth: 16 });
    expect(useStudioStore.getState().exportBitDepth).toBe(16);
    useStudioStore.getState().setExportBitDepth(24);
    expect(useStudioStore.getState().exportBitDepth).toBe(24);
    useStudioStore.getState().setExportBitDepth(16);
    expect(useStudioStore.getState().exportBitDepth).toBe(16);
  });

  it('HELP.exportBitDepth teaches What/When/Happens ≤160 and does not claim Studio live', () => {
    expect(HELP.exportBitDepth).toMatch(/What:/);
    expect(HELP.exportBitDepth).toMatch(/When:/);
    expect(HELP.exportBitDepth).toMatch(/What happens:/);
    expect(HELP.exportBitDepth.length).toBeLessThanOrEqual(160);
    expect(HELP.exportBitDepth).toMatch(/16|24/);
    expect(HELP.exportBitDepth).toMatch(/Sketch/i);
    expect(HELP.exportBitDepth).not.toMatch(/Studio live|Studio GPU audio/i);
    expect(HELP.badgeSketch16).not.toMatch(/waits for Studio GPU/i);
  });
});
