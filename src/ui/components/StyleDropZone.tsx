import { useCallback, useRef, useState } from 'react';
import { STYLE_REF_ACCEPT } from '@/core/styleRef';
import { pushToast } from '../lib/toasts';
import { useStudioStore } from '../hooks/useStudioStore';
import { HELP } from '../lib/helpCopy';
import { HelpTip } from './HelpTip';

/**
 * Style reference — File picker / drag-drop ONLY.
 * No URL / YouTube. User must confirm own/licensed before attach.
 */
export function StyleDropZone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const vibe = useStudioStore((s) => s.vibe);
  const vibeBusy = useStudioStore((s) => s.vibeBusy);
  const ownerConfirmed = useStudioStore((s) => s.ownerConfirmed);
  const setOwnerConfirmed = useStudioStore((s) => s.setOwnerConfirmed);
  const attachVibeFile = useStudioStore((s) => s.attachVibeFile);
  const clearVibe = useStudioStore((s) => s.clearVibe);
  const undoVibeKnobs = useStudioStore((s) => s.undoVibeKnobs);
  const vibeKnobUndo = useStudioStore((s) => s.vibeKnobUndo);
  const vibeIntensity = useStudioStore((s) => s.vibeIntensity);
  const setVibeIntensity = useStudioStore((s) => s.setVibeIntensity);
  const energy = useStudioStore((s) => s.energy);
  const darkness = useStudioStore((s) => s.darkness);
  const setEnergy = useStudioStore((s) => s.setEnergy);
  const setDarkness = useStudioStore((s) => s.setDarkness);

  const tryAttach = useCallback(
    (files: FileList | null) => {
      const f = files?.[0];
      if (!f) return;
      if (!ownerConfirmed) {
        pushToast('Confirm you own / have rights to this file before attaching.', 'warn', 4200);
        return;
      }
      void attachVibeFile(f);
    },
    [attachVibeFile, ownerConfirmed],
  );

  const openPicker = useCallback(() => {
    if (vibeBusy) return;
    if (!ownerConfirmed) {
      pushToast('Confirm you own / have rights to this file before attaching.', 'warn', 4200);
      return;
    }
    inputRef.current?.click();
  }, [ownerConfirmed, vibeBusy]);

  return (
    <section
      id="style-ref"
      className={`panel style-ref-panel style-drop ${dragOver ? 'drag' : ''} ${vibe ? 'has-vibe' : ''} optional-quiet`}
      aria-label="Optional vibe reference"
    >
      <div className="style-drop-head">
        <h2>
          Optional vibe
          <HelpTip
            text={HELP.styleRef}
            ariaLabel="About style reference"
          />
        </h2>
        <span className="style-legal">
          Optional — drop a track you own. Sketch biases mood; Studio conditions on the audio itself. Original output, not a copy. Skip anytime.
        </span>
      </div>

      <div className="owner-check style-ref-attest">
        <label className="owner-check-label">
          <input
            type="checkbox"
            checked={ownerConfirmed}
            onChange={(e) => setOwnerConfirmed(e.target.checked)}
          />
          <span>I own or have rights to this file</span>
        </label>
        <HelpTip
          text={HELP.ownerCheck}
          ariaLabel="About ownership attestation"
        />
      </div>

      {!vibe && (
        <div
          className={`style-ref-drop style-drop-zone${dragOver ? ' over' : ''}${vibeBusy ? ' busy' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Drop or choose a style reference audio file"
          aria-busy={vibeBusy}
          aria-disabled={!ownerConfirmed || vibeBusy}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openPicker();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            tryAttach(e.dataTransfer.files);
          }}
          onClick={() => openPicker()}
        >
          <p className="style-ref-drop-title style-drop-cta">
            {vibeBusy ? 'Analyzing…' : 'Drop a track you own'}
          </p>
          <p className="style-ref-drop-sub">MP3 · WAV · FLAC · stays in this browser</p>
          <p className="hint">
            {ownerConfirmed
              ? 'Optional — Generate still works with no upload.'
              : 'Check ownership above, then drop / pick a file.'}
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={STYLE_REF_ACCEPT}
        className="style-ref-input sr-only"
        aria-hidden
        tabIndex={-1}
        disabled={vibeBusy}
        onChange={(e) => {
          tryAttach(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="sr-only" aria-live="polite">
        {vibeBusy ? 'Analyzing style reference…' : vibe ? `Style reference ready: ${vibe.fileName}` : ''}
      </div>

      {vibe && (
        <div className="vibe-card honesty-card style-ref-ready" role="status">
          <p className="vibe-banner">Conditioned on YOUR file (Studio) · mood-mapped (Sketch) — original output</p>
          <div className="vibe-meta">
            <strong className="vibe-name style-ref-filename" title={vibe.fileName}>
              {vibe.fileName}
            </strong>
            <span className="pill tiny ready-chip">Ready · vibe locked</span>
          </div>
          <details className="vibe-details-fold">
            <summary>Vibe details & nudges</summary>
            <ul className="vibe-stats">
              <li>
                Estimated BPM{' '}
                <strong>{vibe.estimatedBpm != null ? vibe.estimatedBpm.toFixed(1) : '—'}</strong>{' '}
                <span className="muted">(card only)</span>
              </li>
              <li>
                Energy <strong>{vibe.energy.toFixed(2)}</strong> · Brightness{' '}
                <strong>{vibe.brightness.toFixed(2)}</strong>
              </li>
              <li className="vibe-lock">
                Arrangement stays <strong>174 BPM</strong> — vibe mapped, not tempo-cloned
              </li>
            </ul>
            <div className="vibe-nudges">
              <label>
                <span className="label-with-tip">
                  <span className="label-with-tip-text">Energy · {energy.toFixed(2)}</span>
                  <HelpTip text={HELP.energyNudge} ariaLabel="About energy nudge" />
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={energy}
                  onChange={(e) => setEnergy(Number(e.target.value))}
                />
              </label>
              <label>
                <span className="label-with-tip">
                  <span className="label-with-tip-text">Darkness · {darkness.toFixed(2)}</span>
                  <HelpTip text={HELP.darknessNudge} ariaLabel="About darkness nudge" />
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={darkness}
                  onChange={(e) => setDarkness(Number(e.target.value))}
                />
              </label>
              <label>
                <span className="label-with-tip">
                  <span className="label-with-tip-text">Intensity · {vibeIntensity.toFixed(2)}</span>
                  <HelpTip text={HELP.vibeIntensity} ariaLabel="About vibe intensity" />
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={vibeIntensity}
                  onChange={(e) => setVibeIntensity(Number(e.target.value))}
                />
              </label>
            </div>
          </details>

          <div className="vibe-actions">
            <button
              type="button"
              className="btn ghost tiny"
              disabled={!vibeKnobUndo}
              title="Restore energy / darkness / chaos / bars from before vibe attach"
              onClick={() => undoVibeKnobs()}
            >
              Undo knobs
            </button>
            <button type="button" className="btn ghost tiny" onClick={() => clearVibe()} title="Remove style reference">
              Clear
            </button>
            <HelpTip text={HELP.clearStyleRef} ariaLabel="About Clear style reference" />
            <button
              type="button"
              className="btn tiny"
              disabled={!ownerConfirmed || vibeBusy}
              onClick={() => openPicker()}
            >
              Replace file
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
