/**
 * R-3 downbeat grid — estimate where bar 1 starts; section windows use it.
 * Synthetic audio only (deterministic, not copyrighted).
 */
import { describe, expect, it } from 'vitest';
import type { RenderResult, StructureMap } from '../core/types';
import { estimateBarGrid, BAR_GRID_MIN_CONFIDENCE } from '../core/audio/downbeatGrid';
import { planTakeEdit } from '../ui/lib/takeEdit';

function synth(bpm: number, offsetSec: number, bars: number, sr = 48000): Float32Array {
  const beat = 60 / bpm;
  const x = new Float32Array(Math.ceil((offsetSec + bars * 4 * beat + 0.5) * sr));
  let s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296) * 2 - 1;
  const add = (i: number, v: number) => {
    if (i >= 0 && i < x.length) x[i] = (x[i] ?? 0) + v;
  };
  for (let b = 0; b < bars * 4; b++) {
    const i0 = Math.round((offsetSec + b * beat) * sr);
    if (b % 4 === 0)
      for (let i = 0; i < 0.12 * sr; i++) {
        const t = i / sr;
        add(i0 + i, Math.sin(2 * Math.PI * 55 * t) * Math.exp(-t * 25));
      }
    if (b % 4 === 1 || b % 4 === 3)
      for (let i = 0; i < 0.08 * sr; i++) {
        const t = i / sr;
        add(i0 + i, 0.5 * rnd() * Math.exp(-t * 40));
      }
  }
  return x;
}

describe('estimateBarGrid', () => {
  it('finds a 174 BPM offset', () => {
    const g = estimateBarGrid(synth(174, 0.137, 16), 48000, 174);
    expect(Math.abs(g.offsetSec - 0.137)).toBeLessThanOrEqual(0.02);
    expect(g.confidence).toBeGreaterThanOrEqual(BAR_GRID_MIN_CONFIDENCE);
  });

  it('finds a 140 BPM offset', () => {
    const g = estimateBarGrid(synth(140, 0.4, 16), 48000, 140);
    expect(Math.abs(g.offsetSec - 0.4)).toBeLessThanOrEqual(0.02);
    expect(g.confidence).toBeGreaterThanOrEqual(BAR_GRID_MIN_CONFIDENCE);
  });

  it('zero offset reads as 0 or one bar', () => {
    const g = estimateBarGrid(synth(174, 0, 16), 48000, 174);
    const barSec = 240 / 174;
    expect(g.offsetSec <= 0.02 || g.offsetSec >= barSec - 0.02).toBe(true);
  });

  it('pure noise is low confidence', () => {
    const sr = 48000;
    const x = new Float32Array(sr * 10);
    let s = 987654321;
    const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296) * 2 - 1;
    for (let i = 0; i < x.length; i++) x[i] = rnd() * 0.3;
    expect(estimateBarGrid(x, sr, 174).confidence).toBeLessThan(BAR_GRID_MIN_CONFIDENCE);
  });
});

const sections = [
  { name: 'intro' as const, startBar: 0, lengthBars: 8 },
  { name: 'drop' as const, startBar: 8, lengthBars: 16 },
  { name: 'outro' as const, startBar: 24, lengthBars: 8 },
];

function structureOf(secs: StructureMap['sections'], bars: number): StructureMap {
  return {
    version: 'hard-grid-v0',
    bpm: 140,
    bars,
    ppq: 480,
    samplesPerBar: 1,
    snapPolicy: 'hard',
    sampleRateHz: 48000,
    sections: secs.map((s) => ({ ...s })),
    drumRole: {} as StructureMap['drumRole'],
    drums: [],
    bassRole: {} as StructureMap['bassRole'],
    energyCurve: [],
    keyRoot: 'A',
    seed: 5,
  };
}

const baseStructure = structureOf(sections, 32);
const mixBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });

function takeWith(barGrid?: RenderResult['barGrid']): RenderResult {
  return {
    jobId: 'take1',
    seed: 5,
    bpmMeasured: 140,
    backendId: 'ace-step-1.5',
    stems: [{ id: 'mix', blob: mixBlob }],
    warnings: [],
    waveformPeaks: [],
    structure: baseStructure,
    manifest: {},
    ...(barGrid ? { barGrid } : {}),
  } as unknown as RenderResult;
}

describe('planTakeEdit uses the confident bar-1 offset', () => {
  it('redo shifts the window by the offset', () => {
    const plan = planTakeEdit(takeWith({ offsetSec: 0.25, confidence: 0.9, bpm: 140 }), {
      kind: 'redo',
      sectionIndex: 1,
    });
    expect(plan).not.toBeNull();
    expect(plan!.edit.startSec).toBeCloseTo(0.25 + (8 * 240) / 140, 5);
    expect(plan!.edit.endSec).toBeCloseTo(0.25 + (24 * 240) / 140, 5);
  });

  it('low confidence ignores the offset', () => {
    const plan = planTakeEdit(takeWith({ offsetSec: 0.25, confidence: 0.2, bpm: 140 }), {
      kind: 'redo',
      sectionIndex: 1,
    });
    expect(plan!.edit.startSec).toBeCloseTo((8 * 240) / 140, 5);
  });

  it('extend shifts the tail window by the offset', () => {
    const plan = planTakeEdit(takeWith({ offsetSec: 0.25, confidence: 0.9, bpm: 140 }), {
      kind: 'extend',
      sectionIndex: 2,
      deltaBars: 16,
    });
    expect(plan).not.toBeNull();
    expect(plan!.edit.endSec).toBeCloseTo(0.25 + (48 * 240) / 140, 5);
  });
});
