/** One-click song shapes — fewer knobs, clearer control. */
export type SongShapeId =
  | 'classic'
  | 'long-intro'
  | 'breakdown'
  | 'double-drop'
  | 'dubstep'
  | 'half-time-drop'
  | 'trap-bounce';

export type SongShape = {
  id: SongShapeId;
  label: string;
  blurb: string;
  /** Suggested total bars */
  bars: number;
};

// 'dubstep' shape retired from the picker: Dubstep is now a genre at 140 BPM.
export const SONG_SHAPES: readonly SongShape[] = [
  {
    id: 'classic',
    label: 'Classic',
    blurb: 'Intro → build → drop → break → outro',
    bars: 32,
  },
  {
    id: 'long-intro',
    label: 'Long intro',
    blurb: 'More runway before the drop',
    bars: 48,
  },
  {
    id: 'breakdown',
    label: 'Breakdown',
    blurb: 'Drop, then strip it back, then hit again',
    bars: 48,
  },
  {
    id: 'double-drop',
    label: 'Double drop',
    blurb: 'Two drops with a breath between',
    bars: 64,
  },
  {
    id: 'half-time-drop',
    label: 'Half-time drop',
    blurb: 'Snare on 3 · heavy half-time drop',
    bars: 48,
  },
  {
    id: 'trap-bounce',
    label: 'Trap bounce',
    blurb: 'Fat 808s · rolling hats · bouncy drop',
    bars: 32,
  },
] as const;

export function songShapeById(id: SongShapeId): SongShape {
  return SONG_SHAPES.find((s) => s.id === id) ?? SONG_SHAPES[0]!;
}
