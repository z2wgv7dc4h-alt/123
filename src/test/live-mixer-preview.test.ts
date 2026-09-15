/**
 * P0: live gain/mute/solo must affect the SAME preview path Play hears.
 *
 * Product:
 * - Dirty mixer → loadLiveFromStems + applyLiveMixer (Tone.Channel mid-play)
 * - Fallback bake → loadMixFromStems (native sum+glue) when no elementals
 * - Export → renderRemixedWavBlob (same mute/gain selection via audibleStemIds)
 *
 * Soft-pass forbidden. Tone.Channel needs real AudioParam — Node vitest proves
 * store wiring via spies + native fallback buffer ≡ Play / as-heard DSP.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { offlineStubBackend } from '../core/backends';
import {
  PreviewPlayer,
  previewPlayer,
  audibleStemIds,
  renderRemixedWavBlob,
} from '../core/audio';
import {
  DEFAULT_BIT_DEPTH,
  DEFAULT_BPM,
  DEFAULT_SAMPLE_RATE,
  type RenderResult,
  type StemId,
} from '../core/types';
import {
  ELEMENTAL_STEM_IDS,
  resolveRemixStemIds,
  useStudioStore,
} from '../ui/hooks/useStudioStore';

const REMIX_STEM_IDS = [...ELEMENTAL_STEM_IDS, 'drums'] as const;
const STEM_IDS: StemId[] = [...REMIX_STEM_IDS, 'mix'];
type RemixStemId = (typeof REMIX_STEM_IDS)[number];

function bufferEnergy(buf: {
  numberOfChannels: number;
  length: number;
  getChannelData: (c: number) => Float32Array;
}): number {
  let e = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < ch.length; i++) e += Math.abs(ch[i]!);
  }
  return e;
}

function maxAbsDiff(
  a: { numberOfChannels: number; length: number; getChannelData: (c: number) => Float32Array },
  b: { numberOfChannels: number; length: number; getChannelData: (c: number) => Float32Array },
): number {
  const len = Math.min(a.length, b.length);
  const chN = Math.min(a.numberOfChannels, b.numberOfChannels);
  let max = 0;
  for (let c = 0; c < chN; c++) {
    const ca = a.getChannelData(c);
    const cb = b.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const d = Math.abs(ca[i]! - cb[i]!);
      if (d > max) max = d;
    }
  }
  return max;
}

function installWebAudioMock() {
  class MockAudioBuffer {
    sampleRate: number;
    numberOfChannels: number;
    length: number;
    private channels: Float32Array[];
    constructor(sr: number, ch: Float32Array[]) {
      this.sampleRate = sr;
      this.numberOfChannels = ch.length;
      this.length = ch[0]?.length ?? 0;
      this.channels = ch;
    }
    get duration(): number {
      return this.sampleRate > 0 ? this.length / this.sampleRate : 0;
    }
    getChannelData(c: number): Float32Array {
      return this.channels[Math.min(c, this.channels.length - 1)]!;
    }
  }

  function decodePcmWav(ab: ArrayBuffer): MockAudioBuffer {
    const view = new DataView(ab);
    if (view.byteLength < 44) throw new Error('WAV too short');
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
    const channels: Float32Array[] = Array.from({ length: numChannels }, () => new Float32Array(frameCount));
    let o = dataOffset;
    for (let i = 0; i < frameCount; i++) {
      for (let c = 0; c < numChannels; c++) {
        let sample = 0;
        if (bitDepth === 16) {
          sample = view.getInt16(o, true) / 0x8000;
          o += 2;
        } else if (bitDepth === 24) {
          const b0 = view.getUint8(o);
          const b1 = view.getUint8(o + 1);
          const b2 = view.getUint8(o + 2);
          let v = b0 | (b1 << 8) | (b2 << 16);
          if (v & 0x800000) v |= ~0xffffff;
          sample = v / 0x800000;
          o += 3;
        } else {
          throw new Error(`unsupported bit depth ${bitDepth}`);
        }
        channels[c]![i] = sample;
      }
    }
    return new MockAudioBuffer(sampleRate, channels);
  }

  class MockAudioContext {
    state: AudioContextState = 'running';
    currentTime = 0;
    destination = {} as AudioDestinationNode;
    decodeAudioData(ab: ArrayBuffer): Promise<MockAudioBuffer> {
      return Promise.resolve(decodePcmWav(ab));
    }
    createBuffer(numberOfChannels: number, length: number, sampleRate: number): MockAudioBuffer {
      const channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
      return new MockAudioBuffer(sampleRate, channels);
    }
    createBufferSource(): AudioBufferSourceNode {
      const node = {
        buffer: null as AudioBuffer | null,
        onended: null as (() => void) | null,
        connect: () => node,
        disconnect: () => {},
        start: () => {},
        stop: () => {},
      };
      return node as unknown as AudioBufferSourceNode;
    }
    resume(): Promise<void> {
      this.state = 'running';
      return Promise.resolve();
    }
    close(): Promise<void> {
      this.state = 'closed';
      return Promise.resolve();
    }
  }

  (globalThis as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;
}

function installUrlPolyfill() {
  if (typeof URL.createObjectURL !== 'function') {
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => 'node://blob';
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
  }
}

async function renderStub(): Promise<RenderResult> {
  return offlineStubBackend.render({
    jobId: 'live_mixer_preview',
    seed: 17401,
    bpm: DEFAULT_BPM,
    bpmTolerance: 2,
    durationBars: 8,
    sampleRateHz: DEFAULT_SAMPLE_RATE,
    bitDepth: DEFAULT_BIT_DEPTH,
    channels: 2,
    prompt: { descriptors: ['live mixer path'], energy: 0.7, darkness: 0.4, chaos: 0.2 },
    stemSchemaVersion: 'v0',
  });
}

function emptyMixerState() {
  return {
    mute: {
      kick: false,
      snare: false,
      hats: false,
      perc: false,
      bass: false,
      drums: false,
      mix: false,
      other: false,
    },
    solo: {
      kick: false,
      snare: false,
      hats: false,
      perc: false,
      bass: false,
      drums: false,
      mix: false,
      other: false,
    },
    gainDb: {
      kick: 0,
      snare: 0,
      hats: 0,
      perc: 0,
      bass: 0,
      drums: 0,
      mix: 0,
      other: 0,
    },
  };
}

/** Peek private nativeBuffer without exporting more surface (fallback Play path). */
function peekNativeBuffer(p: PreviewPlayer): AudioBuffer | null {
  return (p as unknown as { nativeBuffer: AudioBuffer | null }).nativeBuffer;
}

