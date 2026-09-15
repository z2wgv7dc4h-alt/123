/** Mulberry32 seeded PRNG — deterministic from StructureInput.seed */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

export function chance(rng: () => number, p: number): boolean {
  return rng() < p;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Derive an independent 32-bit seed for a given section index from a base
 * song seed. Used so each section's drum/bass RNG sub-stream is keyed only
 * by (seed, sectionIndex) — editing one section's length (Expand/×2/Repeat)
 * can never shift another section's RNG position.
 */
export function sectionSeed(baseSeed: number, index: number): number {
  let h = (baseSeed >>> 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (index + 1), 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}
