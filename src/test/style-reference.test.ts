/**
 * Style-reference analyzer + provenance honesty.
 * Imports the canonical `@/core/styleRef` surface (not UI/store).
 */
import { describe, expect, it } from 'vitest';
import {
  analyzeMonoBuffer,
  blendEnergy,
  clampBpmToDnBBand,
  estimateBpmFromMono,
  estimateBrightness,
  estimateDarknessHint,
  estimateEnergyFromRms,
  fingerprintHash,
  guessSectionHints,
  isAllowedStyleAudioFile,
  mapVibeToParams,
  nudgeBpmTowardReference,
  onsetEnvelope,
  peakAbs,
  peakDbFromLinear,
  toMono,
  vibeFromMono,
} from '../core/styleRef';
import { buildExportManifest, buildStyleReferenceProvenance } from '../core/export/manifest';
import { offlineStubBackend } from '../core/backends';
import { DEFAULT_BPM } from '../core/types';
import type { RenderJob, StructureMap } from '../core/types';

/** Synthetic click train at a known BPM for analyzer tests. */
function clickTrain(bpm: number, sampleRate: number, durationSec: number): Float32Array {
  const n = Math.floor(sampleRate * durationSec);
  const out = new Float32Array(n);
  const interval = Math.floor((60 / bpm) * sampleRate);
  const clickLen = Math.floor(0.008 * sampleRate);
  for (let at = 0; at + clickLen < n; at += interval) {
    for (let i = 0; i < clickLen; i++) {
      const t = i / sampleRate;
      out[at + i]! += Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t * 400);
    }
  }
  return out;
}

function fakeFile(name: string, type: string): File {
  return { name, type, size: 4 } as File;
}

describe('style reference: file allowlist', () => {
  it('accepts mp3/wav/flac by extension or mime', () => {
    expect(isAllowedStyleAudioFile(fakeFile('mine.mp3', ''))).toBe(true);
    expect(isAllowedStyleAudioFile(fakeFile('mine.WAV', 'audio/wav'))).toBe(true);
    expect(isAllowedStyleAudioFile(fakeFile('pad.flac', 'audio/flac'))).toBe(true);
    expect(isAllowedStyleAudioFile(fakeFile('track.mpeg', 'audio/mpeg'))).toBe(true);
  });

  it('rejects non-audio / unknown types (no URL / catalog path)', () => {
    expect(isAllowedStyleAudioFile(fakeFile('notes.txt', 'text/plain'))).toBe(false);
    expect(isAllowedStyleAudioFile(fakeFile('video.mp4', 'video/mp4'))).toBe(false);
    expect(isAllowedStyleAudioFile(fakeFile('rip.webm', 'audio/webm'))).toBe(false);
  });
});

describe('style reference: analyzer helpers', () => {
  it('toMono averages channels; peakAbs + energy + peak dB map', () => {
    const L = new Float32Array([0.5, -0.5, 0.25]);
    const R = new Float32Array([0.5, 0.5, 0.75]);
    const mono = toMono([L, R]);
    expect(mono[0]).toBeCloseTo(0.5);
    expect(mono[1]).toBeCloseTo(0);
    expect(peakAbs(mono)).toBeCloseTo(0.5);
    expect(estimateEnergyFromRms(0)).toBe(0);
    expect(estimateEnergyFromRms(0.25)).toBeGreaterThan(0.4);
    expect(peakDbFromLinear(1)).toBeCloseTo(0, 5);
    expect(peakDbFromLinear(0)).toBe(-120);
    expect(peakDbFromLinear(0.5)).toBeCloseTo(20 * Math.log10(0.5), 5);
  });

  it('silent / empty buffers yield null BPM and zero energy', () => {
    expect(estimateBpmFromMono(new Float32Array(48000), 48000)).toBeNull();
    expect(estimateBpmFromMono(new Float32Array(0), 48000)).toBeNull();
    const a = analyzeMonoBuffer(new Float32Array(4800), 48000, 1);
    expect(a.estimatedBpm).toBeNull();
    expect(a.energy).toBe(0);
    expect(a.peak).toBe(0);
  });

  it('estimates BPM near a synthetic 174 click train', () => {
    const sr = 22050;
    const mono = clickTrain(174, sr, 8);
    const env = onsetEnvelope(mono, sr);
    expect(env.length).toBeGreaterThan(50);
    const bpm = estimateBpmFromMono(mono, sr);
    expect(bpm).not.toBeNull();
    expect(Math.abs(bpm! - 174)).toBeLessThanOrEqual(4);
  });

  it('analyzeMonoBuffer returns duration/energy/bpm fields', () => {
    const sr = 22050;
    const mono = clickTrain(172, sr, 6);
    const a = analyzeMonoBuffer(mono, sr, 1);
    expect(a.durationSec).toBeCloseTo(6, 1);
    expect(a.energy).toBeGreaterThan(0);
    expect(a.peak).toBeGreaterThan(0);
    expect(a.sampleRateHz).toBe(sr);
  });

  it('nudgeBpmTowardReference + clampBpmToDnBBand stay in 170–176', () => {
    expect(nudgeBpmTowardReference(174, null, 1)).toBe(174);
    expect(nudgeBpmTowardReference(174, 172, 1)).toBe(172);
    expect(nudgeBpmTowardReference(174, 140, 1)).toBe(174); // far outside → keep
    const mid = nudgeBpmTowardReference(174, 170, 0.5);
    expect(mid).toBeGreaterThanOrEqual(170);
    expect(mid).toBeLessThanOrEqual(174);
    expect(clampBpmToDnBBand(174)).toBe(174);
    expect(clampBpmToDnBBand(87)).toBe(174); // half-time fold
    expect(clampBpmToDnBBand(140)).toBeNull();
    expect(clampBpmToDnBBand(null)).toBeNull();
  });

  it('blendEnergy mixes UI + reference by intensity', () => {
    expect(blendEnergy(0.2, 0.8, 0)).toBeCloseTo(0.2);
    expect(blendEnergy(0.2, 0.8, 1)).toBeGreaterThan(0.55);
  });
});

