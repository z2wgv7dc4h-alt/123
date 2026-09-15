import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_BPM } from '@/core/types';
import { useStudioStore } from '../hooks/useStudioStore';
import {
  addFavorite,
  loadFavorites,
  removeFavorite,
  slightVariationSeed,
  type FavoriteSnapshot,
} from '../lib/favorites';
import { buildSurpriseParams } from '../lib/genreTemplates';
import { HELP } from '../lib/helpCopy';
import { pushToast } from '../lib/toasts';
import { HelpTip } from './HelpTip';

function snapshotFromStore(): Parameters<typeof addFavorite>[0] {
  const s = useStudioStore.getState();
  return {
    seed: s.seed,
    bpm: s.bpm || DEFAULT_BPM,
    bars: s.bars,
    energy: s.energy,
    darkness: s.darkness,
    chaos: s.chaos,
    promptText: s.promptText,
    vibeIntensity: s.vibeIntensity,
    vibeHash: s.vibe?.fingerprintHash ?? null,
    vibeFileName: s.vibe?.fileName ?? null,
  };
}

function applyFavorite(fav: FavoriteSnapshot): void {
  const s = useStudioStore.getState();
  s.setSeed(fav.seed);
  s.setBpm(fav.bpm || DEFAULT_BPM);
  s.setBars(fav.bars);
  s.setEnergy(fav.energy);
  s.setDarkness(fav.darkness);
  s.setChaos(fav.chaos);
  s.setPromptText(fav.promptText);
  s.setVibeIntensity(fav.vibeIntensity);
}

/**
 * More-only favorites shelf — browser localStorage only.
 * Again = same seed/settings; Slight variation = new seed, same vibe knobs.
 */
export function FavoritesPanel() {
  const [items, setItems] = useState<FavoriteSnapshot[]>(() => loadFavorites());
  const busy = useStudioStore((s) => s.busy);
  const result = useStudioStore((s) => s.result);
  const mode = useStudioStore((s) => s.mode);
  const backendId = useStudioStore((s) => s.backendId);
  const aceHasGpu = useStudioStore((s) => s.aceHasGpu);
  const generate = useStudioStore((s) => s.generate);
  const generateAgain = useStudioStore((s) => s.generateAgain);

  const refresh = useCallback(() => setItems(loadFavorites()), []);

  useEffect(() => {
    refresh();
  }, [refresh, result?.jobId]);

  const aceBlocked = mode !== 'simple' && backendId.startsWith('ace-step') && !aceHasGpu;
  const canGenerate = !busy && !aceBlocked;

  const onSave = () => {
    const entry = addFavorite(snapshotFromStore());
    refresh();
    pushToast(`Saved favorite · ${entry.label}`, 'success', 2800);
  };

  const onAgain = (fav: FavoriteSnapshot) => {
    applyFavorite(fav);
    void generateAgain();
  };

  const onVary = (fav: FavoriteSnapshot) => {
    applyFavorite(fav);
    const seed = slightVariationSeed(fav);
    useStudioStore.getState().setSeed(seed);
    void generate({ variation: 'vary' });
  };

  const onRemove = (id: string) => {
    setItems(removeFavorite(id));
    pushToast('Favorite removed', 'info', 1800);
  };

  return (
    <section className="panel section-accent-favorites" aria-label="Favorites">
      <h2>
        Favorites
        <HelpTip text={HELP.favorites} ariaLabel="About Favorites" />
      </h2>
      <p className="hint">
        Save seed + knobs locally in this browser. Again replays the same sketch; Slight variation keeps
        the vibe and rolls a new seed.
      </p>

      <span className="transport-btn-wrap favorites-save-row">
        <button
          type="button"
          className="btn ghost"
          disabled={!result || busy}
          title={result ? 'Save current seed and settings to this browser' : 'Generate a sketch first'}
          onClick={onSave}
        >
          Save favorite
        </button>
        <HelpTip text={HELP.favorites} ariaLabel="What Save favorite does" />
      </span>

      {items.length === 0 ? (
        <div className="empty-favorites" role="status">
          <p>No favorites yet — save after a sketch you like</p>
          <span className="transport-btn-wrap">
            <button
              type="button"
              className="btn ghost tiny"
              disabled={busy}
              title="Roll a fresh sketch (Surprise Me)"
              onClick={() => {
                const p = buildSurpriseParams();
                const st = useStudioStore.getState();
                st.setSeed(p.seed);
                st.setBpm(DEFAULT_BPM);
                st.setEnergy(p.energy);
                st.setDarkness(p.darkness);
                st.setChaos(p.chaos);
                st.setPromptText(p.promptText);
                void st.generate({ variation: 'vary' });
              }}
            >
              Surprise me
            </button>
            <HelpTip text={HELP.favoritesEmpty} ariaLabel="About empty Favorites tip" />
          </span>
        </div>
      ) : (
        <ul className="favorites-list">
          {items.map((fav) => (
            <li key={fav.id} className="favorites-item">
              <div className="favorites-meta">
                <strong className="favorites-label">{fav.label}</strong>
                <span className="favorites-sub">
                  seed {fav.seed} · {fav.bpm} BPM
                  {fav.vibeHash ? ` · vibe ${fav.vibeHash.slice(0, 8)}` : ''}
                </span>
              </div>
              <div className="favorites-actions">
                <span className="transport-btn-wrap">
                  <button
                    type="button"
                    className="btn tiny ghost"
                    disabled={!canGenerate}
                    title="Load favorite and generate with the same seed"
                    onClick={() => onAgain(fav)}
                  >
                    Again
                  </button>
                  <HelpTip text={HELP.favoritesAgain} ariaLabel="What Favorites Again does" />
                </span>
                <span className="transport-btn-wrap">
                  <button
                    type="button"
                    className="btn tiny ghost"
                    disabled={!canGenerate}
                    title="Load favorite knobs with a new seed"
                    onClick={() => onVary(fav)}
                  >
                    Slight variation
                  </button>
                  <HelpTip text={HELP.favoritesVary} ariaLabel="What Slight variation does" />
                </span>
                <button
                  type="button"
                  className="btn tiny ghost"
                  title="Remove from this browser"
                  onClick={() => onRemove(fav.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Optional ghost on the transport vary-row — not a 4th primary. */
export function SaveFavoriteGhost() {
  const result = useStudioStore((s) => s.result);
  const busy = useStudioStore((s) => s.busy);
  if (!result) return null;
  return (
    <span className="transport-btn-wrap">
      <button
        type="button"
        className="btn ghost tiny"
        disabled={busy}
        title="Save seed + settings to Favorites (this browser)"
        onClick={() => {
          const entry = addFavorite(snapshotFromStore());
          pushToast(`Saved favorite · ${entry.label}`, 'success', 2800);
        }}
      >
        Save favorite
      </button>
      <HelpTip text={HELP.favorites} ariaLabel="What Save favorite does" />
    </span>
  );
}
