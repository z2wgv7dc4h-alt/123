/**
 * E-1 arrangement splicing: exact sample counts at bar lines + seam windows.
 * bpm 120 at 48 kHz => 96000 frames/bar, so every count is exact.
 */
import { describe, expect, it } from 'vitest';
import type { Section, StructureMap } from '../core/types';
import { frameAtBar, framesPerBar, planArrange } from '../ui/lib/arrangeTake';

const SR = 48000;
const BPM = 120;
const FPB = framesPerBar(BPM, SR); // 96000

function structureOf(sections: Array<[Section['name'], number]>, bpm = BPM): StructureMap {
  let bar = 0;
  const secs: Section[] = sections.map(([name, lengthBars]) => {
    const s: Section = { name, startBar: bar, lengthBars };
    bar += lengthBars;
    return s;
  });
  return {
    version: 'hard-grid-v0',
    bpm,
    bars: bar,
    ppq: 480,
    samplesPerBar: FPB,
    snapPolicy: 'hard',
    sampleRateHz: SR,
    sections: secs,
    drumRole: {} as StructureMap['drumRole'],
    drums: [],
    bassRole: {} as StructureMap['bassRole'],
    energyCurve: [],
    keyRoot: 'A',
    seed: 5,
  };
}

function mkChannels(frames: number): Float32Array[] {
  const l = new Float32Array(frames);
  const r = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    l[i] = i;
    r[i] = -i;
  }
  return [l, r];
}

const baseStructure = structureOf([
  ['intro', 4],
  ['drop', 4],
  ['break', 2],
  ['outro', 2],
]); // 12 bars
const TOTAL = baseStructure.bars * FPB;
const channels = mkChannels(TOTAL);

function plan(op: Parameters<typeof planArrange>[0]['op'], offsetSec = 0) {
  return planArrange({ op, channels, structure: baseStructure, bpm: BPM, offsetSec, sampleRateHz: SR });
}

describe('bar frame math', () => {
  it('framesPerBar is an exact integer and frameAtBar lands on bar lines', () => {
    expect(FPB).toBe(96000);
    expect(frameAtBar(0, 0, SR, FPB)).toBe(0);
    expect(frameAtBar(4, 0, SR, FPB)).toBe(4 * FPB);
    expect(frameAtBar(2, 0.25, SR, FPB)).toBe(Math.round(0.25 * SR) + 2 * FPB);
  });
});

describe('arrangeTake delete', () => {
  it('cuts exactly the section frames and shifts later sections', () => {
    const p = plan({ kind: 'delete', sectionIndex: 1 })!;
    expect(p.channels[0]!.length).toBe(TOTAL - 4 * FPB);
    expect(p.channels[0]!.length % FPB).toBe(0);
    expect(p.structure.bars).toBe(8);
    expect(p.structure.sections.map((s) => s.name)).toEqual(['intro', 'break', 'outro']);
    expect(p.structure.sections.map((s) => s.startBar)).toEqual([0, 4, 6]);
    // Content: tail shifted down by the removed 4 bars.
    expect(p.channels[0]![4 * FPB]).toBe(8 * FPB);
    // One seam, 1 bar each side of the join at 4 bars.
    expect(p.seams).toEqual([{ startSec: (3 * FPB) / SR, endSec: (5 * FPB) / SR }]);
    expect(p.repaint).toEqual(p.seams[0]);
  });
});

describe('arrangeTake duplicate', () => {
  it('copies the block after itself and reports both seams', () => {
    const p = plan({ kind: 'duplicate', sectionIndex: 1 })!;
    expect(p.channels[0]!.length).toBe(TOTAL + 4 * FPB);
    expect(p.structure.bars).toBe(16);
    expect(p.structure.sections.map((s) => s.name)).toEqual([
      'intro',
      'drop',
      'drop',
      'break',
      'outro',
    ]);
    expect(p.structure.sections.map((s) => s.startBar)).toEqual([0, 4, 8, 12, 14]);
    // Second copy starts with the original drop's first frame; after it the
    // original tail resumes.
    expect(p.channels[0]![8 * FPB]).toBe(4 * FPB);
    expect(p.channels[0]![12 * FPB]).toBe(8 * FPB);
    expect(p.seams).toEqual([
      { startSec: (7 * FPB) / SR, endSec: (9 * FPB) / SR },
      { startSec: (11 * FPB) / SR, endSec: (13 * FPB) / SR },
    ]);
    expect(p.repaint).toEqual({ startSec: (7 * FPB) / SR, endSec: (13 * FPB) / SR });
  });
});

describe('arrangeTake insert blank', () => {
  it('inserts exact silence and repaints the whole gap + 1 bar each side', () => {
    const p = plan({ kind: 'insert', atStartBar: 4, bars: 2, name: 'build' })!;
    expect(p.channels[0]!.length).toBe(TOTAL + 2 * FPB);
    expect(p.structure.bars).toBe(14);
    expect(p.structure.sections.map((s) => s.name)).toEqual([
      'intro',
      'build',
      'drop',
      'break',
      'outro',
    ]);
    expect(p.structure.sections.map((s) => s.startBar)).toEqual([0, 4, 6, 10, 12]);
    // The gap is real silence, and the tail shifted by 2 bars.
    for (let i = 4 * FPB; i < 6 * FPB; i++) expect(p.channels[0]![i]).toBe(0);
    expect(p.channels[0]![6 * FPB]).toBe(4 * FPB);
    // Whole gap (2 bars) + 1 bar each side.
    expect(p.repaint).toEqual({ startSec: (3 * FPB) / SR, endSec: (7 * FPB) / SR });
  });
});

describe('arrangeTake move', () => {
  it('reorders blocks with no sample loss and seams around the moved block', () => {
    const p = plan({ kind: 'move', sectionIndex: 1, toIndex: 3 })!;
    expect(p.channels[0]!.length).toBe(TOTAL);
    expect(p.structure.bars).toBe(12);
    expect(p.structure.sections.map((s) => s.name)).toEqual(['intro', 'break', 'outro', 'drop']);
    expect(p.structure.sections.map((s) => s.startBar)).toEqual([0, 4, 6, 8]);
    // Reordered content: intro, break, outro, drop.
    expect(p.channels[0]![0]).toBe(0);
    expect(p.channels[0]![4 * FPB]).toBe(8 * FPB); // break first frame
    expect(p.channels[0]![6 * FPB]).toBe(10 * FPB); // outro first frame
    expect(p.channels[0]![8 * FPB]).toBe(4 * FPB); // drop first frame
    expect(p.seams).toEqual([
      { startSec: (7 * FPB) / SR, endSec: (9 * FPB) / SR },
      { startSec: (11 * FPB) / SR, endSec: (12 * FPB) / SR },
    ]);
  });

  it('refuses a no-op move', () => {
    expect(plan({ kind: 'move', sectionIndex: 2, toIndex: 2 })).toBeNull();
  });
});

describe('arrangeTake grid offset', () => {
  it('applies the R-3 offset to every bar line', () => {
    const off = 0.25;
    const p = plan({ kind: 'delete', sectionIndex: 1 }, off)!;
    expect(p.channels[0]!.length).toBe(TOTAL - 4 * FPB);
    // Join is at bar 4 => offset + 4 bars; seam is 1 bar either side.
    const join = Math.round(off * SR) + 4 * FPB;
    expect(p.seams[0]).toEqual({
      startSec: (join - FPB) / SR,
      endSec: (join + FPB) / SR,
    });
  });
});
