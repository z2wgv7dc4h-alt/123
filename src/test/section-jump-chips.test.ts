/**
 * Test SectionJumpChips: readable layout, all sections, numbered duplicates.
 */
import { describe, expect, it } from 'vitest';
import componentSrc from '../ui/components/SectionJumpChips.tsx?raw';

describe('SectionJumpChips', () => {
  it('source has no MAX_CHIPS constant', () => {
    expect(componentSrc).not.toMatch(/const MAX_CHIPS/);
    expect(componentSrc).not.toMatch(/MAX_CHIPS/);
  });

  it('source no longer builds seg-${} class for chips', () => {
    expect(componentSrc).not.toMatch(/seg-\$\{/);
    expect(componentSrc).not.toMatch(/className=.*seg-/);
  });

  it('exports jumpChipLabels helper for label generation', () => {
    expect(componentSrc).toMatch(/export function jumpChipLabels/);
  });

  it('jumpChipLabels generates correct labels with duplicate numbering', async () => {
    const { jumpChipLabels } = await import('../ui/components/SectionJumpChips');
    const sections = [
      { name: 'intro' },
      { name: 'build' },
      { name: 'drop' },
      { name: 'breakdown' },
      { name: 'build' },
      { name: 'drop' },
      { name: 'outro' },
    ];
    const labels = jumpChipLabels(sections);
    expect(labels).toEqual(['Intro', 'Build 1', 'Drop 1', 'Breakdown', 'Build 2', 'Drop 2', 'Outro']);
  });

  it('jumpChipLabels leaves single-occurrence names plain', async () => {
    const { jumpChipLabels } = await import('../ui/components/SectionJumpChips');
    const sections = [{ name: 'intro' }, { name: 'drop' }, { name: 'outro' }];
    const labels = jumpChipLabels(sections);
    expect(labels).toEqual(['Intro', 'Drop', 'Outro']);
  });

  it('exactly one HelpTip in component', () => {
    const helpTipMatches = componentSrc.match(/<HelpTip/g) || [];
    expect(helpTipMatches.length).toBe(1);
  });

  it('HelpTip is for sectionJump, not sectionLoop or hotkey', () => {
    expect(componentSrc).toMatch(/HELP\.sectionJump/);
    expect(componentSrc).not.toMatch(/HELP\.sectionLoop/);
    expect(componentSrc).not.toMatch(/HELP\.sectionJumpLoopChip/);
    expect(componentSrc).not.toMatch(/HELP\.loopSectionHotkey/);
  });

  it('component still has Loop chip and onclick handler', () => {
    expect(componentSrc).toMatch(/section-jump-loop-chip/);
    expect(componentSrc).toMatch(/loopCurrentSection/);
  });

  it('maps over all sections, not sliced', () => {
    expect(componentSrc).toMatch(/sections\.map/);
    expect(componentSrc).not.toMatch(/sections\.slice/);
  });

  it('keeps onClick seek, onDoubleClick loop, titles, aria-labels', () => {
    expect(componentSrc).toMatch(/onClick=.*seekPreview/);
    expect(componentSrc).toMatch(/onDoubleClick/);
    expect(componentSrc).toMatch(/setLoopRegion/);
    expect(componentSrc).toMatch(/title=/);
    expect(componentSrc).toMatch(/aria-label=/);
  });
});
