import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { offlineStubBackend } from '../core/backends';
import { DEFAULT_BIT_DEPTH, DEFAULT_BPM, DEFAULT_SAMPLE_RATE } from '../core/types';
import { buildZip, blobToUint8 } from '../core/export/zip';

// Node polyfill for OfflineStub blob URLs
if (typeof URL.createObjectURL !== 'function') {
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => 'node://blob';
  (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
}

describe('CPU render → exports/', () => {
  it('plans+renders and writes sample WAV + zip smoke', async () => {
    const result = await offlineStubBackend.render({
      jobId: 'vitest_sample',
      seed: 17400,
      bpm: DEFAULT_BPM,
      bpmTolerance: 2,
      durationBars: 16,
      sampleRateHz: DEFAULT_SAMPLE_RATE,
      bitDepth: DEFAULT_BIT_DEPTH,
      channels: 2,
      prompt: {
        descriptors: ['energetic dancefloor drum and bass'],
        energy: 0.75,
        darkness: 0.45,
        chaos: 0.2,
      },
      stemSchemaVersion: 'v0',
    });

    expect(offlineStubBackend.capabilities.legoStems).toBe(false);
    expect(result.manifest.structureVersion).toBe('hard-grid-v0');
    expect(result.bpmMeasured).toBe(174);

    const mix = result.stems.find((s) => s.id === 'mix');
    expect(mix?.blob).toBeTruthy();
    const bytes = await blobToUint8(mix!.blob!);
    expect(String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!)).toBe('RIFF');

    const outDir = join(process.cwd(), 'exports');
    await mkdir(outDir, { recursive: true });
    const wavPath = join(outDir, `sample_mix_seed${result.seed}.wav`);
    await writeFile(wavPath, bytes);

    const entries = [];
    for (const s of result.stems) {
      if (s.blob) entries.push({ name: `${s.id}.wav`, data: await blobToUint8(s.blob) });
    }
    entries.push({
      name: 'manifest.json',
      data: new TextEncoder().encode(JSON.stringify(result.manifest)),
    });
    const zip = buildZip(entries);
    const zipBytes = await blobToUint8(zip);
    await writeFile(join(outDir, `sample_export_seed${result.seed}.zip`), zipBytes);
    expect(zipBytes[0]).toBe(0x50);

    console.log('Wrote', wavPath, bytes.length, 'bytes');
  }, 60_000);
});
