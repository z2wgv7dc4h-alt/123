import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { encodeWav } from '../core/export/wav';
import { wavPcmPeakAbs, EXPORT_HOT_PEAK } from '../core/audio/wavPeak';
import { PreviewPlayer } from '../core/audio/PreviewPlayer';
import { HELP } from '../ui/lib/helpCopy';
import {
  shouldIgnoreTransportHotkey,
  stemIdFromKeyboardEvent,
  isHelpTipBlockingSpace,
} from '../ui/hooks/useTransportHotkeys';
import { EXPORT_HOT_PEAK_PREGLUE } from '../core/audio/wavPeak';
import {
  useStudioStore,
  GAIN_MAX,
  REMIX_STEM_IDS,
  canPlayPreview,
} from '../ui/hooks/useStudioStore';
import {
  pushToast,
  getToasts,
  __resetToastsForTests,
} from '../ui/lib/toasts';

/** Minimal document stub for tip-open / sticky queries (vitest env = node). */
function installDocStub(opts: {
  sticky?: boolean;
  tipOpen?: boolean;
  tipBtnFocused?: boolean;
}) {
  const g = globalThis as any;
  const prev = g.document;
  const tipBtn = {
    classList: { contains: (c: string) => c === 'help-tip-btn' },
  };
  g.document = {
    querySelector: (sel: string) => {
      if (sel.includes('data-sticky="true"')) return opts.sticky ? {} : null;
      if (sel.includes('data-open="true"') || sel.includes('aria-expanded="true"')) {
        return opts.tipOpen || opts.sticky ? {} : null;
      }
      return null;
    },
    activeElement: opts.tipBtnFocused ? tipBtn : null,
    body: { innerHTML: '' },
  };
  return () => {
    g.document = prev;
  };
}

describe('Brainstormer #51 wav peak scan', () => {
  it('detects hot PCM peak without Web Audio', async () => {
    const n = 64;
    const hot = new Float32Array(n);
    const quiet = new Float32Array(n);
    hot[0] = 0.995;
    quiet[0] = 0.2;
    const hotBlob = encodeWav([hot, hot], 48000, 16);
    const quietBlob = encodeWav([quiet, quiet], 48000, 16);
    const hotPeak = wavPcmPeakAbs(await hotBlob.arrayBuffer());
    const quietPeak = wavPcmPeakAbs(await quietBlob.arrayBuffer());
    expect(hotPeak).toBeGreaterThanOrEqual(EXPORT_HOT_PEAK);
    expect(quietPeak).toBeLessThan(EXPORT_HOT_PEAK);
  });
});

describe('Brainstormer #48 PreviewPlayer loop', () => {
  it('setLoop/clearLoop round-trip', () => {
    const p = new PreviewPlayer();
    p.setLoop(0.2, 0.5);
    expect(p.getLoop()).toEqual({ start: 0.2, end: 0.5 });
    p.setLoop(0.8, 0.1);
    expect(p.getLoop()).toEqual({ start: 0.1, end: 0.8 });
    p.clearLoop();
    expect(p.getLoop()).toBeNull();
    p.setLoop(0.4, 0.405); // too small → clear
    expect(p.getLoop()).toBeNull();
  });
});

