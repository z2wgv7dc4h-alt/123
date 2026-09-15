import { useEffect, useState } from 'react';
import { DEFAULT_BPM } from '@/core/types';
import { useStudioStore } from '../hooks/useStudioStore';
import { HELP } from '../lib/helpCopy';
import {
  dismissResumeDraftStrip,
  loadResumeDraft,
  shouldShowResumeDraftStrip,
  type ResumeDraft,
} from '../lib/resumeDraft';
import { HelpTip } from './HelpTip';
import { pushToast } from '../lib/toasts';

/**
 * #55 Resume last seed+knobs — one dismissible strip under transport/Status.
 * Never above Style Ref. No audio blob.
 */
export function ResumeDraftStrip() {
  const result = useStudioStore((s) => s.result);
  const [draft, setDraft] = useState<ResumeDraft | null>(null);
  const setSeed = useStudioStore((s) => s.setSeed);
  const setBpm = useStudioStore((s) => s.setBpm);
  const setBars = useStudioStore((s) => s.setBars);
  const setEnergy = useStudioStore((s) => s.setEnergy);
  const setDarkness = useStudioStore((s) => s.setDarkness);
  const setChaos = useStudioStore((s) => s.setChaos);
  const setPromptText = useStudioStore((s) => s.setPromptText);
  const setVibeIntensity = useStudioStore((s) => s.setVibeIntensity);

  useEffect(() => {
    if (shouldShowResumeDraftStrip()) {
      setDraft(loadResumeDraft());
    }
  }, []);

  // #55 one restore under transport; hide once a sketch exists (coach mutex)
  if (!draft || result) return null;

  const dismiss = () => {
    dismissResumeDraftStrip();
    setDraft(null);
  };

  const restore = () => {
    setSeed(draft.seed);
    setBpm(draft.bpm || DEFAULT_BPM);
    setBars(draft.bars);
    setEnergy(draft.energy);
    setDarkness(draft.darkness);
    setChaos(draft.chaos);
    setPromptText(draft.promptText);
    setVibeIntensity(draft.vibeIntensity);
    dismissResumeDraftStrip();
    setDraft(null);
    pushToast('Restored seed + knobs — hit Generate', 'info', 3200);
  };

  return (
    <div className="resume-draft-strip" role="status">
      <span className="resume-draft-text">
        Resume last sketch settings (seed {draft.seed})?
        <HelpTip text={HELP.resumeDraft} ariaLabel="About resume draft" />
      </span>
      <button
        type="button"
        className="btn tiny ghost"
        onClick={restore}
        title="Loads last seed + knobs — hit Generate to rebuild (no audio file)"
      >
        Restore
      </button>
      <HelpTip text={HELP.resumeDraft} ariaLabel="About Restore last settings" />
      <button type="button" className="btn tiny ghost" onClick={dismiss} title="Hide this tip for now">
        Dismiss
      </button>
    </div>
  );
}