describe('style reference: vibe mirror (local-only)', () => {
  it('fingerprintHash is stable for same bytes+name and diverges on rename', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 9, 8, 7]).buffer;
    const a = fingerprintHash(bytes, 'a.wav');
    const b = fingerprintHash(bytes, 'a.wav');
    const c = fingerprintHash(bytes, 'b.wav');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it('vibeFromMono + mapVibeToParams never invent a BPM field (structure owns 174)', () => {
    const sr = 22050;
    const mono = clickTrain(174, sr, 4);
    const vibe = vibeFromMono(mono, sr, {
      fileName: 'owned.wav',
      fingerprintSource: new Uint8Array(mono.buffer, mono.byteOffset, mono.byteLength),
    });
    expect(vibe.fileName).toBe('owned.wav');
    expect(vibe.energy).toBeGreaterThan(0);
    expect(vibe.brightness).toBeGreaterThanOrEqual(0);
    expect(vibe.darknessHint).toBeGreaterThanOrEqual(0);
    expect(vibe.sectionHints.length).toBeGreaterThan(0);
    expect(vibe.fingerprintHash).toMatch(/^[0-9a-f]{8}$/);

    const mapped = mapVibeToParams(vibe, { energy: 0.5, darkness: 0.4, chaos: 0.2 }, 0.8);
    expect(mapped).toHaveProperty('energy');
    expect(mapped).toHaveProperty('darkness');
    expect(mapped).toHaveProperty('chaos');
    expect(mapped).toHaveProperty('barsBias');
    expect(mapped).not.toHaveProperty('bpm');
    expect(Object.keys(mapped).sort()).toEqual(['barsBias', 'chaos', 'darkness', 'energy']);
  });

  it('brightness / darkness / section helpers are bounded', () => {
    const bright = new Float32Array(2048);
    for (let i = 0; i < bright.length; i++) bright[i] = i % 2 === 0 ? 0.9 : -0.9;
    const b = estimateBrightness(bright);
    expect(b).toBeGreaterThan(0.2);
    expect(b).toBeLessThanOrEqual(1);
    const d = estimateDarknessHint(0.2, 0.9);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(1);
    const hints = guessSectionHints(bright, 48000, 0.8);
    expect(hints.length).toBeGreaterThan(0);
    expect(hints.length).toBeLessThanOrEqual(4);
  });
});

