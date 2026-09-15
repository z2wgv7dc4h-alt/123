import { DEFAULT_BPM } from '@/core/types';
import { useStudioStore } from '../hooks/useStudioStore';
import { SONG_SHAPES, type SongShapeId } from '../lib/songShapes';
import { barsToDurationSec, formatDurationMmSs } from '../lib/barPosition';
import { HELP } from '../lib/helpCopy';
import { HelpTip } from './HelpTip';

const LENGTH_PRESETS = [32, 48, 64] as const;

function shapeSubtitle(bars: number, bpm = DEFAULT_BPM): string {
  const sec = barsToDurationSec(bars, bpm);
  return `${bars} bars · ~${formatDurationMmSs(sec)}`;
}

/** Simple-mode control: pick the song arc without drowning in knobs. */
export function SongShapePicker() {
  const songShape = useStudioStore((s) => s.songShape);
  const setSongShape = useStudioStore((s) => s.setSongShape);
  const bars = useStudioStore((s) => s.bars);
  const setBars = useStudioStore((s) => s.setBars);
  const busy = useStudioStore((s) => s.busy);

  return (
    <section className="song-shape-picker panel" aria-label="Song shape">
      <div className="song-shape-head">
        <h2>
          Song shape
          <HelpTip text={HELP.songShape} ariaLabel="About song shape" />
        </h2>
        <p className="hint">Pick the arc. Then Generate.</p>
      </div>
      <div className="song-shape-chips" role="radiogroup" aria-label="Song shape">
        {SONG_SHAPES.map((s) => {
          const on = songShape === s.id;
          const sub = shapeSubtitle(s.bars);
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={on}
              className={`song-shape-chip${on ? ' on' : ''}`}
              disabled={busy}
              title={`${s.blurb} · ${sub}`}
              onClick={() => setSongShape(s.id as SongShapeId)}
            >
              <strong>{s.label}</strong>
              <span>{s.blurb}</span>
              <span className="song-shape-chip-sub">{sub}</span>
            </button>
          );
        })}
      </div>
      <div className="song-length-row" role="group" aria-label="Song length">
        <span className="song-length-label label-with-tip">
          Length
          <HelpTip text={HELP.songLengthChips} ariaLabel="About song length chips" />
        </span>
        {LENGTH_PRESETS.map((n) => {
          const on = bars === n;
          return (
            <button
              key={n}
              type="button"
              className={`btn tiny${on ? ' on' : ' ghost'}`}
              disabled={busy}
              aria-pressed={on}
              title={`${n} bars · ~${formatDurationMmSs(barsToDurationSec(n, DEFAULT_BPM))} — applies on next Generate`}
              onClick={() => setBars(n)}
            >
              {n}
            </button>
          );
        })}
        <span className="song-length-meta meta">{shapeSubtitle(bars)}</span>
      </div>
    </section>
  );
}