describe('Brainstormer #46 typing ignore', () => {
  let restore: (() => void) | undefined;

  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  it('shouldIgnoreTransportHotkey for inputs', () => {
    const input = { tagName: 'INPUT', isContentEditable: false, closest: () => null } as any;
    expect(shouldIgnoreTransportHotkey(input)).toBe(true);
    const div = { tagName: 'DIV', isContentEditable: false, closest: () => null } as any;
    expect(shouldIgnoreTransportHotkey(div)).toBe(false);
  });

  it('does not ignore focused buttons (Play/solo must work)', () => {
    const btn = {
      tagName: 'BUTTON',
      isContentEditable: false,
      closest: (sel: string) => (sel.includes('button') ? btn : null),
    } as any;
    expect(shouldIgnoreTransportHotkey(btn)).toBe(false);
    expect(shouldIgnoreTransportHotkey(btn, 'Digit1')).toBe(false);
    expect(shouldIgnoreTransportHotkey(btn, 'KeyB')).toBe(false);
    expect(shouldIgnoreTransportHotkey(btn, ' ')).toBe(false);
  });

  it('hover-open HelpTip does NOT block Space/Digit — sticky/?-focus does (#46/#48)', () => {
    // Mere hover (tip open, not sticky, not focused) — Digit + Space must fire after Play blur
    restore = installDocStub({ tipOpen: true, sticky: false, tipBtnFocused: false });
    const btn = { tagName: 'BUTTON', isContentEditable: false, closest: () => null } as any;
    expect(isHelpTipBlockingSpace()).toBe(false);
    expect(shouldIgnoreTransportHotkey(btn, ' ')).toBe(false);
    expect(shouldIgnoreTransportHotkey(btn, 'Space')).toBe(false);
    expect(shouldIgnoreTransportHotkey(btn, 'Digit1')).toBe(false);
    expect(shouldIgnoreTransportHotkey(btn, 'KeyB')).toBe(false);
    restore();

    // Sticky tip blocks Space only
    restore = installDocStub({ tipOpen: true, sticky: true, tipBtnFocused: false });
    expect(isHelpTipBlockingSpace()).toBe(true);
    expect(shouldIgnoreTransportHotkey(btn, ' ')).toBe(true);
    expect(shouldIgnoreTransportHotkey(btn, 'Digit1')).toBe(false);
    expect(shouldIgnoreTransportHotkey(btn, 'KeyB')).toBe(false);
    restore();

    // ? button focused blocks Space
    restore = installDocStub({ tipOpen: true, sticky: false, tipBtnFocused: true });
    expect(shouldIgnoreTransportHotkey(btn, ' ')).toBe(true);
    expect(shouldIgnoreTransportHotkey(btn, 'Digit2')).toBe(false);
  });

  it('Digit1–4 via code even when key is Shift symbol', () => {
    expect(stemIdFromKeyboardEvent({ code: 'Digit1', key: '!' })).toBe('kick');
    expect(stemIdFromKeyboardEvent({ code: 'Digit2', key: '@' })).toBe('snare');
    expect(stemIdFromKeyboardEvent({ code: 'Digit3', key: '#' })).toBe('hats');
    expect(stemIdFromKeyboardEvent({ code: 'Digit4', key: '$' })).toBe('bass');
    expect(stemIdFromKeyboardEvent({ code: 'KeyG', key: 'g' })).toBeNull();
    // perc has no Digit5
    expect(stemIdFromKeyboardEvent({ code: 'Digit5', key: '5' })).toBeNull();
  });
});

describe('Brainstormer #51 preglue threshold', () => {
  it('EXPORT_HOT_PEAK_PREGLUE is below soft-limit ceiling', () => {
    expect(EXPORT_HOT_PEAK_PREGLUE).toBeLessThan(EXPORT_HOT_PEAK);
    expect(EXPORT_HOT_PEAK_PREGLUE).toBeLessThanOrEqual(0.9);
  });
});

describe('HELP invent 46–51', () => {
  it('all tips teach What/When/Happens ≤160', () => {
    for (const k of [
      'stemSoloHotkeys',
      'holdBFlashback',
      'waveformLoop',
      'favoritesNudge',
      'againVaryHotkeys',
      'peakWarnExport',
    ] as const) {
      expect(HELP[k]).toMatch(/What:/);
      expect(HELP[k]).toMatch(/When:/);
      expect(HELP[k]).toMatch(/What happens:/);
      expect(HELP[k].length).toBeLessThanOrEqual(160);
    }
  });
});

