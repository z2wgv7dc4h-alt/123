/**
 * Minimal dependency-free WAV decoder — delegates to the one RIFF/WAVE
 * parser in core/export/wav (which supports 16/24/32-bit integer PCM,
 * 32-bit IEEE float, and WAVE_FORMAT_EXTENSIBLE). No Web Audio /
 * decodeAudioData dependency, so this works identically in the browser and
 * in plain Node (vite-node render scripts, vitest) — matching this project's
 * hand-rolled-DSP architecture (see docs/ARCHITECTURE.md's Tone.js rationale).
 */

import { decodeWavChannels } from '../export/wav';

export type DecodedWav = {
  sampleRate: number;
  numChannels: number;
  /** One Float32Array per channel, samples normalized to [-1, 1]. */
  channelData: Float32Array[];
};

export function decodeWavPcm(buf: ArrayBuffer): DecodedWav {
  const { channels, sampleRate } = decodeWavChannels(buf);
  return { sampleRate, numChannels: channels.length, channelData: channels };
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
