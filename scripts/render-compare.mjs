/**
 * One-off: render the same seed with and without guitar/solo layers, so the
 * before/after of un-gating them for Sketch can actually be heard.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'exports');

if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'node://blob';
  URL.revokeObjectURL = () => {};
}

const { offlineStubBackend } = await import('../src/core/backends/OfflineStubBackend.ts');
const { DEFAULT_BPM, DEFAULT_BIT_DEPTH, DEFAULT_SAMPLE_RATE } = await import('../src/core/types/index.ts');

await mkdir(outDir, { recursive: true });

const baseJob = {
  jobId: 'compare',
  seed: 17400,
  bpm: DEFAULT_BPM,
  bpmTolerance: 2,
  durationBars: 32,
  sampleRateHz: DEFAULT_SAMPLE_RATE,
  bitDepth: DEFAULT_BIT_DEPTH,
  channels: 2,
  prompt: {
    descriptors: ['energetic dancefloor drum and bass, rock-dnb crossover'],
    energy: 0.75,
    darkness: 0.45,
    chaos: 0.25,
    text: 'energetic dancefloor drum and bass, rock-dnb crossover, distorted supersaw leads, reese bass',
  },
  stemSchemaVersion: 'v0',
};

for (const [label, layers] of [
  ['drums_bass_only', undefined],
  ['with_guitar_solo', { guitar: true, solo: true }],
]) {
  const result = await offlineStubBackend.render({ ...baseJob, layers });
  const mix = result.stems.find((s) => s.id === 'mix');
  if (!mix?.blob) throw new Error('No mix blob for ' + label);
  const buf = Buffer.from(await mix.blob.arrayBuffer());
  const wavPath = join(outDir, `compare_${label}_seed${result.seed}.wav`);
  await writeFile(wavPath, buf);
  console.log('Wrote', wavPath, `(${buf.length} bytes)`, 'stems:', result.stems.map((s) => s.id).join(','));
}
