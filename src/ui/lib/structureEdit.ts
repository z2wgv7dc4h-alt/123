import type { Section, StructureMap } from '@/core/types';

const MAX_BARS = 128;
const MIN_SECTION = 4;

/** Snap bar counts to multiples of 4 (arrangement grid). */
export function snapBars4(n: number): number {
  return Math.max(4, Math.round(n / 4) * 4);
}

function reindexStarts(sections: Section[]): Section[] {
  let cursor = 0;
  return sections.map((s) => {
    const next = { ...s, startBar: cursor, lengthBars: Math.max(MIN_SECTION, s.lengthBars) };
    cursor += next.lengthBars;
    return next;
  });
}

export function totalBarsOf(sections: readonly Section[]): number {
  return sections.reduce((sum, s) => sum + s.lengthBars, 0);
}

/**
 * Grow (or shrink) one section by deltaBars.
 * Positive delta grows total arrangement (capped at MAX_BARS).
 * Negative delta shrinks that section only (floor MIN_SECTION), reducing total.
 */
export function expandSection(
  sections: readonly Section[],
  index: number,
  deltaBars: number,
): { sections: Section[]; bars: number } | null {
  if (index < 0 || index >= sections.length) return null;
  const delta = snapBars4(Math.abs(deltaBars)) * Math.sign(deltaBars || 1);
  if (delta === 0) return null;

  const copy = sections.map((s) => ({ ...s }));
  const target = copy[index]!;
  const nextLen = target.lengthBars + delta;
  if (nextLen < MIN_SECTION) return null;

  const proposedTotal = totalBarsOf(copy) - target.lengthBars + nextLen;
  if (proposedTotal > MAX_BARS) {
    const room = MAX_BARS - (totalBarsOf(copy) - target.lengthBars);
    if (room < MIN_SECTION) return null;
    target.lengthBars = Math.max(MIN_SECTION, snapBars4(room));
  } else {
    target.lengthBars = snapBars4(nextLen);
  }

  const sectionsOut = reindexStarts(copy);
  return { sections: sectionsOut, bars: totalBarsOf(sectionsOut) };
}

/** Duplicate a section immediately after itself (capped at MAX_BARS). */
export function repeatSection(
  sections: readonly Section[],
  index: number,
): { sections: Section[]; bars: number } | null {
  if (index < 0 || index >= sections.length) return null;
  const src = sections[index]!;
  const add = Math.max(MIN_SECTION, snapBars4(src.lengthBars));
  if (totalBarsOf(sections) + add > MAX_BARS) return null;

  const copy = sections.map((s) => ({ ...s }));
  copy.splice(index + 1, 0, {
    name: src.name,
    startBar: 0,
    lengthBars: add,
    fillHint: src.fillHint,
  });
  const sectionsOut = reindexStarts(copy);
  return { sections: sectionsOut, bars: totalBarsOf(sectionsOut) };
}

/** Set absolute length for a section (drag edge). */
export function setSectionLengthBars(
  sections: readonly Section[],
  index: number,
  lengthBars: number,
): { sections: Section[]; bars: number } | null {
  if (index < 0 || index >= sections.length) return null;
  const current = sections[index]!.lengthBars;
  return expandSection(sections, index, snapBars4(lengthBars) - current);
}

/** Build a lightweight structure patch from an existing map + edited sections. */
export function withEditedSections(
  base: StructureMap,
  sections: Section[],
): Pick<StructureMap, 'sections' | 'bars'> & { version: StructureMap['version'] } {
  const reindexed = reindexStarts(sections.map((s) => ({ ...s })));
  return {
    version: base.version,
    sections: reindexed,
    bars: totalBarsOf(reindexed),
  };
}
