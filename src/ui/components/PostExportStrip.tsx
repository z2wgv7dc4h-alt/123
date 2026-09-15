import { useStudioStore } from '../hooks/useStudioStore';
import { HELP } from '../lib/helpCopy';
import { addFavorite } from '../lib/favorites';
import { HelpTip } from './HelpTip';
import { pushToast } from '../lib/toasts';

/**
 * #80 Post-export Favorite / Again / Vary — one low-profile strip under transport.
 * Merges with ResumeDraft (Resume hides when result exists).
 */
export function PostExportStrip() {
  const result = useStudioStore((s) => s.result);
  const flowStep = useStudioStore((s) => s.flowStep);
  const busy = useStudioStore((s) => s.busy);
  const generateAgain = useStudioStore((s) => s.generateAgain);
  const vary = useStudioStore((s) => s.vary);
  const seed = useStudioStore((s) => s.seed);
  const bpm = useStudioStore((s) => s.bpm);
  const bars = useStudioStore((s) => s.bars);
  const energy = useStudioStore((s) => s.energy);
  const darkness = useStudioStore((s) => s.darkness);
  const chaos = useStudioStore((s) => s.chaos);
  const promptText = useStudioStore((s) => s.promptText);
  const vibeIntensity = useStudioStore((s) => s.vibeIntensity);
  const vibe = useStudioStore((s) => s.vibe);

  if (!result || flowStep !== 'exported') return null;

  const saveFav = () => {
    addFavorite({
      seed,
      bpm,
      bars,
      energy,
      darkness,
      chaos,
      promptText,
      vibeIntensity,
      vibeHash: vibe?.fingerprintHash ?? null,
      vibeFileName: vibe?.fileName ?? null,
    });
    pushToast('Saved to Favorites (this browser)', 'success', 2800);
  };

  return (
    <div className="post-export-strip" role="status" aria-label="After export">
      <span className="post-export-text">
        Exported — Favorite / Again / Vary
        <HelpTip text={HELP.postExportStrip} ariaLabel="About post-export strip" />
        <HelpTip text={HELP.sketchNotes} ariaLabel="About sketch notes in ZIP" />
        <HelpTip text={HELP.exportDawTip} ariaLabel="About DAW tip after export" />
      </span>
      <button type="button" className="btn tiny ghost" onClick={saveFav} title="Save settings to Favorites">
        Favorite
      </button>
      <HelpTip text={HELP.favorites} ariaLabel="About Favorite" />
      <button
        type="button"
        className="btn tiny ghost"
        disabled={busy}
        onClick={() => void generateAgain()}
        title="Again (R)"
      >
        Again
      </button>
      <HelpTip text={HELP.again} ariaLabel="What Again does" />
      <button
        type="button"
        className="btn tiny ghost"
        disabled={busy}
        onClick={() => void vary()}
        title="Vary (V)"
      >
        Vary
      </button>
      <HelpTip text={HELP.vary} ariaLabel="What Vary does" />
    </div>
  );
}
