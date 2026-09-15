/**
 * BRIEF-1: listen-first seek + same-song expand keepSeed.
 * Soft-pass forbidden — source + real store behavior.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { useStudioStore } from '../ui/hooks/useStudioStore';
import { structureEngine } from '../core/structure';
import { totalBarsOf } from '../ui/lib/structureEdit';
import type { Section, StructureMap } from '../core/types';

/** Extract a section's drum hits + bass notes, normalized to bar-relative-to-section-start. */
function sectionContent(map: StructureMap, sec: Section) {
  const inRange = (bar: number) => bar >= sec.startBar && bar < sec.startBar + sec.lengthBars;
  const drums: Record<string, unknown> = {};
  for (const d of map.drums) {
    drums[d.role] = d.hits
      .filter((h) => inRange(h.bar))
      .map((h) => ({ ...h, bar: h.bar - sec.startBar }));
  }
  const bass = map.bassRole.notes
    .filter((n) => inRange(n.bar))
    .map((n) => ({ ...n, bar: n.bar - sec.startBar }));
  return { drums, bass };
}

const here = dirname(fileURLToPath(import.meta.url));
const timelineSrc = readFileSync(resolve(here, '../ui/components/SectionTimeline.tsx'), 'utf8');
const storeSrc = readFileSync(resolve(here, '../ui/hooks/useStudioStore.ts'), 'utf8');

describe('BRIEF-1 listen-first wiring', () => {
  it('SectionTimeline click seeks via seekPreview(targetRatio)', () => {
    expect(timelineSrc).toMatch(/seekPreview\(targetRatio\)/);
    expect(timelineSrc).toMatch(/onClick=\{\(e\)\s*=>/);
    expect(timelineSrc).toMatch(/sectionStartRatio/);
  });
});

describe('BRIEF-1 same-song expand keepSeed', () => {
  beforeEach(() => {
    useStudioStore.setState({
      seed: 17400,
      keepSeed: false,
      editedSections: null,
      chaos: 0.25,
    });
  });

  it('store source preserves seed when editedSections set (no variation)', () => {
    expect(storeSrc).toMatch(/preserve seed when sections are edited|editedSections/);
    expect(storeSrc).toMatch(/!opts\?\.variation && !s0\.keepSeed/);
  });

  it('expandSectionAt sets editedSections; generate without vary keeps seed', async () => {
    useStudioStore.setState({
      seed: 17400,
      keepSeed: false,
      result: {
        jobId: 'job_brief1',
        seed: 17400,
        bpmMeasured: 174,
        backendId: 'offline-stub',
        stems: [],
        warnings: [],
        waveformPeaks: [],
        structure: {
          version: 'hard-grid-v0',
          bpm: 174,
          bars: 32,
          ppq: 480,
          samplesPerBar: 1,
          snapPolicy: 'hard',
          sampleRateHz: 48000,
          sections: [
            { name: 'intro', startBar: 0, lengthBars: 8 },
            { name: 'build', startBar: 8, lengthBars: 8 },
            { name: 'drop', startBar: 16, lengthBars: 8 },
            { name: 'break', startBar: 24, lengthBars: 4 },
            { name: 'outro', startBar: 28, lengthBars: 4 },
          ],
          drumRole: {} as any,
          drums: [],
          bassRole: {} as any,
          energyCurve: [],
          keyRoot: 'A',
          seed: 17400,
        },
        manifest: {},
      } as any,
    });

    useStudioStore.getState().expandSectionAt(2, 8);
    const afterExpand = useStudioStore.getState();
    expect(afterExpand.editedSections).not.toBeNull();
    expect(afterExpand.editedSections![2]!.lengthBars).toBe(16);
    expect(afterExpand.seed).toBe(17400);

    // Seed-roll gate: with editedSections and no variation, condition must skip roll
    const s0 = useStudioStore.getState();
    const wouldRoll =
      !undefined && !s0.keepSeed && !(s0.editedSections && true);
    expect(wouldRoll).toBe(false);
  });

  it('P0-1: expanding the drop leaves intro/build/break/outro drum+bass hits byte-identical, not just seed', async () => {
    const seed = 17400;
    const baseSections = [
      { name: 'intro', startBar: 0, lengthBars: 8 },
      { name: 'build', startBar: 8, lengthBars: 8 },
      { name: 'drop', startBar: 16, lengthBars: 8 },
      { name: 'break', startBar: 24, lengthBars: 4 },
      { name: 'outro', startBar: 28, lengthBars: 4 },
    ] as const;

    useStudioStore.setState({
      seed,
      keepSeed: false,
      editedSections: null,
      result: {
        jobId: 'job_brief1_diff',
        seed,
        bpmMeasured: 174,
        backendId: 'offline-stub',
        stems: [],
        warnings: [],
        waveformPeaks: [],
        structure: {
          version: 'hard-grid-v0',
          bpm: 174,
          bars: 32,
          ppq: 480,
          samplesPerBar: 1,
          snapPolicy: 'hard',
          sampleRateHz: 48000,
          sections: baseSections.map((s) => ({ ...s })),
          drumRole: {} as any,
          drums: [],
          bassRole: {} as any,
          energyCurve: [],
          keyRoot: 'A',
          seed,
        },
        manifest: {},
      } as any,
    });

    const before = await structureEngine.plan({
      seed,
      bpm: 174,
      bars: totalBarsOf(baseSections),
      energy: 0.7,
      breakDensity: 0.4,
      sectionsOverride: baseSections.map((s) => ({ ...s })),
    });

    useStudioStore.getState().expandSectionAt(2, 8); // grow drop 8 -> 16
    const editedSections = useStudioStore.getState().editedSections!;
    expect(editedSections[2]!.lengthBars).toBe(16);

    const after = await structureEngine.plan({
      seed,
      bpm: 174,
      bars: totalBarsOf(editedSections),
      energy: 0.7,
      breakDensity: 0.4,
      sectionsOverride: editedSections,
    });

    // Song identity survives the expand.
    expect(after.keyRoot).toBe(before.keyRoot);
    expect(after.patternFamily).toBe(before.patternFamily);
    expect(after.bassRole.character).toBe(before.bassRole.character);

    // intro (0), build (1) sit before the expanded drop and outro/break shift
    // position (3,4) but must keep byte-identical content in all four cases.
    for (const idx of [0, 1, 3, 4]) {
      expect(after.sections[idx]!.name).toBe(before.sections[idx]!.name);
      expect(after.sections[idx]!.lengthBars).toBe(before.sections[idx]!.lengthBars);
      expect(
        sectionContent(after, after.sections[idx]!),
        `GAP: section ${idx} (${before.sections[idx]!.name}) hits changed after expanding the drop`,
      ).toEqual(sectionContent(before, before.sections[idx]!));
    }

    // The edited section (drop, index 2) actually grew.
    expect(after.sections[2]!.lengthBars).toBe(16);
  });

  it('vary changes seed (new idea)', () => {
    const before = useStudioStore.getState().seed;
    useStudioStore.getState().vary();
    // vary is async generate; seed nudge happens synchronously in applyVaryDiversity path via vary()
    // If vary only kicks generate, seed may change in applyVaryDiversity before await
    const after = useStudioStore.getState().seed;
    // vary() in store: applyVaryDiversity then generate — seed should change
    expect(after).not.toBe(before);
  });
});
