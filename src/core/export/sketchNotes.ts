/**
 * #85 sketch_notes.txt — browser-sketch honesty; no artist names.
 */

export type SketchNotesInput = {
  seed: number;
  bpm: number;
  bars: number;
  energy: number;
  darkness: number;
  chaos: number;
  bitDepth: 16 | 24;
  mixAsHeard: boolean;
  /** Optional scrubbed mood words — never artist clones. */
  promptText?: string;
};

/** Plain-text notes file for ZIP (seed, ~174, bars, knobs, depth, honesty). */
export function buildSketchNotes(input: SketchNotesInput): string {
  const lines = [
    'DnB Studio — sketch notes',
    `seed: ${input.seed}`,
    `bpm: ~${Math.round(input.bpm)} (layout ~174)`,
    `bars: ${input.bars}`,
    `energy: ${input.energy}`,
    `darkness: ${input.darkness}`,
    `chaos: ${input.chaos}`,
    `bit_depth: ${input.bitDepth}`,
    'product: browser-sketch (CPU) — not Studio GPU',
    `mix_as_heard: ${input.mixAsHeard ? 'yes' : 'no'}`,
  ];
  const prompt = (input.promptText ?? '').trim();
  if (prompt) {
    // Keep short; never claim artist likeness
    const safe = prompt.slice(0, 120).replace(/\s+/g, ' ');
    lines.push(`mood_words: ${safe}`);
  }
  lines.push('honesty: original browser sketch only — no artist names, no catalog rips');
  lines.push('');
  return lines.join('\n');
}
