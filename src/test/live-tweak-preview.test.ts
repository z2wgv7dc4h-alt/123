/**
 * P0 live tweaks: Tone.Player → Tone.Channel mid-play (not remux-on-Play).
 * Export-as-heard stays on renderRemixedWavBlob sum path.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('tone', () => {
  class FakeParam {
    value = 0;
    constructor(v = 0) {
      this.value = v;
    }
  }
  class Channel {
    mute = false;
    solo = false;
    volume: FakeParam;
    constructor(opts?: { volume?: number; mute?: boolean; solo?: boolean }) {
      this.volume = new FakeParam(opts?.volume ?? 0);
      this.mute = !!opts?.mute;
      this.solo = !!opts?.solo;
    }
    toDestination() {
      return this;
    }
    connect(_node: any) {
      return this;
    }
    dispose() {}
  }
  class Player {
    loaded = true;
    buffer = { duration: 2 };
    url = '';
    constructor(opts?: { url?: string; autostart?: boolean }) {
      this.url = opts?.url ?? '';
    }
    connect(_ch: unknown) {
      return this;
    }
    start() {
      return this;
    }
    stop() {
      return this;
    }
    dispose() {}
  }
  return {
    start: async () => undefined,
    now: () => 0,
    Player,
    Channel,
    Gain: class {
      constructor(v = 1) {}
      chain(...args: any[]) {}
      connect(...args: any[]) {}
      dispose() {}
    },
    Compressor: class {
      constructor(opts?: any) {}
      dispose() {}
    },
    Limiter: class {
      constructor(v: number) {}
      dispose() {}
    },
    Analyser: class {
      constructor(type: string, size: number) {}
      getValue() { return [new Float32Array(256)]; }
      dispose() {}
    },
    getContext: () => ({ sampleRate: 48000 }),
    getDestination: () => ({}),
  };
});

import { PreviewPlayer, previewPlayer, renderRemixedWavBlob } from '../core/audio';
import { offlineStubBackend } from '../core/backends';
import {
  DEFAULT_BIT_DEPTH,
  DEFAULT_BPM,
  DEFAULT_SAMPLE_RATE,
  type MixerState,
  type StemId,
} from '../core/types';
import {
  ELEMENTAL_STEM_IDS,
  computeMixerDirty,
  useStudioStore,
} from '../ui/hooks/useStudioStore';

function blankMixer(): MixerState {
  const mute = {} as Record<StemId, boolean>;
  const solo = {} as Record<StemId, boolean>;
  const gainDb = {} as Record<StemId, number>;
  for (const id of [...ELEMENTAL_STEM_IDS, 'drums', 'mix', 'other'] as StemId[]) {
    mute[id] = false;
    solo[id] = false;
    gainDb[id] = 0;
  }
  return { mute, solo, gainDb };
}

function installRafPolyfill() {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    (globalThis as unknown as { requestAnimationFrame: (cb: FrameRequestCallback) => number }).requestAnimationFrame =
      (cb) => setTimeout(() => cb(performance.now()), 0) as unknown as number;
  }
}

function installUrlPolyfill() {
  if (typeof URL.createObjectURL !== 'function') {
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => 'blob:mock';
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
  }
}

function installWavAudioContextMock() {
  class MockAudioBuffer {
    sampleRate: number;
    numberOfChannels: number;
    length: number;
    duration: number;
    private channels: Float32Array[];
    constructor(sr: number, ch: Float32Array[]) {
      this.sampleRate = sr;
      this.numberOfChannels = ch.length;
      this.length = ch[0]?.length ?? 0;
      this.duration = this.length / sr;
      this.channels = ch;
    }
    getChannelData(c: number): Float32Array {
      return this.channels[Math.min(c, this.channels.length - 1)]!;
    }
  }
  function decodePcmWav(ab: ArrayBuffer): MockAudioBuffer {
    const view = new DataView(ab);
    const numChannels = view.getUint16(22, true);
    const sampleRate = view.getUint32(24, true);
    const bitDepth = view.getUint16(34, true);
    let offset = 12;
    let dataOffset = 44;
    let dataSize = view.byteLength - 44;
    while (offset + 8 <= view.byteLength) {
      const id =
        String.fromCharCode(view.getUint8(offset)) +
        String.fromCharCode(view.getUint8(offset + 1)) +
        String.fromCharCode(view.getUint8(offset + 2)) +
        String.fromCharCode(view.getUint8(offset + 3));
      const size = view.getUint32(offset + 4, true);
      if (id === 'data') {
        dataOffset = offset + 8;
        dataSize = size;
        break;
      }
      offset += 8 + size;
    }
    const bytesPerSample = bitDepth / 8;
    const frameCount = Math.floor(dataSize / (numChannels * bytesPerSample));
    const channels: Float32Array[] = Array.from(
      { length: numChannels },
      () => new Float32Array(frameCount),
    );
    let o = dataOffset;
    for (let i = 0; i < frameCount; i++) {
      for (let c = 0; c < numChannels; c++) {
        const sample = bitDepth === 16 ? view.getInt16(o, true) / 0x8000 : 0;
        o += bytesPerSample;
        channels[c]![i] = sample;
      }
    }
    return new MockAudioBuffer(sampleRate, channels);
  }
  class MockAudioContext {
    state = 'running';
    destination = {};
    createBuffer(ch: number, len: number, sr: number) {
      return new MockAudioBuffer(
        sr,
        Array.from({ length: ch }, () => new Float32Array(len)),
      );
    }
    createBufferSource() {
      return { buffer: null, connect() {}, start() {}, stop() {}, onended: null };
    }
    decodeAudioData(ab: ArrayBuffer) {
      return Promise.resolve(decodePcmWav(ab));
    }
    resume() {
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
  }
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;
}

async function renderShort() {
  return offlineStubBackend.render({
    jobId: 'live_tweak',
    seed: 17400,
    bpm: DEFAULT_BPM,
    bpmTolerance: 2,
    durationBars: 8,
    sampleRateHz: DEFAULT_SAMPLE_RATE,
    bitDepth: DEFAULT_BIT_DEPTH,
    channels: 2,
    prompt: { descriptors: ['live'], energy: 0.75, darkness: 0.4, chaos: 0.2 },
    stemSchemaVersion: 'v0',
  });
}

describe('P0 Tone.Channel live mute/solo/gain', () => {
  beforeEach(() => {
    installRafPolyfill();
    installUrlPolyfill();
    installWavAudioContextMock();
    useStudioStore.setState({
      result: null,
      mixer: blankMixer(),
      mixerDirty: false,
      previewState: 'idle',
      error: null,
    } as never);
  });

  afterEach(async () => {
    await previewPlayer.dispose();
  });

  it('loadLiveFromStems arms Player→Channel lanes; applyLiveMixer mutes mid-graph', async () => {
    const result = await renderShort();
    const elementals = result.stems.filter((s) =>
      (ELEMENTAL_STEM_IDS as readonly string[]).includes(s.id),
    );
    expect(elementals.length).toBeGreaterThan(2);

    const p = new PreviewPlayer();
    await p.loadLiveFromStems(elementals, blankMixer());
    expect(p.hasLiveGraph()).toBe(true);
    expect(p.liveStemIds()).toContain('kick');
    expect(p.liveStemIds()).toContain('bass');

    const mixer = blankMixer();
    mixer.mute.kick = true;
    mixer.gainDb.bass = -6;
    mixer.solo.hats = true;
    p.applyLiveMixer(mixer);

    expect(p.getLiveChannelState('kick')?.mute).toBe(true);
    expect(p.getLiveChannelState('bass')?.volumeDb).toBe(-6);
    expect(p.getLiveChannelState('hats')?.solo).toBe(true);
    expect(p.liveStemIds().length).toBe(elementals.length);
    await p.dispose();
  }, 60_000);

  it('store toggleMute with live graph calls applyLiveMixer (not loadMix remux)', async () => {
    const result = await renderShort();
    const elementals = result.stems.filter((s) =>
      (ELEMENTAL_STEM_IDS as readonly string[]).includes(s.id),
    );
    await previewPlayer.loadLiveFromStems(elementals, blankMixer());
    expect(previewPlayer.hasLiveGraph()).toBe(true);

    const applySpy = vi.spyOn(previewPlayer, 'applyLiveMixer');
    const loadMixSpy = vi.spyOn(previewPlayer, 'loadMix');
    const loadLiveSpy = vi.spyOn(previewPlayer, 'loadLiveFromStems');
    const bakeSpy = vi.spyOn(previewPlayer, 'loadMixFromStems');

    useStudioStore.setState({
      result,
      previewState: 'playing',
      mixer: blankMixer(),
      mixerDirty: false,
    } as never);

    useStudioStore.getState().toggleMute('kick');
    await vi.waitFor(() => {
      expect(useStudioStore.getState().mixerDirty).toBe(true);
      expect(applySpy).toHaveBeenCalled();
    });

    expect(loadMixSpy).not.toHaveBeenCalled();
    expect(loadLiveSpy).not.toHaveBeenCalled();
    expect(bakeSpy).not.toHaveBeenCalled();
    expect(previewPlayer.getLiveChannelState('kick')?.mute).toBe(true);

    applySpy.mockRestore();
    loadMixSpy.mockRestore();
    loadLiveSpy.mockRestore();
    bakeSpy.mockRestore();
  }, 60_000);

  it('clean mixer still arms live graph on first Play (elementals present)', async () => {
    // CoS/Critic: arm Tone.Channel lanes even with clean mixer so first mute is mid-play.
    const result = await renderShort();
    const loadMixSpy = vi.spyOn(previewPlayer, 'loadMix');
    const loadLiveSpy = vi.spyOn(previewPlayer, 'loadLiveFromStems');

    useStudioStore.setState({
      result,
      previewState: 'ready',
      mixer: blankMixer(),
      mixerDirty: false,
    } as never);

    await useStudioStore.getState().play();

    expect(loadLiveSpy).toHaveBeenCalled();
    expect(loadMixSpy).not.toHaveBeenCalled();
    expect(computeMixerDirty(useStudioStore.getState().mixer)).toBe(false);
    expect(previewPlayer.hasLiveGraph()).toBe(true);

    loadMixSpy.mockRestore();
    loadLiveSpy.mockRestore();
  }, 60_000);

  it('setGainDb applies Channel volume without rebuild when live', async () => {
    const result = await renderShort();
    const elementals = result.stems.filter((s) =>
      (ELEMENTAL_STEM_IDS as readonly string[]).includes(s.id),
    );
    await previewPlayer.loadLiveFromStems(elementals, blankMixer());
    useStudioStore.setState({
      result,
      previewState: 'playing',
      mixer: blankMixer(),
      mixerDirty: true,
    } as never);

    const applySpy = vi.spyOn(previewPlayer, 'applyLiveMixer');
    useStudioStore.getState().setGainDb('snare', -12);
    await vi.waitFor(() => expect(applySpy).toHaveBeenCalled(), { timeout: 2000 });
    expect(previewPlayer.getLiveChannelState('snare')?.volumeDb).toBe(-12);
    applySpy.mockRestore();
  }, 60_000);

  it('export-as-heard still uses sum path (renderRemixedWavBlob), independent of live graph', async () => {
    const result = await renderShort();
    const elementals = result.stems.filter((s) =>
      (ELEMENTAL_STEM_IDS as readonly string[]).includes(s.id),
    );
    const noKick = elementals.filter((s) => s.id !== 'kick');
    const { blob } = await renderRemixedWavBlob(noKick, {}, DEFAULT_BIT_DEPTH);
    expect(blob.size).toBeGreaterThan(1000);
  }, 60_000);
});