beforeAll(() => {
  installUrlPolyfill();
  installWebAudioMock();
});

describe('audibleStemIds ↔ remix/export selection (shared with Play/export)', () => {
  it('mute kick drops kick from audible set; solo hats keeps only hats', () => {
    const muted = audibleStemIds({ kick: true }, {}, STEM_IDS);
    expect(muted).not.toContain('kick');
    expect(resolveRemixStemIds(muted)).not.toContain('kick');

    const soloed = audibleStemIds({}, { hats: true }, STEM_IDS);
    expect(soloed).toEqual(['hats']);
    expect(resolveRemixStemIds(soloed)).toEqual(['hats']);
  });

  it('renderRemixedWavBlob mute-kick differs from full elemental remix (as-heard DSP)', async () => {
    const result = await renderStub();
    const muteIds = resolveRemixStemIds(audibleStemIds({ kick: true }, {}, STEM_IDS));
    const fullIds = resolveRemixStemIds(audibleStemIds({}, {}, STEM_IDS));
    const mutedStems = result.stems.filter((s) => muteIds.includes(s.id as RemixStemId));
    const fullStems = result.stems.filter((s) => fullIds.includes(s.id as RemixStemId));
    const { blob: muted } = await renderRemixedWavBlob(mutedStems, {}, DEFAULT_BIT_DEPTH);
    const { blob: full } = await renderRemixedWavBlob(fullStems, {}, DEFAULT_BIT_DEPTH);
    expect(muted.size).toBeGreaterThan(1000);
    expect(full.size).toBeGreaterThan(1000);
    const a = new Uint8Array(await muted.arrayBuffer());
    const b = new Uint8Array(await full.arrayBuffer());
    let differ = a.length !== b.length;
    if (!differ) {
      for (let i = 44; i < Math.min(a.length, b.length); i++) {
        if (a[i] !== b[i]) {
          differ = true;
          break;
        }
      }
    }
    expect(differ).toBe(true);
  }, 60_000);
});

