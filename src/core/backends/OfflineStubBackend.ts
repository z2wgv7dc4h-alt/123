/**
 * OfflineStubBackend — CPU OfflineAudioContext synth sketch.
 * StructureEngine owns the grid; this only renders AudioBuffers / WAV blobs.
 * Tone.js is NOT used as the synth engine.
 *
 * Honesty: stub ≠ ACE. Stems keep shared pre-mix scale (no per-stem peak-norm).
 * Mix gets soft-ceiling + glue; sample-peak metrics only (not inter-sample true-peak).
 */
import {
  DEFAULT_BIT_DEPTH,
  DEFAULT_BPM,
  DEFAULT_SAMPLE_RATE,
  type AudioBackend,
  type BackendCaps,
  type EnergyPoint,
  type HardwareProbe,
  type RenderJob,
  type RenderResult,
  type StemFile,
  type StemId,
  type StructureMap,
} from '../types';
import { structureEngine } from '../structure/StructureEngine';
import { encodeWav } from '../export/wav';
import { buildExportManifest } from '../export/manifest';
import { structureToMidiBlob } from '../midi/exportMidi';
import { computeWaveformPeaks } from '../audio/waveformPeaks';

const CAPS: BackendCaps = {
  fullSong: true,
  legoStems: false,
  extract: false,
  repaint: false,
  textureOneshots: false,
  maxDurationSec: 120,
  sampleRatesHz: [48000, 44100],
  loraLoad: false,
  requiresGpu: false,
};

/** Soft ceiling for master mix only (stems stay shared pre-mix scale). */
const MIX_SOFT_CEILING = 0.95;

function beatToSample(bar: number, beat: number, bpm: number, sr: number): number {
  const secPerBeat = 60 / bpm;
  return Math.round((bar * 4 + beat) * secPerBeat * sr);
}

function envGain(t: number, attack: number, decay: number): number {
  if (t < 0) return 0;
  if (t < attack) return t / attack;
  const d = (t - attack) / decay;
  return d >= 1 ? 0 : Math.exp(-4 * d);
}

function writeKick(buf: Float32Array, at: number, vel: number, sr: number) {
  // Punchy DnB kick: click transient + fast-sweep body + soft saturation (CPU cheap)
  const len = Math.floor(0.28 * sr);
  for (let i = 0; i < len && at + i < buf.length; i++) {
    const t = i / sr;
    const bodyFreq = 48 * Math.exp(-t * 22) + 28;
    const body = Math.sin(2 * Math.PI * bodyFreq * t);
    const click =
      Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t * 180) * 0.62 +
      Math.sin(2 * Math.PI * 4200 * t) * Math.exp(-t * 320) * 0.32;
    const g = envGain(t, 0.0012, 0.24) * vel;
    const raw = (body * 0.92 + click) * g;
    buf[at + i]! += Math.tanh(raw * 1.65) * 1.05;
  }
}

function writeSnare(buf: Float32Array, at: number, vel: number, sr: number) {
  const len = Math.floor(0.2 * sr);
  let n = 0x2f6e3651;
  let prev = 0;
  for (let i = 0; i < len && at + i < buf.length; i++) {
    const t = i / sr;
    n = (n * 1103515245 + 12345) >>> 0;
    const white = (n / 0xffffffff) * 2 - 1;
    const hp = white - prev;
    prev = white * 0.82;
    const body = Math.sin(2 * Math.PI * 195 * t) * Math.exp(-t * 28);
    const crack = hp * Math.exp(-t * 18);
    const g = envGain(t, 0.0008, 0.16) * vel;
    const raw = (body * 0.42 + crack * 0.78) * g;
    buf[at + i]! += Math.tanh(raw * 1.35) * 0.88;
  }
}

function writeHat(buf: Float32Array, at: number, vel: number, sr: number, open = false) {
  const len = Math.floor((open ? 0.12 : 0.045) * sr);
  let n = 1;
  let prev = 0;
  for (let i = 0; i < len && at + i < buf.length; i++) {
    const t = i / sr;
    n = (n * 1664525 + 1013904223) >>> 0;
    const noise = (n / 0xffffffff) * 2 - 1;
    const hp = noise - prev;
    prev = noise * 0.55;
    const g = envGain(t, 0.0004, open ? 0.1 : 0.032) * vel;
    buf[at + i]! += hp * g * 0.48;
  }
}

/** Short rim / clave — distinct from hats (perc role). */
function writePerc(buf: Float32Array, at: number, vel: number, sr: number) {
  const len = Math.floor(0.055 * sr);
  for (let i = 0; i < len && at + i < buf.length; i++) {
    const t = i / sr;
    const click = Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t * 90);
    const body = Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 55);
    const g = envGain(t, 0.0003, 0.045) * vel;
    buf[at + i]! += (click * 0.7 + body * 0.45) * g * 0.62; // audible clave, still under hats
  }
}

/**
 * Rock-DnB mid grit — short distorted pulse on kick hits in drop/build only.
 * Synthetic original (no catalog samples). Mixed into snare bus for mid presence.
 */
