import { describe, it, expect } from 'vitest';
import { structureEngine } from '../core/structure/StructureEngine';

/**
 * Regression guard for a bug that shipped twice.
 *
 * "Dubstep feel" and "Half-time drop" are presented as two distinct style
 * choices but were byte-identical in generation: one `halfTime` boolean
 * drove drums, bass character, the energy curve and the ACE caption for
 * both. The first fix split them but still collided ~1/3 of seeds, because
 * both shapes reach the bass-character pick with the same seed and the same
 * prior RNG draw count — so they read the same underlying random value, and
 * 'growl' sat at the same index in both weighted arrays. Both rounds were
 * caught only by rendering and reading the output by hand. This asserts it.
 */
async function planShape(seed: number, songShape: string, energy = 0.75) {
  return structureEngine.plan({
    seed,
    bpm: 174,
    bars: 32,
    energy,
    darkness: 0.45,
    chaos: 0.25,
    breakDensity: 0.55,
    sampleRateHz: 48000,
    songShape,
  });
}

/**
 * Drop energy is `Math.min(1, base + dropBoost)`, so above base ≈ 0.58 both
 * shapes clamp to 1.0 and their different dropBoosts (0.5 vs 0.42) become
 * unobservable. That ceiling is real current behaviour, not a test artifact
 * — the energy assertions below deliberately use a base low enough to see
 * the difference.
 */
const UNCLAMPED_ENERGY = 0.4;

const SEEDS = [1, 7, 17, 42, 101, 17400, 2026, 8888];

describe('song shape divergence: dubstep vs half-time-drop', () => {
  it('drop-section energy differs deterministically on every seed', async () => {
    for (const seed of SEEDS) {
      const dub = await planShape(seed, 'dubstep', UNCLAMPED_ENERGY);
      const half = await planShape(seed, 'half-time-drop', UNCLAMPED_ENERGY);

      const dropLevel = (map: Awaited<ReturnType<typeof planShape>>) => {
        const drop = map.sections.find((s) => s.name === 'drop');
        expect(drop, `seed ${seed} produced no drop section`).toBeDefined();
        const mid = drop!.startBar + Math.floor(drop!.lengthBars / 2);
        return map.energyCurve.find((p) => p.bar === mid)?.level;
      };

      const dubDrop = dropLevel(dub);
      const halfDrop = dropLevel(half);
      expect(dubDrop, `seed ${seed}: dubstep drop level missing`).toBeDefined();
      expect(halfDrop, `seed ${seed}: half-time-drop drop level missing`).toBeDefined();
      // dubstep uses a bigger dropBoost (0.5 vs 0.42) — independent of RNG,
      // so this must hold for every seed, not just most.
      expect(
        dubDrop!,
        `seed ${seed}: dubstep drop energy should exceed half-time-drop`,
      ).toBeGreaterThan(halfDrop!);
    }
  });

  it('bass character diverges across seeds instead of tracking in lockstep', async () => {
    let differing = 0;
    for (const seed of SEEDS) {
      const dub = await planShape(seed, 'dubstep');
      const half = await planShape(seed, 'half-time-drop');
      if (dub.bassRole.character !== half.bassRole.character) differing++;
    }
    // Before the RNG-decorrelation fix this was 0 for the sampled seeds.
    expect(
      differing,
      'dubstep and half-time-drop picked identical bass character on every seed — the RNG streams are correlated again',
    ).toBeGreaterThan(0);
  });

  it('dubstep never picks a thin sub bass (growl/reese only)', async () => {
    for (const seed of SEEDS) {
      const dub = await planShape(seed, 'dubstep');
      expect(['growl', 'reese'], `seed ${seed}`).toContain(dub.bassRole.character);
    }
  });

  it('is deterministic — same seed and shape replans identically', async () => {
    const a = await planShape(17400, 'dubstep');
    const b = await planShape(17400, 'dubstep');
    expect(a.bassRole.character).toBe(b.bassRole.character);
    expect(a.energyCurve).toEqual(b.energyCurve);
  });
});
