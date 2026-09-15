/**
 * Proves the kick→bass sidechain duck is actually wired into the paths that
 * claim to share it (VERIFY-SUMMARY.md: "live preview, native Play buffer,
 * and export all share the same ducking DSP computation"). The existing
 * live-duck-envelope.test.ts only unit-tests the envelope math in isolation —
 * it never drives PreviewPlayer.loadMixFromStems or renderRemixedWavBlob, so
 * it never proved the integration. This test does, by comparing a real kick
 * against a silent-kick control through the actual public render paths.
 *
 * Trick: the envelope follower's release tail keeps the duck gain engaged
 * for tens of ms after a kick impulse has already decayed to zero. Sampling
 * a short window just after each kick hit isolates the bass-only duck effect
 * from the kick's own transient (which is ~0 there in both variants).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { PreviewPlayer, renderRemixedWavBlob } from '../core/audio';
import { encodeWav } from '../core/export/wav';

const SR = 8000;
const DURATION_SEC = 1;
const LEN = SR * DURATION_SEC;
const HIT_EVERY = Math.round(SR * 0.25); // 4 hits/sec
const HIT_LEN = 20; // brief impulse burst
const POST_HIT_OFFSET = Math.round(SR * 0.01); // 10ms after hit ends — kick is 0 here, duck tail is not
const POST_HIT_WINDOW = Math.round(SR * 0.02); // 20ms window

function kickImpulses(): Float32Array {
  const arr = new Float32Array(LEN);
  for (let start = 0; start + HIT_LEN <= LEN; start += HIT_EVERY) {
    for (let i = 0; i < HIT_LEN; i++) arr[start + i] = 1;
  }
  return arr;
}

function constantBass(amp: number): Float32Array {
  return new Float32Array(LEN).fill(amp);
}

/** Average |x| in the release-tail window right after each kick hit ends. */
function postHitBassLevel(mix: Float32Array): number {
  let sum = 0;
  let n = 0;
  for (let start = 0; start + HIT_LEN <= LEN; start += HIT_EVERY) {
    const from = start + HIT_LEN + POST_HIT_OFFSET;
    const to = Math.min(LEN, from + POST_HIT_WINDOW);
    for (let i = from; i < to; i++) {
      sum += Math.abs(mix[i]!);
      n++;
    }
  }
  return n > 0 ? sum / n : 0;
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
        const sample = view.getInt16(o, true) / 0x8000;
        o += 2;
        channels[c]![i] = sample;
      }
    }
    return new MockAudioBuffer(sampleRate, channels);
  }

  class MockAudioContext {
    state: AudioContextState = 'running';
    decodeAudioData(ab: ArrayBuffer): Promise<MockAudioBuffer> {
      return Promise.resolve(decodePcmWav(ab));
    }
    createBuffer(numberOfChannels: number, length: number, sampleRate: number): MockAudioBuffer {
      return new MockAudioBuffer(
        sampleRate,
        Array.from({ length: numberOfChannels }, () => new Float32Array(length)),
      );
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

beforeAll(() => {
  installWebAudioMock();
});

describe('kick→bass duck integration (export + native preview share one DSP)', () => {
  it('renderRemixedWavBlob (export/as-heard path) attenuates bass in the post-kick release tail vs a silent-kick control', async () => {
    const kick = kickImpulses();
    const silentKick = new Float32Array(LEN);
    const bass = constantBass(0.3);

    const kickBlob = encodeWav([kick], SR, 16);
    const silentKickBlob = encodeWav([silentKick], SR, 16);
    const bassBlob = encodeWav([bass], SR, 16);

    const { blob: duckedBlob } = await renderRemixedWavBlob(
      [{ id: 'kick', blob: kickBlob }, { id: 'bass', blob: bassBlob }],
      {},
      16,
    );
    const { blob: controlBlob } = await renderRemixedWavBlob(
      [{ id: 'kick', blob: silentKickBlob }, { id: 'bass', blob: bassBlob }],
      {},
      16,
    );

    const ctx = new AudioContext();
    const ducked = (await ctx.decodeAudioData((await duckedBlob.arrayBuffer()).slice(0))).getChannelData(0);
    const control = (await ctx.decodeAudioData((await controlBlob.arrayBuffer()).slice(0))).getChannelData(0);

    const duckedLevel = postHitBassLevel(ducked);
    const controlLevel = postHitBassLevel(control);

    // Real kick present → bass measurably quieter right after each hit than the no-kick control.
    expect(duckedLevel).toBeLessThan(controlLevel * 0.9);
  });

  it('PreviewPlayer.loadMixFromStems (native fallback preview) produces the same duck shape as renderRemixedWavBlob (export)', async () => {
    const kick = kickImpulses();
    const bass = constantBass(0.3);
    const kickBlob = encodeWav([kick], SR, 16);
    const bassBlob = encodeWav([bass], SR, 16);
    const stems = [{ id: 'kick', blob: kickBlob }, { id: 'bass', blob: bassBlob }];

    const player = new PreviewPlayer();
    await player.loadMixFromStems(stems, {});
    const nativeBuffer = (player as unknown as { nativeBuffer: { getChannelData: (c: number) => Float32Array } | null })
      .nativeBuffer;
    expect(nativeBuffer).not.toBeNull();
    const previewMix = nativeBuffer!.getChannelData(0);

    const { blob: exportBlob } = await renderRemixedWavBlob(stems, {}, 16);
    const ctx = new AudioContext();
    const exportMix = (await ctx.decodeAudioData((await exportBlob.arrayBuffer()).slice(0))).getChannelData(0);

    const previewLevel = postHitBassLevel(previewMix);
    const exportLevel = postHitBassLevel(exportMix);

    // Both paths call the same applyKickBassDuck — post-hit duck depth should match closely.
    expect(previewLevel).toBeGreaterThan(0);
    expect(Math.abs(previewLevel - exportLevel) / exportLevel).toBeLessThan(0.1);
  });
});
