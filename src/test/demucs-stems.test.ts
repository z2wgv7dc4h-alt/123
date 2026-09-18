/**
 * Real stems via Demucs: store action replaces mirrored ACE lanes with
 * drums/bass/other and marks the take real (no render). Bridge payload
 * contract lives in sidecar/test_ace_bridge_payload.py.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RenderResult, StemFile } from '../core/types';
import { useStudioStore } from '../ui/hooks/useStudioStore';
import { aceStepBackend } from '../core/backends';
import { previewPlayer } from '../core/audio';

vi.mock('../core/audio', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../core/audio')>();
  return {
    ...orig,
    loadPreviewFromMixer: vi.fn(async () => {}),
    acquireRenderWakeLock: vi.fn(async () => {}),
    releaseRenderWakeLock: vi.fn(async () => {}),
    startRenderHeartbeat: vi.fn(() => ({ stop: () => {} })),
  };
});

const mixBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });

function mirrored(id: RenderResult['stems'][number]['id']): RenderResult['stems'][number] {
  return {
    id,
    url: `blob:mirror-${id}`,
    blob: mixBlob,
    channels: 2,
    sampleRateHz: 48000,
    bitDepth: 16,
    durationSec: 8,
  };
}

const fakeStudioResult = {
  jobId: 'take1',
  seed: 5,
  bpmMeasured: 140,
  backendId: 'ace-step-1.5',
  stems: ['kick', 'snare', 'hats', 'bass', 'drums', 'mix'].map((id) =>
    mirrored(id as RenderResult['stems'][number]['id']),
  ),
  warnings: ['ACE payload line', 'Stem lanes may share mix until ACE lego/extract is wired'],
  structure: { sections: [{ name: 'drop', startBar: 0, lengthBars: 8 }], bars: 8 },
  manifest: { gpuUsed: true, prompt: { energy: 0.7 }, structureVersion: 'hard-grid-v0' },
} as unknown as RenderResult;

const realStems: StemFile[] = (['drums', 'bass', 'other'] as const).map((id, i) => ({
  id,
  url: `blob:real-${id}`,
  blob: new Blob([new Uint8Array([10 + i])], { type: 'audio/wav' }),
  channels: 2,
  sampleRateHz: 44100,
  bitDepth: 16,
  durationSec: 8,
}));

describe('store separateStems', () => {
  let splitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    splitSpy = vi.spyOn(aceStepBackend, 'separateStems').mockResolvedValue(realStems);
    vi.spyOn(previewPlayer, 'loadMix').mockResolvedValue();
    useStudioStore.setState({
      result: fakeStudioResult,
      stemsBusy: false,
      busy: false,
      warnings: ['ACE payload line', 'Stem lanes may share mix until ACE lego/extract is wired'],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('replaces mirrored stems with real drums/bass/other and marks them real', async () => {
    await useStudioStore.getState().separateStems();

    expect(splitSpy).toHaveBeenCalledTimes(1);
    const next = useStudioStore.getState().result!;
    expect(next.stemsReal).toBe(true);
    expect(next.stems.map((s) => s.id)).toEqual(['drums', 'bass', 'other', 'mix']);
    expect(next.stems.find((s) => s.id === 'drums')!.blob).toBe(realStems[0]!.blob);
    expect(useStudioStore.getState().stemsBusy).toBe(false);

    // Honesty: the mirror-mix warning is gone only after real stems land.
    expect(useStudioStore.getState().warnings.join('\n')).not.toMatch(/share mix/i);
    expect(next.warnings.join('\n')).not.toMatch(/share mix/i);
  });

  it('never calls Demucs on a Sketch take', async () => {
    useStudioStore.setState({ result: { ...fakeStudioResult, backendId: 'offline-stub' } as RenderResult });
    await useStudioStore.getState().separateStems();
    expect(splitSpy).not.toHaveBeenCalled();
    expect(useStudioStore.getState().result?.stemsReal).toBeUndefined();
  });

  it('surfaces the Demucs install error and clears busy', async () => {
    splitSpy.mockRejectedValueOnce(new Error('Demucs is not installed on the bridge PC — run: pip install demucs'));
    await useStudioStore.getState().separateStems();
    expect(useStudioStore.getState().stemsBusy).toBe(false);
    expect(useStudioStore.getState().error).toMatch(/pip install demucs/);
  });
});