function writeRockMid(buf: Float32Array, at: number, vel: number, sr: number, amount = 0.35) {
  const len = Math.floor(0.09 * sr);
  for (let i = 0; i < len && at + i < buf.length; i++) {
    const t = i / sr;
    const phase = 2 * Math.PI * 520 * t;
    // Soft square-ish + octave for guitar-adjacent mid without cloning anyone
    const sq = Math.tanh(Math.sin(phase) * 3.2) + Math.sin(phase * 2.01) * 0.35;
    const g = envGain(t, 0.001, 0.07) * vel * amount;
    buf[at + i]! += sq * g * 0.22;
  }
}

/**
 * Generative guitar / lead texture into `other` stem — original synth, not a rip.
 * Rhythm guitar: mid distorted pulses on drop/build. Solo: longer lead tones.
 */
function writeGuitarChord(buf: Float32Array, at: number, vel: number, sr: number, amount: number) {
  const len = Math.floor(0.18 * sr);
  for (let i = 0; i < len && at + i < buf.length; i++) {
    const t = i / sr;
    const phase = 2 * Math.PI * 196 * t; // G3-ish
    const grit =
      Math.tanh(Math.sin(phase) * 4.5) * 0.55 +
      Math.tanh(Math.sin(phase * 1.5) * 3.2) * 0.35 +
      Math.sin(phase * 2.01) * 0.2;
    const g = envGain(t, 0.002, 0.14) * vel * amount;
    buf[at + i]! += grit * g * 0.28;
  }
}

function writeLeadSolo(buf: Float32Array, at: number, midi: number, durBeats: number, vel: number, bpm: number, sr: number) {
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const dur = (durBeats * 60) / bpm;
  const len = Math.floor(dur * sr);
  for (let i = 0; i < len && at + i < buf.length; i++) {
    const t = i / sr;
    const phase = 2 * Math.PI * freq * t;
    const vibr = 1 + 0.012 * Math.sin(2 * Math.PI * 5.5 * t);
    const wave =
      Math.tanh(Math.sin(phase * vibr) * 2.8) * 0.65 +
      Math.sin(phase * 2 * vibr) * 0.25 +
      Math.sin(phase * 3.01) * 0.12;
    const g = envGain(t, 0.01, Math.max(0.08, dur - 0.02)) * vel;
    buf[at + i]! += wave * g * 0.22;
  }
}

export function applyGuitarLayers(
  other: Float32Array,
  structure: StructureMap,
  sr: number,
  energy: number,
  layers: { guitar?: boolean; solo?: boolean },
) {
  if (!layers.guitar && !layers.solo) return;
  const amount = 0.35 + energy * 0.45;
  if (layers.guitar) {
    for (const plan of structure.drums) {
      if (plan.role !== 'kick') continue;
      for (const h of plan.hits) {
        const sec = structure.sections.find(
          (s) => h.bar >= s.startBar && h.bar < s.startBar + s.lengthBars,
        );
        if (!sec || (sec.name !== 'drop' && sec.name !== 'build')) continue;
        const at = beatToSample(h.bar, h.beat, structure.bpm, sr);
        writeGuitarChord(other, at, h.velocity, sr, amount);
      }
    }
  }
  if (layers.solo) {
    const root = 57; // A3
    for (const sec of structure.sections) {
      if (sec.name !== 'drop' && sec.name !== 'outro') continue;
      for (let bar = sec.startBar; bar < sec.startBar + sec.lengthBars; bar += 2) {
        const at = beatToSample(bar, 0, structure.bpm, sr);
        const midi = root + (bar % 4 === 0 ? 0 : bar % 4 === 2 ? 3 : 5);
        writeLeadSolo(other, at, midi, 1.5, 0.7 + energy * 0.25, structure.bpm, sr);
      }
    }
  }
}

/** Layer rock mid on kick hits during drop/build sections. */
export function applyRockMidGrit(
  snare: Float32Array,
  structure: StructureMap,
  sr: number,
  energy: number,
) {
  const amount = 0.22 + energy * 0.35;
  for (const plan of structure.drums) {
    if (plan.role !== 'kick') continue;
    for (const h of plan.hits) {
      const sec = structure.sections.find(
        (s) => h.bar >= s.startBar && h.bar < s.startBar + s.lengthBars,
      );
      if (!sec || (sec.name !== 'drop' && sec.name !== 'build')) continue;
      const at = beatToSample(h.bar, h.beat, structure.bpm, sr);
      writeRockMid(snare, at, h.velocity, sr, amount);
    }
  }
}