describe('fallback loadMixFromStems ≡ Play buffer ≡ renderRemixedWavBlob', () => {
  afterEach(async () => {
    await previewPlayer.dispose();
  });

  it('mute-kick changes native Play buffer energy vs full remix', async () => {
    const result = await renderStub();
    const fullIds = resolveRemixStemIds(audibleStemIds({}, {}, STEM_IDS));
    const mutedIds = resolveRemixStemIds(audibleStemIds({ kick: true }, {}, STEM_IDS));
    const fullStems = result.stems.filter((s) => fullIds.includes(s.id as RemixStemId));
    const mutedStems = result.stems.filter((s) => mutedIds.includes(s.id as RemixStemId));

    const player = new PreviewPlayer();
    try {
      await player.loadMixFromStems(fullStems, {});
      const fullBuf = peekNativeBuffer(player);
      expect(fullBuf).not.toBeNull();
      expect(player.state).toBe('ready');
      const fullE = bufferEnergy(fullBuf!);

      await player.loadMixFromStems(mutedStems, {});
      const mutedBuf = peekNativeBuffer(player);
      expect(mutedBuf).not.toBeNull();
      expect(Math.abs(fullE - bufferEnergy(mutedBuf!))).toBeGreaterThan(1);

      await player.play();
      expect(player.state).toBe('playing');
      // Play still hears the remixed native buffer (same object)
      expect(peekNativeBuffer(player)).toBe(mutedBuf);
    } finally {
      await player.dispose();
    }
  }, 60_000);

  it('gain changes Play buffer; matches renderRemixedWavBlob DSP within 16-bit tol', async () => {
    const result = await renderStub();
    const ids = resolveRemixStemIds(audibleStemIds({}, {}, STEM_IDS));
    const stems = result.stems.filter((s) => ids.includes(s.id as RemixStemId));
    const gains: Partial<Record<string, number>> = {};
    for (const s of stems) gains[s.id] = s.id === 'bass' ? -12 : 0;

    const player = new PreviewPlayer();
    try {
      await player.loadMixFromStems(stems, {});
      const flatE = bufferEnergy(peekNativeBuffer(player)!);

      await player.loadMixFromStems(stems, gains);
      const previewBuf = peekNativeBuffer(player)!;
      expect(Math.abs(flatE - bufferEnergy(previewBuf))).toBeGreaterThan(1);

      const { blob } = await renderRemixedWavBlob(stems, gains, DEFAULT_BIT_DEPTH);
      const ctx = new AudioContext();
      try {
        const decoded = await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
        expect(maxAbsDiff(previewBuf, decoded)).toBeLessThan(0.01);
      } finally {
        await ctx.close().catch(() => undefined);
      }
    } finally {
      await player.dispose();
    }
  }, 60_000);
});

