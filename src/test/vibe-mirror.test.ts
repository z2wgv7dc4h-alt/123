import { describe, expect, it } from 'vitest';
import { DEFAULT_BPM } from '../core/types';
import { scrubArtistNames } from '../core/prompt';
import { offlineStubBackend } from '../core/backends';
import {
  vibeFromMono,
  mapVibeToParams,
  fingerprintHash,
  estimateBrightness,
  estimateEnergyFromRms,
} from '../core/styleRef';
import { bufferRms } from '../core/audio';

/** Synthetic ~174 BPM click train @ 48 kHz (deterministic fixture — not copyrighted). */
function synthClickTrain(bpm = 174, bars = 4, sr = 48000): Float32Array {
  const beats = bars * 4;
  const samples = Math.floor((beats * 60) / bpm * sr);
  const out = new Float32Array(samples);
  const period = Math.floor((60 / bpm) * sr);
  for (let b = 0; b < beats; b++) {
    const at = b * period;
    for (let i = 0; i < Math.floor(0.008 * sr) && at + i < samples; i++) {
      const t = i / sr;
      out[at + i] = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 80) * (b % 2 === 0 ? 0.9 : 0.55);
    }
  }
  return out;
}

describe('Vibe Mirror v0', () => {
  it('vibeFromMono is deterministic for synthetic buffer', () => {
    const mono = synthClickTrain();
    const ab = mono.buffer.slice(mono.byteOffset, mono.byteOffset + mono.byteLength);
    const a = vibeFromMono(mono, 48000, { fileName: 'fixture.wav', fingerprintSource: ab });
    const b = vibeFromMono(mono, 48000, { fileName: 'fixture.wav', fingerprintSource: ab });
    expect(a).toEqual(b);
    expect(a.fingerprintHash).toMatch(/^[0-9a-f]{8}$/);
    expect(a.energy).toBeGreaterThan(0);
    expect(a.brightness).toBeGreaterThanOrEqual(0);
    expect(a.darknessHint).toBeGreaterThanOrEqual(0);
    expect(a.sectionHints.length).toBeGreaterThan(0);
    expect(fingerprintHash(ab, 'fixture.wav')).toBe(a.fingerprintHash);
  });

  it('mapVibeToParams does not imply BPM change (caller keeps 174)', () => {
    const mono = synthClickTrain();
    const ab = mono.buffer.slice(mono.byteOffset, mono.byteOffset + mono.byteLength);
    const vibe = vibeFromMono(mono, 48000, { fileName: 'x.wav', fingerprintSource: ab });
    const mapped = mapVibeToParams(vibe, { energy: 0.5, darkness: 0.5, chaos: 0.25 }, 0.7);
    expect(mapped.energy).toBeGreaterThanOrEqual(0);
    expect(mapped.energy).toBeLessThanOrEqual(1);
    expect(mapped.darkness).toBeGreaterThanOrEqual(0);
    expect(mapped.chaos).toBeGreaterThanOrEqual(0);
    // Contract: StructureEngine BPM always 174 — map has no bpm field
    expect('bpm' in mapped).toBe(false);
    expect(DEFAULT_BPM).toBe(174);
  });

  it('scrubArtistNames keeps artist style descriptors', () => {
    const { clean, blocked } = scrubArtistNames('Pendulum energy with Suno polish');
    expect(blocked).toEqual([]);
    expect(clean).toContain('Pendulum');
  });

  it('OfflineStub generate without vibe → 174 BPM', async () => {
    const result = await offlineStubBackend.render({
      jobId: 'vibe_none',
      seed: 42,
      bpm: DEFAULT_BPM,
      bpmTolerance: 2,
      durationBars: 16,
      sampleRateHz: 48000,
      bitDepth: 16,
      channels: 2,
      prompt: { descriptors: ['test'], energy: 0.6, darkness: 0.4 },
      stemSchemaVersion: 'v0',
    });
    expect(result.bpmMeasured).toBe(174);
    expect(result.manifest.styleReference).toBeUndefined();
    expect(result.backendId).toBe('offline-stub');
  });

  it('OfflineStub generate with vibe → 174 BPM + provenance hash/userOwned', async () => {
    const mono = synthClickTrain();
    const ab = mono.buffer.slice(mono.byteOffset, mono.byteOffset + mono.byteLength);
    const vibe = vibeFromMono(mono, 48000, { fileName: 'mine.wav', fingerprintSource: ab });
    const mapped = mapVibeToParams(vibe, { energy: 0.5, darkness: 0.4, chaos: 0.2 }, 0.7);
    const result = await offlineStubBackend.render({
      jobId: 'vibe_yes',
      seed: 42,
      bpm: DEFAULT_BPM,
      bpmTolerance: 2,
      durationBars: 16,
      sampleRateHz: 48000,
      bitDepth: 16,
      channels: 2,
      prompt: {
        descriptors: ['test'],
        energy: mapped.energy,
        darkness: mapped.darkness,
        chaos: mapped.chaos,
      },
      stemSchemaVersion: 'v0',
      styleReference: {
        intensity: 0.7,
        estimatedBpm: vibe.estimatedBpm,
        energy: vibe.energy,
        fileName: vibe.fileName,
        ownerAttested: true,
        hash: vibe.fingerprintHash,
      },
    });
    expect(result.bpmMeasured).toBe(174);
    expect(result.manifest.styleReference?.used).toBe(true);
    expect(result.manifest.styleReference?.userOwned).toBe(true);
    expect(result.manifest.styleReference?.hash).toBe(vibe.fingerprintHash);
    expect(result.manifest.styleReference?.acePathActive).toBe(false);
    expect(result.warnings.some((w) => /Style reference|YOUR file|your file/i.test(w))).toBe(true);
  });

  it('brightness / energy helpers are finite on silence and tone', () => {
    const silence = new Float32Array(2048);
    expect(estimateBrightness(silence)).toBe(0);
    expect(estimateEnergyFromRms(bufferRms(silence))).toBe(0);
    const tone = synthClickTrain(174, 2);
    expect(estimateBrightness(tone)).toBeGreaterThan(0);
  });
});
