/**
 * One-off: render every song-shape preset at the same seed so genre/style
 * differentiation can actually be heard and inspected, not just trusted
 * from reading the code.
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

const shapes = ['classic', 'dubstep', 'trap-bounce', 'half-time-drop'];

for (const songShape of shapes) {
  const map = await structureEngine.plan({
    seed: 17400, bpm: 174, bars: 32, energy: 0.75, darkness: 0.45, chaos: 0.25,
    breakDensity: 0.55, sampleRateHz: 48000, songShape,
  });
  const snareBeats = [...new Set(map.drums.find((d) => d.role === 'snare').hits.map((h) => Math.round(h.beat * 4) / 4))].sort((a, b) => a - b);
  const kickCount = map.drums.find((d) => d.role === 'kick').hits.length;
  console.log(`[${songShape}] family=${map.patternFamily} bassChar=${map.bassRole.character} kickHits=${kickCount} snareBeatPositions=${JSON.stringify(snareBeats)}`);

  const result = await offlineStubBackend.render({
    jobId: `style_${songShape}`,
    seed: 17400,
    bpm: DEFAULT_BPM,
    bpmTolerance: 2,
    durationBars: 32,
    sampleRateHz: DEFAULT_SAMPLE_RATE,
    bitDepth: DEFAULT_BIT_DEPTH,
    channels: 2,
    songShape,
    prompt: {
      descriptors: [],
      energy: 0.75,
      darkness: 0.45,
      chaos: 0.25,
      text: 'energetic dancefloor drum and bass, rock-dnb crossover',
    },
    stemSchemaVersion: 'v0',
  });
  const mix = result.stems.find((s) => s.id === 'mix');
  const buf = Buffer.from(await mix.blob.arrayBuffer());
  const wavPath = join(outDir, `style_${songShape.replace(/[^a-z0-9]/gi, '_')}_seed17400.wav`);
  await writeFile(wavPath, buf);
  console.log('  wrote', wavPath);
}
