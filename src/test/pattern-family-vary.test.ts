import { describe, expect, it } from 'vitest';
import { structureEngine, pickPatternFamily, mulberry32 } from '../core/structure';

function kickSignature(map: Awaited<ReturnType<typeof structureEngine.plan>>): string {
  const kick = map.drums.find((d) => d.role === 'kick')!;
  const dropStart = map.sections.find((s) => s.name === 'drop')?.startBar ?? 8;
  const hits = kick.hits
    .filter((h) => h.bar >= dropStart && h.bar < dropStart + 4)
    .map((h) => `${h.bar}:${h.beat.toFixed(2)}`)
    .sort()
    .join('|');
  return hits;
}

describe('pattern family + Vary diversity', () => {
  it('pickPatternFamily returns amen | twoStep | syncopated', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 64; seed++) {
      seen.add(pickPatternFamily(mulberry32(seed)));
    }
    expect(seen.has('amen')).toBe(true);
    expect(seen.has('twoStep')).toBe(true);
    expect(seen.has('syncopated')).toBe(true);
    expect(seen.size).toBe(3);
  });

  it('different seeds can produce different pattern families', async () => {
    const families = new Set<string>();
    for (const seed of [1001, 2002, 3003, 4004, 5005, 6006, 7007, 8008, 9009, 10101]) {
      const map = await structureEngine.plan({
        seed,
        bpm: 174,
        bars: 32,
        energy: 0.75,
        breakDensity: 0.5,
        darkness: 0.45,
        chaos: 0.3,
      });
      expect(map.patternFamily).toBeTruthy();
      families.add(map.patternFamily!);
    }
    expect(families.size).toBeGreaterThanOrEqual(2);
  });

  it('two Vary-like seeds sound different: kick drop signature differs', async () => {
    const a = await structureEngine.plan({
      seed: 17400,
      bpm: 174,
      bars: 32,
      energy: 0.8,
      breakDensity: 0.55,
      darkness: 0.5,
      chaos: 0.25,
    });
    const b = await structureEngine.plan({
      seed: 99112233,
      bpm: 174,
      bars: 32,
      energy: 0.8,
      breakDensity: 0.55,
      darkness: 0.5,
      chaos: 0.45, // chaos nudge
    });
    const sigA = kickSignature(a);
    const sigB = kickSignature(b);
    expect(sigA.length).toBeGreaterThan(0);
    expect(sigB.length).toBeGreaterThan(0);
    // Must differ in family, kick pattern, bass character, or kick count
    const differ =
      a.patternFamily !== b.patternFamily ||
      sigA !== sigB ||
      a.bassRole.character !== b.bassRole.character ||
      a.drums.find((d) => d.role === 'kick')!.hits.length !==
        b.drums.find((d) => d.role === 'kick')!.hits.length;
    expect(differ).toBe(true);
  });

  it('chaos bump changes hit density on same seed family path', async () => {
    const low = await structureEngine.plan({
      seed: 424242,
      bpm: 174,
      bars: 32,
      energy: 0.7,
      breakDensity: 0.4,
      darkness: 0.4,
      chaos: 0.1,
    });
    const high = await structureEngine.plan({
      seed: 424242,
      bpm: 174,
      bars: 32,
      energy: 0.7,
      breakDensity: 0.4,
      darkness: 0.4,
      chaos: 0.85,
    });
    // Same seed → same family (rng starts same) but chaos changes later draws
    expect(low.patternFamily).toBe(high.patternFamily);
    const kickLow = low.drums.find((d) => d.role === 'kick')!.hits.length;
    const kickHigh = high.drums.find((d) => d.role === 'kick')!.hits.length;
    const bassLow = low.bassRole.notes.length;
    const bassHigh = high.bassRole.notes.length;
    expect(kickLow !== kickHigh || bassLow !== bassHigh).toBe(true);
  });
});
