import { useEffect, useState } from 'react';
import { useStudioStore } from '../hooks/useStudioStore';
import { HELP } from '../lib/helpCopy';
import { HelpTip } from './HelpTip';
import type { PreviewState } from '@/core/audio';
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
  const productTier = useStudioStore((s) => s.productTier);
  const mixerDirty = useStudioStore((s) => s.mixerDirty);
  const generate = useStudioStore((s) => s.generate);
  const generateAgain = useStudioStore((s) => s.generateAgain);
  const vary = useStudioStore((s) => s.vary);
  const previousResult = useStudioStore((s) => s.previousResult);
  const abFlashback = useStudioStore((s) => s.abFlashback);
  const restorePrevious = useStudioStore((s) => s.restorePrevious);

  // Studio/ACE without GPU: keep Generate enabled — store fail-softs to Sketch audio
  const sketchHonesty = (productTier === 'studio' && !aceHasGpu) || (backendId.startsWith('ace-step') && !aceHasGpu);
  const studioLive = productTier === 'studio' && aceHasGpu;
  const canGenerate = !busy;
  const pill = previewPillLabel(previewState, mixerDirty, !!result, abFlashback);
  const [coachOpen, setCoachOpen] = useState(false);

  // #43 soft first-play coach — once per browser, after first Generate until Play/dismiss
  // (Play itself now lives on the waveform card — this banner just watches previewState.)
  useEffect(() => {
    if (result && flowStep === 'generated' && shouldShowFirstPlayCoach()) {
      setCoachOpen(true);
    }
  }, [result, flowStep]);

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

  const postHear = !!result && (flowStep === 'played' || flowStep === 'exported' || previewState === 'playing' || previewState === 'stopped' || previewState === 'ready');

  return (
    <>
      <div id="transport" className="transport" role="toolbar" aria-label="Transport">
        {/* UI-5: Play/Stop moved to the waveform card's compact controls — only Generate/Vary here. */}
        <span className="transport-cluster" role="group" aria-label="Generate, Vary">
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
              {busy ? 'Generating…' : sketchHonesty ? 'Generate · Sketch' : 'Generate'}
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
      {/* One transient coach max — never stack with the play coach */}
      {!coachOpen ? <FavoritesNudge /> : null}
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
      {sketchHonesty ? (
        <p className="help-prose transport-help transport-help-simple" role="status">
          Studio GPU not live — Generate stays on Sketch.
        </p>
      ) : null}
    </>
  );
}

/**
 * UI-3: Export ZIP is a More-only control — one export target, no
 * primary-row clutter. Same `exportStems` handler as before.
 */
export function ExportControls() {
  const result = useStudioStore((s) => s.result);
  const flowStep = useStudioStore((s) => s.flowStep);
  const exportStems = useStudioStore((s) => s.exportStems);
  const exportBitDepth = useStudioStore((s) => s.exportBitDepth);
  const aceHasGpu = useStudioStore((s) => s.aceHasGpu);
  const productTier = useStudioStore((s) => s.productTier);
  const studioLive = productTier === 'studio' && aceHasGpu;
  const [exportCoachOpen, setExportCoachOpen] = useState(false);

  // #67 first-export coach — Export-adjacent
  useEffect(() => {
    if (result && (flowStep === 'played' || flowStep === 'exported') && shouldShowFirstExportCoach()) {
      setExportCoachOpen(true);
    }
  }, [result, flowStep]);

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

  return (
    <span className="transport-btn-wrap export-controls">
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
        Export ZIP
      </button>
      <HelpTip
        text={
          !result ? HELP.exportDisabled : flowStep === 'exported' ? HELP.exportDone : HELP.exportZip
        }
        ariaLabel={
          !result
            ? 'Why Export is disabled'
            : flowStep === 'exported'
              ? 'What landed in the ZIP'
              : 'What Export ZIP does'
        }
      />
      {!result ? (
        <span id="help-export-disabled" className="sr-only">
          {HELP.exportDisabled}
        </span>
      ) : null}
      {exportCoachOpen && result ? (
        <span className="first-export-coach" role="status">
          Ready to Export ZIP?
          <HelpTip text={HELP.firstExportCoach} ariaLabel="About first Export tip" />
          <button type="button" className="btn tiny ghost" onClick={dismissExportCoach}>
            Got it
          </button>
        </span>
      ) : null}
    </span>
  );
}