function writeBass(
  buf: Float32Array,
  at: number,
  midi: number,
  durBeats: number,
  vel: number,
  bpm: number,
  sr: number,
  character: 'sub' | 'reese' | 'growl',
  opts?: { wobble?: boolean },
) {
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const dur = (durBeats * 60) / bpm;
  const len = Math.floor(dur * sr);
  // Tempo-synced wobble: 1/4-note LFO at bpm (174 → ~2.9 Hz) — dancefloor, not toy
  const wobbleHz = (bpm / 60) * (character === 'growl' ? 2 : 1); // growl = 1/8 feel
  const wantWobble = opts?.wobble !== false && character !== 'sub';
  for (let i = 0; i < len && at + i < buf.length; i++) {
    const t = i / sr;
    const phase = 2 * Math.PI * freq * t;
    let s: number;
    if (character === 'sub') {
      s = Math.sin(phase) + Math.sin(phase * 2) * 0.12;
    } else if (character === 'reese') {
      const d1 = Math.sin(phase * 1.007);
      const d2 = Math.sin(phase * 0.993);
      const d3 = Math.sin(phase * 1.014);
      const lfo = wantWobble ? 0.5 + 0.5 * Math.sin(2 * Math.PI * wobbleHz * t) : 0.85;
      // Harmonic morph with LFO = filter-ish movement without GPL plugins
      const bright = 0.35 + 0.65 * lfo;
      const core =
        Math.sin(phase) * (0.7 - bright * 0.25) +
        (d1 + d2) * (0.28 + bright * 0.22) +
        d3 * (0.12 + bright * 0.2) +
        Math.sin(phase * 3.01) * bright * 0.18 +
        Math.sin(phase * 4.02) * bright * 0.08;
      s = Math.tanh(core * (1.4 + bright * 0.55));
      s *= 0.55 + 0.45 * lfo; // amp wobble
    } else {
      // growl: harder drive + faster wobble
      const lfo = wantWobble ? 0.45 + 0.55 * Math.sin(2 * Math.PI * wobbleHz * t) : 0.9;
      const drive = 2.2 + lfo * 1.4;
      s = Math.tanh(
        Math.sin(phase) * drive +
          Math.sin(phase * 2.03) * (0.4 + lfo * 0.35) +
          Math.sin(phase * 3.02) * (0.15 + lfo * 0.25) +
          Math.sin(phase * 5.01) * lfo * 0.12,
      );
      s *= 0.5 + 0.5 * lfo;
    }
    const g = envGain(t, 0.008, Math.max(0.05, dur - 0.015)) * vel;
    const body = character === 'sub' ? 0.52 : character === 'reese' ? 0.58 : 0.55;
    buf[at + i]! += s * g * body;
  }
}

/** Fat generative 808 — pitch glide + long sub body (trap-bounce flavor, still 174). */
function write808Bass(
  buf: Float32Array,
  at: number,
  midi: number,
  durBeats: number,
  vel: number,
  bpm: number,
  sr: number,
) {
  const startFreq = 440 * Math.pow(2, (midi - 69) / 12);
  const endFreq = Math.max(28, startFreq * 0.55); // downward glide
  const dur = Math.max(0.35, (durBeats * 60) / bpm);
  const len = Math.floor(dur * sr);
  let phase = 0;
  for (let i = 0; i < len && at + i < buf.length; i++) {
    const t = i / sr;
    const u = t / dur;
    const freq = startFreq * Math.pow(endFreq / startFreq, Math.min(1, u * 1.15));
    phase += (2 * Math.PI * freq) / sr;
    const body = Math.sin(phase);
    const click = Math.sin(2 * Math.PI * Math.min(180, startFreq * 3) * t) * Math.exp(-t * 40) * 0.2;
    const env = Math.exp(-t * (1.1 / Math.max(0.25, dur))) * (1 - Math.min(1, u * 0.15));
    const raw = (body * 0.92 + click) * env * vel;
    buf[at + i]! += Math.tanh(raw * 2.1) * 0.72;
  }
}

function peakAbs(chans: Float32Array[]): number {
  let peak = 0;
  for (const c of chans) {
    for (let i = 0; i < c.length; i++) peak = Math.max(peak, Math.abs(c[i]!));
  }
  return peak;
}

function applyGainInPlace(buf: Float32Array, g: number) {
  if (g === 1) return;
  for (let i = 0; i < buf.length; i++) buf[i]! *= g;
}

function peakNormalize(chans: Float32Array[], target = 0.92) {
  const peak = peakAbs(chans);
  if (peak < 1e-8) return;
  const g = target / peak;
  for (const c of chans) applyGainInPlace(c, g);
}

/** Sample peak in dBFS — NOT inter-sample true-peak (stub honesty). */
function samplePeakDb(chan: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < chan.length; i++) peak = Math.max(peak, Math.abs(chan[i]!));
  return peak < 1e-12 ? -120 : 20 * Math.log10(peak);
}

function rmsOf(buf: Float32Array): number {
  if (!buf.length) return 0;
  let s = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i]!;
    s += x * x;
  }
  return Math.sqrt(s / buf.length);
}

function monoToStereo(mono: Float32Array): [Float32Array, Float32Array] {
  return [mono.slice(), mono.slice()];
}