describe('style reference: provenance honesty', () => {
  const baseJob = (withRef: boolean): RenderJob => ({
    jobId: 'prov_test',
    seed: 1,
    bpm: DEFAULT_BPM,
    bpmTolerance: 2,
    durationBars: 16,
    sampleRateHz: 48000,
    bitDepth: 16,
    channels: 2,
    prompt: { descriptors: ['test'], energy: 0.7, darkness: 0.4 },
    stemSchemaVersion: 'v0',
    styleReference: withRef
      ? {
          intensity: 0.8,
          estimatedBpm: 173,
          energy: 0.72,
          fileName: 'my-loop.wav',
          ownerAttested: true,
        }
      : undefined,
  });

  const stubStructure: StructureMap = {
    version: 'hard-grid-v0',
    bpm: 174,
    bars: 16,
    ppq: 480,
    samplesPerBar: Math.round((60 / 174) * 4 * 48000),
    snapPolicy: 'hard',
    sampleRateHz: 48000,
    sections: [{ name: 'drop', startBar: 0, lengthBars: 16 }],
    drumRole: { role: 'kick', hits: [] },
    drums: [],
    bassRole: { notes: [], character: 'reese' },
    energyCurve: [],
    keyRoot: 'Am',
    seed: 1,
  };

  it('OfflineStub provenance: used + userOwned + acePathActive=false', () => {
    const job = baseJob(true);
    const prov = buildStyleReferenceProvenance(job, {
      acePathActive: false,
      backendId: 'offline-stub',
    });
    expect(prov).toBeTruthy();
    expect(prov!.used).toBe(true);
    expect(prov!.source).toBe('user-upload');
    expect(prov!.userOwned).toBe(true);
    expect(prov!.acePathActive).toBe(false);
    expect(prov!.fileName).toBe('my-loop.wav');
    expect(prov!.ownerAttested).toBe(true);
    expect(prov!.note.toLowerCase()).toMatch(/browser.?sketch|not (ace|studio)/);
    expect(prov!.note.toLowerCase()).not.toMatch(/stems came from ace|ace produced these stems/);
  });

  it('forcing acePathActive=true only allowed when caller opts in (ACE path)', () => {
    const prov = buildStyleReferenceProvenance(baseJob(true), {
      acePathActive: true,
      backendId: 'ace-step-1.5',
    });
    expect(prov!.acePathActive).toBe(true);
    expect(prov!.note.toLowerCase()).toMatch(/ace-step|sidecar/);
  });

  it('manifest omits styleReference when unused', () => {
    const manifest = buildExportManifest({
      job: baseJob(false),
      structure: stubStructure,
      stems: [],
      backendId: 'offline-stub',
      checkpointId: 'offline-stub-v0',
      bpmMeasured: 174,
      gpuUsed: false,
      acePathActive: false,
    });
    expect(manifest.styleReference).toBeUndefined();
    expect(manifest.gpuUsed).toBe(false);
  });

  it('manifest never claims ACE path for OfflineStub when flag omitted', () => {
    const manifest = buildExportManifest({
      job: baseJob(true),
      structure: stubStructure,
      stems: [],
      backendId: 'offline-stub',
      checkpointId: 'offline-stub-v0',
      bpmMeasured: 174,
      gpuUsed: false,
    });
    expect(manifest.styleReference?.acePathActive).toBe(false);
    expect(manifest.styleReference?.used).toBe(true);
    expect(manifest.styleReference?.userOwned).toBe(true);
  });
});

describe('style reference: OfflineStub bias is meaningful', () => {
  it(
    'render with styleReference differs from baseline and records honest provenance',
    async () => {
    const basePrompt = { descriptors: ['test'], energy: 0.5, darkness: 0.4, chaos: 0.2 };
    const base = await offlineStubBackend.render({
      jobId: 'style_base',
      seed: 4242,
      bpm: DEFAULT_BPM,
      bpmTolerance: 2,
      durationBars: 8,
      sampleRateHz: 48000,
      bitDepth: 16,
      channels: 2,
      prompt: basePrompt,
      stemSchemaVersion: 'v0',
    });
    const styled = await offlineStubBackend.render({
      jobId: 'style_biased',
      seed: 4242,
      bpm: 172,
      bpmTolerance: 2,
      durationBars: 16,
      sampleRateHz: 48000,
      bitDepth: 16,
      channels: 2,
      prompt: { ...basePrompt, energy: 0.85 },
      stemSchemaVersion: 'v0',
      styleReference: {
        intensity: 0.9,
        estimatedBpm: 172,
        energy: 0.9,
        fileName: 'owned-drop.wav',
        ownerAttested: true,
      },
    });

    expect(styled.manifest.styleReference?.used).toBe(true);
    expect(styled.manifest.styleReference?.userOwned).toBe(true);
    expect(styled.manifest.styleReference?.acePathActive).toBe(false);
    expect(styled.manifest.styleReference?.fileName).toBe('owned-drop.wav');
    expect(styled.manifest.gpuUsed).toBe(false);
    expect(styled.backendId).toBe('offline-stub');
    expect(styled.warnings.some((w) => /style reference/i.test(w))).toBe(true);
    expect(styled.warnings.some((w) => /not (ACE|Studio)/i.test(w))).toBe(true);

    const styledMix = styled.stems.find((s) => s.id === 'mix')!;
    expect(styledMix.blob?.size).toBeGreaterThan(1000);
    expect(base.waveformPeaks).not.toEqual(styled.waveformPeaks);
    expect(styled.bpmMeasured).toBe(174);
  }, 30_000);
});
