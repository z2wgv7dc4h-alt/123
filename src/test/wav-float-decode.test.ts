/**
 * ACE-Step returns 32-bit IEEE float WAV (fmt tag 3). Before this fix the
 * decoders only accepted 16/24-bit PCM, so R-5 mastering, R-3 barGrid and
 * E-1 splices silently no-opped on real takes. Covers all three entry points
 * on the same one-parser path + the new post-limiter stereo width.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeWavChannels } from '../core/export/wav';
import { decodeWavToMono } from '../core/audio/onsetGrid';
import { decodeWavPcm } from '../core/audio/wavDecode';
import { masterStereo, MASTER_WIDTH_SIDE_HP_HZ } from '../core/audio/master';
import {
  AceStepBackend,
  ACE_SIDECAR_RENDER_URL,
  clampText2MusicBars,
  ACE_TEXT2MUSIC_MIN_BARS,
} from '../core/backends/AceStepBackend';

if (typeof URL.createObjectURL !== 'function') {
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => 'node://blob';
  (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
}

const SR = 48000;

function writeAscii(view: DataView, offset: number, str: string): number {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  return offset + str.length;
}

/** Build a 32-bit float WAV (tag 3, or 0xFFFE extensible via subformat GUID). */
function buildFloat32Wav(
  left: Float32Array,
  right: Float32Array,
  sampleRate = SR,
  extensible = false,
): ArrayBuffer {
  const numChannels = 2;
  const bytesPerSample = 4;
  const dataSize = left.length * numChannels * bytesPerSample;
  const fmtSize = extensible ? 40 : 16;
  const buf = new ArrayBuffer(12 + 8 + fmtSize + 8 + dataSize);
  const view = new DataView(buf);
  let o = 0;
  o = writeAscii(view, o, 'RIFF');
  view.setUint32(o, 4 + 8 + fmtSize + 8 + dataSize, true);
  o += 4;
  o = writeAscii(view, o, 'WAVE');
  o = writeAscii(view, o, 'fmt ');
  view.setUint32(o, fmtSize, true);
  o += 4;
  const fmtStart = o;
  view.setUint16(o, extensible ? 0xfffe : 0x0003, true);
  o += 2; // format tag
  view.setUint16(o, numChannels, true);
  o += 2;
  view.setUint32(o, sampleRate, true);
  o += 4;
  view.setUint32(o, sampleRate * numChannels * bytesPerSample, true);
  o += 4;
  view.setUint16(o, numChannels * bytesPerSample, true);
  o += 2; // blockAlign
  view.setUint16(o, 32, true);
  o += 2; // bitsPerSample
  if (extensible) {
    view.setUint16(o, 22, true);
    o += 2; // cbSize
    view.setUint16(o, 32, true);
    o += 2; // validBits
    view.setUint32(o, 0x3, true);
    o += 4; // channelMask
    view.setUint32(o, 0x00000003, true);
    o += 4; // Data1 (LE) — first 2 bytes = IEEE float subformat
    view.setUint16(o, 0x0000, true);
    o += 2; // Data2
    view.setUint16(o, 0x0010, true);
    o += 2; // Data3
    for (const b of [0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71]) {
      view.setUint8(o, b);
      o += 1;
    }
  }
  if (o !== fmtStart + fmtSize) throw new Error('fmt size mismatch');
  o = writeAscii(view, o, 'data');
  view.setUint32(o, dataSize, true);
  o += 4;
  for (let i = 0; i < left.length; i++) {
    view.setFloat32(o, left[i]!, true);
    o += 4;
    view.setFloat32(o, right[i]!, true);
    o += 4;
  }
  return buf;
}

/** Build a 32-bit signed integer PCM WAV (tag 1). */
function buildInt32Wav(left: Int32Array, right: Int32Array, sampleRate = SR): ArrayBuffer {
  const numChannels = 2;
  const dataSize = left.length * numChannels * 4;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, 36 + dataSize, true);
  view.setUint32(8, 0x57415645, false);
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 4, true);
  view.setUint16(32, numChannels * 4, true);
  view.setUint16(34, 32, true);
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, dataSize, true);
  let o = 44;
  for (let i = 0; i < left.length; i++) {
    view.setInt32(o, left[i]!, true);
    o += 4;
    view.setInt32(o, right[i]!, true);
    o += 4;
  }
  return buf;
}

const L = new Float32Array([0.1, -0.25, 0.3333333, 0.75]);
const R = new Float32Array([0.5, 0.0, -0.75, -0.125]);

function expectChannelsClose(
  actual: Float32Array[],
  expected: Float32Array[],
  tol = 1e-6,
): void {
  expect(actual).toHaveLength(expected.length);
  for (let c = 0; c < expected.length; c++) {
    expect(actual[c]!.length).toBe(expected[c]!.length);
    for (let i = 0; i < expected[c]!.length; i++) {
      expect(Math.abs(actual[c]![i]! - expected[c]![i]!)).toBeLessThanOrEqual(tol);
    }
  }
}