/** Micro-Haas stereo width — delay R by ~0.15–0.35 ms (hats/snare). */
function monoToStereoHaas(mono: Float32Array, sr: number, delayMs = 0.22): [Float32Array, Float32Array] {
  const delay = Math.max(1, Math.round((delayMs / 1000) * sr));
  const L = mono.slice();
  const R = new Float32Array(mono.length);
  for (let i = 0; i < mono.length; i++) {
    R[i] = i >= delay ? mono[i - delay]! * 0.98 : 0;
  }
  return [L, R];
}

function mixDown(stems: Record<string, Float32Array>, length: number): Float32Array {
  const out = new Float32Array(length);
  for (const key of Object.keys(stems)) {
    const s = stems[key]!;
    for (let i = 0; i < length; i++) out[i]! += s[i] ?? 0;
  }
  return out;
}

/** Interpolate StructureMap.energyCurve at fractional bar. */
export function sampleEnergyCurve(curve: EnergyPoint[], bar: number): number {
  if (!curve.length) return 0.7;
  if (bar <= curve[0]!.bar) return curve[0]!.level;
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1]!;
    const b = curve[i]!;
    if (bar <= b.bar) {
      const t = (bar - a.bar) / Math.max(1e-9, b.bar - a.bar);
      return a.level + (b.level - a.level) * t;
    }
  }
  return curve[curve.length - 1]!.level;
}

/**
 * Kick→bass sidechain duck ~2–4 dB, attack ~3–8 ms, release ~40–80 ms.
 * Envelope follows kick abs; applied after stems are written.
 */
export function sidechainDuckBass(
  bass: Float32Array,
  kick: Float32Array,
  sr: number,
  opts?: { duckDb?: number; attackMs?: number; releaseMs?: number },
) {
  const duckDb = opts?.duckDb ?? 3.2;
  const attackMs = opts?.attackMs ?? 5;
  const releaseMs = opts?.releaseMs ?? 55;
  const duckLin = Math.pow(10, -duckDb / 20);
  const atkCoef = Math.exp(-1 / Math.max(1, (attackMs / 1000) * sr));
  const relCoef = Math.exp(-1 / Math.max(1, (releaseMs / 1000) * sr));
  let env = 0;
  // Normalize kick follower so solid hits approach 1
  let kickPeak = 0;
  for (let i = 0; i < kick.length; i++) kickPeak = Math.max(kickPeak, Math.abs(kick[i]!));
  const invPeak = kickPeak > 1e-8 ? 1 / kickPeak : 1;
  for (let i = 0; i < bass.length; i++) {
    const k = Math.abs(kick[i]!) * invPeak;
    if (k > env) env = env * atkCoef + k * (1 - atkCoef);
    else env = env * relCoef + k * (1 - relCoef);
    const amount = Math.min(1, env * 1.15);
    const g = 1 - amount * (1 - duckLin);
    bass[i]! *= g;
  }
}

/**
 * Mix bus glue: harder peak compressor + soft clip for dancefloor crest ~10–12 dB.
 * Makeup toward RMS ≈ −12 dBFS (stub sketch — pyloudnorm later).
 */
export function applyMixBusGlue(
  mix: Float32Array,
  sr: number,
  opts?: { hot?: boolean },
) {
  const n = mix.length;
  if (!n) return;
  const hot = !!opts?.hot;

  // Pass 1: peak compressor — hotter for dubstep drops
  const thresh = Math.pow(10, (hot ? -22 : -20) / 20);
  const ratio = hot ? 5 : 4;
  const atkCoef = Math.exp(-1 / ((hot ? 0.002 : 0.003) * sr));
  const relCoef = Math.exp(-1 / ((hot ? 0.05 : 0.06) * sr));
  let env = 0;

  for (let i = 0; i < n; i++) {
    const x = mix[i]!;
    const a = Math.abs(x);
    if (a > env) env = env * atkCoef + a * (1 - atkCoef);
    else env = env * relCoef + a * (1 - relCoef);

    let y = x;
    if (env > thresh) {
      const over = env / thresh;
      const gr = Math.pow(over, 1 - 1 / ratio);
      y = x / gr;
    }
    // Mild saturation (keep headroom for makeup)
    mix[i] = Math.tanh(y * (hot ? 1.28 : 1.15));
  }

  // Pass 2: makeup to target RMS (~−10.5 hot / −11 normal), soft-limit peaks
  const targetRms = Math.pow(10, (hot ? -10.5 : -11) / 20);
  const curRms = rmsOf(mix);
  if (curRms > 1e-8) {
    applyGainInPlace(mix, Math.min(targetRms / curRms, hot ? 8 : 7));
  }
  for (let i = 0; i < n; i++) {
    const x = mix[i]!;
    const a = Math.abs(x);
    if (a > MIX_SOFT_CEILING) {
      // Soft knee into ceiling — preserves RMS better than full-buffer peakNormalize
      const s = Math.sign(x) || 1;
      mix[i] = s * (MIX_SOFT_CEILING + (1 - MIX_SOFT_CEILING) * Math.tanh((a - MIX_SOFT_CEILING) * 2));
      if (Math.abs(mix[i]!) > 0.99) mix[i] = s * 0.99;
    }
  }
}

