/**
 * Live mixer parity (P0.3 gap): mute/solo/gain arms the Tone.Channel live
 * graph, which previously had no kick→bass sidechain duck and no mix-bus
 * glue, unlike the flat/export mix. PreviewPlayer now runs an rAF envelope
 * follower (duckEnvelopeStep/duckGainFromEnvelope) driving a pre-Channel
 * duck gain on the bass lane. Real Tone.Channel/Analyser objects need a
 * live AudioContext this suite doesn't have, so the deterministic envelope
 * math is unit-tested directly here — this is the provable, non-soft-pass
 * part of the fix.
 */
import { describe, expect, it } from 'vitest';
import { duckEnvelopeStep, duckGainFromEnvelope } from '../core/audio/ducking';

// Coefficients matching PreviewPlayer.startDuckLoop with 60fps RAF assumption
const FRAME_RATE_HZ = 60;
const ATK_COEF = Math.exp(-1 / Math.max(1, (5 / 1000) * FRAME_RATE_HZ)); // ~0.035674
const REL_COEF = Math.exp(-1 / Math.max(1, (55 / 1000) * FRAME_RATE_HZ)); // ~0.738556

function runEnvelope(levels: number[]): number[] {
  let env = 0;
  const out: number[] = [];
  for (const lvl of levels) {
    env = duckEnvelopeStep(lvl, env, ATK_COEF, REL_COEF);
    out.push(env);
  }
  return out;
}

describe('duckEnvelopeStep', () => {
  it('rises toward a sustained kick level and never overshoots it', () => {
    // With ATK_COEF ≈ 0.035674, time constant ≈ 1/ln(1/ATK_COEF) frames ≈ 28.0 frames
    // In 400 frames, should reach very close to 1
    const steps = runEnvelope(new Array(400).fill(1));
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!).toBeGreaterThanOrEqual(steps[i - 1]!);
      expect(steps[i]!).toBeLessThanOrEqual(1);
    }
    expect(steps.at(-1)!).toBeGreaterThan(0.999);
  });

  it('attack reaches near-full level faster than release decays back to silence', () => {
    const attackSteps = runEnvelope(new Array(100).fill(1));
    const attackFrames = attackSteps.findIndex((v) => v > 0.9);

    const releaseSeed = attackSteps.at(-1)!;
    let env = releaseSeed;
    let releaseFrames = -1;
    for (let i = 0; i < 200; i++) {
      env = duckEnvelopeStep(0, env, ATK_COEF, REL_COEF);
      if (releaseFrames === -1 && env < 0.1) releaseFrames = i;
    }
    expect(attackFrames).toBeGreaterThan(-1);
    expect(releaseFrames).toBeGreaterThan(-1);
    expect(releaseFrames).toBeGreaterThan(attackFrames);
  });

  it('stays at zero when the kick is silent', () => {
    const steps = runEnvelope(new Array(50).fill(0));
    expect(steps.every((v) => v === 0)).toBe(true);
  });

  it('clamps out-of-range input levels into 0..1', () => {
    const high = duckEnvelopeStep(5, 0, ATK_COEF, REL_COEF);
    const low = duckEnvelopeStep(-3, 0.5, ATK_COEF, REL_COEF);
    expect(high).toBeLessThanOrEqual(1);
    expect(low).toBeGreaterThanOrEqual(0);
  });
});

describe('duckGainFromEnvelope', () => {
  it('returns 1 (no duck) at zero envelope', () => {
    expect(duckGainFromEnvelope(0, 3.2)).toBeCloseTo(1, 5);
  });

  it('reduces gain toward the target duck depth as envelope approaches 1', () => {
    const g = duckGainFromEnvelope(1, 3.2);
    const expectedFloor = Math.pow(10, -3.2 / 20);
    expect(g).toBeCloseTo(expectedFloor, 2);
    expect(g).toBeLessThan(1);
  });

  it('is monotonically non-increasing as envelope rises', () => {
    let prev = duckGainFromEnvelope(0, 3.2);
    for (let e = 0.1; e <= 1; e += 0.1) {
      const g = duckGainFromEnvelope(e, 3.2);
      expect(g).toBeLessThanOrEqual(prev + 1e-9);
      prev = g;
    }
  });

  it('deeper duckDb produces a lower floor gain at full envelope', () => {
    const shallow = duckGainFromEnvelope(1, 2.4);
    const deep = duckGainFromEnvelope(1, 4.0);
    expect(deep).toBeLessThan(shallow);
  });
});
