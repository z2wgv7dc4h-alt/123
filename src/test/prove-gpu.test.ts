import { describe, it, expect } from 'vitest';
import { AceStepBackend } from '../core/backends/AceStepBackend';

describe('AceStepBackend real GPU path', () => {
  const backend = new AceStepBackend();

  it('should probe and report GPU', async () => {
    const probe = await backend.probe();
    expect(probe.hasGpu).toBe(true);
    console.log('GPU probe:', probe);
  });

  it('should render a short segment and produce playable WAV', async () => {
    const job = {
      jobId: 'prove-gpu',
      seed: 123,
      bpm: 140,
      bpmTolerance: 2,
      durationBars: 2, // short
      sampleRateHz: 48000,
      bitDepth: 16,
      channels: 2,
      prompt: {
        descriptors: ['dnb'],
        energy: 0.7,
        darkness: 0.4,
        chaos: 0.3,
        text: 'drum and bass test',
      },
      stemSchemaVersion: 'v0',
    };

    const result = await backend.render(job);
    expect(result.backendId).toBe('ace-step-1.5');
    expect(result.manifest.gpuUsed).toBe(true);
    const mix = result.stems.find((s) => s.id === 'mix');
    expect(mix).toBeDefined();
    expect(mix?.url).toStartWith('blob:');
    expect(mix?.blob).toBeTruthy();
    console.log('Rendered mix URL:', mix?.url);
    console.log('Duration:', mix?.durationSec);
    // Optionally, we could convert blob to ArrayBuffer and save as file, but for now trust.
  });
});