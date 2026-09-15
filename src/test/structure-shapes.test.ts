import { describe, expect, it } from 'vitest';
import { planSections, structureEngine } from '../core/structure';
import { DEFAULT_BPM } from '../core/types';
import { expandSection, repeatSection, totalBarsOf } from '../ui/lib/structureEdit';
import { mulberry32 } from '../core/structure/rng';

describe('planSections song shapes', () => {
  it('long-intro gives a longer intro than classic', () => {
    const classic = planSections(48, mulberry32(42), 'classic');
    const longIntro = planSections(48, mulberry32(42), 'long-intro');
    const cIntro = classic.find((s) => s.name === 'intro')!.lengthBars;
    const lIntro = longIntro.find((s) => s.name === 'intro')!.lengthBars;
    expect(lIntro).toBeGreaterThan(cIntro);
    expect(lIntro).toBeGreaterThanOrEqual(8);
  });

  it('breakdown includes a breakdown section and second drop', () => {
    const secs = planSections(48, mulberry32(7), 'breakdown');
    expect(secs.map((s) => s.name)).toContain('breakdown');
    expect(secs.filter((s) => s.name === 'drop').length).toBeGreaterThanOrEqual(2);
  });

  it('double-drop has two drops', () => {
    const secs = planSections(64, mulberry32(9), 'double-drop');
    expect(secs.filter((s) => s.name === 'drop').length).toBe(2);
    expect(totalBarsOf(secs)).toBeGreaterThanOrEqual(60);
  });

  it('dubstep half-time snare on drop (engine plan)', async () => {
    const map = await structureEngine.plan({
      seed: 99,
      bpm: DEFAULT_BPM,
      bars: 48,
      energy: 0.8,
      breakDensity: 0.4,
      songShape: 'dubstep',
    });
    expect(map.bpm).toBe(174);
    const drop = map.sections.find((s) => s.name === 'drop')!;
    const snare = map.drums.find((d) => d.role === 'snare')!;
    const inDrop = snare.hits.filter(
      (h) => h.bar >= drop.startBar && h.bar < drop.startBar + drop.lengthBars,
    );
    const on2 = inDrop.filter((h) => Math.abs(h.beat - 2) < 0.01).length;
    const on1 = inDrop.filter((h) => Math.abs(h.beat - 1) < 0.01).length;
    expect(on2).toBeGreaterThan(0);
    expect(on2).toBeGreaterThanOrEqual(on1);
  });
});

describe('structureEdit helpers', () => {
  const base = [
    { name: 'intro' as const, startBar: 0, lengthBars: 8 },
    { name: 'drop' as const, startBar: 8, lengthBars: 16 },
    { name: 'outro' as const, startBar: 24, lengthBars: 8 },
  ];

  it('expandSection grows drop and total bars', () => {
    const out = expandSection(base, 1, 8);
    expect(out).not.toBeNull();
    expect(out!.sections[1]!.lengthBars).toBe(24);
    expect(out!.bars).toBe(40);
    expect(out!.sections[2]!.startBar).toBe(32);
  });

  it('x2 drop doubles lengthBars', () => {
    const dropLen = base[1]!.lengthBars;
    const out = expandSection(base, 1, dropLen);
    expect(out!.sections[1]!.lengthBars).toBe(dropLen * 2);
  });

  it('repeatSection duplicates after itself', () => {
    const out = repeatSection(base, 1);
    expect(out).not.toBeNull();
    expect(out!.sections.filter((s) => s.name === 'drop').length).toBe(2);
  });
});
