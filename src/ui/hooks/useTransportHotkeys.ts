import { useEffect } from 'react';
import { useStudioStore, canPlayPreview, ELEMENTAL_STEM_IDS } from './useStudioStore';
import { markHelpSeen } from '../components/HelpPanel';

/** True when a HelpTip is sticky-open or its ? button is focused (not mere hover). */
export function isHelpTipBlockingSpace(): boolean {
  if (typeof document === 'undefined') return false;
  const sticky = !!document.querySelector('.help-tip-wrap[data-sticky="true"]');
  const tipBtnFocused =
    !!document.activeElement &&
    (document.activeElement as HTMLElement).classList?.contains('help-tip-btn');
  return sticky || tipBtnFocused;
}

/**
 * True when transport hotkeys must not fire.
 * Typing always blocks. Focused buttons do NOT block (#46/#48 Play autofocus).
 * Mere hover HelpTip does NOT block Digit/B/R/V/Space — only sticky/?-focus blocks Space
 * (QA: after Generate mouse sits on tip; after waveform drag Play is blurred).
 */
export function shouldIgnoreTransportHotkey(
  t: HTMLElement | null,
  keyOrCode?: string,
): boolean {
  if (t) {
    const tag = t.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) {
      return true;
    }
  }
  const k = (keyOrCode ?? '').toLowerCase();
  if (k === ' ' || k === 'space' || k === 'k' || k === 'keyk') {
    // Space/K: only block while reading a sticky or focused tip — not hover-open.
    if (isHelpTipBlockingSpace()) return true;
  }
  return false;
}

/** Digit1–4 → elemental stems. Prefer ev.code so Shift+1 is still Digit1 (not "!"). */
export const STEM_DIGIT_CODES: Record<string, (typeof ELEMENTAL_STEM_IDS)[number]> = {
  Digit1: 'kick',
  Digit2: 'snare',
  Digit3: 'hats',
  Digit4: 'bass',
};

/** Resolve stem from keyboard — code first, bare key 1–4 fallback (never Shift symbol keys). */
export function stemIdFromKeyboardEvent(ev: {
  code: string;
  key: string;
}): (typeof ELEMENTAL_STEM_IDS)[number] | null {
  const fromCode = STEM_DIGIT_CODES[ev.code];
  if (fromCode) return fromCode;
  // Bare digit key only — "!" / "@" must not solo or Generate
  if (ev.key >= '1' && ev.key <= '4') {
    const map: Record<string, (typeof ELEMENTAL_STEM_IDS)[number]> = {
      '1': 'kick',
      '2': 'snare',
      '3': 'hats',
      '4': 'bass',
    };
    return map[ev.key] ?? null;
  }
  return null;
}

/**
 * Space = play/stop (loop-aware), G = generate, E = export,
 * 1–4 = stem solo (#46), Shift+1–4 = mute (#62),
 * Hold-B = A/B (#47), R/V = Again/Vary (#50), Esc = help / zoom / clear loop,
 * L = loop section (#81), Z = waveform zoom (#82),
 * ,/. = ±1 bar (#53), ?/H = HelpPanel (#57).
 * Capture-phase so HelpTip / focused Play cannot swallow Digit/Esc/Space (#46/#48).
 */
