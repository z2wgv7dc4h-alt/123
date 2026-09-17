import { useStudioStore } from '../hooks/useStudioStore';
import { GENRE_TEMPLATES, templateParams } from '../lib/genreTemplates';

/**
 * Step 1: what do you want? Style presets + free text, above Generate.
 * A preset fills the text and knobs only — Generate stays the user's click.
 */
export function SimpleWant() {
  const promptText = useStudioStore((s) => s.promptText);
  const setPromptText = useStudioStore((s) => s.setPromptText);
  const setEnergy = useStudioStore((s) => s.setEnergy);
  const setDarkness = useStudioStore((s) => s.setDarkness);
  const setChaos = useStudioStore((s) => s.setChaos);
  const setSongShape = useStudioStore((s) => s.setSongShape);
  const busy = useStudioStore((s) => s.busy);

  const applyPreset = (id: string) => {
    const p = templateParams(id);
    if (!p) return;
    setPromptText(p.promptText);
    setEnergy(p.energy);
    setDarkness(p.darkness);
    setChaos(p.chaos);
    if (p.songShape) setSongShape(p.songShape);
  };

  return (
    <section className="simple-want panel" aria-label="What do you want" id="want">
      <div className="simple-want-head">
        <h2>What do you want?</h2>
        <p className="hint">Pick a style or type sound words (genre, drums, bass, leads). Style-ref file drop lives in More.</p>
      </div>
      <div className="style-presets" role="group" aria-label="Style presets" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
        {GENRE_TEMPLATES.map((t) => {
          const on = promptText === t.promptText;
          return (
            <button
              key={t.id}
              type="button"
              className={on ? 'btn tiny on' : 'btn tiny'}
              aria-pressed={on}
              disabled={busy}
              data-template-id={t.id}
              onClick={() => applyPreset(t.id)}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <label className="simple-want-label">
        <span className="sr-only">Style prompt</span>
        <textarea
          rows={2}
          disabled={busy}
          value={promptText}
          placeholder="e.g. neurofunk drum and bass, growling reese bass, tight snare"
          onChange={(e) => setPromptText(e.target.value)}
        />
      </label>
    </section>
  );
}
