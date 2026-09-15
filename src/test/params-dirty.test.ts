import { describe, expect, it } from 'vitest';
import {
  computeParamsDirty,
  snapshotRenderFingerprint,
} from '../ui/hooks/useStudioStore';

const base = {
  seed: 1,
  bpm: 174,
  bars: 32,
  energy: 0.75,
  darkness: 0.45,
  chaos: 0.25,
  promptText: 'dark rollers',
  vibeIntensity: 0.7,
};

describe('paramsDirty fingerprint', () => {
  it('null fingerprint is never dirty', () => {
    expect(computeParamsDirty(null, base)).toBe(false);
  });

  it('matching snapshot is clean', () => {
    const fp = snapshotRenderFingerprint(base);
    expect(computeParamsDirty(fp, base)).toBe(false);
  });

  it('energy / darkness / chaos / seed / bpm / bars / prompt / vibeIntensity flip dirty', () => {
    const fp = snapshotRenderFingerprint(base);
    expect(computeParamsDirty(fp, { ...base, energy: 0.9 })).toBe(true);
    expect(computeParamsDirty(fp, { ...base, darkness: 0.1 })).toBe(true);
    expect(computeParamsDirty(fp, { ...base, chaos: 0.9 })).toBe(true);
    expect(computeParamsDirty(fp, { ...base, seed: 99 })).toBe(true);
    expect(computeParamsDirty(fp, { ...base, bpm: 172 })).toBe(true);
    expect(computeParamsDirty(fp, { ...base, bars: 48 })).toBe(true);
    expect(computeParamsDirty(fp, { ...base, promptText: 'other' })).toBe(true);
    expect(computeParamsDirty(fp, { ...base, vibeIntensity: 0.2 })).toBe(true);
  });
});