/**
 * Drive per-bar automation gains from structure.energyCurve
 * so drop > intro/break (curve was previously ignored at render).
 */
export function applyEnergyCurveGains(
  buffers: { kick: Float32Array; snare: Float32Array; hats: Float32Array; bass: Float32Array; perc: Float32Array },
  structure: StructureMap,
) {
  const { kick, snare, hats, bass, perc } = buffers;
  const spb = structure.samplesPerBar;
  const total = kick.length;
  for (let bar = 0; bar < structure.bars; bar++) {
    const e = sampleEnergyCurve(structure.energyCurve, bar + 0.5);
    // Map curve level → bus gain; drop (~high) louder than intro/break
    const g = 0.28 + e * 0.88; // wider intro→drop contrast
    const hatMul = e < 0.5 ? 0.45 + e * 0.5 : 1 + (e - 0.5) * 0.4;
    const bassMul = e < 0.4 ? 0.32 + e * 0.9 : 1 + (e - 0.55) * 0.15;
    const start = bar * spb;
    const end = Math.min(total, start + spb);
    for (let i = start; i < end; i++) {
      kick[i]! *= g;
      snare[i]! *= g;
      hats[i]! *= g * hatMul;
      bass[i]! *= g * bassMul;
      perc[i]! *= g;
    }
  }
}

/**
 * Encode stem WAV. No per-stem peakNormalize to 0.9 — sharedGain keeps pre-mix scale.
 * Only mix may pass softCeiling for master normalize.
 */
async function bufferToStem(
  id: StemId,
  monoOrStereo: Float32Array | [Float32Array, Float32Array],
  sr: number,
  bitDepth: number,
  opts?: { sharedGain?: number; softCeiling?: number },
): Promise<StemFile> {
  let L: Float32Array;
  let R: Float32Array;
  if (Array.isArray(monoOrStereo)) {
    L = monoOrStereo[0].slice();
    R = monoOrStereo[1].slice();
  } else {
    [L, R] = monoToStereo(monoOrStereo);
  }
  const shared = opts?.sharedGain ?? 1;
  if (shared !== 1) {
    applyGainInPlace(L, shared);
    applyGainInPlace(R, shared);
  }
  if (opts?.softCeiling != null) {
    peakNormalize([L, R], opts.softCeiling);
  }
  // Soft-limit only near clip — full-buffer tanh was crushing dancefloor RMS
  for (let i = 0; i < L.length; i++) {
    const aL = Math.abs(L[i]!);
    if (aL > 0.9) L[i] = Math.sign(L[i]!) * Math.tanh(aL);
    const aR = Math.abs(R[i]!);
    if (aR > 0.9) R[i] = Math.sign(R[i]!) * Math.tanh(aR);
  }
  const blob = encodeWav([L, R], sr, bitDepth as 16 | 24);
  const url = URL.createObjectURL(blob);
  const peakDb = samplePeakDb(L);
  return {
    id,
    url,
    blob,
    channels: 2,
    sampleRateHz: sr,
    bitDepth,
    samplePeakDbFS: peakDb,
    peakMetric: 'sample-peak',
    // Legacy field name despite dBTP suffix — dual-written from the same sample-peak value.
    truePeakDbTP: peakDb,
    durationSec: L.length / sr,
  };
}

export class OfflineStubBackend implements AudioBackend {
  readonly id = 'offline-stub';
  readonly role = 'song' as const;
  readonly displayName = 'Browser sketch (CPU)';
  readonly capabilities = CAPS;
  private cancelled = new Set<string>();

  async probe(): Promise<HardwareProbe> {
    return {
      hasGpu: false,
      backend: this.id,
      notes: [
        'CPU OfflineAudioContext / Float32 sketch synth',
        'No GPU required — Phase 0 fallback',
        'Replace with AceStepBackend when CUDA weights available',
      ],
    };
  }

  async cancel(jobId: string): Promise<void> {
    this.cancelled.add(jobId);
  }

