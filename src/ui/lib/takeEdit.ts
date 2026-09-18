import type { GenreId, RenderJob, RenderResult, SectionRole, StructureMap } from '@/core/types';
import { BAR_GRID_MIN_CONFIDENCE } from '@/core/audio/downbeatGrid';
import { sectionBpm, sectionStartSec } from './tempoBlocks';

export type SectionStyle = { role?: SectionRole; genre?: GenreId; words?: string; strength?: number };

/** Redo "Change amount" — ACE repaint_strength. UI range 0.2-1, default 0.5. */
export const REDO_STRENGTH_DEFAULT = 0.5;
export const REDO_STRENGTH_MIN = 0.2;
export const REDO_STRENGTH_MAX = 1;

export function clampRedoStrength(value?: number | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return REDO_STRENGTH_DEFAULT;
  return Math.min(REDO_STRENGTH_MAX, Math.max(REDO_STRENGTH_MIN, value));
}

export type TakeEditRequest =
  | { kind: 'redo'; sectionIndex: number; style?: SectionStyle }
  | { kind: 'extend'; sectionIndex: number; deltaBars: number }
  | {
      /** E-1: browser already spliced the PCM; ACE repaints one seam window. */
      kind: 'splice';
      source: Blob;
      structure: StructureMap;
      startSec: number;
      endSec: number;
      style?: SectionStyle;
    };

export type TakeEditPlan = {
  edit: NonNullable<RenderJob['edit']>;
  structureRef: StructureMap;
  seed: number;
  bpm: number;
  style?: SectionStyle;
  /** Present when the raw mix was missing and the mastered mix was used. */
  warning?: string;
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

/** Bar-1 offset to use for edits: the estimate when confident, else 0. */
export function gridOffsetSec(result: RenderResult): number {
  const g = result.barGrid;
  return g && g.confidence >= BAR_GRID_MIN_CONFIDENCE ? g.offsetSec : 0;
}

/** Section index → [startSec, endSec) on the take (startBar is 0-based, per-section BPM). */
export function sectionWindowSec(
  structure: StructureMap,
  index: number,
  bpm: number,
  offsetSec = 0,
): { startSec: number; endSec: number } | null {
  const sec = structure.sections[index];
  if (!sec) return null;
  const spb = 240 / sectionBpm(sec, bpm);
  const start = offsetSec + sectionStartSec(structure, index, bpm);
  return { startSec: start, endSec: start + sec.lengthBars * spb };
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
  // Prefer the RAW ACE mix so a Redo repaints from un-mastered audio. Studio
  // takes always carry it now; if an old take lacks it, fall back to the
  // mastered mix and surface a warning.
  const mixSource = result.stems.find((s) => s.id === 'mix')!.blob!;
  const rawSource = result.rawMixBlob ?? null;
  const source = rawSource ?? mixSource;
  const sourceWarning = rawSource
    ? undefined
    : 'No raw mix for this take — editing the mastered mix (tone may drift)';
  const bpm = result.bpmMeasured || structure.bpm;
  const off = gridOffsetSec(result);
  if (req.kind === 'splice') {
    // E-1 arrangement edit: the spliced PCM is the new source; ACE only
    // repaints the seam window(s) the pure planner produced.
    return {
      edit: {
        kind: 'repaint',
        source: req.source,
        startSec: req.startSec,
        endSec: req.endSec,
        mode: 'balanced',
      },
      structureRef: req.structure,
      seed: result.seed,
      bpm,
      ...(req.style ? { style: req.style } : {}),
    };
  }
  if (req.kind === 'redo') {
    const w = sectionWindowSec(structure, req.sectionIndex, bpm, off);
    if (!w) return null;
    const sec = structure.sections[req.sectionIndex]!;
    const style: SectionStyle = { ...req.style, role: req.style?.role ?? roleForSectionName(sec.name) };
    return {
      edit: {
        kind: 'repaint',
        source,
        ...w,
        mode: 'balanced',
        strength: clampRedoStrength(req.style?.strength),
      },
      structureRef: structure,
      seed: result.seed,
      bpm,
      style,
      ...(sourceWarning ? { warning: sourceWarning } : {}),
    };
  }
  const last = structure.sections.length - 1;
  if (req.sectionIndex !== last || req.deltaBars <= 0) return null;
  const lastSec = structure.sections[last]!;
  const lastBpm = sectionBpm(lastSec, bpm);
  const lastSpb = 240 / lastBpm;
  const lastStart = off + sectionStartSec(structure, last, bpm);
  return {
    edit: {
      kind: 'repaint',
      source,
      startSec: lastStart + Math.max(0, lastSec.lengthBars - 1) * lastSpb,
      endSec: lastStart + (lastSec.lengthBars + req.deltaBars) * lastSpb,
    },
    structureRef: extendStructure(structure, last, req.deltaBars),
    seed: result.seed,
    bpm,
    ...(sourceWarning ? { warning: sourceWarning } : {}),
  };
}
