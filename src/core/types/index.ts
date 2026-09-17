/** Phase 0+ shared contracts — structure owns the hard grid at the job's BPM; backends render audio only. */

export type DrumRole = 'kick' | 'snare' | 'hats' | 'break' | 'perc';
export type SectionName = 'intro' | 'build' | 'drop' | 'break' | 'breakdown' | 'outro';
export type SongShapeId = 'classic' | 'long-intro' | 'breakdown' | 'double-drop' | 'dubstep' | 'half-time-drop' | 'trap-bounce';
export type SnapPolicy = 'hard';
export type BackendRole = 'song' | 'texture';

export interface StylePrompt {
  /** Non-IP genre descriptors only — never artist/band/track names. */
  descriptors: string[];
  energy: number; // 0..1
  darkness: number; // 0..1
  chaos?: number; // 0..1 optional Power Mode
  text?: string;
}

export interface EnergyPoint {
  bar: number;
  level: number; // 0..1
}

export interface DrumHit {
  bar: number;
  beat: number; // 0..4 in 4/4
  velocity: number; // 0..1
  role: DrumRole;
}

export interface DrumRolePlan {
  role: DrumRole;
  hits: Array<{ bar: number; beat: number; velocity: number }>;
}

export interface BassNote {
  bar: number;
  beat: number;
  midi: number;
  durationBeats: number;
  velocity?: number;
}

export interface BassRolePlan {
  notes: BassNote[];
  character: 'sub' | 'reese' | 'growl';
}

export interface Section {
  name: SectionName;
  startBar: number;
  lengthBars: number;
  fillHint?: boolean;
}

export interface StructureInput {
  seed: number;
  bpm: number;
  bars: number;
  energy: number;
  breakDensity: number;
  darkness?: number;
  chaos?: number;
  keyRoot?: string;
  sampleRateHz?: number;
  /** Arrangement preset from Song shape picker. */
  songShape?: SongShapeId;
  /** User-edited section lengths (expand/repeat) — drums/bass re-planned to match. */
  sectionsOverride?: Section[];
}

export interface StructureMap {
  version: 'hard-grid-v0';
  bpm: number;
  bars: number;
  ppq: number; // pulses per quarter — 480
  samplesPerBar: number;
  snapPolicy: SnapPolicy;
  sampleRateHz: number;
  sections: Section[];
  drumRole: DrumRolePlan;
  /** All drum roles planned (kick/snare/hats/perc). */
  drums: DrumRolePlan[];
  bassRole: BassRolePlan;
  energyCurve: EnergyPoint[];
  keyRoot: string;
  seed: number;
  /** OfflineStub / hard-grid drum grammar — amen | twoStep | syncopated. */
  patternFamily?: 'amen' | 'twoStep' | 'syncopated';
}

export interface StructureEngine {
  id: string;
  plan(input: StructureInput): Promise<StructureMap>;
}

/** Alias matching brief naming. */
export type IStructureEngine = StructureEngine;

export interface BackendCaps {
  fullSong: boolean;
  legoStems: boolean;
  extract: boolean;
  repaint: boolean;
  textureOneshots: boolean;
  maxDurationSec: number;
  sampleRatesHz: number[];
  loraLoad: boolean;
  requiresGpu: boolean;
}

export interface HardwareProbe {
  hasGpu: boolean;
  vramGb?: number;
  backend: string;
  notes: string[];
  /** DiT checkpoint the GPU server reports as loaded (e.g. acestep-v15-base). */
  checkpoint?: string;
}

export interface LoRAPackRef {
  packId: string;
  scale?: number;
}

export interface ProvenanceGate {
  ownerAttestation: boolean;
  corpusPaths: string[];
  excludedArtistNames: string[];
  licenseScanOk: boolean;
  minClips: number;
  memorizationReview: 'pending' | 'passed';
  baseCheckpoint: string;
  adapterTarget: 'dit_attention';
}

export interface LoRAPack {
  packId: string;
  name: string;
  baseModel: string;
  adapterPath: string;
  scale: number;
  triggerTags: string[];
  provenance: ProvenanceGate;
  createdAt: string;
  digests: { adapterSha256: string; corpusManifestSha256: string };
  status: 'stub' | 'ready' | 'training' | 'failed';
}

