import type { StemId } from '@/core/types';
import {
  useStudioStore,
  GAIN_MIN,
  GAIN_MAX,
  REMIX_STEM_IDS,
  ELEMENTAL_STEM_IDS,
} from '../hooks/useStudioStore';
import { HELP } from '../lib/helpCopy';
import { HelpTip } from './HelpTip';

const ROWS: StemId[] = ['kick', 'snare', 'hats', 'perc', 'bass', 'other', 'drums', 'mix'];
/** #84 digits 1–4 SoT — matches STEM_DIGIT_CODES / HelpPanel Keys */
const HOTKEY_SOLO_STEMS = ['kick', 'snare', 'hats', 'bass'] as const;
const HOTKEY_DIGIT: Record<(typeof HOTKEY_SOLO_STEMS)[number], string> = {
  kick: '1',
  snare: '2',
  hats: '3',
  bass: '4',
};

function MixerBody() {
  const mixer = useStudioStore((s) => s.mixer);
  const result = useStudioStore((s) => s.result);
  const mixerDirty = useStudioStore((s) => s.mixerDirty);
  const toggleMute = useStudioStore((s) => s.toggleMute);
  const toggleSolo = useStudioStore((s) => s.toggleSolo);
  const exclusiveSolo = useStudioStore((s) => s.exclusiveSolo);
  const setGainDb = useStudioStore((s) => s.setGainDb);
  const resetMix = useStudioStore((s) => s.resetMix);
  const undoMixer = useStudioStore((s) => s.undoMixer);
  const mixerUndoAvailable = useStudioStore((s) => s.mixerUndoAvailable);
  const mixerAnnounce = useStudioStore((s) => s.mixerAnnounce);

  return (
    <>
      <span className="sr-only mixer-aria-live" aria-live="polite">
        {mixerAnnounce}
      </span>
      {result && (
        <div className={`remix-banner${mixerDirty ? '' : ' remix-banner-quiet'}`} role="status">
          {mixerDirty ? (
            <span>Preview updated · dry stems stay in ZIP · mix_as_heard when tweaked</span>
          ) : (
            <span className="meta">Mixer</span>
          )}
          <span className="transport-btn-wrap">
            <button
              type="button"
              className="btn tiny ghost"
              disabled={!mixerUndoAvailable}
              onClick={() => undoMixer()}
            >
              Undo
            </button>
            <HelpTip text={HELP.mixerUndo} ariaLabel="About mixer undo" />
          </span>
          <button type="button" className="btn tiny ghost" disabled={!mixerDirty} onClick={() => resetMix()}>
            Reset mix
          </button>
        </div>
      )}
      <div className="stem-legend" aria-label="Mixer controls explained">
        <span className="stem-legend-item">
          <span className="stem-legend-key">M</span> Mute
          <HelpTip text={HELP.stemMute} ariaLabel="About mute" />
          <HelpTip text={HELP.stemMuteHotkeys} ariaLabel="About Shift+1-4 mute hotkeys" />
        </span>
        <span className="stem-legend-item">
          <span className="stem-legend-key">S</span> Solo
          <HelpTip text={HELP.stemSolo} ariaLabel="About solo" />
          <HelpTip text={HELP.stemSoloHotkeys} ariaLabel="About 1-4 solo hotkeys" />
          <HelpTip text={HELP.stemLabelSolo} ariaLabel="About stem-label exclusive solo" />
        </span>
        <span className="stem-legend-item">
          Gain
          <HelpTip text={HELP.stemGain} ariaLabel="About gain" />
        </span>
      </div>
      <div className="stem-grid">
        {/* other (guitar) row only when stem exists */}
        {ROWS.filter((id) => id !== 'other' || result?.stems.some((s) => s.id === 'other')).map((id) => {
          const present = result?.stems.some((s) => s.id === id);
          const showGain = (REMIX_STEM_IDS as readonly string[]).includes(id);
          const gain = mixer.gainDb[id] ?? 0;
          return (
            <div key={id} className={`stem-row ${present ? '' : 'dim'}`}>
              {(HOTKEY_SOLO_STEMS as readonly string[]).includes(id) ? (
                <button
                  type="button"
                  className={`stem-name stem-name-solo${mixer.solo[id] ? ' on' : ''}`}
                  title={`Exclusive solo ${id} (${HOTKEY_DIGIT[id as (typeof HOTKEY_SOLO_STEMS)[number]]})`}
                  aria-label={`Exclusive solo ${id} key ${HOTKEY_DIGIT[id as (typeof HOTKEY_SOLO_STEMS)[number]]}`}
                  onClick={() => exclusiveSolo(id)}
                >
                  <span className="stem-digit" aria-hidden="true">
                    {HOTKEY_DIGIT[id as (typeof HOTKEY_SOLO_STEMS)[number]]}
                  </span>
                  {id}
                </button>
              ) : (
                <span className="stem-name">{id}</span>
              )}
              <button
                type="button"
                className={mixer.mute[id] ? 'btn tiny on' : 'btn tiny'}
                aria-label={`Mute ${id}`}
                aria-pressed={!!mixer.mute[id]}
                onClick={() => toggleMute(id)}
              >
                M
              </button>
              <button
                type="button"
                className={mixer.solo[id] ? 'btn tiny on' : 'btn tiny'}
                aria-label={`Solo ${id}`}
                aria-pressed={!!mixer.solo[id]}
                onClick={() => toggleSolo(id)}
              >
                S
              </button>
              {showGain ? (
                <label className="stem-gain">
                  <span className="stem-gain-val">{gain > 0 ? `+${gain}` : gain} dB</span>
                  <input
                    type="range"
                    min={GAIN_MIN}
                    max={GAIN_MAX}
                    step={1}
                    value={gain}
                    disabled={!present}
                    aria-label={`${id} gain`}
                    onChange={(e) => setGainDb(id, Number(e.target.value))}
                  />
                </label>
              ) : (
                <span className="stem-gain stub" aria-hidden />
              )}
              <span className="meta">
                {present ? `${result!.stems.find((s) => s.id === id)!.durationSec.toFixed(1)}s` : '-'}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Simple Mode hero strip - mute key parts without opening More. */
export function StemMixerCompact() {
  const result = useStudioStore((s) => s.result);
  const mixer = useStudioStore((s) => s.mixer);
  const mixerDirty = useStudioStore((s) => s.mixerDirty);
  const mixerAnnounce = useStudioStore((s) => s.mixerAnnounce);
  const toggleMute = useStudioStore((s) => s.toggleMute);
  const resetMix = useStudioStore((s) => s.resetMix);
  const undoMixer = useStudioStore((s) => s.undoMixer);
  const mixerUndoAvailable = useStudioStore((s) => s.mixerUndoAvailable);
  const exportHeardSingle = useStudioStore((s) => s.exportHeardSingle);

  if (!result) return null;

  const sharedMix =
    Boolean(result.manifest?.gpuUsed) || Boolean(result.backendId?.startsWith('ace-step'));
  const compactHelp = sharedMix ? HELP.stemsSharedMix : HELP.remixPreview;

  return (
    <section className="panel stem-compact" aria-label="Quick stem mute">
      <span className="sr-only mixer-aria-live" aria-live="polite">
        {mixerAnnounce}
      </span>
      <div className="stem-compact-head">
        <h2 className="stem-compact-title">
          Mute parts
          <HelpTip text={compactHelp} ariaLabel="About quick remix" />
        </h2>
        {mixerDirty && (
          <span className="pill tiny remix-live" aria-live="polite">
            Live tweaks
          </span>
        )}
      </div>
      <div className="stem-compact-row">
        {ELEMENTAL_STEM_IDS.filter((id) => result.stems.some((s) => s.id === id)).map((id) => (
          <button
            key={id}
            type="button"
            className={`btn tiny stem-chip${mixer.mute[id] ? ' on muted-on' : ''}`}
            aria-label={`Mute ${id}`}
            aria-pressed={!!mixer.mute[id]}
            onClick={() => toggleMute(id)}
          >
            {id}
          </button>
        ))}
        <span className="stem-compact-actions">
          <button
            type="button"
            className="btn tiny ghost"
            disabled={!mixerUndoAvailable}
            onClick={() => undoMixer()}
            title="Undo last mute"
          >
            Undo
          </button>
          <button
            type="button"
            className="btn tiny ghost"
            disabled={!mixerDirty}
            onClick={() => resetMix()}
          >
            Reset
          </button>
          {mixerDirty ? (
            <button
              type="button"
              className="btn tiny ghost"
              title={HELP.exportHeardSingle}
              onClick={() => exportHeardSingle()}
            >
              Heard WAV
            </button>
          ) : null}
        </span>
      </div>
    </section>
  );
}

export function StemMixer() {
  const result = useStudioStore((s) => s.result);
  const sharedMix =
    Boolean(result?.manifest?.gpuUsed) ||
    Boolean(result?.backendId?.startsWith('ace-step'));
  const stemsHelp = sharedMix ? HELP.stemsSharedMix : HELP.stems;

  return (
    <section className="panel">
      <h2>
        Stems
        <HelpTip text={stemsHelp} ariaLabel="About stem mixer" />
      </h2>
      <p className="hint">
        {sharedMix
          ? 'Studio ACE may share one mix across lanes — Mute/Solo are preview-relative, not isolated stems yet.'
          : 'Mute / Solo / Gain update the preview live. ZIP always keeps dry stems for DAW work; when you tweak, it also adds mix_as_heard.wav matching this preview.'}
      </p>
      <details className="stem-mixer-details" open>
        <summary>Preview stem mix (optional)</summary>
        <MixerBody />
      </details>
    </section>
  );
}
