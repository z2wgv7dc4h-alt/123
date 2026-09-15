/**
 * Loads a real one-bar breakbeat loop (see src/assets/samples/breaks/) and
 * returns it as a mono Float32Array resampled to an exact bar length at the
 * render's sample rate, so it tiles into OfflineStubBackend's bar-indexed
 * mix with no drift. Dual-path I/O (fetch in the browser, fs in Node) so the
 * same code runs in the app and in the Node-based render/test scripts —
 * see docs/ARCHITECTURE.md's Tone.js note for why this project avoids
 * anything that only works with a real browser AudioContext.
 */
import { decodeWavPcm, toMonoResampled } from './wavDecode';
// Ambient 'node:fs' typing lives in node-fs-shim.d.ts (project has no
// @types/node — see that file for why).

export type BreakLoopName = 'amen_174bpm_1bar' | 'funky_drummer_174bpm_1bar';

const cache = new Map<string, Float32Array>();

async function readWavBytes(name: BreakLoopName): Promise<ArrayBuffer> {
  const url = new URL(`../../assets/samples/breaks/${name}.wav`, import.meta.url);
  if (url.protocol === 'file:') {
    const { readFileSync } = await import('node:fs');
    const buf = readFileSync(url);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  }
  const res = await fetch(url.href);
  if (!res.ok) throw new Error(`loadBreakLoop: fetch ${url.href} failed (${res.status})`);
  return res.arrayBuffer();
}

/**
 * Returns a mono Float32Array of exactly `barSamples` length, resampled from
 * the source loop's native rate. Cached per (name, sampleRate, barSamples).
 */
export async function loadBreakLoopMono(
  name: BreakLoopName,
  barSamples: number,
): Promise<Float32Array> {
  const key = `${name}:${barSamples}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const bytes = await readWavBytes(name);
  const decoded = decodeWavPcm(bytes);
  const mono = toMonoResampled(decoded, barSamples);
  cache.set(key, mono);
  return mono;
}