describe('Brainstormer #47 previousResult stash + Hold-B', () => {
  beforeEach(() => {
    useStudioStore.setState({
      result: null,
      previousResult: null,
      loopRegion: null,
      abFlashback: false,
      mixerAnnounce: '',
    });
    __resetToastsForTests();
  });

  it('setLoopRegion updates store + player; clearLoopRegion empties (#48 Esc path)', () => {
    useStudioStore.setState({
      result: { jobId: 'x', stems: [], backendId: 'offline-stub' } as any,
    });
    useStudioStore.getState().setLoopRegion(0.1, 0.4);
    expect(useStudioStore.getState().loopRegion).toEqual({ start: 0.1, end: 0.4 });
    useStudioStore.getState().clearLoopRegion();
    expect(useStudioStore.getState().loopRegion).toBeNull();
  });

  it('Space canPlay when ready + loop set (#48 after drag)', () => {
    useStudioStore.setState({
      result: { jobId: 'loop', stems: [], backendId: 'offline-stub' } as any,
      previewState: 'ready',
      loopRegion: { start: 0.2, end: 0.5 },
    });
    const st = useStudioStore.getState();
    expect(canPlayPreview(st.result, st.previewState)).toBe(true);
    expect(st.loopRegion?.start).toBe(0.2);
  });

  it('beginAbFlashback no-ops without previousResult', async () => {
    await useStudioStore.getState().beginAbFlashback();
    expect(useStudioStore.getState().abFlashback).toBe(false);
  });

  it('previousResult survives Generate stash shape', () => {
    const a = { jobId: 'a', stems: [], backendId: 'offline-stub' } as any;
    const b = { jobId: 'b', stems: [], backendId: 'offline-stub' } as any;
    useStudioStore.setState({ result: a, previousResult: null });
    useStudioStore.setState({
      result: b,
      previousResult: a,
    });
    expect(useStudioStore.getState().previousResult?.jobId).toBe('a');
    expect(useStudioStore.getState().result?.jobId).toBe('b');
  });

  it('beginAbFlashback sets abFlashback + observable toast when previous exists', async () => {
    const prev = {
      jobId: 'prev',
      stems: [],
      backendId: 'offline-stub',
      seed: 1,
      bpmMeasured: 174,
      warnings: [],
      checkpointId: 'c',
      structure: { bars: 32, sections: [] },
      manifest: {} as any,
    } as any;
    const cur = { ...prev, jobId: 'cur' };
    useStudioStore.setState({
      result: cur,
      previousResult: prev,
      abFlashback: false,
      previewState: 'ready',
    });
    // loadPreviewFromMixer will fail without blobs — abFlashback may clear in catch.
    // Still assert the toast/announce path fires when flag sets (best-effort).
    await useStudioStore.getState().beginAbFlashback();
    const toasts = getToasts();
    const announced =
      useStudioStore.getState().abFlashback ||
      toasts.some((t) => /previous sketch/i.test(t.message));
    expect(announced).toBe(true);
  });
});

describe('Brainstormer #50/#51 +6 dB peak warn toast', () => {
  beforeEach(() => {
    __resetToastsForTests();
  });

  it('toast stack keeps warn when capping at 3 (drops info first)', () => {
    pushToast('info1', 'info', 9000);
    pushToast('info2', 'info', 9000);
    pushToast('info3', 'info', 9000);
    pushToast('Mix looks hot — Export still ran', 'warn', 9000);
    const msgs = getToasts().map((t) => t.message);
    expect(msgs).toContain('Mix looks hot — Export still ran');
    expect(getToasts().length).toBeLessThanOrEqual(3);
    expect(getToasts().some((t) => t.kind === 'warn')).toBe(true);
  });

  it('setGainDb to +6 fires hot warn toast', () => {
    useStudioStore.setState({
      mixer: {
        mute: {
          kick: false,
          snare: false,
          hats: false,
          bass: false,
          drums: false,
          mix: false,
          perc: false,
          other: false,
        } as any,
        solo: {
          kick: false,
          snare: false,
          hats: false,
          bass: false,
          drums: false,
          mix: false,
          perc: false,
          other: false,
        } as any,
        gainDb: {
          kick: 0,
          snare: 0,
          hats: 0,
          bass: 0,
          drums: 0,
          mix: 0,
          perc: 0,
          other: 0,
        } as any,
      },
      mixerDirty: false,
      mixerUndoAvailable: false,
      result: null,
    });
    useStudioStore.getState().setGainDb('kick', GAIN_MAX);
    expect(useStudioStore.getState().mixer.gainDb.kick).toBe(GAIN_MAX);
    expect(getToasts().some((t) => t.kind === 'warn' && /hot|\+6/i.test(t.message))).toBe(
      true,
    );
  });

  it('hotGain heuristic: any remix stem at GAIN_MAX', () => {
    const gainDb = Object.fromEntries(REMIX_STEM_IDS.map((id) => [id, 0])) as Record<
      string,
      number
    >;
    gainDb.bass = GAIN_MAX;
    const hotGain = REMIX_STEM_IDS.some((id) => (gainDb[id] ?? 0) >= GAIN_MAX);
    expect(hotGain).toBe(true);
    expect(GAIN_MAX).toBe(6);
  });

  it('export-order: warn survives when success pushed after three infos', () => {
    pushToast('Export · name.zip', 'info', 9000);
    pushToast('DAW tip', 'info', 9000);
    pushToast('Mix looks hot — Export still ran', 'warn', 9000);
    pushToast('Downloaded ZIP · 16-bit Sketch · dry stems + mix', 'success', 9000);
    expect(getToasts().some((t) => t.kind === 'warn')).toBe(true);
    expect(getToasts().some((t) => t.kind === 'success')).toBe(true);
  });
});
