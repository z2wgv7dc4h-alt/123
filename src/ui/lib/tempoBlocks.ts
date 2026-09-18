/**
 * A-3 tempo blocks: a Studio take can carry sections at different BPMs.
 * Each block is rendered as its own text2music at its bpm/genre, using the
 * previous bars as ACE `reference_audio`, then hard-cut into the take.
 *
 * Pure functions only — bar↔frame math is per section so sample counts are
 * exact and testable without any audio.
 */
import type { GenreId, Section, StructureMap } from '@/core/types';
import { sectionBpm, structureBarToFrame } from './arrangeTake';

export { sectionBpm, structureBarToFrame } from './arrangeTake';

export type TempoBlock = {
  genre: GenreId;
  bpm: number;
  bars: number;
  /** Caption role for the block — the bridge renders it, still a section. */
  role: 'drop';
};

/** Seconds from the take start to a section's first bar (per-section BPM). */
export function sectionStartSec(
  structure: StructureMap,
  index: number,
  fallbackBpm: number = structure.bpm,
): number {
  let sec = 0;
  for (let i = 0; i < index; i++) {
    const s = structure.sections[i]!;
    sec += s.lengthBars * (240 / sectionBpm(s, fallbackBpm));
  }
  return sec;
}

/**
 * Insert a tempo block right after `sectionIndex`. Existing sections are
 * stamped with the base bpm so each carries its own tempo explicitly.
 */
export function withTempoBlock(
  structure: StructureMap,
  sectionIndex: number,
  block: TempoBlock,
): { structure: StructureMap; blockIndex: number; blockStartBar: number } | null {
  const sec = structure.sections[sectionIndex];
  if (!sec || block.bars <= 0 || block.bpm <= 0) return null;
  const stamped: Section[] = structure.sections.map((s) => ({
    ...s,
    bpm: sectionBpm(s, structure.bpm),
  }));
  const blockSection: Section = {
    name: 'drop',
    startBar: 0,
    lengthBars: Math.max(1, Math.round(block.bars)),
    bpm: block.bpm,
    genre: block.genre,
  };
  const out = [...stamped];
  out.splice(sectionIndex + 1, 0, blockSection);
  let cursor = 0;
  const relaid = out.map((s) => {
    const next = { ...s, startBar: cursor };
    cursor += s.lengthBars;
    return next;
  });
  return {
    structure: { ...structure, sections: relaid, bars: cursor },
    blockIndex: sectionIndex + 1,
    blockStartBar: sec.startBar + sec.lengthBars,
  };
}

/**
 * Exact join frames for `[before][transition][block][after]` at a hard cut.
 * The transition is the last bar of the preceding section (repainted as
 * `build`), so `beforeEnd === transitionStart` and `transitionEnd === blockStart`.
 */
export function planTempoJoinFrames(opts: {
  structure: StructureMap;
  blockIndex: number;
  offsetSec: number;
  sampleRateHz: number;
}): {
  beforeEnd: number;
  transitionStart: number;
  transitionEnd: number;
  blockStart: number;
  blockEnd: number;
  afterStart: number;
} | null {
  const block = opts.structure.sections[opts.blockIndex];
  if (!block) return null;
  const beforeEndBar = Math.max(0, block.startBar - 1);
  const beforeEnd = structureBarToFrame(opts.structure, beforeEndBar, opts.offsetSec, opts.sampleRateHz);
  const blockStart = structureBarToFrame(
    opts.structure,
    block.startBar,
    opts.offsetSec,
    opts.sampleRateHz,
  );
  const blockEnd = structureBarToFrame(
    opts.structure,
    block.startBar + block.lengthBars,
    opts.offsetSec,
    opts.sampleRateHz,
  );
  return {
    beforeEnd,
    transitionStart: beforeEnd,
    transitionEnd: blockStart,
    blockStart,
    blockEnd,
    afterStart: blockEnd,
  };
}

/** Transition caption words (role `build`) that lead into the block. */
export const TEMPO_TRANSITION_WORDS = 'riser into a hard stop, impact';

/** Bars of the previous take sent as ACE `reference_audio` for continuity. */
export const TEMPO_REFERENCE_BARS = 8;