  async render(job: RenderJob): Promise<RenderResult> {
    const sr = job.sampleRateHz || DEFAULT_SAMPLE_RATE;
    const bitDepth = job.bitDepth || DEFAULT_BIT_DEPTH;
    const bars = job.durationBars || 32;
    const styleRef = job.styleReference;
    const styleIntensity = styleRef ? Math.min(1, Math.max(0, styleRef.intensity)) : 0;

    const bpm = DEFAULT_BPM;
    const energy =
      styleRef && styleIntensity > 0
        ? Math.min(
            1,
            Math.max(
              0,
              job.prompt.energy * (1 - styleIntensity * 0.5) + styleRef.energy * styleIntensity * 0.5,
            ),
          )
        : job.prompt.energy;
    const darkness = job.prompt.darkness;
    const chaos = job.prompt.chaos ?? 0.25;

    // P1: styleRef.intensity maps into arrangement density (original notes only)
    const breakDensity =
      0.4 +
      chaos * 0.4 +
      styleIntensity * 0.08 +
      (styleRef && styleIntensity > 0 ? styleRef.energy * styleIntensity * 0.12 : 0);
    const planChaos = Math.min(1, chaos + styleIntensity * (styleRef?.energy ?? 0) * 0.25);

    let structure: StructureMap =
      job.structureRef ??
      (await structureEngine.plan({
        seed: job.seed,
        bpm,
        bars,
        energy,
        breakDensity: Math.min(1, breakDensity),
        darkness:
          styleRef && styleIntensity > 0
            ? Math.min(1, Math.max(0, darkness * (1 - styleIntensity * 0.3) + (1 - styleRef.energy) * styleIntensity * 0.35))
            : darkness,
        chaos: planChaos,
        sampleRateHz: sr,
        songShape: job.songShape,
        sectionsOverride: job.sectionsOverride,
      }));

    if (Math.abs(structure.bpm - DEFAULT_BPM) > 2) {
      const lockedBpm = DEFAULT_BPM;
      const samplesPerBar = Math.round((60 / lockedBpm) * 4 * sr);
      structure = { ...structure, bpm: lockedBpm, samplesPerBar };
    }

    // Pattern-family stem balance nudge (audible Vary without style ref)
    const family = structure.patternFamily ?? 'amen';
    const familyStemBias =
      family === 'twoStep'
        ? { kick: 1.06, snare: 1.1, hats: 0.88, bass: 1.04, perc: 0.9 }
        : family === 'syncopated'
          ? { kick: 0.96, snare: 1.04, hats: 1.12, bass: 0.98, perc: 1.15 }
          : { kick: 1, snare: 1, hats: 1, bass: 1, perc: 1 };

    // Bass character nudge from style energy (high energy → growl/reese bias via darkness already in plan;
    // extra post-pass character swap for intensity)
    if (styleRef && styleIntensity > 0.35) {
      const bright = styleRef.brightness ?? styleRef.energy;
      const darkH = styleRef.darknessHint ?? 1 - bright;
      let character = structure.bassRole.character;
      if (darkH > 0.55 || styleRef.energy > 0.65) {
        character = darkH > 0.7 ? 'growl' : 'reese';
      }
      if (character !== structure.bassRole.character) {
        structure = {
          ...structure,
          bassRole: { ...structure.bassRole, character },
        };
      }
    }

    const totalSamples = structure.samplesPerBar * structure.bars;
    const kick = new Float32Array(totalSamples);
    const snare = new Float32Array(totalSamples);
    const hats = new Float32Array(totalSamples);
    const bass = new Float32Array(totalSamples);
    const perc = new Float32Array(totalSamples);

    for (const plan of structure.drums) {
      for (const h of plan.hits) {
        const at = beatToSample(h.bar, h.beat, structure.bpm, sr);
        if (plan.role === 'kick') writeKick(kick, at, h.velocity, sr);
        else if (plan.role === 'snare') writeSnare(snare, at, h.velocity, sr);
        else if (plan.role === 'hats') writeHat(hats, at, h.velocity, sr, Math.abs(h.beat % 1 - 0.5) < 0.02);
        else if (plan.role === 'perc') writePerc(perc, at, h.velocity, sr);
      }
    }

    const dubMode =
      job.songShape === 'dubstep' || job.songShape === 'half-time-drop';
    const trapMode = job.songShape === 'trap-bounce';
    // Dubstep: ensure wobble-capable character even without style ref
    if (dubMode && structure.bassRole.character === 'sub') {
      structure = {
        ...structure,
        bassRole: { ...structure.bassRole, character: energy > 0.6 ? 'growl' : 'reese' },
      };
    }
    if (trapMode) {
      structure = {
        ...structure,
        bassRole: { ...structure.bassRole, character: 'sub' },
      };
    }

    for (const n of structure.bassRole.notes) {
      const at = beatToSample(n.bar, n.beat, structure.bpm, sr);
      if (trapMode) {
        write808Bass(
          bass,
          at,
          n.midi,
          n.durationBeats,
          n.velocity ?? 0.85,
          structure.bpm,
          sr,
        );
      } else {
        writeBass(
          bass,
          at,
          n.midi,
          n.durationBeats,
          n.velocity ?? 0.8,
          structure.bpm,
          sr,
          structure.bassRole.character,
          { wobble: true },
        );
      }
    }

    // Rock-DnB mid grit on drop/build kicks (into snare bus — mid presence)
    applyRockMidGrit(snare, structure, sr, energy);

    const other = new Float32Array(totalSamples);
    const wantGuitar = !!(job.layers?.guitar || job.layers?.solo);
    if (wantGuitar) {
      applyGuitarLayers(other, structure, sr, energy, {
        guitar: job.layers?.guitar,
        solo: job.layers?.solo,
      });
    }
    // Extra drums: denser perc in drops
    if (job.layers?.extraDrums) {
      for (const plan of structure.drums) {
        if (plan.role !== 'perc') continue;
        for (const h of plan.hits) {
          const at = beatToSample(h.bar, (h.beat + 0.5) % 4, structure.bpm, sr);
          writePerc(perc, at, h.velocity * 0.7, sr);
        }
      }
    }

    // Style-reference timbre bias (OfflineStub sketch only — not a rip / not ACE)
    // brightness/darknessHint from Vibe Mirror when present — meaningful feel, not gain-only
    if (styleRef && styleIntensity > 0) {
      const bright = styleRef.brightness ?? styleRef.energy;
      const darkH = styleRef.darknessHint ?? 1 - bright;
      const kickPunch = 1 + styleIntensity * (0.15 + styleRef.energy * 0.25);
      const snareCrack = 1 + styleIntensity * (0.08 + bright * 0.28 + styleRef.energy * 0.1);
      const hatAir = 1 + styleIntensity * (bright * 0.32 - (1 - bright) * 0.08);
      const bassWeight = 1 + styleIntensity * (0.1 + darkH * 0.18);
      for (let i = 0; i < totalSamples; i++) {
        kick[i]! *= kickPunch;
        snare[i]! *= snareCrack;
        hats[i]! *= hatAir;
        bass[i]! *= bassWeight;
        perc[i]! *= 1 + styleIntensity * (0.08 + bright * 0.12);
      }
      // Hot / bright refs → more mid grit; dark refs → thicker bass fold
      if (styleRef.energy > 0.55 || bright > 0.55) {
        const drive = 1 + styleIntensity * (0.25 + bright * 0.2);
        for (let i = 0; i < totalSamples; i++) {
          bass[i] = Math.tanh(bass[i]! * (drive + darkH * 0.15));
          kick[i] = Math.tanh(kick[i]! * (1 + styleIntensity * 0.15));
          snare[i] = Math.tanh(snare[i]! * (1 + styleIntensity * bright * 0.2));
        }
      }
    }

    // Pattern-family balance before energy curve / glue
    const trapHat = trapMode ? 1.18 : 1;
    const trapBass = trapMode ? 1.12 : 1;
    const trapKick = trapMode ? 1.04 : 1;
    for (let i = 0; i < totalSamples; i++) {
      kick[i]! *= familyStemBias.kick * trapKick;
      snare[i]! *= familyStemBias.snare;
      hats[i]! *= familyStemBias.hats * trapHat;
      bass[i]! *= familyStemBias.bass * trapBass;
      perc[i]! *= familyStemBias.perc;
    }

    // P0: drive section/automation from energyCurve (drop > intro/break)
    applyEnergyCurveGains({ kick, snare, hats, bass, perc }, structure);

    // P0: kick→bass sidechain for mix only (keep bass stem dry)
    const bassForMix = bass.slice();
    sidechainDuckBass(bassForMix, kick, sr, {
      duckDb: (dubMode || trapMode ? 3.2 : 2.4) + energy * (dubMode || trapMode ? 2.6 : 2.2),
      attackMs: 3 + (1 - energy) * 5,
      releaseMs: (dubMode || trapMode ? 55 : 40) + (1 - energy) * 40,
    });

    if (this.cancelled.has(job.jobId)) {
      this.cancelled.delete(job.jobId);
      throw new Error(`Job ${job.jobId} cancelled`);
    }

    // Dry mix at shared pre-mix scale (elementals + perc) — no per-stem normalize
    const dryMix = mixDown(
      wantGuitar ? { kick, snare, hats, bass, perc, other } : { kick, snare, hats, bass, perc },
      totalSamples,
    );

    // Shared bus gain: only attenuate if dry sum would clip; keep relative stem levels
    const dryPeak = peakAbs([dryMix]);
    const sharedGain = dryPeak > 1.0 ? 0.99 / dryPeak : 1;

    const kickOut = kick.slice();
    const snareOut = snare.slice();
    const hatsOut = hats.slice();
    const bassOut = bass.slice();
    const percOut = perc.slice();
    const otherOut = other.slice();
    applyGainInPlace(kickOut, sharedGain);
    applyGainInPlace(snareOut, sharedGain);
    applyGainInPlace(hatsOut, sharedGain);
    applyGainInPlace(bassOut, sharedGain);
    applyGainInPlace(percOut, sharedGain);
    if (wantGuitar) applyGainInPlace(otherOut, sharedGain);

    const mix = mixDown(
      wantGuitar
        ? { kick: kickOut, snare: snareOut, hats: hatsOut, bass: bassOut, perc: percOut, other: otherOut }
        : { kick: kickOut, snare: snareOut, hats: hatsOut, bass: bassOut, perc: percOut },
      totalSamples,
    );
    // P0: mix bus glue + soft ceiling (master only)
    applyMixBusGlue(mix, sr, { hot: dubMode || trapMode || energy > 0.72 });

    const drumsBus = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      drumsBus[i] = (kickOut[i]! + snareOut[i]! + hatsOut[i]! + percOut[i]!) * 0.85;
    }

