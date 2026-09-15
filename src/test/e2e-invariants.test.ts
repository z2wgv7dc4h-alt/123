import { beforeEach, describe, expect, it } from 'vitest';
import { useStudioStore, computeMixerDirty, canPlayPreview } from '../ui/hooks/useStudioStore';
import { PreviewPlayer } from '../core/audio/PreviewPlayer';
import type { VibeProfile } from '../core/types';

const fakeVibe: VibeProfile = {
  fileName: 'mine.wav',
  estimatedBpm: 172,
  energy: 0.8,
  brightness: 0.4,
  darknessHint: 0.5,
  sectionHints: ['drop'],
  fingerprintHash: 'abc123deadbeef',
};

describe('browser E2E store invariants', () => {
  beforeEach(() => {
    useStudioStore.setState({
      moreOpen: false,
      vibe: fakeVibe,
      ownerConfirmed: true,
      vibeIntensity: 0.7,
      result: {
        jobId: 'job_test',
        seed: 1,
        bpmMeasured: 174,
        backendId: 'offline-stub',
        stems: [],
        warnings: [],
        waveformPeaks: [],
        structure: { bars: 32, sections: [], energyCurve: [] },
        manifest: { styleReference: { used: true, fileName: 'mine.wav' } },
      } as any,
      mixer: useStudioStore.getState().mixer,
      mixerDirty: false,
      paramsDirty: false,
      previewState: 'stopped',
      busy: false,
    });
  });

  it('Style Ref preserve: opening/closing More keeps vibe + ownerConfirmed', () => {
    useStudioStore.getState().setMoreOpen(true);
    expect(useStudioStore.getState().moreOpen).toBe(true);
    expect(useStudioStore.getState().vibe?.fileName).toBe('mine.wav');
    expect(useStudioStore.getState().ownerConfirmed).toBe(true);
    useStudioStore.getState().setMoreOpen(false);
    expect(useStudioStore.getState().vibe?.fingerprintHash).toBe('abc123deadbeef');
    expect(useStudioStore.getState().ownerConfirmed).toBe(true);
  });

  it('one layout: store has no mode / setMode', () => {
    const s = useStudioStore.getState() as unknown as Record<string, unknown>;
    expect('mode' in s).toBe(false);
    expect('setMode' in s).toBe(false);
  });

  it('mute does not close More or wipe style', () => {
    useStudioStore.setState({ moreOpen: true });
    useStudioStore.getState().toggleMute('kick');
    expect(useStudioStore.getState().moreOpen).toBe(true);
    expect(useStudioStore.getState().mixer.mute.kick).toBe(true);
    expect(useStudioStore.getState().mixerDirty).toBe(true);
    expect(computeMixerDirty(useStudioStore.getState().mixer)).toBe(true);
    expect(useStudioStore.getState().vibe).not.toBeNull();
  });

  it('canPlay only ready|stopped (never idle/loading/playing)', () => {
    const result = useStudioStore.getState().result;
    expect(canPlayPreview(result, 'ready')).toBe(true);
    expect(canPlayPreview(result, 'stopped')).toBe(true);
    expect(canPlayPreview(result, 'idle')).toBe(false);
    expect(canPlayPreview(result, 'loading')).toBe(false);
    expect(canPlayPreview(result, 'playing')).toBe(false);
    expect(canPlayPreview(null, 'ready')).toBe(false);
  });

  it('paramsDirty exists on StudioState and is boolean', () => {
    const s = useStudioStore.getState();
    expect(typeof s.paramsDirty).toBe('boolean');
    // fingerprint null → setEnergy may not flip until fingerprint exists; force fingerprint
    useStudioStore.setState({
      lastRenderFingerprint: {
        seed: 1,
        bpm: 174,
        bars: 32,
        energy: 0.75,
        darkness: 0.45,
        chaos: 0.25,
        promptText: s.promptText,
        vibeIntensity: 0.7,
      },
    });
    useStudioStore.getState().setEnergy(0.99);
    expect(useStudioStore.getState().paramsDirty).toBe(true);
  });
});

describe('PreviewPlayer idle no-op', () => {
  it('play() with idle and no buffer does not throw and stays idle', async () => {
    const p = new PreviewPlayer();
    expect(p.state).toBe('idle');
    await p.play();
    expect(p.state).toBe('idle');
  });
});

describe('Style Ref undo + replace keep', () => {
  it('undoVibeKnobs restores store-backed snapshot', () => {
    useStudioStore.setState({
      energy: 0.9,
      darkness: 0.1,
      chaos: 0.2,
      bars: 48,
      bpm: 174,
      vibeKnobUndo: { energy: 0.5, darkness: 0.5, chaos: 0.5, bars: 32, bpm: 174 },
      vibe: fakeVibe,
    });
    useStudioStore.getState().undoVibeKnobs();
    const s = useStudioStore.getState();
    expect(s.energy).toBe(0.5);
    expect(s.darkness).toBe(0.5);
    expect(s.vibeKnobUndo).toBeNull();
    expect(s.vibe?.fileName).toBe('mine.wav');
  });
});
