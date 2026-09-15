/**
 * Critic A7 — section RMS drop > intro (OfflineStub + energyCurve).
 * Pure CPU windowing — no Matchering/Pedalboard; StructureMap section bounds are authority.
 */
import type { Section, SectionName, StructureMap } from '../types';
import { bufferRms } from './waveformPeaks';

/** Hard gate: drop section RMS must be at least this multiple of intro RMS. Soft-pass forbidden. */
export const DROP_INTRO_RMS_MIN_RATIO = 1.25;

export interface SectionRmsReport {
  section: SectionName;
  startBar: number;
  lengthBars: number;
  startSample: number;
  endSample: number;
  rms: number;
}

export interface DropVsIntroRmsReport {
  intro: SectionRmsReport;
  drop: SectionRmsReport;
  /** drop.rms / intro.rms (Infinity if intro silent and drop has energy). */
  ratio: number;
  /** True iff drop.rms >= intro.rms * DROP_INTRO_RMS_MIN_RATIO and intro.rms > 0. */
  passes: boolean;
  samplesPerBar: number;
  sampleRateHz: number;
}

/** Locate a named section on the structure map (first match). */
export function findSection(structure: StructureMap, name: SectionName): Section | undefined {
  return structure.sections.find((s) => s.name === name);
}

/**
 * RMS of mono samples covering [startBar, startBar+lengthBars) using structure.samplesPerBar.
 * Clamps to buffer length — does not soft-pad silence beyond the render.
 */
export function sectionWindowRms(
  mono: Float32Array,
  section: Section,
  samplesPerBar: number,
): SectionRmsReport {
  const spb = Math.max(1, samplesPerBar | 0);
  const startSample = Math.max(0, section.startBar * spb);
  const endSample = Math.min(mono.length, (section.startBar + section.lengthBars) * spb);
  const slice =
    endSample > startSample ? mono.subarray(startSample, endSample) : new Float32Array(0);
  return {
    section: section.name,
    startBar: section.startBar,
    lengthBars: section.lengthBars,
    startSample,
    endSample,
    rms: bufferRms(slice),
  };
}

/**
 * Compare drop vs intro RMS on a rendered mono channel using StructureMap section bounds.
 * Prefer left/undelayed channel for Haas stems; mix is fine as mono average or left.
 */
export function measureDropVsIntroRms(opts: {
  structure: StructureMap;
  mono: Float32Array;
  sampleRateHz?: number;
}): DropVsIntroRmsReport {
  const { structure, mono } = opts;
  const introSec = findSection(structure, 'intro');
  const dropSec = findSection(structure, 'drop');
  if (!introSec || !dropSec) {
    throw new Error('StructureMap missing intro or drop section');
  }
  const intro = sectionWindowRms(mono, introSec, structure.samplesPerBar);
  const drop = sectionWindowRms(mono, dropSec, structure.samplesPerBar);
  const ratio =
    intro.rms > 1e-12 ? drop.rms / intro.rms : drop.rms > 1e-12 ? Number.POSITIVE_INFINITY : 0;
  const passes = intro.rms > 1e-12 && drop.rms >= intro.rms * DROP_INTRO_RMS_MIN_RATIO;
  return {
    intro,
    drop,
    ratio,
    passes,
    samplesPerBar: structure.samplesPerBar,
    sampleRateHz: opts.sampleRateHz ?? structure.sampleRateHz,
  };
}
