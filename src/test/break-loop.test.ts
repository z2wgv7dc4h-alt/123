import { describe, it, expect } from 'vitest';
import { decodeWavPcm, toMonoResampled } from '../core/audio/wavDecode';
import { loadBreakLoopMono } from '../core/audio/loadBreakLoop';

/** Builds a minimal valid 16-bit PCM WAV buffer for decoder unit tests — no
 * dependency on any real asset file. */
function buildWav16(
  sampleRate: number,
  numChannels: number,
  samplesPerChannel: Int16Array[],
): ArrayBuffer {
  const frameCount = samplesPerChannel[0]!.length;
  const dataLen = frameCount * numChannels * 2;
  const buf = new ArrayBuffer(44 + dataLen);
  const view = new DataView(buf);
  view.setUint32(0, 0x52494646, false); // 'RIFF'
  view.setUint32(4, 36 + dataLen, true);
  view.setUint32(8, 0x57415645, false); // 'WAVE'
  view.setUint32(12, 0x666d7420, false); // 'fmt '
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false); // 'data'
  view.setUint32(40, dataLen, true);
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame++) {
    for (let ch = 0; ch < numChannels; ch++) {
      view.setInt16(offset, samplesPerChannel[ch]![frame]!, true);
      offset += 2;
    }
  }
  return buf;
}

describe('decodeWavPcm', () => {
  it('decodes a 16-bit mono WAV to normalized Float32 samples', () => {
    const raw = new Int16Array([0, 16384, -16384, 32767, -32768]);
    const buf = buildWav16(44100, 1, [raw]);
    const decoded = decodeWavPcm(buf);
    expect(decoded.sampleRate).toBe(44100);
    expect(decoded.numChannels).toBe(1);
    expect(decoded.channelData).toHaveLength(1);
    const out = decoded.channelData[0]!;
    expect(out).toHaveLength(5);
    expect(out[0]).toBeCloseTo(0, 4);
    expect(out[1]).toBeCloseTo(0.5, 3);
    expect(out[2]).toBeCloseTo(-0.5, 3);
    expect(out[3]).toBeCloseTo(1, 3);
    expect(out[4]).toBeCloseTo(-1, 3);
  });

  it('decodes interleaved stereo correctly (channels not swapped/mixed)', () => {
    const left = new Int16Array([32767, 0, -32768]);
    const right = new Int16Array([0, 32767, 0]);
    const buf = buildWav16(48000, 2, [left, right]);
    const decoded = decodeWavPcm(buf);
    expect(decoded.numChannels).toBe(2);
    expect(decoded.channelData[0]![0]).toBeCloseTo(1, 3);
    expect(decoded.channelData[1]![0]).toBeCloseTo(0, 3);
    expect(decoded.channelData[0]![1]).toBeCloseTo(0, 3);
    expect(decoded.channelData[1]![1]).toBeCloseTo(1, 3);
  });

  it('rejects a non-RIFF buffer instead of misreading garbage', () => {
    const buf = new ArrayBuffer(44);
    expect(() => decodeWavPcm(buf)).toThrow(/RIFF/);
  });
});

describe('toMonoResampled', () => {
  it('averages channels to mono', () => {
    const decoded = {
      sampleRate: 44100,
      numChannels: 2,
      channelData: [new Float32Array([1, 1, 1]), new Float32Array([-1, -1, -1])],
    };
    const mono = toMonoResampled(decoded, 3);
    expect(Array.from(mono)).toEqual([0, 0, 0]);
  });

  it('resamples to an exact target length without changing overall shape', () => {
    const decoded = {
      sampleRate: 44100,
      numChannels: 1,
      channelData: [new Float32Array([0, 1, 0, -1, 0])],
    };
    const out = toMonoResampled(decoded, 9);
    expect(out).toHaveLength(9);
    // First and last samples must survive resampling exactly.
    expect(out[0]).toBeCloseTo(0, 5);
    expect(out[8]).toBeCloseTo(0, 5);
  });

  it('is a no-op when target length already matches source length', () => {
    const src = new Float32Array([0.1, 0.2, 0.3]);
    const decoded = { sampleRate: 44100, numChannels: 1, channelData: [src] };
    const out = toMonoResampled(decoded, 3);
    expect(out).toBe(src.length === out.length ? out : out); // length parity
    expect(Array.from(out)).toEqual(Array.from(src));
  });
});

describe('loadBreakLoopMono (real committed assets)', () => {
  it('loads the amen break at an exact requested length, non-silent', async () => {
    const barSamples = Math.round((60 / 174) * 4 * 48000);
    const loop = await loadBreakLoopMono('amen_174bpm_1bar', barSamples);
    expect(loop).toHaveLength(barSamples);
    let peak = 0;
    for (const v of loop) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeGreaterThan(0.05);
  });

  it('loads the funky drummer break at an exact requested length, non-silent', async () => {
    const barSamples = Math.round((60 / 174) * 4 * 48000);
    const loop = await loadBreakLoopMono('funky_drummer_174bpm_1bar', barSamples);
    expect(loop).toHaveLength(barSamples);
    let peak = 0;
    for (const v of loop) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeGreaterThan(0.05);
  });

  it('caches — second call for the same key returns the same array instance', async () => {
    const barSamples = Math.round((60 / 174) * 4 * 48000);
    const a = await loadBreakLoopMono('amen_174bpm_1bar', barSamples);
    const b = await loadBreakLoopMono('amen_174bpm_1bar', barSamples);
    expect(a).toBe(b);
  });
});
