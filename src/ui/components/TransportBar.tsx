import { useEffect, useRef, useState } from 'react';
import { useStudioStore, canPlayPreview } from '../hooks/useStudioStore';
import { HELP } from '../lib/helpCopy';
import { HelpTip } from './HelpTip';
import type { PreviewState } from '@/core/audio';
import { previewPlayer } from '@/core/audio';
import {
  formatElapsedTotal,
  formatBarSectionClockLine,
  resolvePlaybackDuration,
} from '../lib/barPosition';
import {
  shouldShowFirstPlayCoach,
  dismissFirstPlayCoach,
} from '../lib/firstPlayCoach';
import {
  shouldShowFirstExportCoach,
  dismissFirstExportCoach,
} from '../lib/firstExportCoach';
import { FavoritesNudge } from './FavoritesNudge';

function previewPillLabel(
  previewState: PreviewState,
  mixerDirty: boolean,
  hasResult: boolean,
  abFlashback = false,
): string {
  if (abFlashback) return 'A/B · previous sketch (hold B)';
  if (!hasResult) {
    if (previewState === 'idle') return 'Ready to generate';
    return `preview · ${previewState}`;
  }
  if (mixerDirty) {
    if (previewState === 'playing') return 'Hearing your tweaks';
    if (previewState === 'loading') return 'Updating preview…';
    return 'Tweaks ready — hit Play';
  }
  switch (previewState) {
    case 'idle':
      return 'Ready — hit Play';
    case 'loading':
      return 'Loading preview…';
    case 'ready':
      return 'Ready — hit Play';
    case 'playing':
      return 'Playing';
    case 'stopped':
      return 'Stopped · hit Play to replay';
    default:
      return `preview · ${previewState}`;
  }
}

