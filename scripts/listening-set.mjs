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

/** `--target loud|balanced|dynamic` — local mastering loudness preset. */
const VALID_TARGETS = ['loud', 'balanced', 'dynamic'];
const targetArg = String(cliValue('--target') ?? '').toLowerCase();
const masterTarget = VALID_TARGETS.includes(targetArg) ? targetArg : 'balanced';
if (targetArg && !VALID_TARGETS.includes(targetArg)) {
  console.warn(`[listening] ignoring --target ${targetArg} (use loud|balanced|dynamic)`);
}

const { buildAceCaption, buildAceLyrics, buildAceTags } = await import(
  '../src/core/prompt/buildAceCaption.ts'
);
const { decodeWavChannels, encodeWav } = await import('../src/core/export/wav.ts');
const { analyzeMix, listeningReportCsv } = await import('../src/core/audio/listeningReport.ts');
const { masterStereo } = await import('../src/core/audio/master.ts');
const { MASTER_TARGET_LUFS } = await import('../src/core/types/index.ts');
const targetLufs = MASTER_TARGET_LUFS[masterTarget];

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
    // One take per prompt — the set is for listening, not best-of scoring.
    batchSize: 1,
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

/** XL-turbo + CPU offload can run long; give each render a hard 15 min cap. */
const RENDER_TIMEOUT_MS = 900_000;

async function renderOnce(payload) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), RENDER_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${bridge}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
  } catch (e) {
    const why = ctrl.signal.aborted
      ? `timed out after ${RENDER_TIMEOUT_MS / 1000}s`
      : e instanceof Error
        ? e.message
        : String(e);
    throw new Error(
      `bridge unreachable at ${bridge} (${why}). Start scripts/windows/start-ace-stack.ps1.`,
    );
  } finally {
    clearTimeout(timer);
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

/** One retry on any failure (transient bridge/GPU hiccup). */
async function renderWithRetry(payload) {
  try {
    return await renderOnce(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[listening] retrying once after: ${msg}`);
    return await renderOnce(payload);
  }
}

const date = new Date().toISOString().slice(0, 10);
const outDir = join(root, 'exports', 'listening', date);
await mkdir(outDir, { recursive: true });

const rows = [];
// Target only changes the filename when it is not the default (balanced).
const variantSuffix = `${sampler ? `_${sampler}` : ''}${masterTarget === 'balanced' ? '' : `_${masterTarget}`}`;
for (const prompt of prompts) {
  for (const seed of seeds) {
    const payload = payloadFor(prompt, seed);
    process.stdout.write(`[listening] ${prompt.name}${variantSuffix} seed ${seed} ... `);
    let data;
    try {
      data = await renderWithRetry(payload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`FAILED (${msg})`);
      rows.push({
        name: `${prompt.name}${variantSuffix}`,
        seed,
        durationSec: 0,
        integratedLufs: -Infinity,
        samplePeakDbFS: -Infinity,
        error: msg,
      });
      continue;
    }
    const rawBytes = Buffer.from(data.mixWavBase64, 'base64');
    const wavName = `${prompt.name}${variantSuffix}_${seed}.wav`;
    const ab = rawBytes.buffer.slice(rawBytes.byteOffset, rawBytes.byteOffset + rawBytes.byteLength);
    let wrote = false;
    try {
      const decoded = decodeWavChannels(ab);
      const left = decoded.channels[0] ?? new Float32Array(0);
      const right = decoded.channels[1] ?? left;
      // Master locally to the --target preset so the report matches Studio.
      const mastered = masterStereo(left, right, decoded.sampleRate, { targetLufs });
      const masteredWav = encodeWav(
        [mastered.left, mastered.right],
        decoded.sampleRate,
        decoded.bitDepth === 24 ? 24 : 16,
      );
      await writeFile(join(outDir, wavName), Buffer.from(await masteredWav.arrayBuffer()));
      wrote = true;
      const row = analyzeMix([mastered.left, mastered.right], decoded.sampleRate, {
        name: `${prompt.name}${variantSuffix}`,
        seed,
      });
      rows.push(row);
      console.log(
        `${row.durationSec.toFixed(1)}s · ${row.integratedLufs.toFixed(1)} LUFS (target ${targetLufs}) · ${row.samplePeakDbFS.toFixed(1)} dBFS`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`master skipped (${msg})`);
      // Fall back to the raw ACE WAV so the render is still on disk.
      if (!wrote) await writeFile(join(outDir, wavName), rawBytes);
      rows.push({
        name: `${prompt.name}${variantSuffix}`,
        seed,
        durationSec: 0,
        integratedLufs: -Infinity,
        samplePeakDbFS: -Infinity,
        error: `master skipped: ${msg}`,
      });
    }
  }
}

await writeFile(join(outDir, 'report.csv'), listeningReportCsv(rows));
console.log(`\n[listening] wrote ${rows.length} WAVs + report.csv to ${outDir}`);
