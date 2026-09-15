import { DEFAULT_BPM } from '@/core/types';
import { useStudioStore } from '../hooks/useStudioStore';
import { buildSurpriseParams, type RandomUint32 } from '../lib/genreTemplates';
import { SONG_SHAPES } from '../lib/songShapes';
import { HELP } from '../lib/helpCopy';
import { HelpTip } from './HelpTip';

type Props = {
  /** Injectable RNG for vitest — production omits. */
  rng?: RandomUint32;
  pickIndex?: (n: number) => number;
};

/**
 * More-only Surprise Me — new seed + allowlisted genre template, 174 BPM locked.
 * Never on the Generate / Play / Export primary row.
 */
export function SurpriseMeButton({ rng, pickIndex }: Props = {}) {
  const busy = useStudioStore((s) => s.busy);
  const setSeed = useStudioStore((s) => s.setSeed);
  const setBpm = useStudioStore((s) => s.setBpm);
  const setEnergy = useStudioStore((s) => s.setEnergy);
  const setDarkness = useStudioStore((s) => s.setDarkness);
  const setChaos = useStudioStore((s) => s.setChaos);
  const setPromptText = useStudioStore((s) => s.setPromptText);
  const setSongShape = useStudioStore((s) => s.setSongShape);
  const generate = useStudioStore((s) => s.generate);

  const canRun = !busy;

  const onSurprise = () => {
    const p = buildSurpriseParams({ rng, pickIndex });
    const jitter = (v: number) => Math.min(1, Math.max(0, v + (Math.random() - 0.5) * 0.08));
    const shapePick =
      typeof pickIndex === 'function'
        ? SONG_SHAPES[Math.abs(pickIndex(SONG_SHAPES.length)) % SONG_SHAPES.length]!
        : SONG_SHAPES[Math.floor(Math.random() * SONG_SHAPES.length)]!;
    setSeed(p.seed);
    setSongShape(shapePick.id);
    setBpm(DEFAULT_BPM);
    setEnergy(jitter(p.energy));
    setDarkness(jitter(p.darkness));
    setChaos(jitter(p.chaos));
    setPromptText(p.promptText);
    // Reuse vary toast path without touching store paramsDirty logic.
    void generate({ variation: 'vary' });
  };

  return (
    <section className="panel section-accent-surprise" aria-label="Surprise Me">
      <h2>
        Surprise Me
        <HelpTip text={HELP.surpriseMe} ariaLabel="About Surprise Me" />
      </h2>
      <p className="hint">
        Fresh seed + song shape + genre template. Tempo stays locked near 174. Genre words only — no artist
        names.
      </p>
      <span className="transport-btn-wrap">
        <button
          type="button"
          className="btn ghost"
          disabled={!canRun}
          title="Roll a fresh original Sketch near 174 BPM (CPU)" 
          onClick={onSurprise}
        >
          Surprise me
        </button>
        <HelpTip text={HELP.surpriseMe} ariaLabel="What Surprise Me does" />
      </span>
    </section>
  );
}
