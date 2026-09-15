import { describe, expect, it } from 'vitest';
import {
  computeMixerDirty,
  resolveRemixStemIds,
  ELEMENTAL_STEM_IDS,
} from '../ui/hooks/useStudioStore';
import type { MixerState, StemId } from '../core/types';

function blankMixer(): MixerState {
  const mute = {} as Record<StemId, boolean>;
  const solo = {} as Record<StemId, boolean>;
  const gainDb = {} as Record<StemId, number>;
  for (const id of [...ELEMENTAL_STEM_IDS, 'drums', 'mix', 'other'] as StemId[]) {
    mute[id] = false;
    solo[id] = false;
    gainDb[id] = 0;
  }
  return { mute, solo, gainDb };
}

describe('mixerDirty / remix helpers', () => {
  it('clean mixer is not dirty', () => {
    expect(computeMixerDirty(blankMixer())).toBe(false);
  });

  it('mute / solo / gain mark dirty', () => {
    const m = blankMixer();
    m.mute.kick = true;
    expect(computeMixerDirty(m)).toBe(true);
    const s = blankMixer();
    s.solo.bass = true;
    expect(computeMixerDirty(s)).toBe(true);
    const g = blankMixer();
    g.gainDb.hats = -6;
    expect(computeMixerDirty(g)).toBe(true);
  });

  it('resolveRemixStemIds prefers elementals over drums bus', () => {
    expect(resolveRemixStemIds(['kick', 'snare', 'drums'])).toEqual(['kick', 'snare']);
    expect(resolveRemixStemIds(['drums'])).toEqual(['drums']);
    expect(resolveRemixStemIds(['mix'])).toEqual([]);
  });
});
