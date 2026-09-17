import type { BarGrid } from '../types';
import { onsetEnvelope } from '../styleRef/analyzeAudio';
import { peakPickOnsetTimes } from './onsetGrid';

/** Below this, edits ignore the estimate and use offset 0. */
export const BAR_GRID_MIN_CONFIDENCE = 0.45;
const HOP_SEC = 0.005;
const MAX_ANALYZE_SEC = 60;
const SIGMA_SEC = 0.015;
const ON_GRID_SEC = 0.025;

function lowPass(samples: Float32Array, sampleRateHz: number, cutoffHz: number): Float32Array {
  const out = new Float32Array(samples.length);
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRateHz;
  const a = dt / (rc + dt);
  let y = 0;
  for (let i = 0; i < samples.length; i++) {
    y += a * ((samples[i] ?? 0) - y);
    out[i] = y;
  }
  return out;
}

/**
 * Beat phase = offset that best fits low-band (kick) onsets to a 60/bpm grid.
 * Downbeat = the beat (of 4) carrying the most low-band onset strength.
 */
export function estimateBarGrid(mono: Float32Array, sampleRateHz: number, bpm: number): BarGrid {
  const beatSec = 60 / bpm;
  const barSec = beatSec * 4;
  const n = Math.min(mono.length, Math.round(MAX_ANALYZE_SEC * sampleRateHz));
  const low = lowPass(lowPass(mono.subarray(0, n), sampleRateHz, 150), sampleRateHz, 150);
  const env = onsetEnvelope(low, sampleRateHz, HOP_SEC);
  const onsets = peakPickOnsetTimes(env, HOP_SEC, { relativeThreshold: 0.2, minSeparationSec: beatSec * 0.4 });
  if (onsets.length < 4) return { offsetSec: 0, confidence: 0, bpm };
  const strength = onsets.map((t) => env[Math.min(env.length - 1, Math.round(t / HOP_SEC))] ?? 0);

  const distToGrid = (t: number, phase: number) => {
    const rel = (t - phase) / beatSec;
    return { k: Math.round(rel), d: Math.abs(rel - Math.round(rel)) * beatSec };
  };

  let bestPhase = 0;
  let bestScore = -1;
  for (let phase = 0; phase < beatSec; phase += 0.002) {
    let score = 0;
    for (let i = 0; i < onsets.length; i++) {
      const { d } = distToGrid(onsets[i]!, phase);
      score += strength[i]! * Math.exp(-(d * d) / (2 * SIGMA_SEC * SIGMA_SEC));
    }
    if (score > bestScore) {
      bestScore = score;
      bestPhase = phase;
    }
  }

  let near = 0;
  const beatScore = [0, 0, 0, 0];
  for (let i = 0; i < onsets.length; i++) {
    const { k, d } = distToGrid(onsets[i]!, bestPhase);
    if (d > ON_GRID_SEC) continue;
    near++;
    const slot = ((k % 4) + 4) % 4;
    beatScore[slot] = (beatScore[slot] ?? 0) + strength[i]!;
  }
  let j = 0;
  for (let b = 1; b < 4; b++) if ((beatScore[b] ?? 0) > (beatScore[j] ?? 0)) j = b;

  const offsetSec = (((bestPhase + j * beatSec) % barSec) + barSec) % barSec;
  return { offsetSec, confidence: near / onsets.length, bpm };
}
