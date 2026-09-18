/**
 * Listening set — run by the USER against a live ACE stack (never agents):
 *
 *   npm run listen:set                    # needs `tsx` available
 *   npm run listen:set -- --sampler sde   # A/B the diffusion sampler
 *
 * 5 fixed prompts x 2 seeds -> POST bridge /render with the same payload
 * shape the app sends, write WAVs to exports/listening/<date>/ and a
 * report.csv (duration, integrated LUFS, sample peak). No UI, no stems.
 *
 * Start the stack first: scripts/windows/start-ace-stack.ps1
 * Override the bridge with ACE_BRIDGE_URL (default http://127.0.0.1:8766).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bridge = process.env.ACE_BRIDGE_URL ?? 'http://127.0.0.1:8766';
const seeds = [17400, 90210];
const sampleRateHz = 48000;
const durationBars = 64;

/** `--sampler ode|sde` — forwarded to the bridge as ACE infer_method. */
const VALID_SAMPLERS = ['ode', 'sde'];
function cliValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const samplerArg = String(cliValue('--sampler') ?? '').toLowerCase();
const sampler = VALID_SAMPLERS.includes(samplerArg) ? samplerArg : undefined;
if (samplerArg && !sampler) {
  console.warn(`[listening] ignoring --sampler ${samplerArg} (use ode|sde)`);
}

const { buildAceCaption, buildAceLyrics, buildAceTags } = await import(
  '../src/core/prompt/buildAceCaption.ts'
);
const { decodeWavChannels } = await import('../src/core/export/wav.ts');
const { analyzeMix, listeningReportCsv } = await import('../src/core/audio/listeningReport.ts');

/** Typical 64-bar arrangement so ACE's timeline tags land on real sections. */
const sections = [
  { name: 'intro', startBar: 0, lengthBars: 8 },
  { name: 'build', startBar: 8, lengthBars: 8 },
  { name: 'drop', startBar: 16, lengthBars: 16 },
  { name: 'break', startBar: 32, lengthBars: 8 },
  { name: 'drop', startBar: 40, lengthBars: 16 },
  { name: 'outro', startBar: 56, lengthBars: 8 },
];

const prompts = [
  {
    name: 'dnb-festival',
    genre: 'dnb',
    bpm: 174,
    energy: 0.9,
    darkness: 0.4,
    chaos: 0.25,
    text: 'energetic festival drum and bass, big build, epic drop',
  },
  {
    name: 'neuro',
    genre: 'dnb',
    bpm: 174,
    energy: 0.8,
    darkness: 0.9,
    chaos: 0.5,
    text: 'dark neurofunk drum and bass, growling reese bass, technical',
  },
  {
    name: 'dubstep-140',
    genre: 'dubstep',
    bpm: 140,
    energy: 0.85,
    darkness: 0.7,
    chaos: 0.35,
    text: 'heavy dubstep, wobble growl bass, half-time drop',
  },
  {
    name: 'trap-140',
    genre: 'trap',
    bpm: 140,
    energy: 0.8,
    darkness: 0.6,
    chaos: 0.3,
    text: 'dark trap, 808 glides, rolling hi-hats',
  },
  {
    name: 'jungle-165',
    genre: 'jungle',
    bpm: 165,
    energy: 0.85,
    darkness: 0.5,
    chaos: 0.7,
    text: 'classic jungle, chopped amen breaks, deep sub bass',
  },
];

function payloadFor(prompt, seed) {
  const caption = buildAceCaption({
    energy: prompt.energy,
    darkness: prompt.darkness,
    chaos: prompt.chaos,
    genre: prompt.genre,
    userText: prompt.text,
    sections: sections.map((s) => s.name),
    seed,
  });
  return {
    jobId: `listen-${prompt.name}-${seed}`,
    seed,
    bpm: prompt.bpm,
    bpmTolerance: 2,
    durationBars,
    sampleRateHz,
    bitDepth: 16,
    channels: 2,
    // LM plans the track; the bridge keeps caption/CoT locked off.
    thinking: true,
    guidanceScale: 7,
    shift: 3,
    lyrics: buildAceLyrics(sections.map((s) => s.name)),
    prompt: {
      text: caption,
      tags: buildAceTags({
        energy: prompt.energy,
        darkness: prompt.darkness,
        chaos: prompt.chaos,
        seed,
      }),
      energy: prompt.energy,
      darkness: prompt.darkness,
    },
    structureRef: {
      version: 'hard-grid-v0',
      bpm: prompt.bpm,
      bars: durationBars,
      samplesPerBar: Math.round((240 / prompt.bpm) * sampleRateHz),
      sections,
    },
    stemSchemaVersion: 'v0',
    // Sampler A/B flag (bridge maps it to ACE infer_method).
    ...(sampler ? { sampler } : {}),
  };
}

async function renderOnce(payload) {
  let res;
  try {
    res = await fetch(`${bridge}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw new Error(
      `bridge unreachable at ${bridge} (${e instanceof Error ? e.message : e}). Start scripts/windows/start-ace-stack.ps1.`,
    );
  }
  if (res.status === 503) {
    throw new Error('ACE GPU path offline (bridge 503) — start the ACE stack first.');
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`bridge /render HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  if (!data.mixWavBase64) throw new Error('bridge returned no mixWavBase64');
  return data;
}

const date = new Date().toISOString().slice(0, 10);
const outDir = join(root, 'exports', 'listening', date);
await mkdir(outDir, { recursive: true });

const rows = [];
const samplerSuffix = sampler ? `_${sampler}` : '';
for (const prompt of prompts) {
  for (const seed of seeds) {
    const payload = payloadFor(prompt, seed);
    process.stdout.write(`[listening] ${prompt.name}${samplerSuffix} seed ${seed} ... `);
    const data = await renderOnce(payload);
    const bytes = Buffer.from(data.mixWavBase64, 'base64');
    const wavName = `${prompt.name}${samplerSuffix}_${seed}.wav`;
    await writeFile(join(outDir, wavName), bytes);

    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    try {
      const decoded = decodeWavChannels(ab);
      const row = analyzeMix(decoded.channels, decoded.sampleRate, {
        name: `${prompt.name}${samplerSuffix}`,
        seed,
      });
      rows.push(row);
      console.log(
        `${row.durationSec.toFixed(1)}s · ${row.integratedLufs.toFixed(1)} LUFS · ${row.samplePeakDbFS.toFixed(1)} dBFS`,
      );
    } catch (e) {
      console.log(`wrote ${wavName} (report skipped: ${e instanceof Error ? e.message : e})`);
      rows.push({
        name: `${prompt.name}${samplerSuffix}`,
        seed,
        durationSec: 0,
        integratedLufs: -Infinity,
        samplePeakDbFS: -Infinity,
      });
    }
  }
}

await writeFile(join(outDir, 'report.csv'), listeningReportCsv(rows));
console.log(`\n[listening] wrote ${rows.length} WAVs + report.csv to ${outDir}`);
