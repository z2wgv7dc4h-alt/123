import { beforeEach, describe, expect, it } from 'vitest';
import { HELP } from '../ui/lib/helpCopy';
import { dropWashRatios, sectionLoopRatios } from '../ui/lib/barPosition';
import {
  shouldShowFirstExportCoach,
  dismissFirstExportCoach,
  __resetFirstExportCoachForTests,
} from '../ui/lib/firstExportCoach';
import {
  shouldShowFirstPlayCoach,
  dismissFirstPlayCoach,
  __resetFirstPlayCoachForTests,
} from '../ui/lib/firstPlayCoach';

describe('HELP invent 64–69', () => {
  it('tips ≤160 What/When/Happens', () => {
    for (const k of [
      'clearLoop',
      'dropWash',
      'hotkeysSheet',
      'firstExportCoach',
      'copySettings',
      'sectionAnnounce',
    ] as const) {
      expect(HELP[k]).toMatch(/What:/);
      expect(HELP[k]).toMatch(/When:/);
      expect(HELP[k]).toMatch(/What happens:/);
      expect(HELP[k].length).toBeLessThanOrEqual(160);
    }
  });
});

describe('Brainstormer #65 drop wash', () => {
  it('finds drop section ratios', () => {
    const sections = [
      { name: 'intro', startBar: 0, lengthBars: 8 },
      { name: 'drop', startBar: 16, lengthBars: 8 },
    ];
    expect(dropWashRatios(sections, 32)).toEqual({ start: 0.5, end: 0.75 });
    expect(dropWashRatios(sections.filter((s) => s.name !== 'drop'), 32)).toBeNull();
  });
});

describe('Brainstormer #64 clear loop helper reuse', () => {
  it('sectionLoopRatios still valid for clear-loop region math', () => {
    expect(sectionLoopRatios(0, 8, 32)?.start).toBe(0);
  });
});

describe('Brainstormer #67 first-export coach no stack', () => {
  beforeEach(() => {
    __resetFirstExportCoachForTests();
    __resetFirstPlayCoachForTests();
  });

  it('shows until dismissed; independent of play coach flags', () => {
    expect(shouldShowFirstExportCoach()).toBe(true);
    expect(shouldShowFirstPlayCoach()).toBe(true);
    dismissFirstPlayCoach();
    expect(shouldShowFirstExportCoach()).toBe(true);
    dismissFirstExportCoach();
    expect(shouldShowFirstExportCoach()).toBe(false);
  });
});
