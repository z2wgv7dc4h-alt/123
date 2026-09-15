import { beforeEach, describe, expect, it } from 'vitest';
import { HELP } from '../ui/lib/helpCopy';
import {
  barBeatFromProgress,
  formatBarBeatSection,
  formatMmSs,
  nudgeBarRatio,
  sectionLoopRatios,
} from '../ui/lib/barPosition';
import {
  __resetResumeDraftForTests,
  loadResumeDraft,
  saveResumeDraft,
  shouldShowResumeDraftStrip,
  dismissResumeDraftStrip,
} from '../ui/lib/resumeDraft';
import { shouldIgnoreTransportHotkey } from '../ui/hooks/useTransportHotkeys';
import { useStudioStore } from '../ui/hooks/useStudioStore';

describe('HELP invent 52–63', () => {
  it('tips teach What/When/Happens ≤160 (56 may skip tip)', () => {
    for (const k of [
      'barBeatReadout',
      'barNudge',
      'heardBadge',
      'resumeDraft',
      'helpHotkey',
      'waveformHoverTime',
      'sectionLoop',
      'restorePrevious',
      'favoritesEmpty',
      'stemMuteHotkeys',
      'exportNamePreview',
    ] as const) {
      expect(HELP[k]).toMatch(/What:/);
      expect(HELP[k]).toMatch(/When:/);
      expect(HELP[k]).toMatch(/What happens:/);
      expect(HELP[k].length).toBeLessThanOrEqual(160);
    }
  });
});

describe('Brainstormer #52–53 bar position', () => {
  it('bar:beat + section from progress', () => {
    const sections = [
      { name: 'intro' as const, startBar: 0, lengthBars: 8 },
      { name: 'drop' as const, startBar: 16, lengthBars: 8 },
    ];
    expect(barBeatFromProgress(0, 32)).toEqual({ bar: 0, beat: 1 });
    expect(formatBarBeatSection(0.5, 32, sections)).toMatch(/:/);
    expect(formatBarBeatSection(16 / 32, 32, sections)).toMatch(/Drop/i);
  });

  it('nudgeBarRatio ±1 bar', () => {
    expect(nudgeBarRatio(0.25, 32, 1)).toBeCloseTo(0.25 + 1 / 32, 5);
    expect(nudgeBarRatio(0, 32, -1)).toBe(0);
    expect(nudgeBarRatio(1, 32, 1)).toBe(1);
  });

  it('store nudgeBar seeks without flipping play state truth', () => {
    useStudioStore.setState({
      result: {
        jobId: 'j',
        bpmMeasured: 174,
        stems: [],
        structure: { bars: 32, sections: [] },
      } as any,
      previewState: 'ready',
    });
    useStudioStore.getState().seekPreview(0.25);
    useStudioStore.getState().nudgeBar(1);
    expect(useStudioStore.getState().previewState).toBe('ready');
  });
});

describe('Brainstormer #55 resume draft (no blob)', () => {
  beforeEach(() => {
    __resetResumeDraftForTests();
  });

  it('saves knobs only and shows until dismissed', () => {
    saveResumeDraft({
      seed: 99,
      bpm: 174,
      bars: 32,
      energy: 0.7,
      darkness: 0.4,
      chaos: 0.2,
      promptText: 'deep bass',
      vibeIntensity: 0.5,
    });
    const d = loadResumeDraft();
    expect(d?.seed).toBe(99);
    expect(d).not.toHaveProperty('blob');
    expect(shouldShowResumeDraftStrip()).toBe(true);
    dismissResumeDraftStrip();
    expect(shouldShowResumeDraftStrip()).toBe(false);
  });
});

describe('Brainstormer #57/#62 hotkey guards', () => {
  it('ignores inputs and HelpTip for transport', () => {
    const input = { tagName: 'INPUT', isContentEditable: false, closest: () => null } as any;
    expect(shouldIgnoreTransportHotkey(input)).toBe(true);
    const div = { tagName: 'DIV', isContentEditable: false, closest: () => null } as any;
    expect(shouldIgnoreTransportHotkey(div)).toBe(false);
  });

  it('setHelpOpen toggles without touching G/Space/E handlers', () => {
    useStudioStore.setState({ helpOpen: false });
    useStudioStore.getState().setHelpOpen(true);
    expect(useStudioStore.getState().helpOpen).toBe(true);
    useStudioStore.getState().setHelpOpen(false);
    expect(useStudioStore.getState().helpOpen).toBe(false);
  });
});

describe('Brainstormer #58–59 waveform helpers', () => {
  it('formatMmSs', () => {
    expect(formatMmSs(0, 125)).toBe('0:00');
    expect(formatMmSs(0.5, 120)).toBe('1:00');
  });

  it('sectionLoopRatios leaves room for seek (min width)', () => {
    const loop = sectionLoopRatios(16, 8, 32);
    expect(loop).toEqual({ start: 0.5, end: 0.75 });
    expect(sectionLoopRatios(0, 0, 32)).toBeNull();
  });
});

describe('Brainstormer #60 restorePrevious', () => {
  it('swaps previous into current', async () => {
    const a = { jobId: 'a', stems: [], backendId: 'offline-stub' } as any;
    const b = { jobId: 'b', stems: [], backendId: 'offline-stub' } as any;
    useStudioStore.setState({
      result: b,
      previousResult: a,
      mixer: useStudioStore.getState().mixer,
      previewState: 'ready',
    });
    // restorePrevious loads preview — may fail without blobs; still swaps result
    await useStudioStore.getState().restorePrevious();
    expect(useStudioStore.getState().result?.jobId).toBe('a');
    expect(useStudioStore.getState().previousResult?.jobId).toBe('b');
  });
});

describe('Brainstormer #56 mixer announce', () => {
  it('toggleMute writes mixerAnnounce', () => {
    useStudioStore.setState({
      result: { jobId: 'm', stems: [{ id: 'kick' }], backendId: 'offline-stub' } as any,
      mixerAnnounce: '',
      previewState: 'ready',
    });
    useStudioStore.getState().toggleMute('kick');
    expect(useStudioStore.getState().mixerAnnounce).toMatch(/kick/i);
  });
});