describe('store mute/solo/gain → applyLiveMixer / loadLiveFromStems (same Play APIs)', () => {
  beforeEach(async () => {
    await previewPlayer.dispose();
    installWebAudioMock();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await previewPlayer.dispose();
  });

  it('when live graph armed, toggleMute calls applyLiveMixer with muted kick (no remux)', async () => {
    vi.spyOn(previewPlayer, 'hasLiveGraph').mockReturnValue(true);
    const applySpy = vi.spyOn(previewPlayer, 'applyLiveMixer').mockImplementation(() => {});
    const liveSpy = vi.spyOn(previewPlayer, 'loadLiveFromStems').mockResolvedValue();

    const result = await renderStub();
    useStudioStore.setState({
      result,
      mixer: emptyMixerState(),
      mixerDirty: false,
      previewState: 'ready',
      busy: false,
      error: null,
    });

    useStudioStore.getState().toggleMute('kick');
    expect(useStudioStore.getState().mixer.mute.kick).toBe(true);
    expect(useStudioStore.getState().mixerDirty).toBe(true);

    await vi.waitFor(() => {
      expect(applySpy).toHaveBeenCalled();
    });

    const arg = applySpy.mock.calls.at(-1)![0] as {
      mute: Partial<Record<string, boolean>>;
    };
    expect(arg.mute.kick).toBe(true);
    expect(liveSpy).not.toHaveBeenCalled();
  }, 30_000);

  it('setGainDb debounced path calls applyLiveMixer with bass gain when live armed', async () => {
    vi.spyOn(previewPlayer, 'hasLiveGraph').mockReturnValue(true);
    const applySpy = vi.spyOn(previewPlayer, 'applyLiveMixer').mockImplementation(() => {});

    const result = await renderStub();
    useStudioStore.setState({
      result,
      mixer: emptyMixerState(),
      mixerDirty: false,
      previewState: 'ready',
      busy: false,
      error: null,
    });

    useStudioStore.getState().setGainDb('bass', -6);

    await vi.waitFor(
      () => {
        expect(applySpy).toHaveBeenCalled();
      },
      { timeout: 3000 },
    );

    const arg = applySpy.mock.calls.at(-1)![0] as {
      gainDb: Partial<Record<string, number>>;
    };
    expect(arg.gainDb.bass).toBe(-6);
  }, 30_000);

  it('first dirty tweak without live graph calls loadLiveFromStems then applyLiveMixer', async () => {
    vi.spyOn(previewPlayer, 'hasLiveGraph').mockReturnValue(false);
    const liveSpy = vi
      .spyOn(previewPlayer, 'loadLiveFromStems')
      .mockImplementation(async () => {
        // After arm, subsequent hasLiveGraph checks in same refresh may still be false —
        // loadPreviewFromMixer still calls applyLiveMixer after loadLiveFromStems.
      });
    const applySpy = vi.spyOn(previewPlayer, 'applyLiveMixer').mockImplementation(() => {});

    const result = await renderStub();
    useStudioStore.setState({
      result,
      mixer: emptyMixerState(),
      mixerDirty: false,
      previewState: 'ready',
      busy: false,
      error: null,
    });

    useStudioStore.getState().toggleMute('snare');

    await vi.waitFor(
      () => {
        expect(liveSpy).toHaveBeenCalled();
        expect(applySpy).toHaveBeenCalled();
      },
      { timeout: 10_000 },
    );

    const stemsArg = liveSpy.mock.calls[0]![0] as Array<{ id: string }>;
    expect(stemsArg.some((s) => ELEMENTAL_STEM_IDS.includes(s.id as (typeof ELEMENTAL_STEM_IDS)[number]))).toBe(
      true,
    );
    const mixerArg = applySpy.mock.calls.at(-1)![0] as {
      mute: Partial<Record<string, boolean>>;
    };
    expect(mixerArg.mute.snare).toBe(true);
  }, 30_000);

  it('PreviewPlayer exposes liveStemIds / getLiveChannelState for QA (Tone graph)', () => {
    // Contract: product ships testability for Channel strip — used when Tone AudioParam works.
    expect(typeof previewPlayer.hasLiveGraph).toBe('function');
    expect(typeof previewPlayer.liveStemIds).toBe('function');
    expect(typeof previewPlayer.getLiveChannelState).toBe('function');
    expect(typeof previewPlayer.applyLiveMixer).toBe('function');
    expect(previewPlayer.hasLiveGraph()).toBe(false);
    expect(previewPlayer.liveStemIds()).toEqual([]);
    expect(previewPlayer.getLiveChannelState('kick')).toBeNull();
  });
});
