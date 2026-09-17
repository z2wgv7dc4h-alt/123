import type { GenreId, RenderJob, RenderResult, SectionRole, StructureMap } from '@/core/types';

export type SectionStyle = { role?: SectionRole; genre?: GenreId; words?: string };

export type TakeEditRequest =
  | { kind: 'redo'; sectionIndex: number; style?: SectionStyle }
  | { kind: 'extend'; sectionIndex: number; deltaBars: number };

export type TakeEditPlan = {
  edit: NonNullable<RenderJob['edit']>;
  structureRef: StructureMap;
  seed: number;
  bpm: number;
  style?: SectionStyle;
};

/** Map structure section names to caption roles. */
export function roleForSectionName(name: string): SectionRole {
  if (name === 'break' || name === 'breakdown') return 'breakdown';
  if (name === 'intro' || name === 'build' || name === 'drop' || name === 'outro') return name;
  return 'drop';
}

export const REDO_PRESETS: ReadonlyArray<{ id: string; label: string; style: SectionStyle }> = [
  { id: 'auto', label: 'Same part', style: {} },
  { id: 'epic-drop', label: 'Epic drop', style: { role: 'drop' } },
  { id: 'build-up', label: 'Build-up', style: { role: 'build' } },
  { id: 'breakdown', label: 'Breakdown', style: { role: 'breakdown' } },
  { id: 'dubstep-switch', label: 'Dubstep switch', style: { role: 'switch', genre: 'dubstep' } },
  { id: 'trap-switch', label: 'Trap switch', style: { role: 'switch', genre: 'trap' } },
  { id: 'halftime-switch', label: 'Half-time switch', style: { role: 'switch', genre: 'halftime' } },
  { id: 'jungle-switch', label: 'Jungle switch', style: { role: 'switch', genre: 'jungle' } },
];

export function secondsPerBar(bpm: number): number {
  return 240 / bpm;
}

/** Section index → [startSec, endSec) on the take (startBar is 0-based). */
export function sectionWindowSec(structure: StructureMap, index: number, bpm: number): { startSec: number; endSec: number } | null {
  const sec = structure.sections[index];
  if (!sec) return null;
  const spb = secondsPerBar(bpm);
  return { startSec: sec.startBar * spb, endSec: (sec.startBar + sec.lengthBars) * spb };
}

/** Grow one section; later sections shift; total bars grow. */
export function extendStructure(structure: StructureMap, index: number, deltaBars: number): StructureMap {
  let shift = 0;
  const sections = structure.sections.map((s, i) => {
    const out = { ...s, startBar: s.startBar + shift };
    if (i === index) {
      out.lengthBars = s.lengthBars + deltaBars;
      shift += deltaBars;
    }
    return out;
  });
  return { ...structure, sections, bars: structure.bars + deltaBars };
}

export function isStudioTake(result: RenderResult | null | undefined): boolean {
  return Boolean(
    result?.backendId?.startsWith('ace-step') &&
      result.structure &&
      result.stems.some((s) => s.id === 'mix' && s.blob),
  );
}

/**
 * Redo = repaint the section window. Extend (last section only in R-2) =
 * repaint from 1 bar before the end to past the end; ACE pads and generates the tail.
 */
export function planTakeEdit(result: RenderResult, req: TakeEditRequest): TakeEditPlan | null {
  if (!isStudioTake(result)) return null;
  const structure = result.structure!;
  const source = result.stems.find((s) => s.id === 'mix')!.blob!;
  const bpm = result.bpmMeasured || structure.bpm;
  const spb = secondsPerBar(bpm);
  if (req.kind === 'redo') {
    const w = sectionWindowSec(structure, req.sectionIndex, bpm);
    if (!w) return null;
    const sec = structure.sections[req.sectionIndex]!;
    const style: SectionStyle = { ...req.style, role: req.style?.role ?? roleForSectionName(sec.name) };
    return { edit: { kind: 'repaint', source, ...w }, structureRef: structure, seed: result.seed, bpm, style };
  }
  const last = structure.sections.length - 1;
  if (req.sectionIndex !== last || req.deltaBars <= 0) return null;
  return {
    edit: {
      kind: 'repaint',
      source,
      startSec: Math.max(0, structure.bars - 1) * spb,
      endSec: (structure.bars + req.deltaBars) * spb,
    },
    structureRef: extendStructure(structure, last, req.deltaBars),
    seed: result.seed,
    bpm,
  };
}
