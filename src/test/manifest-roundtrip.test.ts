/**
 * Reproducibility: a manifest round-trips through JSON and drives Recreate;
 * the export ZIP lists mastered + raw mixes, stems and manifest.
 */
import { describe, expect, it } from 'vitest';
import { buildExportManifest, recreateParamsFromManifest } from '../core/export/manifest';
import { buildExportEntries } from '../core/export/download';
import { encodeWav } from '../core/export/wav';
import type { AceRequestRecord, ExportManifest, RenderJob, RenderResult, StructureMap } from '../core/types';

const structure: StructureMap = {
  version: 'hard-grid-v0',
  bpm: 174,
  bars: 16,
  ppq: 480,
  samplesPerBar: 110345,
  snapPolicy: 'hard',
  sampleRateHz: 48000,
  sections: [{ name: 'drop', startBar: 0, lengthBars: 16 }],
  drumRole: {} as StructureMap['drumRole'],
  drums: [],
  bassRole: {} as StructureMap['bassRole'],
  energyCurve: [],
  keyRoot: 'A',
  seed: 7,
};

const aceRequest: AceRequestRecord = {
  caption: 'An instrumental drum and bass track',
  lyrics: '[Drop - explosive]',
  bpm: 174,
  seed: 7,
  model: 'acestep-v15-xl-turbo',
  thinking: true,
  inferenceSteps: 8,
  useAdg: false,
  guidanceScale: 7,
  shift: 3,
  lmTemperature: 0.7,
  sampler: 'sde',
  masterTarget: 'dynamic',
  repaint: { startSec: 10, endSec: 20, mode: 'balanced', strength: 0.5 },
  referenceHash: 'abc123',
};

const master = {
  lufsBefore: -16,
  lufsAfter: -11,
  peakDbAfter: -1,
  gainDb: 5,
  widthApplied: true,
  matchApplied: false,
  maxCorrectionDb: 1.5,
};

function jobOf(): RenderJob {
  return {
    jobId: 'job_7',
    seed: 7,
    bpm: 174,
    bpmTolerance: 2,
    durationBars: 16,
    sampleRateHz: 48000,
    bitDepth: 16,
    channels: 2,
    prompt: { descriptors: ['dnb'], energy: 0.8, darkness: 0.4, text: 'dnb' },
    stemSchemaVersion: 'v0',
  };
}

describe('manifest round-trip', () => {
  it('serializes aceRequest + master and recreates identical params', () => {
    const manifest = buildExportManifest({
      job: jobOf(),
      structure,
      stems: [],
      backendId: 'ace-step-1.5',
      checkpointId: 'acestep-v15-xl-turbo',
      bpmMeasured: 174,
      gpuUsed: true,
      aceRequest,
      master,
    });
    const parsed = JSON.parse(JSON.stringify(manifest)) as ExportManifest;
    expect(parsed.aceRequest).toEqual(aceRequest);
    expect(parsed.master).toEqual(master);

    const params = recreateParamsFromManifest(parsed);
    expect(params.seed).toBe(7);
    expect(params.bpm).toBe(174);
    expect(params.promptText).toBe(aceRequest.caption);
    expect(params.masterTarget).toBe('dynamic');
    expect(params.sampler).toBe('sde');
    expect(params.lmTemperature).toBe(0.7);
  });
});

describe('export ZIP entry list', () => {
  const p = 'take';
  async function resultOf(): Promise<RenderResult> {
    const mix = encodeWav([new Float32Array(64), new Float32Array(64)], 48000, 16);
    const kick = encodeWav([new Float32Array(32), new Float32Array(32)], 48000, 16);
    return {
      jobId: 'job',
      seed: 7,
      bpmMeasured: 174,
      backendId: 'ace-step-1.5',
      stems: [
        { id: 'mix', url: 'blob:mix', blob: mix, channels: 2, sampleRateHz: 48000, bitDepth: 16, durationSec: 1 },
        { id: 'kick', url: 'blob:kick', blob: kick, channels: 2, sampleRateHz: 48000, bitDepth: 16, durationSec: 1 },
      ],
      stemsReal: true,
      warnings: [],
      rawMixBlob: new Blob([new Uint8Array([82, 73, 70, 70, 9, 9, 9, 9])], { type: 'audio/wav' }),
      structure,
      manifest: buildExportManifest({
        job: jobOf(),
        structure,
        stems: [],
        backendId: 'ace-step-1.5',
        checkpointId: 'acestep-v15-xl-turbo',
        bpmMeasured: 174,
        gpuUsed: true,
        aceRequest,
        master,
      }),
    };
  }

  it('lists mastered + raw mix, stems and manifest.json', async () => {
    const result = await resultOf();
    const entries = await buildExportEntries(result, p, { bitDepth: 16 });
    const names = entries.map((e) => e.name);
    expect(names).toContain(`${p}_mix_mastered.wav`);
    expect(names).toContain(`${p}_mix_raw.wav`);
    expect(names).toContain(`${p}_kick.wav`);
    expect(names).toContain(`${p}_manifest.json`);

    const manifestEntry = entries.find((e) => e.name === `${p}_manifest.json`)!;
    const manifest = JSON.parse(new TextDecoder().decode(manifestEntry.data)) as ExportManifest;
    expect(manifest.mixFiles).toEqual({
      mastered: `${p}_mix_mastered.wav`,
      raw: `${p}_mix_raw.wav`,
    });
    // Raw mix is byte-for-byte the ACE output (not re-encoded).
    const rawEntry = entries.find((e) => e.name === `${p}_mix_raw.wav`)!;
    expect(Array.from(rawEntry.data)).toEqual([82, 73, 70, 70, 9, 9, 9, 9]);
  });
});
