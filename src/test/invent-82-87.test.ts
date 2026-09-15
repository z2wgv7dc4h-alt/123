import { beforeEach, describe, expect, it } from 'vitest';
import { HELP } from '../ui/lib/helpCopy';
import { buildSketchNotes } from '../core/export/sketchNotes';
import { listChangedParamLabels } from '../ui/lib/paramsChanged';
import {
  shouldShowExportDawTip,
  markExportDawTipSeen,
  __resetExportDawTipForTests,
  EXPORT_DAW_TIP_KEY,
} from '../ui/lib/exportDawTip';
import { useStudioStore } from '../ui/hooks/useStudioStore';
import { STEM_DIGIT_CODES } from '../ui/hooks/useTransportHotkeys';
import { buildZip, blobToUint8 } from '../core/export';

describe('HELP invent 82–87', () => {
  it('tips ≤160 What/When/Happens', () => {
    for (const k of [
      'waveformZoom',
      'paramsWhatChanged',
      'stemLabelSolo',
      'sketchNotes',
      'exportDawTip',
      'sectionJumpLoopChip',
    ] as const) {
      expect(HELP[k]).toMatch(/What:/);
      expect(HELP[k]).toMatch(/When:/);
      expect(HELP[k]).toMatch(/What happens:/);
      expect(HELP[k].length).toBeLessThanOrEqual(160);
    }
  });
});

describe('Brainstormer #85 sketch_notes.txt', () => {
  it('builds honest notes without artist names', () => {
    const notes = buildSketchNotes({
      seed: 17400,
      bpm: 174,
      bars: 32,
      energy: 0.7,
      darkness: 0.4,
      chaos: 0.2,
      bitDepth: 16,
      mixAsHeard: true,
      promptText: 'deep bass half-time',
    });
    expect(notes).toMatch(/seed: 17400/);
    expect(notes).toMatch(/~174/);
    expect(notes).toMatch(/mix_as_heard: yes/);
    expect(notes).toMatch(/browser-sketch/);
    expect(notes).not.toMatch(/Pendulum|artist clone/i);
  });

  it('ZIP entry name is sketch_notes.txt', async () => {
    const data = new TextEncoder().encode(
      buildSketchNotes({
        seed: 1,
        bpm: 174,
        bars: 16,
        energy: 0.5,
        darkness: 0.5,
        chaos: 0.5,
        bitDepth: 24,
        mixAsHeard: false,
      }),
    );
    const zip = buildZip([{ name: 'sketch_notes.txt', data }]);
    const bytes = await blobToUint8(zip);
    const asText = new TextDecoder().decode(bytes);
    expect(asText).toContain('sketch_notes.txt');
  });
});

describe('Brainstormer #83 What changed labels', () => {
  it('lists changed knobs only', () => {
    const fp = {
      seed: 1,
      bpm: 174,
      bars: 32,
      energy: 0.5,
      darkness: 0.5,
      chaos: 0.5,
      promptText: 'a',
      vibeIntensity: 0.7,
    };
    expect(listChangedParamLabels(fp, { ...fp, energy: 0.9 })).toEqual(['Energy']);
    expect(listChangedParamLabels(fp, { ...fp, darkness: 0.1, chaos: 0.9 })).toEqual([
      'Mood',
      'Chaos',
    ]);
    expect(HELP.paramsWhatChanged).toMatch(/never pulses Generate/i);
  });
});

describe('Brainstormer #86 export DAW tip once-flag', () => {
  beforeEach(() => {
    __resetExportDawTipForTests();
  });

  it('shows once then marks seen', () => {
    expect(shouldShowExportDawTip()).toBe(true);
    markExportDawTipSeen();
    expect(shouldShowExportDawTip()).toBe(false);
    expect(EXPORT_DAW_TIP_KEY).toBe('dnb-export-daw-tip-v1');
  });
});

describe('Brainstormer #84 stem digits + exclusive solo', () => {
  beforeEach(() => {
    useStudioStore.setState({
      mixer: {
        mute: { kick: false, snare: false, hats: false, bass: false, drums: false, mix: false },
        solo: { kick: false, snare: false, hats: false, bass: false, drums: false, mix: false },
        gainDb: { kick: 0, snare: 0, hats: 0, bass: 0, drums: 0, mix: 0 },
      },
      mixerDirty: false,
      result: { jobId: 'x' } as any,
    });
  });

  it('hotkey solo stems 1–4 are kick/snare/hats/bass (HelpPanel Keys SoT)', () => {
    expect(STEM_DIGIT_CODES).toEqual({
      Digit1: 'kick',
      Digit2: 'snare',
      Digit3: 'hats',
      Digit4: 'bass',
    });
    expect(HELP.stemLabelSolo).toMatch(/1–4|1-4/);
    expect(HELP.stemSoloHotkeys).toMatch(/1–4|1-4/);
  });

  it('exclusiveSolo solos only that stem', () => {
    useStudioStore.getState().exclusiveSolo('snare');
    const solo = useStudioStore.getState().mixer.solo;
    expect(solo.snare).toBe(true);
    expect(solo.kick).toBe(false);
    expect(solo.hats).toBe(false);
    expect(solo.bass).toBe(false);
    // toggle off when already exclusive
    useStudioStore.getState().exclusiveSolo('snare');
    expect(useStudioStore.getState().mixer.solo.snare).toBe(false);
  });
});

describe('Brainstormer #82 waveform zoom store', () => {
  it('setWaveformZoom toggles flag', () => {
    useStudioStore.setState({ waveformZoom: false });
    useStudioStore.getState().setWaveformZoom(true);
    expect(useStudioStore.getState().waveformZoom).toBe(true);
    useStudioStore.getState().setWaveformZoom(false);
    expect(useStudioStore.getState().waveformZoom).toBe(false);
  });
});