describe('float32 WAV decode (ACE-Step fmt tag 3)', () => {
  it('decodeWavChannels / decodeWavToMono / decodeWavPcm agree to 1e-6', () => {
    const buf = buildFloat32Wav(L, R);

    const channels = decodeWavChannels(buf);
    expect(channels.sampleRate).toBe(SR);
    expect(channels.bitDepth).toBe(32);
    expectChannelsClose(channels.channels, [L, R]);

    const mono = decodeWavToMono(buf);
    expect(mono.sampleRateHz).toBe(SR);
    expect(mono.bitDepth).toBe(32);
    expect(mono.channels).toBe(2);
    expectChannelsClose([mono.left], [L]);
    const expectedMono = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) expectedMono[i] = (L[i]! + R[i]!) / 2;
    for (let i = 0; i < expectedMono.length; i++) {
      expect(Math.abs(mono.mono[i]! - expectedMono[i]!)).toBeLessThanOrEqual(1e-6);
    }

    const pcm = decodeWavPcm(buf);
    expect(pcm.sampleRate).toBe(SR);
    expect(pcm.numChannels).toBe(2);
    expectChannelsClose(pcm.channelData, [L, R]);
  });

  it('reads WAVE_FORMAT_EXTENSIBLE via the SubFormat GUID tag', () => {
    const decoded = decodeWavChannels(buildFloat32Wav(L, R, SR, true));
    expectChannelsClose(decoded.channels, [L, R]);
  });

  it('reads 32-bit integer PCM (tag 1)', () => {
    const li = new Int32Array([0x40000000, -0x40000000, 0x7fffffff, -0x80000000]);
    const ri = new Int32Array([0, 0x7fffffff, -0x80000000, 0x40000000]);
    const decoded = decodeWavChannels(buildInt32Wav(li, ri));
    expect(decoded.bitDepth).toBe(32);
    expect(decoded.channels[0]![0]).toBeCloseTo(0.5, 5);
    expect(decoded.channels[0]![1]).toBeCloseTo(-0.5, 5);
    expect(decoded.channels[1]![3]).toBeCloseTo(0.5, 5);
  });
});

describe('masterStereo float-decoded fixture + stereo width', () => {
  it('float-decoded tone masters to -9 ±1 LUFS', () => {
    const n = SR * 2;
    const l = new Float32Array(n);
    const r = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const mid = 0.5 * Math.sin(2 * Math.PI * 440 * t);
      const side = 0.12 * Math.sin(2 * Math.PI * 1000 * t);
      l[i] = mid + side;
      r[i] = mid - side;
    }
    const decoded = decodeWavChannels(buildFloat32Wav(l, r));
    const out = masterStereo(decoded.channels[0]!, decoded.channels[1]!, decoded.sampleRate);
    expect(out.report.widthApplied).toBe(true);
    expect(out.report.lufsAfter).toBeGreaterThan(-10);
    expect(out.report.lufsAfter).toBeLessThan(-8);
    expect(out.report.peakDbAfter).toBeLessThanOrEqual(-0.999);
  });

  it('mono bass below 150 Hz stays mono through width', () => {
    const n = SR;
    const l = new Float32Array(n);
    const r = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s = 0.5 * Math.sin((2 * Math.PI * 55 * i) / SR);
      l[i] = s;
      r[i] = s;
    }
    const out = masterStereo(l, r, SR);
    let sideEnergy = 0;
    for (let i = 0; i < n; i++) {
      const side = (out.left[i]! - out.right[i]!) * 0.5;
      sideEnergy += side * side;
    }
    expect(sideEnergy).toBeLessThan(1e-9);
    expect(MASTER_WIDTH_SIDE_HP_HZ).toBe(150);
    expect(out.report.widthApplied).toBe(true);
  });
});

describe('AceStepBackend text2music durationBars clamp + skipped-stage warnings', () => {
  const backend = new AceStepBackend();
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('clampText2MusicBars never returns below 16', () => {
    expect(clampText2MusicBars(8)).toBe(ACE_TEXT2MUSIC_MIN_BARS);
    expect(clampText2MusicBars(0)).toBe(16);
    expect(clampText2MusicBars(32)).toBe(32);
  });

  it('clamps text2music payload to 16 bars and logs the clamp', async () => {
    const fakeWav = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69]);
    let binary = '';
    fakeWav.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    const b64 = btoa(binary);
    let sent: Record<string, unknown> | null = null;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === ACE_SIDECAR_RENDER_URL) {
        sent = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ jobId: 'j', seed: 7, gpuUsed: true, mixWavBase64: b64 }), {
          status: 200,
        });
      }
      throw new Error('unexpected fetch');
    }) as typeof fetch;

    const result = await backend.render({
      jobId: 'j', seed: 7, bpm: 174, bpmTolerance: 2, durationBars: 8,
      sampleRateHz: 48000, bitDepth: 16, channels: 2,
      prompt: { descriptors: ['dnb'], energy: 0.8, darkness: 0.3, chaos: 0.4, text: 'dnb' },
      stemSchemaVersion: 'v0', master: false,
    });

    expect((sent as unknown as Record<string, unknown>).durationBars).toBe(16);
    expect(warn.mock.calls.some((c) => /durationBars 8 .* clamped to 16/.test(String(c[0])))).toBe(true);
    expect(result.warnings.some((w) => /Bar grid skipped:/.test(w))).toBe(true);
  });

  it('surfaces a visible warning when mastering decodes a non-WAV payload', async () => {
    const fakeWav = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69]);
    let binary = '';
    fakeWav.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    const b64 = btoa(binary);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === ACE_SIDECAR_RENDER_URL) {
        return new Response(JSON.stringify({ jobId: 'j', seed: 7, gpuUsed: true, mixWavBase64: b64 }), {
          status: 200,
        });
      }
      throw new Error('unexpected fetch');
    }) as typeof fetch;

    const result = await backend.render({
      jobId: 'j', seed: 7, bpm: 174, bpmTolerance: 2, durationBars: 32,
      sampleRateHz: 48000, bitDepth: 16, channels: 2,
      prompt: { descriptors: ['dnb'], energy: 0.8, darkness: 0.3, chaos: 0.4, text: 'dnb' },
      stemSchemaVersion: 'v0', master: true,
    });

    expect(result.master).toBeUndefined();
    expect(result.warnings.some((w) => /^Mastering skipped: /.test(w))).toBe(true);
  });
});
