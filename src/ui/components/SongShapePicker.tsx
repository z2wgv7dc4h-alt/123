import { useStudioStore } from '../hooks/useStudioStore';
import { SONG_SHAPES, type SongShapeId } from '../lib/songShapes';
import { barsToDurationSec, formatDurationMmSs } from '../lib/barPosition';

const LENGTH_PRESETS = [32, 48, 64, 96, 128] as const;

function shapeSubtitle(bars: number, bpm: number): string {
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
  const bpm = useStudioStore((s) => s.bpm);

  return (
    <section className="song-shape-picker panel" aria-label="Song shape">
      <div className="song-shape-head">
        <h2>Song shape</h2>
        <p className="hint">Pick the arc. Then Generate.</p>
      </div>
      <div className="song-shape-chips" role="radiogroup" aria-label="Song shape">
        {SONG_SHAPES.map((s) => {
          const on = songShape === s.id;
          const sub = shapeSubtitle(s.bars, bpm);
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
        <span className="song-length-label">Length</span>
        {LENGTH_PRESETS.map((n) => {
          const on = bars === n;
          return (
            <button
              key={n}
              type="button"
              className={`btn tiny${on ? ' on' : ' ghost'}`}
              disabled={busy}
              aria-pressed={on}
              title={`${n} bars · ~${formatDurationMmSs(barsToDurationSec(n, bpm))} — applies on next Generate`}
              onClick={() => setBars(n)}
            >
              {n}
            </button>
          );
        })}
        <span className="song-length-meta meta">{shapeSubtitle(bars, bpm)}</span>
      </div>
    </section>
  );
}
