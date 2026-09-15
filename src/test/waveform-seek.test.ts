import { beforeEach, describe, expect, it } from 'vitest';
import { PreviewPlayer } from '../core/audio/PreviewPlayer';
import { useStudioStore, canPlayPreview } from '../ui/hooks/useStudioStore';
import { HELP } from '../ui/lib/helpCopy';
import {
  shouldShowFirstPlayCoach,
  dismissFirstPlayCoach,
  __resetFirstPlayCoachForTests,
} from '../ui/lib/firstPlayCoach';

describe('Brainstormer #40 PreviewPlayer seek/getProgress', () => {
  it('seek clamps ratio01 and getProgress reflects stopped playhead', () => {
    const p = new PreviewPlayer();
    expect(p.state).toBe('idle');
    p.seek(0.42);
    expect(p.getProgress()).toBeCloseTo(0.42, 5);
    p.seek(2);
    expect(p.getProgress()).toBe(1);
    p.seek(-0.5);
    expect(p.getProgress()).toBe(0);
  });

  it('seek does not flip idle→playing without a buffer', () => {
    const p = new PreviewPlayer();
    p.seek(0.3);
    expect(p.state).toBe('idle');
    expect(p.getProgress()).toBeCloseTo(0.3, 5);
  });
});

describe('Brainstormer #40 store seekPreview', () => {
  beforeEach(() => {
    useStudioStore.setState({
      result: {
        jobId: 'job_seek',
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
          sections: [
            { name: 'intro', startBar: 0, lengthBars: 8 },
            { name: 'drop', startBar: 16, lengthBars: 8 },
          ],
          drumRole: {} as any,
          drums: [],
          bassRole: {} as any,
          energyCurve: [],
          keyRoot: 'A',
          seed: 1,
        },
        manifest: {},
      } as any,
      previewState: 'ready',
      mixerUndoAvailable: false,
    });
  });

  it('seekPreview keeps canPlayPreview ready|stopped truth', () => {
    const { result } = useStudioStore.getState();
    expect(canPlayPreview(result, 'ready')).toBe(true);
    useStudioStore.getState().seekPreview(0.25);
    expect(useStudioStore.getState().previewState).toBe('ready');
    expect(canPlayPreview(useStudioStore.getState().result, useStudioStore.getState().previewState)).toBe(
      true,
    );
    useStudioStore.setState({ previewState: 'stopped' });
    useStudioStore.getState().seekPreview(0.6);
    expect(useStudioStore.getState().previewState).toBe('stopped');
    expect(canPlayPreview(useStudioStore.getState().result, 'stopped')).toBe(true);
  });
});

describe('Brainstormer #42 mixer undo', () => {
  beforeEach(() => {
    useStudioStore.setState({
      mixer: {
        mute: { kick: false, snare: false, hats: false, perc: false, bass: false, drums: false, mix: false, other: false },
        solo: { kick: false, snare: false, hats: false, perc: false, bass: false, drums: false, mix: false, other: false },
        gainDb: { kick: 0, snare: 0, hats: 0, perc: 0, bass: 0, drums: 0, mix: 0, other: 0 },
      },
      mixerDirty: false,
      mixerUndoAvailable: false,
      result: { jobId: 'j', stems: [], backendId: 'offline-stub' } as any,
      previewState: 'ready',
    });
  });

  it('undo restores prior mute and disables when empty', () => {
    useStudioStore.getState().toggleMute('kick');
    expect(useStudioStore.getState().mixer.mute.kick).toBe(true);
    expect(useStudioStore.getState().mixerUndoAvailable).toBe(true);
    useStudioStore.getState().undoMixer();
    expect(useStudioStore.getState().mixer.mute.kick).toBe(false);
    expect(useStudioStore.getState().mixerUndoAvailable).toBe(false);
  });
});

describe('HELP invent 40–45', () => {
  it('waveformSeek matches locked copy', () => {
    expect(HELP.waveformSeek).toBe(
      'What: Drag the wave to jump in the sketch. When: After Generate, while listening. What happens: Playhead moves; Drop is easy to find.',
    );
  });

  it('sectionJump / mixerUndo / firstPlayCoach / exportDone / seedCopy exist and teach', () => {
    for (const k of ['sectionJump', 'mixerUndo', 'firstPlayCoach', 'exportDone', 'seedCopy'] as const) {
      expect(HELP[k]).toMatch(/What:/);
      expect(HELP[k]).toMatch(/When:/);
      expect(HELP[k]).toMatch(/What happens:/);
      expect(HELP[k].length).toBeLessThanOrEqual(160);
    }
  });
});

describe('Brainstormer #43 firstPlayCoach ls', () => {
  beforeEach(() => {
    __resetFirstPlayCoachForTests();
  });

  it('shows until dismissed', () => {
    expect(shouldShowFirstPlayCoach()).toBe(true);
    dismissFirstPlayCoach();
    expect(shouldShowFirstPlayCoach()).toBe(false);
  });
});


describe('Brainstormer #44 export success copy', () => {
  it('HELP.exportDone teaches dry vs heard', () => {
    expect(HELP.exportDone).toMatch(/What:/);
    expect(HELP.exportDone).toMatch(/When:/);
    expect(HELP.exportDone).toMatch(/What happens:/);
    expect(HELP.exportDone.length).toBeLessThanOrEqual(160);
    expect(HELP.exportDone.toLowerCase()).toMatch(/dry|heard|zip/i);
  });
});
