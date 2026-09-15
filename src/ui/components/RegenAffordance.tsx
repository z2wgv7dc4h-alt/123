import { useStudioStore } from '../hooks/useStudioStore';
import { HELP } from '../lib/helpCopy';
import { listChangedParamLabels } from '../lib/paramsChanged';
import { HelpTip } from './HelpTip';

/** Hero secondary row when arrangement knobs diverge from last render (not mixerDirty). */
export function RegenAffordance() {
  const result = useStudioStore((s) => s.result);
  const busy = useStudioStore((s) => s.busy);
  const paramsDirty = useStudioStore((s) => s.paramsDirty);
  const lastRenderFingerprint = useStudioStore((s) => s.lastRenderFingerprint);
  const seed = useStudioStore((s) => s.seed);
  const bpm = useStudioStore((s) => s.bpm);
  const bars = useStudioStore((s) => s.bars);
  const energy = useStudioStore((s) => s.energy);
  const darkness = useStudioStore((s) => s.darkness);
  const chaos = useStudioStore((s) => s.chaos);
  const promptText = useStudioStore((s) => s.promptText);
  const vibeIntensity = useStudioStore((s) => s.vibeIntensity);
  const generateAgain = useStudioStore((s) => s.generateAgain);

  if (!result || !paramsDirty || busy) return null;

  // Studio without GPU never blocks: generate() fail-softs to Sketch audio.
  const canGenerate = !busy;

  const changed = listChangedParamLabels(lastRenderFingerprint, {
    seed,
    bpm,
    bars,
    energy,
    darkness,
    chaos,
    promptText,
    vibeIntensity,
  });
  const changedLabel = changed.length ? changed.join(', ') : 'settings';

  return (
    <div className="regen-affordance" role="status" aria-label="Settings changed — regenerate">
      <span className="regen-affordance-label">
        What changed: {changedLabel}
        <HelpTip text={HELP.paramsWhatChanged} ariaLabel="About what changed" />
        <HelpTip text={HELP.paramsDirtyCue} ariaLabel="Why regenerate" />
      </span>
      <span className="params-what-changed-chip" title={changedLabel}>
        {changed.slice(0, 4).join(' · ') || 'Knobs'}
      </span>
      <span className="transport-btn-wrap">
        <button
          type="button"
          className="btn ghost"
          disabled={!canGenerate}
          title="Regenerate with the same seed and current settings"
          onClick={() => void generateAgain()}
        >
          Again
        </button>
        <HelpTip text={HELP.again} ariaLabel="What Again does" />
      </span>
    </div>
  );
}
