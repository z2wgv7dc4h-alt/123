import { aceStepBackend } from './src/core/backends/AceStepBackend.ts';
import { DEFAULT_BPM, DEFAULT_BIT_DEPTH, DEFAULT_SAMPLE_RATE } from './src/core/types/index.ts';

// Minimal job
const job = {
  jobId: 'ace-one-shot',
  seed: 12345,
  bpm: DEFAULT_BPM,
  bpmTolerance: 2,
  durationBars: 8, // shorter for quick test
  sampleRateHz: DEFAULT_SAMPLE_RATE,
  bitDepth: DEFAULT_BIT_DEPTH,
  channels: 2,
  prompt: {
    descriptors: ['energetic dancefloor drum and bass'],
    energy: 0.75,
    darkness: 0.45,
    chaos: 0.25,
    text: 'energetic dancefloor drum and bass',
  },
  stemSchemaVersion: 'v0',
};

aceStepBackend.render(job).then(async result => {
  console.log('ACE render succeeded');
  // Optionally save the mix wav to file
  const mix = result.stems.find(s => s.id === 'mix');
  if (mix?.blob) {
    const { writeFile, mkdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const outDir = join(process.cwd(), 'exports');
    await mkdir(outDir, { recursive: true });
    const buf = Buffer.from(await mix.blob.arrayBuffer());
    const wavPath = join(outDir, `ace_mix_seed${result.seed}.wav`);
    await writeFile(wavPath, buf);
    console.log('Wrote', wavPath);
    process.exit(0);
  } else {
    console.error('No mix blob');
    process.exit(1);
  }
}).catch(err => {
  console.error('ACE render failed:', err);
  process.exit(1);
});