export function TransportBar() {
  const busy = useStudioStore((s) => s.busy);
  const previewState = useStudioStore((s) => s.previewState);
  const result = useStudioStore((s) => s.result);
  const flowStep = useStudioStore((s) => s.flowStep);
  const backendId = useStudioStore((s) => s.backendId);
  const aceHasGpu = useStudioStore((s) => s.aceHasGpu);
  const mode = useStudioStore((s) => s.mode);
  const productTier = useStudioStore((s) => s.productTier);
  const mixerDirty = useStudioStore((s) => s.mixerDirty);
  const generate = useStudioStore((s) => s.generate);
  const generateAgain = useStudioStore((s) => s.generateAgain);
  const vary = useStudioStore((s) => s.vary);
  const play = useStudioStore((s) => s.play);
  const stop = useStudioStore((s) => s.stop);
  const exportStems = useStudioStore((s) => s.exportStems);
  const exportHeardSingle = useStudioStore((s) => s.exportHeardSingle);
  const exportBitDepth = useStudioStore((s) => s.exportBitDepth);
  const setExportBitDepth = useStudioStore((s) => s.setExportBitDepth);
  const previousResult = useStudioStore((s) => s.previousResult);
  const abFlashback = useStudioStore((s) => s.abFlashback);
  const restorePrevious = useStudioStore((s) => s.restorePrevious);

  // Critic ONE Play truth: ready|stopped only (shared with Space hotkey).
  const canPlay = canPlayPreview(result, previewState);
  const playNeedsAttention =
    !!result && flowStep === 'generated' && (previewState === 'ready' || previewState === 'stopped');
  // #78 mixerDirty → pulse Play (rehear), NEVER Generate
  const rehearPulse =
    !!result && mixerDirty && previewState !== 'playing' && previewState !== 'loading';
  const playPulse = playNeedsAttention || rehearPulse;
  const [playGlowOnce, setPlayGlowOnce] = useState(false);
  const lastGlowJob = useRef<string | null>(null);

  // Soft 1.2s Play glow on new result (reduced-motion: CSS static outline only)
  useEffect(() => {
    if (!result || flowStep !== 'generated') return;
    if (lastGlowJob.current === result.jobId) return;
    lastGlowJob.current = result.jobId;
    setPlayGlowOnce(true);
    const id = window.setTimeout(() => setPlayGlowOnce(false), 1200);
    return () => window.clearTimeout(id);
  }, [result, flowStep]);

  // Studio/ACE without GPU: keep Generate enabled — store fail-softs to Sketch audio
  const sketchHonesty = (productTier === 'studio' && !aceHasGpu) || (backendId.startsWith('ace-step') && !aceHasGpu);
  const studioLive = productTier === 'studio' && aceHasGpu;
  const canGenerate = !busy;
  const pill = previewPillLabel(previewState, mixerDirty, !!result, abFlashback);
  const [coachOpen, setCoachOpen] = useState(false);
  const [exportCoachOpen, setExportCoachOpen] = useState(false);
  const playBtnRef = useRef<HTMLButtonElement>(null);
  const lastAutofocusJob = useRef<string | null>(null);

  // #43 soft first-play coach — once per browser, after first Generate until Play/dismiss
  useEffect(() => {
    if (result && flowStep === 'generated' && shouldShowFirstPlayCoach()) {
      setCoachOpen(true);
    }
  }, [result, flowStep]);

  // #77 Play autofocus after Generate — skip while typing / HelpTip open
  useEffect(() => {
    if (!result || flowStep !== 'generated' || busy) return;
    if (lastAutofocusJob.current === result.jobId) return;
    const typingOrTip = () => {
      if (typeof document === 'undefined') return true;
      if (document.querySelector('.help-tip-wrap[data-open="true"]')) return true;
      if (document.querySelector('.help-tip-btn[aria-expanded="true"]')) return true;
      const t = document.activeElement as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return true;
      return false;
    };
    if (typingOrTip()) return;
    lastAutofocusJob.current = result.jobId;
    // Defer so Generate click blur settles
    const id = window.setTimeout(() => {
      if (typingOrTip()) return;
      playBtnRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(id);
  }, [result, flowStep, busy]);

  useEffect(() => {
    if (previewState === 'playing' && coachOpen) {
      dismissFirstPlayCoach();
      setCoachOpen(false);
    }
  }, [previewState, coachOpen]);

  useEffect(() => {
    if (!coachOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismissFirstPlayCoach();
        setCoachOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [coachOpen]);

  const dismissCoach = () => {
    dismissFirstPlayCoach();
    setCoachOpen(false);
  };

  // #67 first-export coach — Export-adjacent; never stacks with first-play
  useEffect(() => {
    if (coachOpen) {
      setExportCoachOpen(false);
      return;
    }
    if (
      result &&
      (flowStep === 'played' || flowStep === 'exported') &&
      shouldShowFirstExportCoach()
    ) {
      setExportCoachOpen(true);
    }
  }, [result, flowStep, coachOpen]);

  useEffect(() => {
    if (!exportCoachOpen) return;
    const t = window.setTimeout(() => {
      dismissFirstExportCoach();
      setExportCoachOpen(false);
    }, 8000);
    return () => window.clearTimeout(t);
  }, [exportCoachOpen]);

  useEffect(() => {
    if (flowStep === 'exported' && exportCoachOpen) {
      dismissFirstExportCoach();
      setExportCoachOpen(false);
    }
  }, [flowStep, exportCoachOpen]);

  const dismissExportCoach = () => {
    dismissFirstExportCoach();
    setExportCoachOpen(false);
  };

  // Always-on clock: elapsed / total from honest playback duration (mix/live).
  const [clockProgress, setClockProgress] = useState(0);
  const [liveDur, setLiveDur] = useState(0);
  useEffect(() => {
    if (!result) {
      setClockProgress(0);
      setLiveDur(0);
      return;
    }
    let raf = 0;
    const tick = () => {
      setClockProgress(previewPlayer.getProgress());
      setLiveDur(previewPlayer.getDurationSec());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [result, previewState]);

  const structBars = result?.structure?.bars ?? 0;
  const bpm = result?.bpmMeasured ?? 174;
  const mixDur = result?.stems.find((s) => s.id === 'mix')?.durationSec ?? 0;
  const playback = resolvePlaybackDuration({
    mixDurationSec: mixDur,
    liveDurationSec: liveDur > 0 ? liveDur : null,
    bars: structBars,
    bpm,
  });
  const elapsedSec = clockProgress * playback.durationSec;
  const postHear = !!result && (flowStep === 'played' || flowStep === 'exported' || previewState === 'playing' || previewState === 'stopped' || previewState === 'ready');

  return (
    <>
      <div id="transport" className="transport" role="toolbar" aria-label="Transport">
        {/* UI-1: Play · Stop · Generate · Vary in one cluster — same handlers, nothing between them. */}
        <span className="transport-cluster" role="group" aria-label="Play, Stop, Generate, Vary">
          <span className="transport-btn-wrap">
            <button
              ref={playBtnRef}
              type="button"
              className={`btn btn-play ${playPulse ? 'accent pulse' : ''}${playGlowOnce ? ' glow-once' : ''}`}
              disabled={!canPlay}
              aria-keyshortcuts="Space"
              title={
                rehearPulse
                  ? 'Tweaks ready — hit Play to rehear (Space)'
                  : canPlay
                    ? 'Play mix preview — replay OK after end (Space)'
                    : HELP.playDisabled
              }
              aria-describedby={!canPlay ? 'help-play-disabled' : undefined}
              onClick={() => void play()}
            >
              {mode === 'simple' ? 'Play' : '2 · Play'}
            </button>
            <HelpTip
              text={canPlay ? HELP.play : HELP.playDisabled}
              ariaLabel={canPlay ? 'What Play does' : 'Why Play is disabled'}
            />
            {mode !== 'simple' && (
              <HelpTip text={HELP.playAutofocus} ariaLabel="About Play autofocus" />
            )}
            {mode !== 'simple' && rehearPulse ? (
              <HelpTip text={HELP.rehearPulse} ariaLabel="About rehear pulse on Play" />
            ) : null}
            {!canPlay ? (
              <span id="help-play-disabled" className="sr-only">
                {HELP.playDisabled}
              </span>
            ) : null}
            {mixerDirty && result ? (
              <span className="heard-remix-badge" role="status">
                Heard remix
                <HelpTip text={HELP.heardBadge} ariaLabel="About heard remix badge" />
              </span>
            ) : null}
          </span>
          <span className="transport-btn-wrap">
            <button
              type="button"
              className={`btn btn-stop ${previewState === 'playing' ? 'on' : ''}`}
              disabled={previewState !== 'playing'}
              title="Stop mix preview (Space)"
              onClick={() => stop()}
            >
              Stop
            </button>
            <HelpTip text={HELP.stop} ariaLabel="What Stop does" />
          </span>
          <span className="transport-btn-wrap">
            <button
              type="button"
              className={`btn primary btn-generate ${busy ? 'pulse' : ''}`}
              disabled={!canGenerate}
              aria-busy={busy}
              aria-keyshortcuts="g"
              title={
                sketchHonesty
                  ? 'Studio GPU not live — Generate still makes Sketch (CPU 16-bit) near 174 BPM (G)'
                  : studioLive
                    ? 'Creates original Studio ACE rock-DnB near 174 BPM (G)'
                    : 'Creates an original Sketch near 174 BPM (G)'
              }
              onClick={() => void generate()}
            >
              {busy
                ? 'Generating…'
                : mode === 'simple'
                  ? sketchHonesty
                    ? 'Generate · Sketch'
                    : studioLive
                      ? 'Generate'
                      : 'Generate'
                  : sketchHonesty
                    ? '1 · Generate (Sketch)'
                    : studioLive
                      ? '1 · Generate'
                      : '1 · Generate'}
            </button>
            <HelpTip text={HELP.generate} ariaLabel="What Generate does" />
          </span>
          {postHear ? (
            <span className="transport-btn-wrap">
              <button
                type="button"
                className="btn accent btn-vary-primary"
                disabled={!canGenerate}
                title="New seed + chaos nudge — fresh arrangement (V)"
                onClick={() => void vary()}
              >
                Vary
              </button>
              <HelpTip text={HELP.vary} ariaLabel="What Vary does" />
            </span>
          ) : null}
        </span>
        <span className="transport-btn-wrap">
          <button
            type="button"
            className="btn accent btn-export"
            disabled={!result}
            aria-keyshortcuts="e"
            onClick={() => exportStems()}
            title={
              result
                ? studioLive
                  ? `Downloads Studio ZIP · ${exportBitDepth}-bit + MIDI (E)`
                  : `Downloads Sketch ZIP · ${exportBitDepth}-bit stems + MIDI (E)`
                : HELP.exportDisabled
            }
            aria-describedby={!result ? 'help-export-disabled' : undefined}
          >
            {mode === 'simple' ? 'Export ZIP' : '3 · Export Sketch ZIP'}
          </button>
          <HelpTip
            text={
              !result
                ? HELP.exportDisabled
                : flowStep === 'exported'
                  ? HELP.exportDone
                  : HELP.exportZip
            }
            ariaLabel={
              !result
                ? 'Why Export is disabled'
                : flowStep === 'exported'
                  ? 'What landed in the ZIP'
                  : 'What Export ZIP does'
            }
          />
          {mode !== 'simple' && (
            <>
              <HelpTip text={HELP.peakWarnExport} ariaLabel="About hot mix export warning" />
              <HelpTip text={HELP.exportNamePreview} ariaLabel="About export file name" />
            </>
          )}
          {!result ? (
            <span id="help-export-disabled" className="sr-only">
              {HELP.exportDisabled}
            </span>
          ) : null}
          {exportCoachOpen && result && !coachOpen ? (
            <span className="first-export-coach" role="status">
              Ready to Export ZIP?
              <HelpTip text={HELP.firstExportCoach} ariaLabel="About first Export tip" />
              <button type="button" className="btn tiny ghost" onClick={dismissExportCoach}>
                Got it
              </button>
            </span>
          ) : null}
        </span>
        {result && mode !== 'simple' ? (
          <span className="transport-btn-wrap">
            <button
              type="button"
              className="btn ghost tiny"
              title={`Download one WAV of the mix you heard · ${exportBitDepth}-bit Sketch`}
              onClick={() => exportHeardSingle()}
            >
              Download heard
            </button>
            <HelpTip text={HELP.exportHeardSingle} ariaLabel="What Download heard does" />
          </span>
        ) : null}
        {result && mode !== 'simple' && (
          <span className="transport-btn-wrap export-bit-depth-inline" title="Sketch export bit depth">
            <label className="export-bit-depth-compact">
              <span className="sr-only">Export bit depth</span>
              <select
                value={exportBitDepth}
                onChange={(e) => setExportBitDepth(e.target.value === '24' ? 24 : 16)}
                aria-label="Sketch export bit depth"
              >
                <option value={16}>16-bit</option>
                <option value={24}>24-bit</option>
              </select>
            </label>
            <HelpTip text={HELP.exportBitDepth} ariaLabel="About export bit depth" />
          </span>
        )}
        {playNeedsAttention ? (
          <span className="sr-only" role="status" aria-live="polite">
            Ready — hit Play
          </span>
        ) : null}
        {result && playback.durationSec > 0 ? (
          <span
            className={`transport-clock${mode === 'simple' ? ' compact' : ''}`}
            role="status"
            aria-live="off"
            title={HELP.transportClock}
          >
            <span className="transport-clock-elapsed">
              {formatElapsedTotal(elapsedSec, playback.durationSec)}
            </span>
            {mode !== 'simple' ? (
              <span className="transport-clock-bar">
                {formatBarSectionClockLine(
                  clockProgress,
                  structBars,
                  result.structure?.sections,
                  playback.durationSec,
                )}
              </span>
            ) : null}
            {playback.mismatch && playback.mismatchNote ? (
              <span className="transport-clock-mismatch" title={HELP.durationMismatch}>
                {playback.mismatchNote}
              </span>
            ) : null}
            <HelpTip text={HELP.transportClock} ariaLabel="About transport clock" />
          </span>
        ) : null}
        <span
          className={`pill${!result ? ' pill-pre' : ''}${mixerDirty && result ? ' remix-live' : ''}${abFlashback ? ' ab-flashback' : ''}`}
          aria-live="polite"
        >
          {pill}
          {mixerDirty && result ? (
            <>
              <HelpTip text={HELP.remixLive} ariaLabel="About hearing your tweaks" />
              <HelpTip text={HELP.rehear} ariaLabel="About rehearing tweaks" />
            </>
          ) : null}
        </span>
      </div>
      {coachOpen && result && (
        <div className="first-play-coach" role="status">
          <span className="first-play-coach-text">
            Hit Play to hear — stem mutes update live.
            <HelpTip text={HELP.firstPlayCoach} ariaLabel="About first Play tip" />
          </span>
          <button type="button" className="btn tiny ghost" onClick={dismissCoach}>
            Got it
          </button>
        </div>
      )}
      {/* One transient coach max — never stack with play/export coaches */}
      {!coachOpen && !exportCoachOpen ? <FavoritesNudge /> : null}
      {result && (
        <div className="vary-row" role="group" aria-label="Regenerate options">
          <span className="transport-btn-wrap">
            <button
              type="button"
              className="btn ghost tiny"
              disabled={!canGenerate}
              title="Generate again with the same seed and settings (R)"
              onClick={() => void generateAgain()}
            >
              Again
            </button>
            <HelpTip text={HELP.again} ariaLabel="What Again does" />
          </span>
          <span className="transport-btn-wrap">
            <button
              type="button"
              className="btn ghost tiny"
              disabled={!canGenerate}
              title="New seed — fresh arrangement, same vibe settings (V)"
              onClick={() => void vary()}
            >
              Vary
            </button>
            <HelpTip text={HELP.vary} ariaLabel="What Vary does" />
          </span>
          {mode !== 'simple' && (
            <>
              <HelpTip text={HELP.againVaryHotkeys} ariaLabel="About R and V hotkeys" />
              <HelpTip text={HELP.holdBFlashback} ariaLabel="About Hold-B A/B" />
            </>
          )}
          {abFlashback ? (
            <span className="ab-flashback-pill" role="status" aria-live="polite">
              A/B · previous
            </span>
          ) : null}
          {previousResult ? (
            <span className="transport-btn-wrap">
              <button
                type="button"
                className="btn ghost tiny"
                disabled={busy}
                title="Restore the previous sketch"
                onClick={() => void restorePrevious()}
              >
                Previous
              </button>
              <HelpTip text={HELP.restorePrevious} ariaLabel="What Previous does" />
            </span>
          ) : null}
        </div>
      )}
      {mode !== 'simple' ? (
        <p className="help-prose transport-help">
          {sketchHonesty
            ? 'Studio needs a local GPU — not live. Generate/Export stay on Sketch (CPU). Not Studio AI yet.'
            : 'Optional vibe ref · Generate = original 174 BPM Sketch · Play = preview · Export Sketch ZIP = stems + mix_as_heard when remixed'}
        </p>
      ) : sketchHonesty ? (
        <p className="help-prose transport-help transport-help-simple" role="status">
          Studio GPU not live — Generate stays on Sketch.
        </p>
      ) : null}
    </>
  );
}
