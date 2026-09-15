import { describe, expect, it } from 'vitest';
import { buildExportManifest } from '../core/export/manifest';
import { DEFAULT_BIT_DEPTH, DEFAULT_BPM, type RenderJob, type StructureMap } from '../core/types';
import { HELP } from '../ui/lib/helpCopy';

function baseJob(): RenderJob {
  return {
    jobId: 'job_product_tier',
    seed: 17400,
    bpm: DEFAULT_BPM,
    bpmTolerance: 2,
    durationBars: 8,
    sampleRateHz: 48000,
    bitDepth: DEFAULT_BIT_DEPTH,
    channels: 2,
    prompt: {
      descriptors: ['energetic dancefloor drum and bass'],
      energy: 0.7,
      darkness: 0.4,
      chaos: 0.2,
      text: 'test',
    },
    stemSchemaVersion: 'v0',
  };
}

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

describe('Sketch vs Studio retail honesty', () => {
  it('manifest productTier is sketch when gpuUsed false (OfflineStub path)', () => {
    const manifest = buildExportManifest({
      job: baseJob(),
      structure: stubStructure,
      stems: [],
      backendId: 'offline-stub',
      checkpointId: 'offline-stub-v0',
      bpmMeasured: DEFAULT_BPM,
      gpuUsed: false,
    });
    expect(manifest.productTier).toBe('sketch');
    expect(manifest.bitDepth).toBe(16);
    expect(manifest.gpuUsed).toBe(false);
  });

  it('manifest productTier is studio only when gpuUsed true', () => {
    const manifest = buildExportManifest({
      job: baseJob(),
      structure: stubStructure,
      stems: [],
      backendId: 'ace-step-1.5',
      checkpointId: 'ace-v15',
      bpmMeasured: DEFAULT_BPM,
      gpuUsed: true,
      acePathActive: true,
    });
    expect(manifest.productTier).toBe('studio');
    expect(manifest.gpuUsed).toBe(true);
  });

  it('HELP product tips exist and teach Sketch ≠ Studio GPU', () => {
    expect(HELP.productSketch).toMatch(/Sketch/i);
    expect(HELP.productSketch).toMatch(/CPU|16-bit/i);
    expect(HELP.productStudio).toMatch(/Studio/i);
    expect(HELP.productStudio).toMatch(/GPU|Gated/i);
    expect(HELP.studioGated).toMatch(/Sketch/i);
    expect(HELP.badgeSketch16).toMatch(/16-bit/i);
  });
});
