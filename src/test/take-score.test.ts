/**
 * Candidate scoring: clipped / tempo-drifting takes must rank below clean ones.
 */
import { describe, expect, it } from 'vitest';
import { scoreTake } from '../core/audio/takeScore';

const SR = 48000;
const BPM = 174;

function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296) * 2 - 1;
}

/** 24 s at 174 BPM: quiet intro half, louder drop half, kicks on every beat. */
function synth(opts: { jitterSec?: number; clipGain?: number }): Float32Array {
  const beat = 60 / BPM;
  const n = Math.round(SR * 24);
  const out = new Float32Array(n);
  const rnd = prng(7);
  const totalBeats = Math.floor(24 / beat);
  for (let b = 0; b < totalBeats; b++) {
    const intro = b * beat < 11;
    const jitter = opts.jitterSec ? rnd() * opts.jitterSec : 0;
    const i0 = Math.round((b * beat + jitter) * SR);
    const amp = intro ? 0.12 : 0.8;
    for (let i = 0; i < 0.09 * SR; i++) {
      const idx = i0 + i;
      if (idx < 0 || idx >= n) continue;
      const t = i / SR;
      const kick = Math.sin(2 * Math.PI * 70 * t) * Math.exp(-t * 30);
      const click = rnd() * Math.exp(-t * 120) * 0.4;
      let v = out[idx]! + (kick + click) * amp;
      if (opts.clipGain) v = Math.max(-1, Math.min(1, v * opts.clipGain));
      out[idx] = v;
    }
  }
  return out;
}

describe('scoreTake candidate ranking', () => {
  it('ranks a clipped, tempo-drifting take below a clean one', () => {
    const clean = scoreTake({
      channels: [synth({}), synth({})],
      sampleRateHz: SR,
      bpm: BPM,
      genre: 'dnb',
    });
    const bad = scoreTake({
      channels: [synth({ jitterSec: 0.05, clipGain: 4 }), synth({ jitterSec: 0.05, clipGain: 4 })],
      sampleRateHz: SR,
      bpm: BPM,
      genre: 'dnb',
    });
    expect(clean.clipping).toBeGreaterThan(bad.clipping);
    expect(clean.tempoStability).toBeGreaterThan(bad.tempoStability);
    expect(clean.total).toBeGreaterThan(bad.total);
  });

  it('returns a bounded breakdown', () => {
    const s = scoreTake({
      channels: [synth({}), synth({})],
      sampleRateHz: SR,
      bpm: BPM,
      genre: 'dnb',
    });
    for (const key of ['tempoStability', 'dropContrast', 'clipping', 'spectralTilt', 'total'] as const) {
      expect(s[key]).toBeGreaterThanOrEqual(0);
      expect(s[key]).toBeLessThanOrEqual(1);
    }
  });
});
