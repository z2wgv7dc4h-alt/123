/**
 * Style-reference window: a quiet-then-loud file must send the loud 45 s.
 */
import { describe, expect, it } from 'vitest';
import { extractReferenceWindow, loudestWindowStartSec, REFERENCE_WINDOW_SEC } from '../core/audio/referenceWindow';
import { encodeWav, decodeWavChannels } from '../core/export/wav';

const SR = 8000;

function rms(samples: Float32Array, start = 0, end = samples.length): number {
  let sum = 0;
  for (let i = start; i < end; i++) sum += samples[i]! * samples[i]!;
  return Math.sqrt(sum / Math.max(1, end - start));
}

/** 70 s tone: quiet 0-20 s, loud 20-70 s. */
function quietLoud(): Float32Array {
  const n = SR * 70;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const amp = t < 20 ? 0.05 : 0.6;
    out[i] = amp * Math.sin(2 * Math.PI * 220 * t);
  }
  return out;
}

describe('reference window', () => {
  it('picks the loud 45 s window and returns exactly 45 s', async () => {
    const src = quietLoud();
    const blob = encodeWav([src, src.slice()], SR, 16);

    const out = await extractReferenceWindow(blob);
    const decoded = decodeWavChannels(await out.arrayBuffer());
    expect(decoded.sampleRate).toBe(SR);
    const seconds = decoded.channels[0]!.length / SR;
    expect(seconds).toBeCloseTo(REFERENCE_WINDOW_SEC, 2);

    // The returned window must be louder than the first 45 s of the original.
    const first45 = rms(src, 0, SR * REFERENCE_WINDOW_SEC);
    const windowRms = rms(decoded.channels[0]!);
    expect(windowRms).toBeGreaterThan(first45 * 1.2);
    // And close to the loud-region level (0.6 sine → ~0.424 RMS).
    expect(windowRms).toBeGreaterThan(0.4);
  });

  it('loudestWindowStartSec lands in the loud region', () => {
    const start = loudestWindowStartSec(quietLoud(), SR);
    expect(start).toBeGreaterThanOrEqual(20);
    expect(start).toBeLessThanOrEqual(25);
  });

  it('leaves an already-short file untouched', async () => {
    const short = new Float32Array(SR * 10);
    const blob = encodeWav([short, short.slice()], SR, 16);
    const out = await extractReferenceWindow(blob);
    expect(out).toBe(blob);
  });
});