    // A3: export perc WAV only when perc role has hits (role always exists; empty → no silent WAV).
    const percHits = structure.drums.find((d) => d.role === 'perc')?.hits.length ?? 0;
    const structureHasPerc = percHits > 0;
    const defaultStemIds: StemId[] = structureHasPerc
      ? (wantGuitar
          ? ['kick', 'snare', 'hats', 'bass', 'perc', 'other', 'mix', 'drums']
          : ['kick', 'snare', 'hats', 'bass', 'perc', 'mix', 'drums'])
      : (wantGuitar
          ? ['kick', 'snare', 'hats', 'bass', 'other', 'mix', 'drums']
          : ['kick', 'snare', 'hats', 'bass', 'mix', 'drums']);
    const wanted = new Set<StemId>(
      job.regenStems?.length ? [...job.regenStems, 'mix'] : defaultStemIds,
    );

    // Stereo: kick+bass mono; hats/snare micro-Haas; perc slight Haas
    const stereoMap: Partial<Record<StemId, Float32Array | [Float32Array, Float32Array]>> = {
      kick: kickOut,
      bass: bassOut,
      snare: monoToStereoHaas(snareOut, sr, 0.18),
      hats: monoToStereoHaas(hatsOut, sr, 0.28),
      drums: drumsBus,
      mix,
    };
    if (structureHasPerc) {
      stereoMap.perc = monoToStereoHaas(percOut, sr, 0.22);
    }
    if (wantGuitar) {
      stereoMap.other = monoToStereoHaas(otherOut, sr, 0.35);
    }