export function useTransportHotkeys() {
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.tagName?.toLowerCase() === 'input' ||
          t.tagName?.toLowerCase() === 'textarea' ||
          t.tagName?.toLowerCase() === 'select' ||
          t.isContentEditable);

      // #57 Esc closes HelpPanel first; #82 zoom; else #48/#81 clears loop
      // Capture phase — runs before HelpTip document bubble stopPropagation.
      if (ev.key === 'Escape' && !typing) {
        const st = useStudioStore.getState();
        if (st.helpOpen) {
          ev.preventDefault();
          ev.stopPropagation();
          st.setHelpOpen(false);
          markHelpSeen();
          return;
        }
        if (st.waveformZoom) {
          ev.preventDefault();
          ev.stopPropagation();
          st.setWaveformZoom(false);
          return;
        }
        if (st.loopRegion) {
          // Clear loop even if a hover HelpTip would otherwise eat Esc (#48).
          ev.preventDefault();
          ev.stopPropagation();
          st.clearLoopRegion();
          return;
        }
        return;
      }

      if (shouldIgnoreTransportHotkey(t, ev.key === ' ' ? ' ' : ev.code || ev.key)) return;
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;

      const st = useStudioStore.getState();
      const key = ev.key.toLowerCase();
      const code = ev.code;

      // #46 solo / #62 Shift+mute — Digit1–4 via ev.code (Shift+1 is still Digit1)
      // Allowed with Play/button focus; not blocked by hover HelpTip.
      const stemId = stemIdFromKeyboardEvent(ev);
      if (stemId && st.result) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.shiftKey) st.toggleMute(stemId);
        else st.toggleSolo(stemId);
        return;
      }

      // #47 Hold-B A/B flashback — start when previous exists and not already flashing.
      // Allow key-repeat so hold-B still engages if the first keydown raced Generate (#47).
      if (code === 'KeyB' || key === 'b') {
        if (st.previousResult && !st.abFlashback) {
          ev.preventDefault();
          ev.stopPropagation();
          void st.beginAbFlashback();
        }
        return;
      }

      // #57 ? or H opens/toggles HelpPanel — never G/Space/E
      if (ev.key === '?' || key === 'h') {
        ev.preventDefault();
        const next = !st.helpOpen;
        st.setHelpOpen(next);
        if (!next) markHelpSeen();
        return;
      }

      // #53 , = −1 bar · . = +1 bar (optional hotkeys)
      if ((ev.key === ',' || ev.key === '.') && st.result) {
        ev.preventDefault();
        st.nudgeBar(ev.key === ',' ? -1 : 1);
        return;
      }

      // #50 R Again / V Vary — allowed with button focus
      if ((code === 'KeyR' || key === 'r') && st.result && !st.busy) {
        ev.preventDefault();
        void st.generateAgain();
        return;
      }
      if ((code === 'KeyV' || key === 'v') && st.result && !st.busy) {
        ev.preventDefault();
        void st.vary();
        return;
      }

      // #81 L = loop current section (never steals G/Space/E)
      if ((code === 'KeyL' || key === 'l') && st.result) {
        ev.preventDefault();
        st.loopCurrentSection();
        return;
      }

      // #82 Z = waveform 2× zoom toggle (waveform-only affordance; Esc clears)
      if ((code === 'KeyZ' || key === 'z') && st.result) {
        ev.preventDefault();
        st.setWaveformZoom(!st.waveformZoom);
        return;
      }

      if ((code === 'KeyG' || key === 'g') && !st.busy) {
        ev.preventDefault();
        void st.generate();
        return;
      }
      // #48 Space: seek loop start + play when canPlay — works after waveform blur
      if (key === ' ' || code === 'Space' || key === 'k' || code === 'KeyK') {
        ev.preventDefault();
        ev.stopPropagation();
        if (st.previewState === 'playing') st.stop();
        else if (canPlayPreview(st.result, st.previewState)) {
          if (st.loopRegion) {
            st.seekPreview(st.loopRegion.start);
          }
          void st.play();
        }
        return;
      }
      if ((code === 'KeyE' || key === 'e') && st.result) {
        ev.preventDefault();
        st.exportStems();
      }
    };

    const onKeyUp = (ev: KeyboardEvent) => {
      const key = ev.key.toLowerCase();
      if (ev.code !== 'KeyB' && key !== 'b') return;
      // Always end flashback on B release — do not require focus / ignore buttons (#47)
      const st = useStudioStore.getState();
      if (st.abFlashback) {
        ev.preventDefault();
        void st.endAbFlashback();
      }
    };

    // Capture so focused Play / HelpTip cannot swallow Digit/Esc/Space (#46/#48)
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }, []);
}
