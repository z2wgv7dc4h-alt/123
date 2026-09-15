import { describe, expect, it } from 'vitest';
import {
  retailAcePayloadLabel,
  retailBackendLabel,
  retailCapLabel,
  retailCapState,
  retailCapabilityChips,
  retailModelLabel,
  retailStructureLabel,
} from '../ui/lib/retailLabels';

describe('retailLabels (cycle-7/8 chrome honesty)', () => {
  it('never surfaces OfflineStub / hard-grid-v0', () => {
    expect(retailBackendLabel('offline-stub')).toBe('browser sketch');
    expect(retailBackendLabel('offline-stub-v2')).toBe('browser sketch');
    expect(retailBackendLabel('ace-step-1.5')).toBe('Studio GPU');
    expect(retailStructureLabel('hard-grid-v0')).toBe('song layout ~174');
    expect(retailStructureLabel('hard-grid-v1')).toBe('song layout ~174');
    for (const s of [
      retailBackendLabel('offline-stub'),
      retailStructureLabel('hard-grid-v0'),
    ]) {
      expect(s).not.toMatch(/OfflineStub|hard-grid/i);
    }
  });

  it('maps capability keys to retail English (cycle-8 PowerExtras)', () => {
    expect(retailCapLabel('fullSong')).toBe('Full song');
    expect(retailCapLabel('legoStems')).toBe('Stem rebuild');
    expect(retailCapLabel('extract')).toBe('Extract');
    expect(retailCapLabel('repaint')).toBe('Repaint');
    expect(retailCapLabel('loraLoad')).toBe('Style packs');
    expect(retailCapLabel('maxDurationSec')).toBe('Max length');
    expect(retailCapLabel('sampleRatesHz')).toBe('Sample rate');
    expect(retailCapState(true)).toBe('on');
    expect(retailCapState(false)).toBe('off');
    expect(retailCapState(false, true)).toBe('later');
    for (const key of ['fullSong', 'legoStems', 'loraLoad'] as const) {
      expect(retailCapLabel(key)).not.toMatch(/fullSong|legoStems|loraLoad/);
    }
    const chips = retailCapabilityChips({
      fullSong: true,
      legoStems: false,
      extract: false,
      repaint: false,
      loraLoad: true,
      maxDurationSec: 90,
      sampleRatesHz: [48000],
    });
    expect(chips.join(' ')).not.toMatch(/fullSong|legoStems|loraLoad|OfflineStub|hard-grid/i);
  });

  it('reports the restored LM plan payload (thinking on, DnB, 64, base)', () => {
    expect(retailModelLabel('acestep-v15-base')).toBe('base');
    expect(retailModelLabel('acestep-v15-sft')).toBe('SFT');
    expect(retailModelLabel('acestep-v15-turbo')).toBe('turbo');
    expect(retailModelLabel(undefined)).toBe('base');
    const line = retailAcePayloadLabel({
      thinking: true,
      captionFamily: 'DnB',
      steps: 64,
      model: 'acestep-v15-base',
    });
    expect(line).toBe('thinking true · caption family DnB · 64 steps · model base');
    expect(line).not.toMatch(/thinking false|instrumental rock|guitar/i);
  });
});
