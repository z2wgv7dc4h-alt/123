/**
 * Wyatt P0: structure section length drag / expand → persist into next generate.
 * Soft-pass forbidden — red if store actions missing; green only for real wiring.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { structureEngine } from '../core/structure';
import { DEFAULT_BPM, type Section, type StructureMap } from '../core/types';
import {
  expandSection,
  setSectionLengthBars,
  snapBars4,
  totalBarsOf,
  withEditedSections,
} from '../ui/lib/structureEdit';
import { useStudioStore } from '../ui/hooks/useStudioStore';

function sampleSections(): Section[] {
  return [
    { name: 'intro', startBar: 0, lengthBars: 8 },
    { name: 'build', startBar: 8, lengthBars: 8 },
    { name: 'drop', startBar: 16, lengthBars: 8 },
    { name: 'break', startBar: 24, lengthBars: 4 },
    { name: 'outro', startBar: 28, lengthBars: 4 },
  ];
}

const here = dirname(fileURLToPath(import.meta.url));
const timelineSrc = readFileSync(resolve(here, '../ui/components/SectionTimeline.tsx'), 'utf8');
const storeSrc = readFileSync(resolve(here, '../ui/hooks/useStudioStore.ts'), 'utf8');

describe('structureEdit APIs (section length math)', () => {
  it('snapBars4 snaps to multiples of 4 with floor 4', () => {
    expect(snapBars4(7)).toBe(8);
    expect(snapBars4(5)).toBe(4);
    expect(snapBars4(1)).toBe(4);
    expect(snapBars4(16)).toBe(16);
  });

  it('expandSection grows a section and reindexes starts; total updates', () => {
    const sections = sampleSections();
    const before = totalBarsOf(sections);
    const out = expandSection(sections, 2, 8); // grow drop +8
    expect(out).not.toBeNull();
    expect(out!.sections[2]!.name).toBe('drop');
    expect(out!.sections[2]!.lengthBars).toBe(16);
    expect(out!.bars).toBe(before + 8);
    expect(out!.sections[3]!.startBar).toBe(out!.sections[2]!.startBar + out!.sections[2]!.lengthBars);
  });

  it('setSectionLengthBars drag-edge absolute length', () => {
    const sections = sampleSections();
    const out = setSectionLengthBars(sections, 0, 12);
    expect(out).not.toBeNull();
    expect(out!.sections[0]!.lengthBars).toBe(12);
    expect(out!.bars).toBe(totalBarsOf(out!.sections));
  });

  it('withEditedSections patches StructureMap bars+sections for next plan/generate input', async () => {
    const planned = await structureEngine.plan({
      seed: 99,
      bpm: DEFAULT_BPM,
      bars: 32,
      energy: 0.7,
      breakDensity: 0.4,
    });
    const expanded = expandSection(planned.sections, 0, 8);
    expect(expanded).not.toBeNull();
    const patch = withEditedSections(planned as StructureMap, expanded!.sections);
    expect(patch.version).toBe(planned.version);
    expect(patch.bars).toBe(expanded!.bars);
    expect(patch.sections[0]!.lengthBars).toBe(expanded!.sections[0]!.lengthBars);
  });

  it('expandSection clamps at 64 bars and refuses shrink below MIN_SECTION', () => {
    const long: Section[] = [
      { name: 'intro', startBar: 0, lengthBars: 32 },
      { name: 'drop', startBar: 32, lengthBars: 32 },
    ];
    const clamped = expandSection(long, 0, 8);
    expect(clamped).not.toBeNull();
    expect(clamped!.bars).toBe(64);
    const tiny = sampleSections();
    expect(expandSection(tiny, 3, -8)).toBeNull();
  });

  it('StructureEngine honors sectionsOverride lengths on next plan', async () => {
    const base = await structureEngine.plan({
      seed: 7,
      bpm: DEFAULT_BPM,
      bars: 32,
      energy: 0.7,
      breakDensity: 0.4,
    });
    const expanded = expandSection(base.sections, 0, 8);
    expect(expanded).not.toBeNull();
    const overridden = await structureEngine.plan({
      seed: 7,
      bpm: DEFAULT_BPM,
      bars: expanded!.bars,
      energy: 0.7,
      breakDensity: 0.4,
      sectionsOverride: expanded!.sections,
    });
    expect(overridden.sections[0]!.lengthBars).toBe(expanded!.sections[0]!.lengthBars);
    expect(overridden.bars).toBe(expanded!.bars);
  });

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

  it('P0-1: expanding one section leaves every other section\'s drum+bass hits byte-identical (RNG keyed per section)', async () => {
    const seed = 12345;
    const base = sampleSections(); // intro8, build8, drop8, break4, outro4
    const before = await structureEngine.plan({
      seed,
      bpm: DEFAULT_BPM,
      bars: totalBarsOf(base),
      energy: 0.7,
      breakDensity: 0.4,
      sectionsOverride: base,
    });
    const expanded = expandSection(base, 0, 8); // grow intro only
    expect(expanded).not.toBeNull();
    const after = await structureEngine.plan({
      seed,
      bpm: DEFAULT_BPM,
      bars: expanded!.bars,
      energy: 0.7,
      breakDensity: 0.4,
      sectionsOverride: expanded!.sections,
    });

    // Song identity must not shift just because a section's length changed.
    expect(after.keyRoot).toBe(before.keyRoot);
    expect(after.patternFamily).toBe(before.patternFamily);
    expect(after.bassRole.character).toBe(before.bassRole.character);

    // Untouched sections (build/drop/break/outro, indices 1-4) must be
    // byte-identical content, not just same seed/lengthBars.
    for (let i = 1; i < base.length; i++) {
      expect(after.sections[i]!.name).toBe(before.sections[i]!.name);
      expect(after.sections[i]!.lengthBars).toBe(before.sections[i]!.lengthBars);
      expect(
        sectionContent(after, after.sections[i]!),
        `GAP: section ${i} (${before.sections[i]!.name}) hits changed after expanding an earlier section`,
      ).toEqual(sectionContent(before, before.sections[i]!));
    }

    // The edited section (intro) actually grew — proves this isn't a vacuous diff.
    expect(after.sections[0]!.lengthBars).toBe(16);
    expect(after.sections[0]!.lengthBars).not.toBe(before.sections[0]!.lengthBars);
  });
});

describe('structure expand → next generate persist (product wiring)', () => {
  const st = () => useStudioStore.getState();
  const hasExpandAt = () => typeof st().expandSectionAt === 'function';
  const hasSetLengthAt = () => typeof st().setSectionLengthAt === 'function';
  const hasStoreActions = () => hasExpandAt() && hasSetLengthAt();

  const timelineWiresStore =
    /setSectionLengthAt/.test(timelineSrc) &&
    /expandSectionAt/.test(timelineSrc) &&
    /onPointerDown/.test(timelineSrc);

  const generatePassesOverride = /sectionsOverride:\s*live\.editedSections/.test(storeSrc);

  beforeEach(() => {
    useStudioStore.setState({
      editedSections: null,
      bars: 32,
      result: {
        jobId: 'struct_expand',
        seed: 1,
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
          sections: sampleSections(),
          drumRole: {} as any,
          drums: [],
          bassRole: {} as any,
          energyCurve: [],
          keyRoot: 'A',
          seed: 1,
        },
        manifest: {},
      } as any,
      paramsDirty: false,
      busy: false,
    });
  });

  it('SectionTimeline wires drag edge + Expand to store setSectionLengthAt / expandSectionAt', () => {
    expect(
      timelineWiresStore,
      'GAP: SectionTimeline must call setSectionLengthAt on drag and expandSectionAt on Expand',
    ).toBe(true);
    expect(
      /HELP\.sectionTimeline/.test(timelineSrc) && /HelpTip/.test(timelineSrc),
      'GAP: new timeline controls must use HelpTip + HELP.sectionTimeline (no invented tip strings)',
    ).toBe(true);
    expect(
      /×2/.test(timelineSrc) && /expandSectionAt\(index, s\.lengthBars\)/.test(timelineSrc),
      'GAP: optional ×2 drop must call expandSectionAt with current length (structure bars, not WAV loop)',
    ).toBe(true);
    expect(
      /Arrangement ~\$\{approx\} on next Generate/.test(storeSrc),
      'GAP: store must toast Arrangement ~m:ss on next Generate (pending bars, not old mix length)',
    ).toBe(true);
    expect(
      /barsToDurationSec/.test(storeSrc) && /formatDurationMmSs/.test(storeSrc),
      'GAP: expand toast must compute ~m:ss from pending bars via barsToDurationSec',
    ).toBe(true);
  });

  it('generate job source includes sectionsOverride from editedSections', () => {
    expect(
      generatePassesOverride,
      'GAP: generate must pass sectionsOverride: live.editedSections into backend.render',
    ).toBe(true);
  });

  it('GAP red: expandSectionAt/setSectionLengthAt must persist into editedSections (no no-op stubs)', () => {
    // Timeline + generate sectionsOverride are wired; store actions are currently empty stubs.
    expect(hasStoreActions()).toBe(true);
    st().expandSectionAt(0, 8);
    expect(
      st().editedSections,
      [
        'GAP: expandSectionAt/setSectionLengthAt are no-op stubs in useStudioStore.',
        'Implement via structureEdit.expandSection / setSectionLengthBars → set editedSections + bars + paramsDirty',
        'so SectionTimeline drag persists into next generate (sectionsOverride).',
      ].join(' '),
    ).not.toBeNull();
    expect(st().editedSections![0]!.lengthBars).toBeGreaterThan(8);
    expect(st().paramsDirty).toBe(true);

    st().setSectionLengthAt(2, 16);
    expect(st().editedSections![2]!.lengthBars).toBe(16);
    expect(st().bars % 4).toBe(0);
  });

  it('expand must not patch result.structure.bars (player stays on rendered WAV)', () => {
    const beforeBars = st().result!.structure.bars;
    st().expandSectionAt(0, 8);
    expect(st().editedSections).not.toBeNull();
    expect(st().bars).toBeGreaterThan(beforeBars);
    expect(
      st().result!.structure.bars,
      'GAP: expand patched result.structure.bars — clocks would lie vs mix duration',
    ).toBe(beforeBars);
    expect(/editedSections \?\? result\?\.structure\?\.sections/.test(timelineSrc)).toBe(true);
  });
});