    const stemOrder: StemId[] = ['kick', 'snare', 'hats', 'bass', 'perc', 'other', 'drums', 'mix'];
    const stems: StemFile[] = [];
    for (const id of stemOrder) {
      if (!wanted.has(id) && id !== 'mix') continue;
      const src = stereoMap[id];
      if (!src) continue;
      stems.push(
        await bufferToStem(id, src, sr, bitDepth, {
          // Stems keep sharedGain; mix already glued+limited — no second peakNormalize
          softCeiling: undefined,
        }),
      );
    }

    const midiBlob = structureToMidiBlob(structure);
    const warnings: string[] = [];
    if (Math.abs(structure.bpm - DEFAULT_BPM) > 0.01) {
      warnings.push(`BPM locked to structure ${structure.bpm} (target ${DEFAULT_BPM} ±2)`);
    }
    warnings.push(
      'Browser-sketch quality — not production timbre (Studio GPU pending); sketch ≠ Studio',
    );
    warnings.push(
      'Peak meters are sample-peak dBFS (not inter-sample true-peak)',
    );
    if (styleRef && styleIntensity > 0) {
      const bpmNote =
        styleRef.estimatedBpm != null ? ` · ref ~${styleRef.estimatedBpm} BPM` : '';
      warnings.push(
        `Style reference (your file: ${styleRef.fileName}) biased tempo/energy/timbre${bpmNote} — original browser-sketch stems, not Studio and not a clone of the upload`,
      );
    }

    const schemaNotes: string[] = [
      'drums bus = 0.85 * (kick + snare + hats + perc); not equal to summing exported elementals alone',
    ];
    if (structureHasPerc) {
      schemaNotes.push(
        'perc StemId + perc.wav exported only when perc hits > 0 (no silent perc WAV; OfflineStub sketch — not Studio/ACE)',
      );
    } else {
      schemaNotes.push('no perc hits in structure — perc WAV omitted');
    }
    if (wantGuitar) {
      const bits: string[] = [];
      if (job.layers?.guitar) bits.push('guitar');
      if (job.layers?.solo) bits.push('solo');
      warnings.push(
        `Layers (${bits.join('+')}): original OfflineStub synth textures (synth/lego vibe-only) — not ACE extract, not catalog/artist stems`,
      );
      schemaNotes.push(
        'other stem = generative guitar/solo sketch textures when layers on (synth/lego vibe-only); not ACE lego extract / not isolated Studio guitar',
      );
    }

    const manifest = buildExportManifest({
      job,
      structure,
      stems,
      backendId: this.id,
      checkpointId: 'offline-stub-v0',
      bpmMeasured: structure.bpm,
      gpuUsed: false,
      acePathActive: false,
      notes: schemaNotes,
    });

    const waveformPeaks = computeWaveformPeaks(mix, 160);

    return {
      jobId: job.jobId,
      seed: job.seed,
      bpmMeasured: structure.bpm,
      stems,
      mixdownPreviewWav: stems.find((s) => s.id === 'mix')?.url,
      waveformPeaks,
      warnings,
      backendId: this.id,
      checkpointId: 'offline-stub-v0',
      structure,
      midiBlob,
      manifest,
    };
  }
}

export const offlineStubBackend = new OfflineStubBackend();
