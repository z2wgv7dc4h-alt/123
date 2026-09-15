/**
 * CPU plan+render → writes sample mix WAV under exports/
 * Run: node --experimental-vm-modules node_modules/vite-node/vite-node.mjs scripts/render-sample.ts
 * or:  npx vitest run src/test/render-sample.test.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'exports');

// Polyfill browser URL object URLs for OfflineStub in Node
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'node://blob';
  URL.revokeObjectURL = () => {};
}

const { offlineStubBackend } = await import('../src/core/backends/OfflineStubBackend.ts');
const { DEFAULT_BPM, DEFAULT_BIT_DEPTH, DEFAULT_SAMPLE_RATE } = await import('../src/core/types/index.ts');

await mkdir(outDir, { recursive: true });

const result = await offlineStubBackend.render({
  jobId: 'sample_cpu',
  seed: 17400,
  bpm: DEFAULT_BPM,
  bpmTolerance: 2,
  durationBars: 16,
  sampleRateHz: DEFAULT_SAMPLE_RATE,
  bitDepth: DEFAULT_BIT_DEPTH,
  channels: 2,
  prompt: {
    descriptors: ['energetic dancefloor drum and bass', 'reese bass'],
    energy: 0.75,
    darkness: 0.45,
    chaos: 0.25,
    text: 'energetic dancefloor drum and bass',
  },
  stemSchemaVersion: 'v0',
});

const mix = result.stems.find((s) => s.id === 'mix');
if (!mix?.blob) throw new Error('No mix blob');
const buf = Buffer.from(await mix.blob.arrayBuffer());
const wavPath = join(outDir, `sample_mix_seed${result.seed}.wav`);
await writeFile(wavPath, buf);

const manifestPath = join(outDir, `sample_manifest_seed${result.seed}.json`);
await writeFile(manifestPath, JSON.stringify(result.manifest, null, 2));

console.log('Wrote', wavPath, `(${buf.length} bytes)`);
console.log('BPM', result.bpmMeasured, 'structure', result.manifest.structureVersion);
console.log('legoStems', offlineStubBackend.capabilities.legoStems);
