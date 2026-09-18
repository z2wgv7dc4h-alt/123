/**
 * E-1 arrangement splicing on a Studio take.
 *
 * Every op is a deterministic PCM edit at exact bar lines (using the R-3
 * downbeat offset): Duplicate, Delete, Move and Insert-blank. The browser does
 * the splice, then ACE repaints the seam(s) (R-1 edit). These functions are
 * pure — no Blob/Web Audio — so sample counts and seam windows are testable.
 */
import type { Section, SectionName, StructureMap } from '@/core/types';

export type SeamWindow = { startSec: number; endSec: number };

export type ArrangeOp =
  | { kind: 'delete'; sectionIndex: number }
  | { kind: 'duplicate'; sectionIndex: number }
  | { kind: 'move'; sectionIndex: number; toIndex: number }
  | { kind: 'insert'; atStartBar: number; bars: number; name: SectionName };

export type ArrangePlan = {
  op: ArrangeOp;
  /** Spliced PCM channels (same channel count as the input). */
  channels: Float32Array[];
  /** Sections/bars rearranged to match the spliced audio. */
  structure: StructureMap;
  /** One window per edited join (1 bar each side). */
  seams: SeamWindow[];
  /** Single R-1 repaint window covering every seam (ACE takes one per render). */
  repaint: SeamWindow;
};

/** Frames in one 4/4 bar at the take tempo. Integer so bars are exact. */
export function framesPerBar(bpm: number, sampleRateHz: number): number {
  return Math.round((240 / bpm) * sampleRateHz);
}

/** First frame of a 0-based bar, including the grid offset (R-3). */
export function frameAtBar(
  bar: number,
  offsetSec: number,
  sampleRateHz: number,
  fpb: number,
): number {
  return Math.round(offsetSec * sampleRateHz) + Math.round(bar * fpb);
}

export function windowFromFrames(startFrame: number, endFrame: number, sampleRateHz: number): SeamWindow {
  return { startSec: startFrame / sampleRateHz, endSec: endFrame / sampleRateHz };
}

function sliceChannels(channels: readonly Float32Array[], start: number, end: number): Float32Array[] {
  return channels.map((ch) => ch.slice(start, Math.max(start, end)));
}

function silentChannels(channels: readonly Float32Array[], frames: number): Float32Array[] {
  return channels.map(() => new Float32Array(Math.max(0, frames)));
}

function totalFrames(channels: readonly Float32Array[]): number {
  let n = 0;
  for (const ch of channels) n = Math.max(n, ch.length);
  return n;
}

/** Concatenate channel-blocks (same channel count) into fresh arrays. */
function concatChannels(parts: readonly Float32Array[][]): Float32Array[] {
  const nCh = parts[0]?.length ?? 0;
  let frames = 0;
  for (const p of parts) frames += p[0]?.length ?? 0;
  const out = Array.from({ length: nCh }, () => new Float32Array(frames));
  let off = 0;
  for (const p of parts) {
    const len = p[0]?.length ?? 0;
    for (let c = 0; c < nCh; c++) out[c]!.set(p[c]!, off);
    off += len;
  }
  return out;
}

/** Re-flow startBar so sections stay contiguous from bar 0. */
function relayout(sections: readonly Section[]): { sections: Section[]; bars: number } {
  let cursor = 0;
  const out = sections.map((s) => {
    const next: Section = { ...s, startBar: cursor };
    cursor += s.lengthBars;
    return next;
  });
  return { sections: out, bars: cursor };
}

/** Neutral name for an inserted blank section (overridable by the caller). */
export function defaultInsertName(atStartBar: number, totalBars: number): SectionName {
  if (atStartBar <= 0) return 'intro';
  if (atStartBar >= totalBars) return 'outro';
  return 'break';
}

function clampSeam(w: SeamWindow, totalSec: number): SeamWindow {
  const startSec = Math.max(0, Math.min(totalSec, w.startSec));
  const endSec = Math.max(startSec, Math.min(totalSec, w.endSec));
  return { startSec, endSec };
}

function cover(seams: readonly SeamWindow[]): SeamWindow {
  let start = Infinity;
  let end = -Infinity;
  for (const s of seams) {
    start = Math.min(start, s.startSec);
    end = Math.max(end, s.endSec);
  }
  return Number.isFinite(start) ? { startSec: start, endSec: Math.max(end, start) } : { startSec: 0, endSec: 0 };
}

