/**
 * Detect section boundaries in a rendered mix via RMS + novelty analysis.
 * After Studio render, snap planned section boundaries to detected changes.
 */

import type { StructureMap } from '../types';

const NOVELTY_THRESHOLD = 0.5; // Relative novelty threshold for change detection

/**
 * Compute per-bar RMS energy + low-band energy ratio.
 * Returns array where index = bar number, value = {rms, lowBandRatio, novelty}.
 */
export function barEnergyProfile(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  bpm: number,
): Array<{ rms: number; lowBandRatio: number; novelty: number }> {
  const samplesPerBar = Math.round((60 / bpm) * 4 * sampleRate);
  const numBars = Math.ceil(Math.max(left.length, right.length) / samplesPerBar);
  const profile: Array<{ rms: number; lowBandRatio: number; novelty: number }> = [];

  for (let barIdx = 0; barIdx < numBars; barIdx++) {
    const startIdx = barIdx * samplesPerBar;
    const endIdx = Math.min(startIdx + samplesPerBar, left.length);
    const samples = Math.max(0, endIdx - startIdx);

    if (samples === 0) {
      profile.push({ rms: 0, lowBandRatio: 0, novelty: 0 });
      continue;
    }

    // Compute RMS for this bar
    let sumSq = 0;
    for (let i = startIdx; i < endIdx; i++) {
      const lSamp = left[i] ?? 0;
      const rSamp = right[i] ?? 0;
      const mono = (lSamp + rSamp) / 2;
      sumSq += mono * mono;
    }
    const rms = Math.sqrt(sumSq / samples);

    // Rough low-band energy proxy (no actual filtering; use amplitude threshold)
    // This is a placeholder; real implementation would apply a low-pass filter first
    const lowBandRatio = rms > 0.1 ? 0.6 : 0.3; // Heuristic placeholder

    profile.push({ rms, lowBandRatio, novelty: 0 });
  }

  // Compute novelty as local change in RMS
  for (let i = 1; i < profile.length; i++) {
    const prev = profile[i - 1]!.rms;
    const curr = profile[i]!.rms;
    profile[i]!.novelty = Math.abs(curr - prev) / (Math.max(prev, curr) + 0.001);
  }

  return profile;
}

/**
 * Detect bars where novelty / energy change is significant.
 * Returns array of bar indices with detected change points.
 */
export function detectChangePoints(
  profile: Array<{ rms: number; lowBandRatio: number; novelty: number }>,
  threshold = NOVELTY_THRESHOLD,
): number[] {
  const changes: number[] = [];
  for (let i = 1; i < profile.length; i++) {
    if (profile[i]!.novelty > threshold) {
      changes.push(i);
    }
  }
  return changes;
}

/**
 * Snap each section boundary to nearest detected change within ±4 bars.
 * Returns new planned structure with section boundaries adjusted.
 */
export function snapSectionBoundaries(
  plan: StructureMap,
  changePoints: number[],
  snapWindowBars = 4,
): StructureMap {
  if (changePoints.length === 0) return plan;

  const newSections = plan.sections.map((sec) => {
    // Find nearest change point within snap window
    let nearestBar = sec.startBar;
    let nearestDist = Infinity;

    for (const cp of changePoints) {
      const dist = Math.abs(cp - sec.startBar);
      if (dist <= snapWindowBars && dist < nearestDist) {
        nearestDist = dist;
        nearestBar = cp;
      }
    }

    return {
      ...sec,
      startBar: nearestBar === sec.startBar ? sec.startBar : nearestBar,
    };
  });

  return {
    ...plan,
    sections: newSections,
  };
}

/**
 * Full pipeline: detect sections in a rendered mix and snap boundaries.
 * Returns {plannedStructure, detectedStructure}.
 */
export function detectSectionStructure(
  left: Float32Array,
  right: Float32Array,
  plan: StructureMap,
): {
  plannedStructure: StructureMap;
  detectedStructure: StructureMap;
  changePoints: number[];
} {
  const profile = barEnergyProfile(left, right, plan.sampleRateHz, plan.bpm);
  const changePoints = detectChangePoints(profile);
  const detected = snapSectionBoundaries(plan, changePoints);

  return {
    plannedStructure: plan,
    detectedStructure: detected,
    changePoints,
  };
}
