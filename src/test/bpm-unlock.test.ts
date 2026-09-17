import { describe, expect, it } from 'vitest';
import { clampProductBpm, BPM_MIN, BPM_MAX, DEFAULT_BPM } from '../core/types';
import { useStudioStore } from '../ui/hooks/useStudioStore';

describe('tempo is a setting, not a lock', () => {
  it('clampProductBpm bounds and rounds', () => {
    expect(clampProductBpm(10)).toBe(BPM_MIN);
    expect(clampProductBpm(999)).toBe(BPM_MAX);
    expect(clampProductBpm(140.4)).toBe(140);
    expect(clampProductBpm(Number.NaN)).toBe(DEFAULT_BPM);
  });

  it('store keeps 140 (old clamp forced 170)', () => {
    useStudioStore.getState().setBpm(140);
    expect(useStudioStore.getState().bpm).toBe(140);
    useStudioStore.getState().setBpm(DEFAULT_BPM);
  });
});
