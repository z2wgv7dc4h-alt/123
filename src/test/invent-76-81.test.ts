import { beforeEach, describe, expect, it } from 'vitest';
import { HELP } from '../ui/lib/helpCopy';
import { sectionLoopRatios, barBeatFromProgress } from '../ui/lib/barPosition';
import { shouldIgnoreTransportHotkey } from '../ui/hooks/useTransportHotkeys';
import { useStudioStore } from '../ui/hooks/useStudioStore';
import { previewPlayer } from '../core/audio';

describe('HELP invent 76–81', () => {
  it('tips ≤160 What/When/Happens', () => {
    for (const k of [
      'loopEdges',
      'playAutofocus',
      'rehearPulse',
      'emptyWaveformCta',
      'postExportStrip',
      'loopSectionHotkey',
    ] as const) {
      expect(HELP[k]).toMatch(/What:/);
      expect(HELP[k]).toMatch(/When:/);
      expect(HELP[k]).toMatch(/What happens:/);
      expect(HELP[k].length).toBeLessThanOrEqual(160);
    }
  });
});

describe('Brainstormer #78 Play-adjacent only', () => {
  it('rehearPulse copy never mentions pulsing Generate', () => {
    expect(HELP.rehearPulse.toLowerCase()).toMatch(/play/);
    expect(HELP.rehearPulse).toMatch(/never pulses Generate|Generate never/i);
  });
});

describe('Brainstormer #81 L loop current section', () => {
  beforeEach(() => {
    previewPlayer.clearLoop();
    useStudioStore.setState({
      result: {
        jobId: 'j76',
        seed: 1,
        bpmMeasured: 174,
        stems: [],
        warnings: [],
        backendId: 'offline-stub',
        checkpointId: 'c',
        structure: {
          bars: 32,
          sections: [
            { name: 'intro', startBar: 0, lengthBars: 8 },
            { name: 'drop', startBar: 16, lengthBars: 8 },
          ],
        },
        manifest: {} as any,
      } as any,
      loopRegion: null,
      waveformZoom: false,
    });
  });

  it('loopCurrentSection uses sectionLoopRatios for playhead section', () => {
    previewPlayer.seek(16 / 32);
    useStudioStore.getState().loopCurrentSection();
    const loop = useStudioStore.getState().loopRegion;
    expect(loop).toEqual(sectionLoopRatios(16, 8, 32));
  });

  it('hotkey ignore still blocks inputs / open HelpTip', () => {
    const input = { tagName: 'INPUT', isContentEditable: false } as unknown as HTMLElement;
    expect(shouldIgnoreTransportHotkey(input)).toBe(true);
  });
});

describe('Brainstormer #76 loop edges API', () => {
  it('setLoopRegion seek:false keeps region without requiring seek', () => {
    useStudioStore.setState({ loopRegion: null });
    useStudioStore.getState().setLoopRegion(0.2, 0.5, { seek: false });
    expect(useStudioStore.getState().loopRegion).toEqual({ start: 0.2, end: 0.5 });
  });
});

describe('Brainstormer #81 bar helper still honest', () => {
  it('barBeatFromProgress at drop', () => {
    expect(barBeatFromProgress(0.5, 32).bar).toBe(16);
  });
});