export interface RenderJob {
  /** Arrangement preset (intro length, breakdown, etc.). */
  songShape?: SongShapeId;
  /** Genre for captions (ACE) — tempo is job.bpm. Absent = dnb. */
  genre?: GenreId;
  /** Section-focused caption (Redo / arrangement blocks). Absent = whole-song caption. */
  sectionRole?: SectionRole;
  /** Expanded/repeated sections from interactive timeline. */
  sectionsOverride?: Section[];
  jobId: string;
  seed: number;
  bpm: number;
  bpmTolerance: number;
  durationBars: number;
  sampleRateHz: 48000;
  bitDepth: 16 | 24;
  channels: 2;
  prompt: StylePrompt;
  structureRef?: StructureMap;
  lora?: LoRAPackRef[];
  stemSchemaVersion: 'v0';
  /** Which stems to regenerate (Power Mode). Empty = all. */
  regenStems?: StemId[];
  /** Simple Mode texture layers — generative only, never artist-clone. */
  layers?: {
    guitar?: boolean;
    solo?: boolean;
    vocalish?: boolean;
    extraDrums?: boolean;
    /**
     * Real breakbeat loop under drop bars (Sketch only, amen/twoStep
     * families). Defaults ON — `false` disables it. Unlike the other
     * layers this is opt-OUT, because it already shipped as always-on.
     */
    realBreak?: boolean;
  };
  /** Optional user-owned style reference bias (browser upload only). */
  styleReference?: {
    /**
     * The user's actual audio. Present = Studio can do real audio2audio
     * (ACE `cover`) instead of reducing the reference to scalar knobs.
     */
    file?: Blob;
    intensity: number;
    estimatedBpm: number | null;
    energy: number;
    fileName: string;
    ownerAttested: boolean;
    /**
     * Optional audio2audio (cover) strength override, clamped to ACE's
     * validated 0.35-0.7 window. Absent = backends default.
     */
    coverStrength?: number;
    /** Fingerprint hash for manifest provenance (no raw audio). */
    hash?: string;
    /** High-frequency proxy from Vibe Mirror (0..1). */
    brightness?: number;
    /** Darkness hint from Vibe Mirror (0..1). */
    darknessHint?: number;
  };
  /** Edit an existing take instead of generating from scratch (ACE repaint; end past source = extend). */
  edit?: {
    kind: 'repaint';
    source: Blob;
    startSec: number;
    endSec: number;
  };
}

export type StemId = 'kick' | 'snare' | 'hats' | 'perc' | 'bass' | 'mix' | 'drums' | 'other';

/** Which peak measurement a peak field actually holds — see P0.1 peak honesty. */
export type PeakMetricKind = 'sample-peak' | 'true-peak';

export interface StemFile {
  id: StemId;
  /** Blob URL or data URL for browser; path for sidecar. */
  url: string;
  blob?: Blob;
  channels: 1 | 2;
  sampleRateHz: number;
  bitDepth: number;
  /** Honest name: max absolute sample value in dBFS (no inter-sample/oversampled true-peak yet). */
  samplePeakDbFS?: number;
  /** Which metric samplePeakDbFS/truePeakDbTP actually are. OfflineStub always 'sample-peak'. */
  peakMetric?: PeakMetricKind;
  /**
   * @deprecated Legacy field name despite dBTP suffix — currently dual-written from the same
   * sample-peak measurement as `samplePeakDbFS`, NOT a real inter-sample true-peak. Kept for
   * backward compatibility with existing consumers; prefer `samplePeakDbFS` + `peakMetric`.
   */
  truePeakDbTP?: number;
  durationSec: number;
}

/**
 * Honest snapshot of the ACE payload Studio actually sent — recorded by
 * AceStepBackend so Status chrome can report reality, not a stale claim.
 */
export interface AcePayloadSnapshot {
  thinking: boolean;
  captionFamily: string;
  steps: number;
  model: string;
}

