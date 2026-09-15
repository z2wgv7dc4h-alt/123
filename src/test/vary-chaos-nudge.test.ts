/**
 * vary() must roll a new seed AND nudge chaos by ±0.15 (clamped 0–1).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { useStudioStore } from '../ui/hooks/useStudioStore';

describe('vary() seed + chaos ±0.15', () => {
  beforeEach(() => {
    useStudioStore.setState({
      seed: 1000,
      chaos: 0.5,
      keepSeed: false,
      busy: false,
      result: null,
      paramsDirty: false,
    });
    // Avoid real generate network/audio — stub generate on store
    useStudioStore.setState({
      generate: vi.fn(async () => {
        /* no-op */
      }) as any,
    });
  });

  it('sets a new seed and chaos offset of exactly ±0.15', async () => {
    const before = useStudioStore.getState();
    // Force sign via Math.random spy: <0.5 → -1
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    await useStudioStore.getState().vary();
    rand.mockRestore();
    const after = useStudioStore.getState();
    expect(after.seed).not.toBe(before.seed);
    expect(after.chaos).toBeCloseTo(0.35, 5); // 0.5 - 0.15

    useStudioStore.setState({ seed: 2000, chaos: 0.5 });
    const rand2 = vi.spyOn(Math, 'random').mockReturnValue(0.9);
    await useStudioStore.getState().vary();
    rand2.mockRestore();
    expect(useStudioStore.getState().chaos).toBeCloseTo(0.65, 5); // 0.5 + 0.15
  });

  it('clamps chaos to 0..1', async () => {
    useStudioStore.setState({ chaos: 0.05 });
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.1); // -0.15
    await useStudioStore.getState().vary();
    rand.mockRestore();
    expect(useStudioStore.getState().chaos).toBe(0);

    useStudioStore.setState({ chaos: 0.95 });
    const rand2 = vi.spyOn(Math, 'random').mockReturnValue(0.9); // +0.15
    await useStudioStore.getState().vary();
    rand2.mockRestore();
    expect(useStudioStore.getState().chaos).toBe(1);
  });

  it('generates different seeds on consecutive vary calls', async () => {
    await useStudioStore.getState().vary();
    const seed1 = useStudioStore.getState().seed;
    await useStudioStore.getState().vary();
    const seed2 = useStudioStore.getState().seed;
    expect(seed1).not.toBe(seed2);
  });
});

const storeSrc = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../ui/hooks/useStudioStore.ts'),
  'utf8',
);

describe('generate vary + Sketch backend honesty (source)', () => {
  it('generate({ variation: vary }) applies chaos ±0.15 for SurpriseMe/Favorites', () => {
    expect(storeSrc).toMatch(/opts\?\.variation === 'vary'/);
    expect(storeSrc).toMatch(/applyVaryDiversity/);
    expect(storeSrc).toMatch(/0\.15/);
  });

  it('Sketch generate must not selectBest (ACE would win when GPU is up)', () => {
    const gen = storeSrc.split('generate: async')[1] ?? '';
    const force = gen.split('let backend')[1]?.split('const prompt')[0] ?? '';
    expect(force).toMatch(/offline-stub/);
    expect(force).not.toMatch(/selectBest\(/);
    expect(force).toMatch(/productTier === 'studio' && .*aceHasGpu/);
  });
});
