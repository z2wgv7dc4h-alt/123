import { useEffect, useState } from 'react';
import { useStudioStore } from '../hooks/useStudioStore';
import { HELP } from '../lib/helpCopy';
import { HelpTip } from './HelpTip';
import {
  shouldShowFavoritesNudge,
  dismissFavoritesNudge,
} from '../lib/favoritesNudge';
import { shouldShowFirstPlayCoach } from '../lib/firstPlayCoach';

/**
 * #49 Post-Play favorites nudge — once, soft, points to More → Favorites.
 * Never blocks transport. Parent TransportBar also hides this while play/export
 * coaches are open (one transient coach max).
 */
export function FavoritesNudge() {
  const flowStep = useStudioStore((s) => s.flowStep);
  const setMoreOpen = useStudioStore((s) => s.setMoreOpen);
  const mode = useStudioStore((s) => s.mode);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Coach mutex: skip while first-play coach still eligible
    if (
      flowStep === 'played' &&
      shouldShowFavoritesNudge() &&
      !shouldShowFirstPlayCoach()
    ) {
      setOpen(true);
    }
  }, [flowStep]);

  if (!open) return null;

  const dismiss = () => {
    dismissFavoritesNudge();
    setOpen(false);
  };

  return (
    <div className="favorites-nudge" role="status">
      <span className="favorites-nudge-text">
        Like it? Save under More → Favorites.
        <HelpTip text={HELP.favoritesNudge} ariaLabel="About favorites tip" />
      </span>
      <button
        type="button"
        className="btn tiny ghost"
        onClick={() => {
          if (mode === 'simple') setMoreOpen(true);
          dismiss();
        }}
      >
        Open More
      </button>
      <button type="button" className="btn tiny ghost" onClick={dismiss}>
        Dismiss
      </button>
    </div>
  );
}
