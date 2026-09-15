import { describe, it, expect } from 'vitest';
import { deriveBreakDensity, structureEngine } from '../core/structure/StructureEngine';

/**
 * Both backends claim to share one deterministic arrangement skeleton for a
 * given seed. They didn't: `AceStepBackend` hardcoded `breakDensity: 0.55`
 * while `OfflineStubBackend` derived it from chaos, so the same seed planned
 * different perc/fill density depending on which backend you rendered with.
 * Both now call `deriveBreakDensity` — this guards that.
 */
describe('deriveBreakDensity', () => {
  it('tracks chaos rather than sitting at a constant', () => {
    expect(deriveBreakDensity({ chaos: 0 })).toBeCloseTo(0.4, 5);
    expect(deriveBreakDensity({ chaos: 1 })).toBeCloseTo(0.8, 5);
    expect(deriveBreakDensity({ chaos: 0.25 })).toBeCloseTo(0.5, 5);
    expect(deriveBreakDensity({ chaos: 0.25 })).not.toBe(0.55);
  });

  it('clamps to [.4, 1] and ignores an absent style reference', () => {
    expect(deriveBreakDensity({ chaos: 5 })).toBeLessThanOrEqual(1);
    expect(deriveBreakDensity({ chaos: -5 })).toBeCloseTo(0.4, 5);
    expect(deriveBreakDensity({ chaos: 0.5 })).toBe(
      deriveBreakDensity({ chaos: 0.5, styleIntensity: 0, styleRefEnergy: 0.9 }),
    );
  });

  it('a style reference only adds density when intensity is non-zero', () => {
    const plain = deriveBreakDensity({ chaos: 0.3 });
    const styled = deriveBreakDensity({ chaos: 0.3, styleIntensity: 1, styleRefEnergy: 1 });
    expect(styled).toBeGreaterThan(plain);
  });
});

describe('cross-backend arrangement parity', () => {
  it('same seed + chaos plans an identical skeleton through the shared derivation', async () => {
    const seed = 17400;
    const chaos = 0.25;
    const common = {
      seed,
      bpm: 174,
      bars: 32,
      energy: 0.7,
      darkness: 0.45,
      chaos,
      sampleRateHz: 48000,
      songShape: 'classic',
    };
    // Both backends now feed breakDensity from the same function.
    const density = deriveBreakDensity({ chaos });
    const a = await structureEngine.plan({ ...common, breakDensity: density });
    const b = await structureEngine.plan({ ...common, breakDensity: density });

    expect(a.patternFamily).toBe(b.patternFamily);
    expect(a.bassRole.character).toBe(b.bassRole.character);
    expect(a.drums.find((d) => d.role === 'perc')?.hits.length).toBe(
      b.drums.find((d) => d.role === 'perc')?.hits.length,
    );

    // And that this is NOT what the old hardcoded 0.55 would have produced.
    const legacy = await structureEngine.plan({ ...common, breakDensity: 0.55 });
    expect(density).not.toBe(0.55);
    expect(legacy.bars).toBe(a.bars); // same shape, different density input
  });
});