export interface RenderResult {
  jobId: string;
  seed: number;
  bpmMeasured: number;
  stems: StemFile[];
  mixdownPreviewWav?: string;
  /** Normalized absolute peaks (0..1) for post-generate waveform UI. */
  waveformPeaks?: number[];
  warnings: string[];
  backendId: string;
  checkpointId: string;
  /** Present on Studio ACE renders — what was actually posted. */
  acePayload?: AcePayloadSnapshot;
  structure?: StructureMap;
  midiBlob?: Blob;
  manifest: ExportManifest;
}

/**
 * Honesty record for real (not synthesized) audio blended into a Sketch
 * mix. If this is present, the render is NOT 100% generative.
 */
export interface RealBreakLoopProvenance {
  used: true;
  /** Asset stem name under src/assets/samples/breaks/. */
  loopName: string;
  /** Pattern family that triggered it (amen | twoStep). */
  patternFamily: string;
  /** Blend gain applied under the synthesized kit. */
  gain: number;
  note: string;
}

export interface ExportManifest {
  schemaVersion: 'stem-v0';
  jobId: string;
  seed: number;
  bpmTarget: number;
  bpmMeasured: number;
  sampleRateHz: number;
  bitDepth: number;
  backendId: string;
  checkpointId: string;
  structureVersion: string;
  prompt: { text: string; tags: string[]; energy: number; darkness: number };
  /** Arrangement preset used for this render — live preview duck-shape needs it to match export. */
  songShape?: SongShapeId;
  loraPackIds: string[];
  stems: Array<{
    id: string;
    path: string;
    channels: number;
    /** Honest name: max absolute sample value in dBFS. See `StemFile.samplePeakDbFS`. */
    samplePeakDbFS?: number;
    /** Which metric the peak fields actually are. OfflineStub always 'sample-peak'. */
    peakMetric?: PeakMetricKind;
    /** @deprecated Dual-written from the same sample-peak value; not a real true-peak. */
    truePeakDbTP?: number;
  }>;
  createdAt: string;
  snapPolicy: SnapPolicy;
  ppq: number;
  samplesPerBar: number;
  gpuUsed: boolean;
  /** Retail honesty: sketch = CPU OfflineStub; studio = GPU path only when gpuUsed. */
  productTier: ProductTier;
  /** Present when a user-owned style reference biased generation. */
  styleReference?: StyleReferenceProvenance;
  /**
   * Present when a real pre-recorded breakbeat loop was blended into the
   * mix (Sketch only). Absent means the render is fully synthesized —
   * the same honesty contract `styleReference` and the perc stem follow.
   */
  realBreakLoop?: RealBreakLoopProvenance;
  /**
   * Optional honesty notes (stem-v0 additive).
   * e.g. drums bus formula; perc elemental export when structure plans perc.
   */
  notes?: string[];
}

export interface AudioBackend {
  id: string;
  role: BackendRole;
  displayName: string;
  capabilities: BackendCaps;
  probe(): Promise<HardwareProbe>;
  render(job: RenderJob): Promise<RenderResult>;
  cancel(jobId: string): Promise<void>;
}

export type IAudioBackend = AudioBackend;

export interface MixerState {
  mute: Record<StemId, boolean>;
  solo: Record<StemId, boolean>;
  gainDb: Record<StemId, number>;
}

/** Retail product path — Sketch = CPU/browser now; Studio = GPU/ACE when live. */
export type ProductTier = 'sketch' | 'studio';

/** Default tempo only — not a lock. 174 DnB, 140 dubstep, etc. */
export const DEFAULT_BPM = 174;
export const BPM_MIN = 70;
export const BPM_MAX = 200;
export function clampProductBpm(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_BPM;
  return Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(n)));
}
export type GenreId = 'dnb' | 'dubstep' | 'halftime' | 'jungle' | 'trap';
export const GENRES: Record<GenreId, { label: string; defaultBpm: number }> = {
  dnb: { label: 'Drum & bass', defaultBpm: 174 },
  dubstep: { label: 'Dubstep', defaultBpm: 140 },
  halftime: { label: 'Half-time', defaultBpm: 170 },
  jungle: { label: 'Jungle', defaultBpm: 165 },
  trap: { label: 'Trap', defaultBpm: 140 },
};
/** What a section is for — drives caption words on render and on Redo. */
export type SectionRole = 'intro' | 'build' | 'drop' | 'breakdown' | 'outro' | 'switch';
/** 96 bars ≈ 2:12 at 174 / 2:44 at 140 — ACE examples run 140–240 s. */
export const DEFAULT_BARS = 96;
export const DEFAULT_PPQ = 480;
export const DEFAULT_SAMPLE_RATE = 48000 as const;
export const DEFAULT_BIT_DEPTH = 16 as const; // OfflineAudioContext render; Sketch export may re-encode 24 via encodeWav
/** Empty: artist names allowed as style descriptors (the user 2026-09-14). */
export const ARTIST_NAME_BLOCKLIST = [] as const;

