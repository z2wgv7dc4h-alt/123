import { DEFAULT_BPM } from '@/core/types';
import { useStudioStore } from '../hooks/useStudioStore';
import { buildSurpriseParams } from '../lib/genreTemplates';
import { SONG_SHAPES } from '../lib/songShapes';
import { HELP } from '../lib/helpCopy';
import { HelpTip } from './HelpTip';

/**
 * More-only delight control.
 * Knobs are 0–1 (same as ParamPanel sliders). Old 0–100 values clamped everything to 1.00.
 */
export function SurpriseMe() {
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
    if (!canRun) return;
    const p = buildSurpriseParams();
    // Tiny jitter so repeats of the same template don't look identical on the sliders
    const jitter = (v: number) => Math.min(1, Math.max(0, v + (Math.random() - 0.5) * 0.08));
    const shapePick = SONG_SHAPES[Math.floor(Math.random() * SONG_SHAPES.length)]!;
    setSeed(p.seed);
    setSongShape(shapePick.id);
    setBpm(DEFAULT_BPM);
    setEnergy(jitter(p.energy));
    setDarkness(jitter(p.darkness));
    setChaos(jitter(p.chaos));
    setPromptText(p.promptText);
    void generate({ variation: 'vary' });
  };

  return (
    <div className="surprise-me" role="group" aria-label="Surprise Me">
      <span className="transport-btn-wrap">
        <button
          type="button"
          className="btn ghost"
          disabled={!canRun}
          title="Roll a fresh seed and vibe template — More only"
          onClick={onSurprise}
        >
          Surprise Me
        </button>
        <HelpTip text={HELP.surpriseMe} ariaLabel="What Surprise Me does" />
      </span>
      <span className="surprise-me-hint meta">Random seed + genre template · Drive/Mood/Chaos stay in range</span>
    </div>
  );
}
