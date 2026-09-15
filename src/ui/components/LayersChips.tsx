import { useStudioStore } from '../hooks/useStudioStore';
import { HELP } from '../lib/helpCopy';
import { HelpTip } from './HelpTip';

/** Promoted on Simple: Guitar + Solo. Extra heat stays under More. */
const PRIMARY = [
  { key: 'guitar' as const, label: 'Guitar', blurb: 'Rhythm guitar grit in drops' },
  { key: 'solo' as const, label: 'Solo', blurb: 'Lead guitar lines' },
];
const SECONDARY = [
  { key: 'vocalish' as const, label: 'Vocal-ish', blurb: 'Synth vocal texture · no lyrics' },
  { key: 'extraDrums' as const, label: 'Extra drums', blurb: 'Denser breaks & fills' },
];

type Props = { /** Show vocal-ish / extra drums too */ showSecondary?: boolean };

/** Simple Mode — generative heat only (never artist-clone). Never claim ACE extract/repaint on Sketch. */
export function LayersChips({ showSecondary = false }: Props) {
  const layers = useStudioStore((s) => s.layers);
  const setLayer = useStudioStore((s) => s.setLayer);
  const busy = useStudioStore((s) => s.busy);
  const result = useStudioStore((s) => s.result);
  const generateAgain = useStudioStore((s) => s.generateAgain);
  const vary = useStudioStore((s) => s.vary);
  const paramsDirty = useStudioStore((s) => s.paramsDirty);
  const aceHasGpu = useStudioStore((s) => s.aceHasGpu);
  const defs = showSecondary ? [...PRIMARY, ...SECONDARY] : PRIMARY;
  const anyOn = defs.some((d) => layers[d.key]);
  const pulse = !!(result && (anyOn || paramsDirty));
  const needsStudio = !aceHasGpu;

  return (
    <section className="layers-chips panel" aria-label="Add heat layers">
      <div className="layers-head">
        <h2>
          Add heat
          <HelpTip text={HELP.layers} ariaLabel="About layers" />
        </h2>
        <p className="hint">Applies on next Generate · original textures only</p>
        {needsStudio && (
          <p className="layers-needs-studio" role="status">
            Needs Studio
          </p>
        )}
      </div>
      <div className="layers-row" role="group" aria-label="Texture layers">
        {defs.map((d) => {
          const on = layers[d.key];
          const disabled = busy || needsStudio;
          const ariaLabel = needsStudio
            ? `${d.label} — Needs Studio`
            : `${d.label}. ${d.blurb}`;
          return (
            <button
              key={d.key}
              type="button"
              className={`layers-chip${on ? ' on' : ''}${needsStudio ? ' needs-studio' : ''}`}
              aria-pressed={on}
              aria-label={ariaLabel}
              disabled={disabled}
              title={needsStudio ? `${d.blurb} · Needs Studio` : d.blurb}
              onClick={() => {
                if (disabled) return;
                setLayer(d.key, !on);
              }}
            >
              <strong>{d.label}</strong>
              <span>{needsStudio ? 'Needs Studio' : d.blurb}</span>
            </button>
          );
        })}
      </div>
      {pulse && !needsStudio && (
        <div className="layers-actions">
          <button
            type="button"
            className={`btn accent${anyOn ? ' pulse' : ''}`}
            disabled={busy}
            onClick={() => void generateAgain()}
            title="Re-render with current layers and arrangement edits"
          >
            Re-generate with layers
          </button>
          <HelpTip text={HELP.layers} ariaLabel="About re-generate with layers" />
          <button type="button" className="btn ghost" disabled={busy} onClick={() => void vary()}>
            Vary with layers
          </button>
        </div>
      )}
    </section>
  );
}