// "distorted supersaw leads" (trance/EDM-coded, not DnB-idiomatic) and
// "gated pads" (vague filler) removed 2026-09-15 — genre dilution traced in
// the raw ACE model log: the caption's own "thinking" expansion drifted
// toward "fuses elements of trance and drum and bass" with the old wording.
// "distorted guitar riffs" / "rock-dnb crossover" removed 2026-09-16: the
// starter text put guitar in every Studio caption with the guitar layer off.
// "half-time break" removed: shape words come from the selected song shape.
export const DEFAULT_DESCRIPTORS = [
  'energetic dancefloor drum and bass',
  'rolling reese bass',
  'tight punchy drums',
  'heavy sub bass',
  '174 bpm',
  'rolling breakbeats',
] as const;

/** User-owned style reference — browser File API only; never external rips. */
export interface StyleReferenceAnalysis {
  durationSec: number;
  estimatedBpm: number | null;
  /** Rough loudness / energy proxy 0..1 from RMS. */
  energy: number;
  /** Peak absolute sample 0..1. */
  peak: number;
  sampleRateHz: number;
  channels: number;
}

/**
 * In-memory style reference kept for future ACE cover/repaint when sidecar/GPU exists.
 * Blob / ArrayBuffer live only in the browser session — never uploaded to a catalog.
 */
export interface StyleReference {
  fileName: string;
  mimeType: string;
  byteLength: number;
  /** Original file bytes kept for future ACE path. */
  arrayBuffer: ArrayBuffer;
  blob: Blob;
  analysis: StyleReferenceAnalysis;
  /** How strongly generation should bias toward the reference (0..1). */
  intensity: number;
  /** ISO timestamp when the user attached the file. */
  attachedAt: string;
  /** Owner attestation checkbox — user confirms they own the file. */
  ownerAttested: boolean;
}

/** Honest provenance for exports — OfflineStub must never claim ACE stems from a reference. */
export interface StyleReferenceProvenance {
  used: boolean;
  source: 'user-upload';
  /** Stable fingerprint of the user file (not raw audio). */
  hash?: string;
  /** Always true for browser File/drag-drop path. */
  userOwned: true;
  fileName?: string;
  estimatedBpm?: number | null;
  energy?: number;
  durationSec?: number;
  intensity?: number;
  ownerAttested?: boolean;
  /**
   * True only when ACE-Step sidecar actually consumed the reference.
   * OfflineStub always leaves this false.
   */
  acePathActive: boolean;
  note: string;
}

/**
 * Vibe Mirror v0 — local analysis of a user-owned upload.
 * estimatedBpm is display-only; BPM is the user's tempo setting; style refs do not change it.
 */
export interface VibeProfile {
  estimatedBpm: number | null;
  energy: number; // 0..1
  brightness: number; // 0..1 high-frequency proxy
  darknessHint: number; // 0..1 mapped into store darkness
  sectionHints: string[];
  fingerprintHash: string;
  durationSec: number;
  fileName: string;
}

/** Mapped arrangement knobs from a VibeProfile (BPM is the user's tempo setting; style refs do not change it). */
export interface VibeParamMap {
  energy: number;
  darkness: number;
  chaos: number;
  /** Soft bar-count bias toward longer drops when energy is high. */
  barsBias: number;
}

/** Simple Mode flow chips: idle → generated → played → exported */
export type FlowStep = 'idle' | 'generated' | 'played' | 'exported';
