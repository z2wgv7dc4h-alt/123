import { structureEngine } from '../src/core/structure/index.ts';
import { OfflineStubBackend } from '../src/core/backends/OfflineStubBackend.ts';

async function one(seed: number, chaos: number) {
  const map = await structureEngine.plan({
    seed, bpm: 174, bars: 16, energy: 0.8, breakDensity: 0.5, darkness: 0.5, chaos,
  });
  const kick = map.drums.find((d) => d.role === 'kick')!;
  const drop = map.sections.find((s) => s.name === 'drop')!;
  return {
    seed,
    chaos,
    family: map.patternFamily,
    bass: map.bassRole.character,
    kickHits: kick.hits.length,
    dropKickBeats: kick.hits
      .filter((h) => h.bar >= drop.startBar && h.bar < drop.startBar + 2)
      .map((h) => h.beat.toFixed(2))
      .join(','),
  };
}

const a = await one(17400, 0.25);
const b = await one(99112233, 0.45);
const different =
  a.family !== b.family || a.dropKickBeats !== b.dropKickBeats || a.bass !== b.bass;
console.log(JSON.stringify({ a, b, different }, null, 2));

const backend = new OfflineStubBackend();
async function renderSeed(seed: number, chaos: number) {
  const r = await backend.render({
    jobId: 'vary-' + seed,
    seed,
    bpm: 174,
    durationBars: 16,
    sampleRateHz: 44100,
    bitDepth: 16,
    prompt: { descriptors: ['dancefloor'], energy: 0.8, darkness: 0.5, chaos },
  } as any);
  return {
    family: r.structure.patternFamily,
    bass: r.structure.bassRole.character,
    kickBytes: r.stems.find((s: any) => s.id === 'kick')!.blob.size,
    mixBytes: r.stems.find((s: any) => s.id === 'mix')!.blob.size,
  };
}
const ra = await renderSeed(17400, 0.25);
const rb = await renderSeed(99112233, 0.45);
console.log(
  'renders',
  JSON.stringify({
    ra,
    rb,
    blobDiff: ra.kickBytes !== rb.kickBytes || ra.mixBytes !== rb.mixBytes,
  }),
);
if (!different) process.exit(1);
