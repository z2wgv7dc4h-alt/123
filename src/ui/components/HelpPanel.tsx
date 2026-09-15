import { useEffect } from 'react';
import { GLOSSARY_BLURBS, HELP } from '../lib/helpCopy';
import { useStudioStore } from '../hooks/useStudioStore';
import { HelpTip } from './HelpTip';

/** localStorage: first-run HelpPanel open once; then stay closed. */
export const HELP_SEEN_KEY = 'dnb-help-seen-v1';

function readHelpSeen(): boolean {
  try {
    return globalThis.localStorage?.getItem(HELP_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markHelpSeen(): void {
  try {
    globalThis.localStorage?.setItem(HELP_SEEN_KEY, '1');
  } catch {
    /* private / blocked storage */
  }
}

/** Short in-app How it works — Simple Mode first-run (no eng stack names). */
export function HelpPanel() {
  const open = useStudioStore((s) => s.helpOpen);
  const setHelpOpen = useStudioStore((s) => s.setHelpOpen);
  const hasResult = useStudioStore((s) => s.result != null);

  // First-run: open once non-blocking (K2).
  useEffect(() => {
    if (!readHelpSeen()) setHelpOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  // After first Generate, close and remember (non-blocking).
  useEffect(() => {
    if (!hasResult) return;
    markHelpSeen();
    setHelpOpen(false);
  }, [hasResult, setHelpOpen]);

  return (
    <details
      className="help-panel"
      open={open}
      onToggle={(e) => {
        const next = e.currentTarget.open;
        setHelpOpen(next);
        if (!next) markHelpSeen();
      }}
    >
      <summary>How it works · 3 clicks</summary>
      <p className="help-note help-hotkey-row">
        <kbd>?</kbd> / <kbd>H</kbd> toggles this panel · <kbd>Esc</kbd> closes{' '}
        <HelpTip text={HELP.helpHotkey} ariaLabel="About help shortcut" />
      </p>
      <ul className="help-steps">
        <li>
          <strong>Style Ref (optional)</strong> — What: vibe from a track you own. When: drop
          before Generate (or skip). What happens: biases mood — never clones; tempo stays ~174.
        </li>
        <li>
          <strong>Generate</strong> (<kbd>G</kbd>) — What: new drum &amp; bass sketch here. When:
          click anytime. What happens: kick/snare/hats/bass near 174 — original, not a clone.
        </li>
        <li>
          <strong>Play</strong> (<kbd>Space</kbd>) — What: hear the mix preview. When: after
          Generate. What happens: listen; quick mute updates Play live — no Generate for mute/solo/gain.
          (Locked until you Generate.)
        </li>
        <li>
          <strong>Export ZIP</strong> (<kbd>E</kbd>) — What: ZIP for your music software. When:
          after you like the sketch. What happens: dry tracks + MIDI; remixed Play also adds{' '}
          <code>mix_as_heard.wav</code>. Or <strong>Download what I heard</strong> for one preview WAV.
        </li>
      </ul>
      <p className="help-note">
        <strong>Want another take?</strong> <strong>Again</strong> = same seed + knobs.{' '}
        <strong>Vary</strong> = new seed. Knobs need Again/Vary; mute/solo do not. Under More: Surprise
        Me and Favorites.
      </p>
      <p className="help-note">
        <strong>What you hear now:</strong> browser sketch near 174 BPM. Local GPU later is not live
        here. No YouTube / artist clones. Files stay in this browser.
      </p>
      <details className="help-why174">
        <summary>Why ~174?</summary>
        <p className="help-note">
          {GLOSSARY_BLURBS.why174} {HELP.why174}
        </p>
      </details>
      <p className="help-note muted">
        Every <strong>?</strong> answers <strong>What / When / What happens</strong>. Long{' '}
        <code>mix_as_heard</code> detail: docs/GLOSSARY.md. Press <kbd>?</kbd> or <kbd>H</kbd> anytime
        (Esc closes).
      </p>
      <details className="help-hotkeys">
        <summary>Keys · shortcuts</summary>
        <p className="help-note" title={HELP.hotkeysSheet}>
          {HELP.hotkeysSheet}
        </p>
        <ul className="help-hotkeys-list">
          <li>
            <kbd>G</kbd> Generate · <kbd>Space</kbd>/<kbd>K</kbd> Play/Stop · <kbd>E</kbd> Export
          </li>
          <li>
            <kbd>?</kbd>/<kbd>H</kbd> Help · <kbd>Esc</kbd> close help / clear loop
          </li>
          <li>
            <kbd>R</kbd> Again · <kbd>V</kbd> Vary · <kbd>,</kbd>/<kbd>.</kbd> ±1 bar
          </li>
          <li>
            <kbd>1</kbd>–<kbd>4</kbd> Solo · <kbd>Shift</kbd>+<kbd>1</kbd>–<kbd>4</kbd> Mute · Hold{' '}
            <kbd>B</kbd> previous
          </li>
          <li>
            <kbd>L</kbd> Loop section · <kbd>Z</kbd> Waveform zoom 2× · <kbd>Esc</kbd> clears zoom/loop
          </li>
        </ul>
      </details>
      <details className="help-glossary">
        <summary>Quick glossary</summary>
        <ul className="help-glossary-list">
          <li>
            <strong>Style Ref</strong> — {GLOSSARY_BLURBS.styleRef}
          </li>
          <li>
            <strong>Generate</strong> — {GLOSSARY_BLURBS.generate}
          </li>
          <li>
            <strong>Play</strong> — {GLOSSARY_BLURBS.play}
          </li>
          <li>
            <strong>Export ZIP</strong> — {GLOSSARY_BLURBS.exportZip}
          </li>
          <li>
            <strong>Stem</strong> — Separate track = one part (kick/snare/hats/bass).{' '}
            <HelpTip text={HELP.glossaryStem} ariaLabel="About stems" />
          </li>
          <li>
            <strong>Seed</strong> — Number that locks song layout.{' '}
            <HelpTip text={HELP.glossarySeed} ariaLabel="About seed" />
          </li>
          <li>
            <strong>mix_as_heard</strong> — {GLOSSARY_BLURBS.mixAsHeard}
          </li>
          <li>
            <strong>Browser sketch</strong> — {GLOSSARY_BLURBS.browserSketch}
          </li>
          <li>
            <strong>~174 BPM</strong> — {GLOSSARY_BLURBS.bpm174} {GLOSSARY_BLURBS.why174}
          </li>
        </ul>
      </details>
    </details>
  );
}
