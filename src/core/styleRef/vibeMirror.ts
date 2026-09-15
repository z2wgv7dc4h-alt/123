/**
 * Vibe Mirror v0 — local-only analysis of user File / ArrayBuffer.
 * Never fetches URLs / YouTube / catalogs. StructureEngine BPM stays 174.
 */
import type { VibeParamMap, VibeProfile } from '../types';
import { bufferRms } from '../audio/waveformPeaks';
import {
  STYLE_REF_ACCEPT,
  isAllowedStyleAudioFile,
  toMono,
  peakAbs,
  estimateEnergyFromRms,
  estimateBpmFromMono,
  analyzeMonoBuffer,
} from './analyzeAudio';

export { STYLE_REF_ACCEPT, isAllowedStyleAudioFile };

/** FNV-1a 32-bit hex fingerprint (params/provenance only — not raw audio persist). */
export function fingerprintHash(bytes: ArrayBuffer | Uint8Array, fileName = ''): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let h = 0x811c9dc5;
  const n = Math.min(u8.length, 256 * 1024); // cap for speed; still stable for fixtures
  for (let i = 0; i < n; i++) {
    h ^= u8[i]!;
    h = Math.imul(h, 0x01000193);
  }
  // Mix length + name so same content different names diverge slightly in provenance
  const meta = `${fileName}|${u8.length}`;
  for (let i = 0; i < meta.length; i++) {
    h ^= meta.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * High-band energy proxy (brightness) via squared sample diff / RMS.
 * Pure Float32 — Node-testable without Web Audio.
 */
export function estimateBrightness(mono: Float32Array): number {
  if (mono.length < 2) return 0;
  let hf = 0;
  for (let i = 1; i < mono.length; i++) {
    const d = mono[i]! - mono[i - 1]!;
    hf += d * d;
  }
  const rmsHf = Math.sqrt(hf / (mono.length - 1));
  // Map into 0..1 softly
  return Math.min(1, Math.max(0, Math.log10(1 + rmsHf * 40) / Math.log10(1 + 40)));
}

/** Darkness hint: inverse brightness blended with low RMS → darker. */
export function estimateDarknessHint(energy: number, brightness: number): number {
  const dark = (1 - brightness) * 0.65 + (1 - energy) * 0.35;
  return Math.min(1, Math.max(0, dark));
}

/**
 * Rough section guesses from duration + energy envelope thirds.
 * Labels only — StructureEngine still owns the real grid.
 */
export function guessSectionHints(
  mono: Float32Array,
  sampleRateHz: number,
  energy: number,
): string[] {
  const dur = mono.length / sampleRateHz;
  const hints: string[] = [];
  if (dur < 8) hints.push('oneshot / loop fragment');
  else if (dur < 45) hints.push('short clip · intro→drop sketch');
  else hints.push('fuller arrangement · multi-section');

  const third = Math.floor(mono.length / 3) || 1;
  const rmsOf = (start: number, len: number) => {
    let s = 0;
    const end = Math.min(mono.length, start + len);
    for (let i = start; i < end; i++) s += mono[i]! * mono[i]!;
    return Math.sqrt(s / Math.max(1, end - start));
  };
  const a = rmsOf(0, third);
  const b = rmsOf(third, third);
  const c = rmsOf(third * 2, third);
  if (b > a * 1.15 && b >= c) hints.push('energy peaks mid (drop-like)');
  else if (c > b * 1.1) hints.push('builds toward end');
  else if (a > b * 1.1) hints.push('front-loaded / cold open');
  if (energy > 0.65) hints.push('high drive');
  else if (energy < 0.35) hints.push('sparse / atmospheric');
  return hints.slice(0, 4);
}

/** Build VibeProfile from a decoded mono buffer (deterministic). */
export function vibeFromMono(
  mono: Float32Array,
  sampleRateHz: number,
  opts: { fileName: string; fingerprintSource: ArrayBuffer | Uint8Array; durationSec?: number },
): VibeProfile {
  const analysis = analyzeMonoBuffer(mono, sampleRateHz, 1);
  const energy = analysis.energy;
  const brightness = estimateBrightness(mono);
  const darknessHint = estimateDarknessHint(energy, brightness);
  const estimatedBpm = analysis.estimatedBpm;
  const durationSec = opts.durationSec ?? analysis.durationSec;
  return {
    estimatedBpm,
    energy,
    brightness,
    darknessHint,
    sectionHints: guessSectionHints(mono, sampleRateHz, energy),
    fingerprintHash: fingerprintHash(opts.fingerprintSource, opts.fileName),
    durationSec,
    fileName: opts.fileName,
  };
}

/**
 * Map vibe → arrangement knobs. Does NOT touch BPM (StructureEngine = 174).
 * Deterministic for a given vibe + current knobs.
 */
export function mapVibeToParams(
  vibe: VibeProfile,
  current: { energy: number; darkness: number; chaos: number },
  intensity = 0.7,
): VibeParamMap {
  const t = Math.min(1, Math.max(0, intensity));
  const energy = Math.min(
    1,
    Math.max(0, current.energy * (1 - t * 0.75) + vibe.energy * t * 0.75),
  );
  const darkness = Math.min(
    1,
    Math.max(0, current.darkness * (1 - t * 0.65) + vibe.darknessHint * t * 0.65),
  );
  // Bright + energetic → slightly more chaos / fill density
  const chaosTarget = Math.min(1, Math.max(0, vibe.energy * 0.55 + (1 - vibe.brightness) * 0.2));
  const chaos = Math.min(1, Math.max(0, current.chaos * (1 - t * 0.5) + chaosTarget * t * 0.5));
  // Soft bars bias: -4 .. +8 around default (caller clamps)
  const barsBias = Math.round((vibe.energy - 0.5) * 16);
  return { energy, darkness, chaos, barsBias };
}

async function decodeArrayBuffer(arrayBuffer: ArrayBuffer): Promise<{
  mono: Float32Array;
  sampleRateHz: number;
  durationSec: number;
}> {
  const AC =
    typeof AudioContext !== 'undefined'
      ? AudioContext
      : (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) {
    throw new Error('Web Audio is required to analyze a style reference in this browser.');
  }
  const copy = arrayBuffer.slice(0);
  const ctx = new AC();
  let audioBuf: AudioBuffer;
  try {
    audioBuf = await ctx.decodeAudioData(copy);
  } finally {
    await ctx.close().catch(() => undefined);
  }
  await new Promise<void>((r) => setTimeout(r, 0));
  const chans: Float32Array[] = [];
  for (let c = 0; c < audioBuf.numberOfChannels; c++) {
    chans.push(audioBuf.getChannelData(c));
  }
  const maxSamples = Math.min(chans[0]!.length, Math.floor(audioBuf.sampleRate * 45));
  const clipped = chans.map((ch) => ch.subarray(0, maxSamples));
  return {
    mono: toMono(clipped),
    sampleRateHz: audioBuf.sampleRate,
    durationSec: audioBuf.duration,
  };
}

/**
 * analyzeUserAudio — File picker / drag-drop bytes only.
 * Accepts File or ArrayBuffer (tests pass synthetic PCM-decoded mono via vibeFromMono).
 */
export async function analyzeUserAudio(
  input: File | ArrayBuffer,
  fileName = 'upload.wav',
): Promise<VibeProfile> {
  let ab: ArrayBuffer;
  let name: string;
  if (typeof File !== 'undefined' && input instanceof File) {
    if (!isAllowedStyleAudioFile(input)) {
      throw new Error(
        'Style reference must be an MP3 or WAV you own / have rights to (browser upload only — no YouTube or URLs).',
      );
    }
    ab = await input.arrayBuffer();
    name = input.name;
  } else if (input instanceof ArrayBuffer) {
    ab = input;
    name = fileName;
  } else {
    throw new Error('Style reference requires a local File or ArrayBuffer (no URLs).');
  }

  // Browser path: decode via Web Audio
  if (typeof AudioContext !== 'undefined' || typeof (globalThis as { webkitAudioContext?: unknown }).webkitAudioContext !== 'undefined') {
    try {
      const { mono, sampleRateHz, durationSec } = await decodeArrayBuffer(ab);
      return vibeFromMono(mono, sampleRateHz, {
        fileName: name,
        fingerprintSource: ab,
        durationSec,
      });
    } catch (e) {
      // Fall through for Node tests that pass raw float buffers differently
      if (typeof File !== 'undefined' && input instanceof File) throw e;
    }
  }

  // Node / synthetic: treat ArrayBuffer as Float32 PCM @ 48k mono
  const mono = new Float32Array(ab.slice(0));
  if (!mono.length) throw new Error('Empty audio buffer — pick an MP3/WAV you own.');
  return vibeFromMono(mono, 48000, { fileName: name, fingerprintSource: ab });
}

/** Convenience: peak abs unused export for tests */
export { peakAbs, bufferRms, estimateEnergyFromRms, estimateBpmFromMono };
