/**
 * One-off: force patternFamily to 'amen' and 'twoStep' at a fixed seed so
 * the real breakbeat loop layer (added 2026-09-15) is actually audible in
 * the rendered mix, then write both to exports/ for a real listen.
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
const { structureEngine } = await import('../src/core/structure/index.ts');
const { DEFAULT_BPM, DEFAULT_BIT_DEPTH, DEFAULT_SAMPLE_RATE } = await import('../src/core/types/index.ts');

await mkdir(outDir, { recursive: true });

// Try a handful of seeds and use whichever lands on 'amen' / 'twoStep' —
// patternFamily is seed-picked, not directly settable from render().
async function findSeedForFamily(target) {
  for (let seed = 1; seed < 200; seed++) {
    const map = await structureEngine.plan({
      seed, bpm: 174, bars: 32, energy: 0.75, darkness: 0.45, chaos: 0.25,
      breakDensity: 0.55, sampleRateHz: 48000, songShape: 'classic',
    });
    if (map.patternFamily === target) return seed;
  }
  throw new Error(`no seed found for family ${target} in range`);
}

for (const family of ['amen', 'twoStep']) {
  const seed = await findSeedForFamily(family);
  console.log(`[${family}] using seed ${seed}`);
  const result = await offlineStubBackend.render({
    jobId: `real_break_${family}`,
    seed,
    bpm: DEFAULT_BPM,
    bpmTolerance: 2,
    durationBars: 32,
    sampleRateHz: DEFAULT_SAMPLE_RATE,
    bitDepth: DEFAULT_BIT_DEPTH,
    channels: 2,
    songShape: 'classic',
    prompt: {
      descriptors: [],
      energy: 0.75,
      darkness: 0.45,
      chaos: 0.25,
      text: 'energetic dancefloor drum and bass',
    },
    stemSchemaVersion: 'v0',
  });
  const mix = result.stems.find((s) => s.id === 'mix');
  const buf = Buffer.from(await mix.blob.arrayBuffer());
  const wavPath = join(outDir, `real_break_${family}_seed${seed}.wav`);
  await writeFile(wavPath, buf);
  console.log('  wrote', wavPath, buf.length, 'bytes');
}