export function planArrange(opts: {
  op: ArrangeOp;
  channels: readonly Float32Array[];
  structure: StructureMap;
  bpm: number;
  offsetSec: number;
  sampleRateHz: number;
}): ArrangePlan | null {
  const { op, channels, structure, bpm, offsetSec, sampleRateHz } = opts;
  if (!channels.length || !structure.sections.length) return null;
  const fpb = framesPerBar(bpm, sampleRateHz);
  const total = totalFrames(channels);
  const frameFor = (bar: number) => frameAtBar(bar, offsetSec, sampleRateHz, fpb);

  let outChannels: Float32Array[];
  let nextStructure: StructureMap;
  let seamFrames: Array<[number, number]>;

  if (op.kind === 'delete') {
    const sec = structure.sections[op.sectionIndex];
    if (!sec) return null;
    const f0 = frameFor(sec.startBar);
    const f1 = frameFor(sec.startBar + sec.lengthBars);
    outChannels = concatChannels([sliceChannels(channels, 0, f0), sliceChannels(channels, f1, total)]);
    nextStructure = { ...structure, ...relayout(structure.sections.filter((_, i) => i !== op.sectionIndex)) };
    seamFrames = [[f0 - fpb, f0 + fpb]];
  } else if (op.kind === 'duplicate') {
    const sec = structure.sections[op.sectionIndex];
    if (!sec) return null;
    const f0 = frameFor(sec.startBar);
    const f1 = frameFor(sec.startBar + sec.lengthBars);
    const block = sliceChannels(channels, f0, f1);
    outChannels = concatChannels([
      sliceChannels(channels, 0, f0),
      block,
      block,
      sliceChannels(channels, f1, total),
    ]);
    const sections = [...structure.sections];
    sections.splice(op.sectionIndex + 1, 0, { ...sec });
    nextStructure = { ...structure, ...relayout(sections) };
    const blockFrames = f1 - f0;
    seamFrames = [
      [f1 - fpb, f1 + fpb],
      [f1 + blockFrames - fpb, f1 + blockFrames + fpb],
    ];
  } else if (op.kind === 'insert') {
    const bars = Math.max(1, Math.round(op.bars));
    if (op.atStartBar < 0 || op.atStartBar > structure.bars) return null;
    const at = frameFor(op.atStartBar);
    const gapFrames = bars * fpb;
    outChannels = concatChannels([
      sliceChannels(channels, 0, at),
      silentChannels(channels, gapFrames),
      sliceChannels(channels, at, total),
    ]);
    const sections = [...structure.sections];
    const insertAt = sections.findIndex((s) => s.startBar >= op.atStartBar);
    const atIndex = insertAt < 0 ? sections.length : insertAt;
    sections.splice(atIndex, 0, { name: op.name, startBar: op.atStartBar, lengthBars: bars });
    nextStructure = { ...structure, ...relayout(sections) };
    seamFrames = [
      [at - fpb, at + fpb],
      [at + gapFrames - fpb, at + gapFrames + fpb],
    ];
  } else {
    // move
    const from = op.sectionIndex;
    const to = Math.max(0, Math.min(structure.sections.length - 1, op.toIndex));
    if (from < 0 || from >= structure.sections.length || from === to) return null;
    const blocks = structure.sections.map((s) => [
      frameFor(s.startBar),
      frameFor(s.startBar + s.lengthBars),
    ] as [number, number]);
    const order = structure.sections.map((_, i) => i);
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved!);
    outChannels = concatChannels(order.map((i) => sliceChannels(channels, blocks[i]![0], blocks[i]![1])));
    const sections = order.map((i) => structure.sections[i]!);
    const laid = relayout(sections);
    nextStructure = { ...structure, ...laid };
    let cursor = 0;
    for (let k = 0; k < to; k++) cursor += sections[k]!.lengthBars;
    const movedLen = sections[to]!.lengthBars;
    const startFrame = frameFor(cursor);
    const endFrame = frameFor(cursor + movedLen);
    seamFrames = [
      [startFrame - fpb, startFrame + fpb],
      [endFrame - fpb, endFrame + fpb],
    ];
  }

  const seams = seamFrames.map(([s, e]) =>
    clampSeam(windowFromFrames(s, e, sampleRateHz), totalFrames(outChannels) / sampleRateHz),
  );
  const repaint = clampSeam(cover(seams), totalFrames(outChannels) / sampleRateHz);
  if (repaint.endSec <= repaint.startSec) return null;
  return { op, channels: outChannels, structure: nextStructure, seams, repaint };
}

/** Section names the Insert control can create. */
export const INSERT_SECTION_NAMES: readonly SectionName[] = ['intro', 'build', 'drop', 'break', 'outro'];
