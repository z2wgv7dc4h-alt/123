/**
 * Minimal dependency-free PCM WAV decoder — parses RIFF/WAVE chunks directly
 * from an ArrayBuffer. No Web Audio / decodeAudioData dependency, so this
 * works identically in the browser and in plain Node (vite-node render
 * scripts, vitest) — matching this project's hand-rolled-DSP architecture
 * (see docs/ARCHITECTURE.md's Tone.js rationale for why).
 *
 * Supports 16-bit and 24-bit integer PCM (audioFormat 1), mono or stereo —
 * the two formats every sample pack this project has used ships in. Not a
 * general WAV parser (no float PCM, no extensible fmt chunks).
 */

export type DecodedWav = {
  sampleRate: number;
  numChannels: number;
  /** One Float32Array per channel, samples normalized to [-1, 1]. */
  channelData: Float32Array[];
};

export function decodeWavPcm(buf: ArrayBuffer): DecodedWav {
  const view = new DataView(buf);
  if (view.getUint32(0, false) !== 0x52494646 /* 'RIFF' */) {
    throw new Error('decodeWavPcm: not a RIFF file');
  }
  if (view.getUint32(8, false) !== 0x57415645 /* 'WAVE' */) {
    throw new Error('decodeWavPcm: not a WAVE file');
  }

  let offset = 12;
  let sampleRate = 0;
  let numChannels = 0;
  let bitsPerSample = 0;
  let audioFormat = 0;
  let dataOffset = -1;
  let dataLen = 0;

  while (offset + 8 <= view.byteLength) {
    const id = view.getUint32(offset, false);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 0x666d7420 /* 'fmt ' */) {
      audioFormat = view.getUint16(body, true);
      numChannels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bitsPerSample = view.getUint16(body + 14, true);
    } else if (id === 0x64617461 /* 'data' */) {
      dataOffset = body;
      dataLen = size;
    }
    offset = body + size + (size % 2);
  }

  if (dataOffset < 0) throw new Error('decodeWavPcm: no data chunk found');
  if (audioFormat !== 1) {
    throw new Error(`decodeWavPcm: unsupported audioFormat ${audioFormat} (only PCM=1 supported)`);
  }
  if (bitsPerSample !== 16 && bitsPerSample !== 24) {
    throw new Error(`decodeWavPcm: unsupported bitsPerSample ${bitsPerSample} (only 16/24 supported)`);
  }

  const bytesPerSample = bitsPerSample / 8;
  const frameCount = Math.floor(dataLen / (bytesPerSample * numChannels));
  const channelData: Float32Array[] = Array.from({ length: numChannels }, () => new Float32Array(frameCount));

  const readSample =
    bitsPerSample === 16
      ? (pos: number) => view.getInt16(pos, true) / 32768
      : (pos: number) => {
          // 24-bit little-endian signed, no native DataView accessor.
          const b0 = view.getUint8(pos);
          const b1 = view.getUint8(pos + 1);
          const b2 = view.getUint8(pos + 2);
          let v = b0 | (b1 << 8) | (b2 << 16);
          if (v & 0x800000) v |= ~0xffffff; // sign-extend
          return v / 8388608;
        };

  for (let frame = 0; frame < frameCount; frame++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const pos = dataOffset + (frame * numChannels + ch) * bytesPerSample;
      channelData[ch]![frame] = readSample(pos);
    }
  }

  return { sampleRate, numChannels, channelData };
}

/** Downmix to mono (average channels) and linearly resample to an exact target length. */
export function toMonoResampled(decoded: DecodedWav, targetLength: number): Float32Array {
  const { channelData } = decoded;
  const srcLen = channelData[0]!.length;
  const mono = new Float32Array(srcLen);
  for (let i = 0; i < srcLen; i++) {
    let sum = 0;
    for (const ch of channelData) sum += ch[i]!;
    mono[i] = sum / channelData.length;
  }
  if (srcLen === targetLength) return mono;

  const out = new Float32Array(targetLength);
  const ratio = (srcLen - 1) / Math.max(1, targetLength - 1);
  for (let i = 0; i < targetLength; i++) {
    const srcPos = i * ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(srcLen - 1, i0 + 1);
    const frac = srcPos - i0;
    out[i] = mono[i0]! * (1 - frac) + mono[i1]! * frac;
  }
  return out;
}
