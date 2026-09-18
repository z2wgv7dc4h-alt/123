import { create } from 'zustand';
import {
  DEFAULT_BPM,
  DEFAULT_BARS,
  DEFAULT_BIT_DEPTH,
  DEFAULT_DESCRIPTORS,
  DEFAULT_SAMPLE_RATE,
  clampProductBpm,
  GENRES,
  COHERENCE_LM_TEMPERATURE,
  type Coherence,
  type SamplerMethod,
  type MasterTarget,
  type RenderProgress,
  type ExportManifest,
  type GenreId,
  type ProductTier,
  type FlowStep,
  type MixerState,
  type RenderResult,
  type StemId,
  type StylePrompt,
  type VibeProfile,
  type Section,
} from '@/core/types';
import { backendRegistry } from '@/core/registry';
import { getAceSidecarBase, aceStepBackend, clampText2MusicBars } from '@/core/backends';
import {
  previewPlayer,
  audibleStemIds,
  renderRemixedWavBlob,
  wavPcmPeakAbs,
  EXPORT_HOT_PEAK,
  EXPORT_HOT_PEAK_PREGLUE,
  acquireRenderWakeLock,
  releaseRenderWakeLock,
  startRenderHeartbeat,
  type PreviewState,
} from '@/core/audio';
import { analyzeUserAudio, mapVibeToParams } from '@/core/styleRef';
import { exportAll, exportZip, buildSketchNotes, decodeWavChannels, encodeWav, recreateParamsFromManifest } from '@/core/export';
import {
  shouldShowExportDawTip,
  markExportDawTipSeen,
} from '../lib/exportDawTip';
import { shouldShowFirstPlayCoach } from '../lib/firstPlayCoach';
import { shouldShowFirstExportCoach } from '../lib/firstExportCoach';
import { barBeatFromProgress, sectionLoopRatios, barsToDurationSec, formatDurationMmSs } from '../lib/barPosition';
import { scrubArtistNames } from '@/core/prompt';
import { loraPackManager } from '@/core/lora';
import { pushToast } from '../lib/toasts';
import { HELP } from '../lib/helpCopy';
import { formatStudioError } from '@/core/uiMessages';
import { saveResumeDraft } from '../lib/resumeDraft';
import { songShapeById, type SongShapeId } from '../lib/songShapes';
import { planTakeEdit, isStudioTake, roleForSectionName, gridOffsetSec, type SectionStyle, type TakeEditRequest } from '../lib/takeEdit';
import { planArrange, type ArrangeOp } from '../lib/arrangeTake';
import {
  expandSection,
  repeatSection,
  setSectionLengthBars,
} from '../lib/structureEdit';

/** Elemental stems used for honest remix (never double-count with drums bus). */
export type ElementalStemId = 'kick' | 'snare' | 'hats' | 'perc' | 'bass';
/** Stems that can be remixed (exclude mix/other). */
export type RemixStemId = ElementalStemId | 'drums';

export const ELEMENTAL_STEM_IDS: readonly ElementalStemId[] = ['kick', 'snare', 'hats', 'perc', 'bass'];
const REMIX_STEM_IDS: readonly RemixStemId[] = [...ELEMENTAL_STEM_IDS, 'drums'];
const STEM_IDS: StemId[] = [...REMIX_STEM_IDS, 'mix'];

export const GAIN_MIN = -24;
export const GAIN_MAX = 6;

function isRemixStem(id: StemId): id is RemixStemId {
  return (REMIX_STEM_IDS as readonly string[]).includes(id);
}

/**
 * REMIX from elementals only (kick|snare|hats|perc|bass).
 * NEVER sum drums bus with elementals (double-count).
 * Solo drums alone OK when no elementals are audible.
 * Hotkeys 1–4 remain kick/snare/hats/bass (perc mixer-only, no invent Digit5).
 */
export function resolveRemixStemIds(audible: readonly StemId[]): RemixStemId[] {
  const elementals = ELEMENTAL_STEM_IDS.filter((id) => audible.includes(id));
  if (elementals.length > 0) return [...elementals];
  if (audible.includes('drums')) return ['drums'];
  return [];
}

/**
 * Real (Demucs) stems are a different set: drums/bass/other, no kick/snare/
 * hats/perc. Choose those present + audible instead of the synthetic
 * elementals-preferred rule.
 */
export function remixStemIdsForResult(
  result: RenderResult,
  audible: readonly StemId[],
): StemId[] {
  if (result.stemsReal) {
    const present = new Set(result.stems.map((s) => s.id));
    return audible.filter(
      (id) => present.has(id) && (id === 'drums' || id === 'bass' || id === 'other'),
    );
  }
  return resolveRemixStemIds(audible);
}

function emptyMixer(): MixerState {
  const mute = {} as Record<StemId, boolean>;
  const solo = {} as Record<StemId, boolean>;
  const gainDb = {} as Record<StemId, number>;
  for (const id of STEM_IDS) {
    mute[id] = false;
    solo[id] = false;
    gainDb[id] = 0;
  }
  mute.other = false;
  solo.other = false;
  gainDb.other = 0;
  return { mute, solo, gainDb };
}

function clampGain(db: number): number {
  return Math.max(GAIN_MIN, Math.min(GAIN_MAX, db));
}

function clampBars(n: number): number {
  return Math.max(16, Math.min(128, Math.round(n / 4) * 4));
}

/** True when mute/solo/non-zero gain would remix away from the dry glued mix. */
export function computeMixerDirty(mixer: MixerState): boolean {
  const anyMute = STEM_IDS.some((id) => mixer.mute[id]);
  const anySolo = STEM_IDS.some((id) => mixer.solo[id]);
  const anyGain = REMIX_STEM_IDS.some((id) => (mixer.gainDb[id] ?? 0) !== 0);
  return anyMute || anySolo || anyGain;
}


export type RenderFingerprint = {
  seed: number;
  bpm: number;
  bars: number;
  energy: number;
  darkness: number;
  chaos: number;
  promptText: string;
  vibeIntensity: number;
};

export function snapshotRenderFingerprint(s: {
  seed: number;
  bpm: number;
  bars: number;
  energy: number;
  darkness: number;
  chaos: number;
  promptText: string;
  vibeIntensity: number;
}): RenderFingerprint {
  return {
    seed: s.seed,
    bpm: s.bpm,
    bars: s.bars,
    energy: s.energy,
    darkness: s.darkness,
    chaos: s.chaos,
    promptText: s.promptText,
    vibeIntensity: s.vibeIntensity,
  };
}

export function computeParamsDirty(
  fp: RenderFingerprint | null,
  s: {
    seed: number;
    bpm: number;
    bars: number;
    energy: number;
    darkness: number;
    chaos: number;
    promptText: string;
    vibeIntensity: number;
  },
): boolean {
  if (!fp) return false;
  return (
    fp.seed !== s.seed ||
    fp.bpm !== s.bpm ||
    fp.bars !== s.bars ||
    fp.energy !== s.energy ||
    fp.darkness !== s.darkness ||
    fp.chaos !== s.chaos ||
    fp.promptText !== s.promptText ||
    fp.vibeIntensity !== s.vibeIntensity
  );
}

/** Critic ONE Play truth: Play enabled only when ready|stopped (never idle/loading/playing). */
export function canPlayPreview(
  result: unknown,
  previewState: PreviewState,
): boolean {
  return !!result && (previewState === 'ready' || previewState === 'stopped');
}

/** Once-per-result toast for first dirty remix (module scope). */
let remixToastJobId: string | null = null;

/** One-level mixer undo snapshot (mute/solo/gain only — not params/seed). */
let mixerUndoSnapshot: MixerState | null = null;

function cloneMixer(m: MixerState): MixerState {
  return {
    mute: { ...m.mute },
    solo: { ...m.solo },
    gainDb: { ...m.gainDb },
  };
}

function pushMixerUndo(prev: MixerState): void {
  mixerUndoSnapshot = cloneMixer(prev);
}


export interface StudioState {
  /** Retail product: Sketch (CPU now) vs Studio (GPU when live). */
  productTier: ProductTier;
  seed: number;
  /** When true, Generate keeps current seed (A/B knobs). Default false = auto-shuffle. */
  keepSeed: boolean;
  bpm: number;
  bars: number;
  energy: number;
  darkness: number;
  chaos: number;
  promptText: string;
  backendId: string;
  busy: boolean;
  /** Live bridge render progress (Studio) — elapsed + stage, not a blind spinner. */
  renderProgress: RenderProgress | null;
  error: string | null;
  warnings: string[];
  result: RenderResult | null;
  /** #47 prior Generate result for Hold-B flashback. */
  previousResult: RenderResult | null;
  /** #48 waveform loop region ratios. */
  loopRegion: { start: number; end: number } | null;
  /** #47 true while B held. */
  abFlashback: boolean;
  previewState: PreviewState;
  mixer: MixerState;
  /** Real ACE LoRA adapter path (null = none). Applied before Studio Generate. */
  loraPath: string | null;
  /** LoRA adapter scale 0..1 (default 0.7). */
  loraScale: number;
  /** Last adapter actually applied to ACE, so Generate only re-applies on change. */
  appliedLoraPath: string | null;
  appliedLoraScale: number;
  /** Vibe Mirror v0 — local analysis only; BPM display-only. */
  vibe: VibeProfile | null;
  /** Raw style-ref audio, kept so Studio can do real audio2audio. */
  vibeFile: File | null;
  vibeBusy: boolean;
  vibeIntensity: number;
  ownerConfirmed: boolean;
  /** Studio-only: use the reference as text2music guidance or ACE cover. */
  styleRefMode: 'cover' | 'reference';
  /** Last ACE-Step /probe result — Generate disabled for ACE when false. */
  aceHasGpu: boolean;
  /** DiT checkpoint the last successful probe reported (null = unknown). */
  aceCheckpoint: string | null;
  /** One layout: extras live behind the single More toggle. */
  moreOpen: boolean;
  /** Sketch export WAV bit depth (16 default; 24 via encodeWav — not Studio). */
  exportBitDepth: 16 | 24;
  flowStep: FlowStep;
  /** Mute/solo/gain differs from dry glued mix — preview is remixed. */
  mixerDirty: boolean;
  /** #42 one-level mixer undo available. */
  mixerUndoAvailable: boolean;
  /** Arrangement knobs diverge from last successful generate (not mixer). */
  paramsDirty: boolean;
  /** Snapshot of knobs at last successful generate; null until first render. */
  lastRenderFingerprint: RenderFingerprint | null;
  /** Prior knobs after vibe attach — Undo knobs restores these (store-backed, not globalThis). */
  vibeKnobUndo: {
    energy: number;
    darkness: number;
    chaos: number;
    bars: number;
    bpm: number;
  } | null;
  /** #57 HelpPanel open (hotkey ?/H / Esc). */
  helpOpen: boolean;
  /** #56 polite mixer change announcement. */
  mixerAnnounce: string;
  /** Arrangement preset chips. */
  songShape: SongShapeId;
  /** Genre for captions; setGenre also applies its default tempo. */
  genre: GenreId;
  /** User-expanded/repeated sections — fed into next Generate as sectionsOverride. */
  editedSections: Section[] | null;
  /** Simple Mode texture layers (generative guitar/solo/etc). */
  layers: {
    guitar: boolean;
    solo: boolean;
    vocalish: boolean;
    extraDrums: boolean;
    /** Real breakbeat loop under drops (Sketch). Opt-OUT: defaults on. */
    realBreak: boolean;
  };
  /** Demucs real-stem separation in progress. */
  stemsBusy: boolean;
  /** Replace mirrored ACE stems with real Demucs stems (drums/bass/other). */
  separateStems: () => Promise<void>;
  /** Earlier versions of the current Studio take (newest last). Not persisted. */
  takeHistory: RenderResult[];
  /** Apply loudness mastering to Studio (ACE) mixes (default true). */
  masterOn: boolean;
  /** Mastering loudness preset (Balanced -11 default). */
  masterTarget: MasterTarget;
  /** LM coherence preset — maps to ACE lm_temperature (Tight/Balanced/Wild). */
  coherence: Coherence;
  /** ACE diffusion sampler (infer_method) A/B. */
  sampler: SamplerMethod;
  /** Which best-of-N take is currently heard (0 = A, the default). */
  activeCandidate: number;
  setProductTier: (t: ProductTier) => void;
  setMasterOn: (v: boolean) => void;
  setMasterTarget: (t: MasterTarget) => void;
  setCoherence: (c: Coherence) => void;
  setSampler: (s: SamplerMethod) => void;
  setSeed: (n: number) => void;
  setKeepSeed: (v: boolean) => void;
  setBpm: (n: number) => void;
  setBars: (n: number) => void;
  setEnergy: (n: number) => void;
  setDarkness: (n: number) => void;
  setChaos: (n: number) => void;
  setPromptText: (t: string) => void;
  setBackendId: (id: string) => void;
  setLoraPath: (path: string | null) => void;
  setLoraScale: (scale: number) => void;
  setOwnerConfirmed: (v: boolean) => void;
  setStyleRefMode: (m: 'cover' | 'reference') => void;
  setMoreOpen: (v: boolean) => void;
  setExportBitDepth: (d: 16 | 24) => void;
  setVibeIntensity: (n: number) => void;
  attachVibeFile: (file: File) => Promise<void>;
  clearVibe: () => void;
  undoVibeKnobs: () => void;
  toggleMute: (id: StemId) => void;
  toggleSolo: (id: StemId) => void;
  /** #84 exclusive solo (stem-label / digit teach path). */
  exclusiveSolo: (id: StemId) => void;
  setGainDb: (id: StemId, db: number) => void;
  resetMix: () => void;
  generate: (opts?: {
    variation?: 'again' | 'vary';
    edit?: TakeEditRequest;
    /** Override backend batch size (Polish drops = 2). */
    batchSize?: number;
    /** Apply the top-scored candidate as the heard mix (no extra history entry). */
    autoPickBest?: boolean;
  }) => Promise<void>;
  /** P-3: repaint every drop section, best-of-2, auto-pick the top score. */
  polishDrops: () => Promise<void>;
  /** Load an exported manifest and re-render with its exact params. */
  recreateFromManifest: (manifest: ExportManifest) => Promise<void>;
  generateAgain: () => Promise<void>;
  vary: () => Promise<void>;
  redoSection: (index: number, style?: SectionStyle) => Promise<void>;
  /** E-1: splice the Studio take in the browser then repaint the seam(s). */
  arrangeSection: (op: ArrangeOp) => Promise<void>;
  /** Best-of-N Redo: swap the heard mix to a candidate — new take version, no render. */
  pickCandidate: (index: number) => Promise<void>;
  extendLastSection: (index: number, deltaBars: number) => Promise<void>;
  undoTakeEdit: () => Promise<void>;
  play: () => Promise<void>;
  stop: () => void;
  /** Seek preview playhead 0..1 (waveform scrub / section jump). */
  seekPreview: (ratio01: number) => void;
  /** #53 ±1 bar playhead nudge. */
  nudgeBar: (deltaBars: number) => void;
  /** #57 HelpPanel open. */
  setHelpOpen: (open: boolean) => void;
  setSongShape: (id: SongShapeId) => void;
  setGenre: (id: GenreId) => void;
  expandSectionAt: (index: number, deltaBars?: number) => void;
  repeatSectionAt: (index: number) => void;
  setSectionLengthAt: (index: number, lengthBars: number) => void;
  clearStructureEdits: () => void;
  setLayer: (key: keyof StudioState['layers'], on: boolean) => void;
  /** #60 swap previous sketch into current (secondary). */
  restorePrevious: () => Promise<void>;
  setLoopRegion: (start: number, end: number, opts?: { seek?: boolean }) => void;
  clearLoopRegion: () => void;
  /** #81 L — loop section under playhead. */
  loopCurrentSection: () => void;
  /** #82 waveform-only 2× zoom around playhead. */
  waveformZoom: boolean;
  setWaveformZoom: (on: boolean) => void;
  beginAbFlashback: () => Promise<void>;
  endAbFlashback: () => Promise<void>;
  /** One-level undo for mute/solo/gain. */
  undoMixer: () => void;
  exportStems: () => void;
  /** Single WAV = what Play heard (dry mix or remixed). */
  exportHeardSingle: () => void;
  initBackends: () => Promise<void>;
}

let gainRefreshTimer: ReturnType<typeof setTimeout> | null = null;

/** Elemental (+ optional other if present) stems for Tone live graph. */
function liveGraphStemIds(result: RenderResult): string[] {
  const present = new Set(result.stems.map((s) => s.id));
  // Real Demucs stems: use drums/bass/other directly (no fake kick/snare bus).
  if (result.stemsReal) {
    return (['drums', 'bass', 'other'] as const).filter((id) => present.has(id));
  }
  const ids: string[] = ELEMENTAL_STEM_IDS.filter((id) => present.has(id));
  if (present.has('other') && !ids.includes('other')) ids.push('other');
  return ids;
}

/**
 * Prefer Tone.Player→Channel live graph whenever elemental stems exist
 * (even with a clean mixer) so the first mute is applyLiveMixer mid-play — no remux.
 * Flat glued mix only when no elementals are present.
 */
function applyVaryDiversity(
  set: (partial: { seed: number; chaos: number }) => void,
  get: () => { chaos: number },
): void {
  const buf = new Uint32Array(1);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    buf[0] = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  }
  const cur = get().chaos ?? 0.25;
  let sign = Math.random() < 0.5 ? -1 : 1;
  let nextChaos = Math.min(1, Math.max(0, cur + sign * 0.15));
  if (nextChaos === cur) {
    sign = -sign;
    nextChaos = Math.min(1, Math.max(0, cur + sign * 0.15));
  }
  set({ seed: buf[0]! >>> 0, chaos: nextChaos });
}

/** True after vary() already applied seed+chaos this tick — generate must not double-nudge. */
let varyDiversityApplied = false;

async function loadPreviewFromMixer(result: RenderResult, mixer: MixerState): Promise<void> {
  const mixStem = result.stems.find((x) => x.id === 'mix');
  previewPlayer.setAuthoritativeDuration(mixStem?.durationSec);
  // Prefer live Tone.Channel graph whenever elementals exist (even clean mixer)
  // so the first mute is applyLiveMixer mid-play — no remux.
  const graphIds = liveGraphStemIds(result);
  if (graphIds.length > 0) {
    if (previewPlayer.hasLiveGraph()) {
      previewPlayer.applyLiveMixer(mixer);
      return;
    }
    const graphStems = result.stems.filter((s) => graphIds.includes(s.id));
    // Live duck shape must match export — same energy/songShape this result was rendered with.
    const hypedShapes: SongShapeId[] = ['dubstep', 'half-time-drop', 'trap-bounce'];
    const duckShape = {
      energy: result.manifest.prompt.energy,
      hyped: !!result.manifest.songShape && hypedShapes.includes(result.manifest.songShape),
    };
    await previewPlayer.loadLiveFromStems(graphStems, mixer, duckShape);
    previewPlayer.applyLiveMixer(mixer);
    return;
  }

  // No elementals — flat glued mix, or bake drums-only remix
  if (!computeMixerDirty(mixer)) {
    const mix = result.stems.find((x) => x.id === 'mix');
    if (mix?.blob || mix?.url) await previewPlayer.loadMix(mix.blob ?? mix.url);
    return;
  }
  const ids = audibleStemIds(mixer.mute, mixer.solo, STEM_IDS);
  const remixIds = remixStemIdsForResult(result, ids);
  const stems = result.stems.filter((s) => remixIds.includes(s.id as RemixStemId));
  if (!stems.length) throw new Error('All stems muted — unmute one to preview.');
  const gains: Partial<Record<string, number>> = {};
  for (const s of stems) {
    if (isRemixStem(s.id)) gains[s.id] = mixer.gainDb[s.id] ?? 0;
  }
  await previewPlayer.loadMixFromStems(stems, gains);
}

/** When refresh hits mid-load, queue one follow-up so mute/solo/gain is not dropped. */
let mixerRefreshQueued = false;
let mixerRefreshInFlight = false;

async function refreshPreviewAfterMixerChange(
  set: (partial: Partial<StudioState>) => void,
  get: () => StudioState,
): Promise<void> {
  const { result, previewState } = get();
  if (!result) return;

  // Fast path: live graph armed — always applyLiveMixer (clean OR dirty). No remux.
  if (previewPlayer.hasLiveGraph()) {
    previewPlayer.applyLiveMixer(get().mixer);
    return;
  }

  // Mid-decode: queue retry with LATEST mixer (don't drop mutes).
  if (previewState === 'loading' || mixerRefreshInFlight) {
    mixerRefreshQueued = true;
    return;
  }
  mixerRefreshInFlight = true;
  try {
    do {
      mixerRefreshQueued = false;
      const snap = get();
      if (!snap.result) break;
      const wasPlaying = snap.previewState === 'playing';
      const progress = previewPlayer.getProgress();
      try {
        await loadPreviewFromMixer(snap.result, snap.mixer);
        previewPlayer.seek(progress);
        if (wasPlaying) await previewPlayer.play();
      } catch (e) {
        const msg = formatStudioError(e instanceof Error ? e.message : String(e));
        set({ error: msg });
        pushToast(msg, 'error', 0);
      }
    } while (mixerRefreshQueued);
  } finally {
    mixerRefreshInFlight = false;
    if (mixerRefreshQueued) {
      mixerRefreshQueued = false;
      void refreshPreviewAfterMixerChange(set, get);
    }
  }
}


function maybeToastRemixLive(get: () => StudioState): void {
  const { result, mixer } = get();
  if (!result || !computeMixerDirty(mixer)) return;
  if (remixToastJobId === result.jobId) return;
  remixToastJobId = result.jobId;
  pushToast(HELP.remixLive, 'info', 4200);
}

/** Swap every stem to a candidate's mastered mix, keeping raw/grid/report in sync. */
function withMixCandidate(result: RenderResult, index: number): RenderResult {
  const candidate = result.candidates?.[index];
  if (!candidate) return result;
  const mix = result.stems.find((s) => s.id === 'mix');
  const durationSec = mix?.durationSec ?? 0;
  const sampleRateHz = mix?.sampleRateHz ?? DEFAULT_SAMPLE_RATE;
  const bitDepth = mix?.bitDepth ?? DEFAULT_BIT_DEPTH;
  const stems = result.stems.map((s) => ({
    ...s,
    blob: candidate.mix,
    url: URL.createObjectURL(candidate.mix),
    durationSec,
    sampleRateHz,
    bitDepth,
  }));
  return {
    ...result,
    stems,
    rawMixBlob: candidate.raw,
    barGrid: candidate.barGrid,
    master: candidate.master,
  };
}

/** Release blob URLs for a result that no longer has any takeHistory reference. */
function revokeResultUrls(result: RenderResult | null | undefined): void {
  if (!result || typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
  for (const s of result.stems) {
    if (typeof s.url === 'string' && s.url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(s.url);
      } catch {
        /* already revoked */
      }
    }
  }
}

export const useStudioStore = create<StudioState>((set, get) => ({
  productTier: 'sketch',
  seed: 17400,
  keepSeed: false,
  bpm: DEFAULT_BPM,
  bars: DEFAULT_BARS,
  energy: 0.75,
  darkness: 0.45,
  chaos: 0.25,
  promptText: DEFAULT_DESCRIPTORS.slice(0, 4).join(', '),
  backendId: 'offline-stub',
  busy: false,
  renderProgress: null,
  error: null,
  warnings: [],
  result: null,
  previousResult: null,
  takeHistory: [],
  stemsBusy: false,
  loopRegion: null,
  waveformZoom: false,
  abFlashback: false,
  previewState: 'idle',
  mixer: emptyMixer(),
  loraPath: null,
  loraScale: 0.7,
  appliedLoraPath: null,
  appliedLoraScale: 0.7,
  vibe: null,
  vibeFile: null,
  vibeBusy: false,
  vibeIntensity: 0.7,
  ownerConfirmed: false,
  styleRefMode: 'reference',
  aceHasGpu: false,
  aceCheckpoint: null,
  moreOpen: false,
  masterOn: true,
  masterTarget: 'balanced',
  coherence: 'balanced',
  sampler: 'ode',
  activeCandidate: 0,
  exportBitDepth: DEFAULT_BIT_DEPTH,
  flowStep: 'idle',
  mixerDirty: false,
  mixerUndoAvailable: false,
  paramsDirty: false,
  lastRenderFingerprint: null,
  vibeKnobUndo: null,
  helpOpen: false,
  mixerAnnounce: '',
  songShape: 'classic',
  genre: 'dnb',
  editedSections: null,
  layers: { guitar: false, solo: false, vocalish: false, extraDrums: false, realBreak: true },

  setProductTier: (tier) => {
    const st = get();
    if (tier === 'sketch') {
      set({ productTier: 'sketch', backendId: 'offline-stub' });
      backendRegistry.setActive('offline-stub');
      if (st.productTier !== 'sketch') {
        pushToast('Sketch · CPU browser path · 16-bit', 'info', 2800);
      }
      return;
    }
    // Studio retail — gated fail-soft when !aceHasGpu (never claim live Studio audio)
    if (!st.aceHasGpu) {
      set({ productTier: 'studio', backendId: 'offline-stub' });
      backendRegistry.setActive('offline-stub');
      pushToast(
        'Studio needs a local GPU — not live yet. Generate still uses Sketch (CPU).',
        'warn',
        5200,
      );
      return;
    }
    const aceId =
      backendRegistry.list().find((b) => b.id.startsWith('ace-step'))?.id ?? st.backendId;
    set({ productTier: 'studio', backendId: aceId });
    backendRegistry.setActive(aceId);
    pushToast('Studio · local GPU path active', 'success', 3200);
  },
  setSeed: (n) =>
    set((s) => {
      const seed = n >>> 0;
      const next = { ...s, seed };
      return { seed, paramsDirty: s.result ? computeParamsDirty(s.lastRenderFingerprint, next) : s.paramsDirty };
    }),
  setKeepSeed: (v) => set({ keepSeed: Boolean(v) }),
  setBpm: (n) =>
    set((s) => {
      const bpm = clampProductBpm(n);
      const next = { ...s, bpm };
      return { bpm, paramsDirty: s.result ? computeParamsDirty(s.lastRenderFingerprint, next) : s.paramsDirty };
    }),
  setBars: (n) => {
    const prev = get();
    const bars = clampBars(n);
    const next = { ...prev, bars };
    set({
      bars,
      paramsDirty: prev.result ? computeParamsDirty(prev.lastRenderFingerprint, next) : prev.paramsDirty,
    });
    if (prev.result && bars !== prev.bars) {
      const bpm = prev.result?.bpmMeasured ?? prev.bpm ?? DEFAULT_BPM;
      const approx = formatDurationMmSs(barsToDurationSec(bars, bpm));
      pushToast(`Arrangement ~${approx} on next Generate`, 'info', 2800);
    }
  },
  setEnergy: (n) =>
    set((s) => {
      const energy = Math.min(1, Math.max(0, n));
      const next = { ...s, energy };
      return { energy, paramsDirty: s.result ? computeParamsDirty(s.lastRenderFingerprint, next) : s.paramsDirty };
    }),
  setDarkness: (n) =>
    set((s) => {
      const darkness = Math.min(1, Math.max(0, n));
      const next = { ...s, darkness };
      return { darkness, paramsDirty: s.result ? computeParamsDirty(s.lastRenderFingerprint, next) : s.paramsDirty };
    }),
  setChaos: (n) =>
    set((s) => {
      const chaos = Math.min(1, Math.max(0, n));
      const next = { ...s, chaos };
      return { chaos, paramsDirty: s.result ? computeParamsDirty(s.lastRenderFingerprint, next) : s.paramsDirty };
    }),
  setPromptText: (t) =>
    set((s) => {
      const promptText = t;
      const next = { ...s, promptText };
      return { promptText, paramsDirty: s.result ? computeParamsDirty(s.lastRenderFingerprint, next) : s.paramsDirty };
    }),
  setBackendId: (id) => {
    backendRegistry.setActive(id);
    set({ backendId: id });
  },
  setLoraPath: (path) => set({ loraPath: path }),
  setLoraScale: (scale) => set({ loraScale: Math.max(0, Math.min(1, scale)) }),
  setOwnerConfirmed: (v) => set({ ownerConfirmed: v }),
  setStyleRefMode: (m) => set({ styleRefMode: m === 'cover' ? 'cover' : 'reference' }),
  setMoreOpen: (v) => set({ moreOpen: v }),
  setMasterOn: (v) => set({ masterOn: Boolean(v) }),
  setMasterTarget: (t) => set({ masterTarget: t }),
  setCoherence: (c) => set({ coherence: c }),
  setSampler: (s) => set({ sampler: s === 'sde' ? 'sde' : 'ode' }),
  setExportBitDepth: (d) => set({ exportBitDepth: d === 24 ? 24 : 16 }),
  setVibeIntensity: (n) =>
    set((s) => {
      const vibeIntensity = Math.min(1, Math.max(0, n));
      const next = { ...s, vibeIntensity };
      return {
        vibeIntensity,
        paramsDirty: s.result ? computeParamsDirty(s.lastRenderFingerprint, next) : s.paramsDirty,
      };
    }),

  attachVibeFile: async (file) => {
    const { ownerConfirmed } = get();
    if (!ownerConfirmed) {
      const msg = 'Confirm you own / have rights to this file before analyzing.';
      set({ error: msg });
      pushToast(msg, 'error', 0);
      return;
    }
    set({ vibeBusy: true, error: null });
    const priorVibeForReplace = get().vibe;
    try {
      const vibe = await analyzeUserAudio(file);
      set({ vibeFile: file });
      const prior = get();
      const undo = {
        energy: prior.energy,
        darkness: prior.darkness,
        chaos: prior.chaos,
        bars: prior.bars,
        bpm: prior.bpm,
      };
      const mapped = mapVibeToParams(
        vibe,
        { energy: undo.energy, darkness: undo.darkness, chaos: undo.chaos },
        prior.vibeIntensity,
      );
      const bars = clampBars(undo.bars + mapped.barsBias);
      const next = {
        ...prior,
        vibe,
        vibeBusy: false,
        energy: mapped.energy,
        darkness: mapped.darkness,
        chaos: mapped.chaos,
        bars,
      };
      set({
        vibe,
        vibeBusy: false,
        energy: mapped.energy,
        darkness: mapped.darkness,
        chaos: mapped.chaos,
        bars,
        paramsDirty: prior.result
          ? computeParamsDirty(prior.lastRenderFingerprint, next)
          : prior.paramsDirty,
      });
      set({ vibeKnobUndo: undo });
      const shortName =
        file.name.length > 28 ? `${file.name.slice(0, 25)}…` : file.name;
      pushToast(`Vibe ready · ${shortName} · knobs nudged`, 'success', 4200);
    } catch (e) {
      const msg = formatStudioError(e instanceof Error ? e.message : String(e));
      // Replace fail keeps prior vibe (no ghost Ready on first-fail: prior is null).
      set({ vibeBusy: false, error: msg, vibe: priorVibeForReplace });
      pushToast(msg, 'error', 0);
    }
  },

  clearVibe: () => {
    set((st) => {
      const next = {
        ...st,
        vibe: null,
        energy: 0.75,
        darkness: 0.45,
        chaos: 0.25,
        bars: DEFAULT_BARS,
      };
      return {
        vibe: null,
        energy: 0.75,
        darkness: 0.45,
        chaos: 0.25,
        bars: DEFAULT_BARS,
        vibeKnobUndo: null,
        // Style Ref persist: keep ownership attest so user can re-attach without re-checking
        ownerConfirmed: st.ownerConfirmed,
        paramsDirty: st.result
          ? computeParamsDirty(st.lastRenderFingerprint, next)
          : st.paramsDirty,
      };
    });
    pushToast('Style reference cleared · knobs reset', 'info', 2200);
  },

  undoVibeKnobs: () => {
    const undo = get().vibeKnobUndo;
    if (!undo) {
      pushToast('Nothing to undo', 'info', 1800);
      return;
    }
    set((st) => {
      const next = { ...st, ...undo };
      return {
        energy: undo.energy,
        darkness: undo.darkness,
        chaos: undo.chaos,
        bars: undo.bars,
        bpm: undo.bpm,
        vibeKnobUndo: null,
        paramsDirty: st.result
          ? computeParamsDirty(st.lastRenderFingerprint, next)
          : st.paramsDirty,
      };
    });
    pushToast('Vibe knobs restored · style file still attached', 'success', 2800);
  },

  toggleMute: (id) => {
    previewPlayer.unlockAudioSync();
    const vibeBefore = get().vibe;
    const ownerBefore = get().ownerConfirmed;
    pushMixerUndo(get().mixer);
    set((s) => {
      const mixer = { ...s.mixer, mute: { ...s.mixer.mute, [id]: !s.mixer.mute[id] } };
      // mute never writes vibe / ownerConfirmed
      return { mixer, mixerDirty: computeMixerDirty(mixer), mixerUndoAvailable: true };
    });
    if (get().vibe !== vibeBefore || get().ownerConfirmed !== ownerBefore) {
      set({ vibe: vibeBefore, ownerConfirmed: ownerBefore });
    }
    maybeToastRemixLive(get);
    {
      const m = get().mixer;
      const on = m.mute[id];
      set({ mixerAnnounce: on ? `${id} muted` : `${id} unmuted` });
    }
    void refreshPreviewAfterMixerChange(set, get);
  },
  toggleSolo: (id) => {
    previewPlayer.unlockAudioSync();
    const vibeBefore = get().vibe;
    const ownerBefore = get().ownerConfirmed;
    pushMixerUndo(get().mixer);
    set((s) => {
      const mixer = { ...s.mixer, solo: { ...s.mixer.solo, [id]: !s.mixer.solo[id] } };
      // mute/solo parity — never write vibe / ownerConfirmed
      return { mixer, mixerDirty: computeMixerDirty(mixer), mixerUndoAvailable: true };
    });
    if (get().vibe !== vibeBefore || get().ownerConfirmed !== ownerBefore) {
      set({ vibe: vibeBefore, ownerConfirmed: ownerBefore });
    }
    maybeToastRemixLive(get);
    {
      const m = get().mixer;
      const on = m.solo[id];
      set({ mixerAnnounce: on ? `${id} solo on` : `${id} solo off` });
    }
    void refreshPreviewAfterMixerChange(set, get);
  },
  exclusiveSolo: (id) => {
    previewPlayer.unlockAudioSync();
    const vibeBefore = get().vibe;
    const ownerBefore = get().ownerConfirmed;
    pushMixerUndo(get().mixer);
    set((s) => {
      const wasExclusive =
        !!s.mixer.solo[id] &&
        STEM_IDS.every((sid) => (sid === id ? s.mixer.solo[sid] : !s.mixer.solo[sid]));
      const solo = { ...s.mixer.solo };
      if (wasExclusive) {
        solo[id] = false;
      } else {
        for (const sid of STEM_IDS) solo[sid] = sid === id;
      }
      const mixer = { ...s.mixer, solo };
      return { mixer, mixerDirty: computeMixerDirty(mixer), mixerUndoAvailable: true };
    });
    if (get().vibe !== vibeBefore || get().ownerConfirmed !== ownerBefore) {
      set({ vibe: vibeBefore, ownerConfirmed: ownerBefore });
    }
    maybeToastRemixLive(get);
    {
      const m = get().mixer;
      const on = m.solo[id];
      set({ mixerAnnounce: on ? `${id} exclusive solo` : `${id} solo off` });
    }
    void refreshPreviewAfterMixerChange(set, get);
  },
  setGainDb: (id, db) => {
    previewPlayer.unlockAudioSync();
    // One-level: snapshot once at the start of a scrub gesture (timer null).
    if (!gainRefreshTimer) pushMixerUndo(get().mixer);
    const clamped = clampGain(db);
    const wasBelowMax = (get().mixer.gainDb[id] ?? 0) < GAIN_MAX;
    set((s) => {
      const mixer = {
        ...s.mixer,
        gainDb: { ...s.mixer.gainDb, [id]: clamped },
      };
      return { mixer, mixerDirty: computeMixerDirty(mixer), mixerUndoAvailable: true };
    });
    // #50/#51: surface +6 dB peak caution as soon as a stem hits the ceiling (toast-only).
    if (wasBelowMax && clamped >= GAIN_MAX) {
      pushToast('Mix looks hot at +6 dB — Export still allowed', 'warn', 3600);
    }
    maybeToastRemixLive(get);
    // Debounce gain scrub — stem decode cache makes each refresh cheap; coalesce slider ticks
    if (gainRefreshTimer) clearTimeout(gainRefreshTimer);
    gainRefreshTimer = setTimeout(() => {
      gainRefreshTimer = null;
      void refreshPreviewAfterMixerChange(set, get);
    }, 40);
  },

  resetMix: () => {
    pushMixerUndo(get().mixer);
    const mixer = emptyMixer();
    set({ mixer, mixerDirty: false, mixerUndoAvailable: true });
    void refreshPreviewAfterMixerChange(set, get);
    pushToast('Mix reset · dry preview restored', 'info', 2200);
  },

  setSongShape: (id) => {
    const shape = songShapeById(id);
    set((s) => {
      const next = { ...s, songShape: id, bars: shape.bars, editedSections: null };
      return {
        songShape: id,
        bars: shape.bars,
        editedSections: null,
        paramsDirty: s.result ? computeParamsDirty(s.lastRenderFingerprint, next) : s.paramsDirty,
      };
    });
    pushToast(`${shape.label} · ${shape.bars} bars`, 'info', 2200);
  },

  setGenre: (id) => {
    const bpm = GENRES[id].defaultBpm;
    set((s) => {
      const next = { ...s, genre: id, bpm };
      return { genre: id, bpm, paramsDirty: s.result ? computeParamsDirty(s.lastRenderFingerprint, next) : s.paramsDirty };
    });
  },

  expandSectionAt: (index, deltaBars = 8) => {
    const { result, editedSections } = get();
    const base = editedSections ?? result?.structure?.sections;
    if (!base?.length) {
      pushToast('Generate first, then expand a section you like', 'info', 2800);
      return;
    }
    const out = expandSection(base, index, deltaBars);
    if (!out) {
      pushToast('Could not expand (min 4 / max 128 bars)', 'warn', 2800);
      return;
    }
    // Pending arrangement only — do not patch result.structure (player stays on rendered WAV).
    set({ bars: out.bars, editedSections: out.sections, paramsDirty: true });
    {
      const bpm = get().result?.bpmMeasured ?? get().bpm ?? DEFAULT_BPM;
      const approx = formatDurationMmSs(barsToDurationSec(out.bars, bpm));
      pushToast(`Arrangement ~${approx} on next Generate`, 'info', 3400);
    }
  },

  repeatSectionAt: (index) => {
    const { result, editedSections } = get();
    const base = editedSections ?? result?.structure?.sections;
    if (!base?.length) return;
    const out = repeatSection(base, index);
    if (!out) {
      pushToast('No room to repeat (max 128 bars)', 'warn', 2800);
      return;
    }
    // Pending arrangement only — do not patch result.structure (player stays on rendered WAV).
    set({ bars: out.bars, editedSections: out.sections, paramsDirty: true });
    {
      const bpm = get().result?.bpmMeasured ?? get().bpm ?? DEFAULT_BPM;
      const approx = formatDurationMmSs(barsToDurationSec(out.bars, bpm));
      pushToast(`Arrangement ~${approx} on next Generate`, 'info', 3200);
    }
  },

  setSectionLengthAt: (index, lengthBars) => {
    const { result, editedSections } = get();
    const base = editedSections ?? result?.structure?.sections;
    if (!base?.length) return;
    const out = setSectionLengthBars(base, index, lengthBars);
    if (!out) return;
    // Pending arrangement only — do not patch result.structure (player stays on rendered WAV).
    set({ bars: out.bars, editedSections: out.sections, paramsDirty: true });
  },

  clearStructureEdits: () => set({ editedSections: null }),
  setLayer: (key, on) =>
    set((s) => ({
      layers: { ...s.layers, [key]: on },
      paramsDirty: s.result ? true : s.paramsDirty,
    })),

  initBackends: async () => {
    try {
      const best = await backendRegistry.selectBest();
      set({ backendId: best.id });
      const ace = backendRegistry.get('ace-step-1.5');
      if (ace) {
        const probe = await ace.probe();
        const hasGpu = !!probe.hasGpu;
        set({ aceHasGpu: hasGpu, ...(probe.checkpoint ? { aceCheckpoint: probe.checkpoint } : {}) });
        if (hasGpu) {
          // Auto Studio retail when ACE bridge is live — Pendulum-vibe quality path
          set({
            productTier: 'studio',
            backendId: 'ace-step-1.5',
            warnings: [],
          });
          backendRegistry.setActive('ace-step-1.5');
          pushToast('Studio ACE (GPU) online — Generate uses your 5080', 'info', 3200);
        } else {
          set((st) => ({
            warnings: [
              ...st.warnings.filter((w) => !w.startsWith('ACE-Step') && !w.startsWith('Studio GPU')),
              'Studio GPU offline — using browser sketch (CPU). Local GPU path later.',
            ],
          }));
        }
      } else {
        set({ aceHasGpu: false });
      }
    } catch (e) {
      const msg = formatStudioError(e instanceof Error ? e.message : String(e));
      set({ error: msg, aceHasGpu: false });
      pushToast(msg, 'error', 0);
    }
  },

  generate: async (opts) => {
    const s0 = get();
    // Favorites / Surprise Me call generate({ variation: 'vary' }) without vary().
    // vary() already applied seed+chaos this tick (varyDiversityApplied).
    if (opts?.variation === 'vary' && !varyDiversityApplied) {
      applyVaryDiversity(set, get);
    }
    varyDiversityApplied = false;
    // Anti-samey: plain Generate rolls a new seed unless Keep-seed is on.
    // Again keeps seed; Vary already set a fresh seed (+ chaos nudge).
    // Also preserve seed when sections are edited (Expand/Repeat/etc) for same-song behavior
    if (!opts?.variation && !s0.keepSeed && !s0.editedSections && !opts?.edit) {
      const buf = new Uint32Array(1);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(buf);
      } else {
        buf[0] = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
      }
      set({ seed: buf[0]! >>> 0 });
    }
    // Phone/LAN: re-probe ACE every Generate so a failed init probe doesn't stick on Sketch.
    try {
      const aceBe = backendRegistry.get('ace-step-1.5');
      if (aceBe) {
        const probe = await aceBe.probe();
        if (probe.hasGpu) {
          set({
            aceHasGpu: true,
            ...(probe.checkpoint ? { aceCheckpoint: probe.checkpoint } : {}),
            productTier: 'studio',
            backendId: 'ace-step-1.5',
            warnings: [],
          });
          backendRegistry.setActive('ace-step-1.5');
        } else {
          set({ aceHasGpu: false });
        }
      }
    } catch {
      /* keep prior aceHasGpu */
    }
    const s = get();
    // R-2: edits act on the Studio take you are hearing; never re-roll the song.
    let editPlan: ReturnType<typeof planTakeEdit> = null;
    if (opts?.edit) {
      const studioLive = s.productTier === 'studio' && s.aceHasGpu;
      editPlan = s.result && studioLive ? planTakeEdit(s.result, opts.edit) : null;
      if (!editPlan) {
        pushToast(
          !studioLive || !s.result
            ? 'Section edits need a Studio (GPU) take — Generate on Studio first'
            : 'Extend works on the last section for now',
          'warn',
          4200,
        );
        return;
      }
      if (editPlan.warning) pushToast(editPlan.warning, 'warn', 5000);
    }
    // Studio/ACE without GPU: fail-soft to Sketch audio — never soft-pass as live Studio
    if ((s.backendId.startsWith('ace-step') && !s.aceHasGpu) || (s.productTier === 'studio' && !s.aceHasGpu)) {
      if (s.backendId.startsWith('ace-step')) {
        set({ backendId: 'offline-stub' });
        pushToast(
          'Studio needs a local GPU — rendering Sketch (CPU 16-bit) instead. No fake Studio audio.',
          'warn',
          5200,
        );
      }
    }
    // Sketch product always renders OfflineStub even if Power layout picked ACE earlier
    if (s.productTier === 'sketch' && s.backendId.startsWith('ace-step')) {
      set({ backendId: 'offline-stub' });
    }
    set({ busy: true, error: null, warnings: [] });
    try {
      const { clean, blocked } = scrubArtistNames(s.promptText);
      if (blocked.length) {
        set({ warnings: [`Blocked artist-name tokens removed: ${blocked.join(', ')}`] });
      }
      let backend;
      // Product tier owns audio path. Soft-pass forbidden: Sketch must never
      // prefer ACE. aceHasGpu was just re-probed above (line ~979) — do NOT
      // probe again here. The registry's best-pick helper re-probes
      // internally and silently falls back to offline-stub on any hiccup, no
      // error, no toast — that redundant second probe was why Generate
      // sometimes used Sketch even with Studio/GPU showing live seconds earlier.
      const studioAce = s.productTier === 'studio' && s.aceHasGpu;
      if (studioAce) {
        const aceBackend = backendRegistry.get('ace-step-1.5');
        if (aceBackend) {
          backendRegistry.setActive(aceBackend.id);
          backend = aceBackend;
          set({ backendId: aceBackend.id });
        } else {
          backendRegistry.setActive('offline-stub');
          backend = backendRegistry.active();
          set({ backendId: 'offline-stub' });
        }
      } else {
        backendRegistry.setActive('offline-stub');
        backend = backendRegistry.active();
        set({ backendId: 'offline-stub' });
      }

      let energy = s.energy;
      let darkness = s.darkness;
      let chaos = s.chaos;
      let bars = s.bars;
      if (s.vibe) {
        const mapped = mapVibeToParams(
          s.vibe,
          { energy: s.energy, darkness: s.darkness, chaos: s.chaos },
          s.vibeIntensity,
        );
        energy = mapped.energy;
        darkness = mapped.darkness;
        chaos = mapped.chaos;
        bars = clampBars(s.bars + mapped.barsBias);
      }

      const prompt: StylePrompt = {
        // Was hardcoded to the FULL 8-item DEFAULT_DESCRIPTORS regardless of
        // what the user actually typed/edited in promptText — forced
        // genre-diluting phrases ("distorted supersaw leads", "gated pads")
        // into every ACE caption and duplicated tags already covered by
        // `clean` (e.g. "rock-dnb crossover" appearing twice, confirmed in
        // the raw ACE log). The starter textarea text (DEFAULT_DESCRIPTORS
        // slice) already reaches ACE via `text: clean` below when the user
        // hasn't edited it away; nothing else needs to force it back in.
        descriptors: [],
        energy,
        darkness,
        chaos,
        text: clean,
      };
      const jobId = `job_${s.seed}_${Date.now()}`;
      // Layer language — generative descriptors only (never artist clone)
      const layerBits: string[] = [];
      if (s.layers.guitar) layerBits.push('energetic rock-dnb guitar riffs, distorted rhythm guitar, original');
      if (s.layers.solo) layerBits.push('expressive lead guitar solo, rock-dnb crossover lead, original');
      if (s.layers.vocalish) layerBits.push('vocal-ish synth texture, chopped pad vocalese, no lyrics, original');
      if (s.layers.extraDrums) layerBits.push('extra breakbeat layers, dense percussion fills, original');
      // Layer + shape caption words are owned by buildAceCaption (job.layers,
      // job.songShape). Appending them here too duplicated guitar phrases and
      // captioned half-time-drop as "dubstep-feel".
      if (layerBits.length) {
        prompt.descriptors = [...prompt.descriptors, ...layerBits.map((b) => b.split(',')[0]!.trim())];
      }

      const live = get();
      const isAcePath = backend.id.startsWith('ace-step');

      // Real ACE LoRA: apply the selection before Generate, but only when it
      // changed since the last apply (load/scale, or unload when cleared).
      if (isAcePath) {
        const desiredPath = live.loraPath;
        const desiredScale = live.loraScale;
        const loraChanged =
          desiredPath !== live.appliedLoraPath ||
          (desiredPath != null && desiredScale !== live.appliedLoraScale);
        if (loraChanged) {
          try {
            if (!desiredPath) {
              const res = await fetch(`${getAceSidecarBase()}/lora/off`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}',
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              set({ appliedLoraPath: null, appliedLoraScale: desiredScale });
            } else {
              const res = await fetch(`${getAceSidecarBase()}/lora`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: desiredPath, scale: desiredScale }),
              });
              if (res.status === 409) {
                let message = 'LoRA model mismatch';
                try {
                  const data = (await res.json()) as { message?: unknown };
                  if (data?.message) message = String(data.message);
                } catch {
                  /* keep default message */
                }
                set({ busy: false });
                pushToast(message, 'warn', 6000);
                return;
              }
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              set({ appliedLoraPath: desiredPath, appliedLoraScale: desiredScale });
            }
          } catch (e) {
            const msg = `LoRA apply failed: ${e instanceof Error ? e.message : String(e)}`;
            set({ busy: false });
            pushToast(msg, 'warn', 5000);
            return;
          }
        }
      }

      let heartbeat: { stop: () => void } | undefined;
      let progressTimer: ReturnType<typeof setInterval> | undefined;
      if (isAcePath) {
        await acquireRenderWakeLock();
        heartbeat = startRenderHeartbeat(getAceSidecarBase(), () => {
          pushToast(
            'ACE bridge connection looks unstable — keep this tab open while rendering',
            'warn',
            4000,
          );
        });
        // Poll the bridge for real elapsed/stage instead of a blind spinner.
        const sidecar = getAceSidecarBase();
        const pollProgress = () => {
          void (async () => {
            try {
              const res = await fetch(`${sidecar}/progress/${encodeURIComponent(jobId)}`);
              if (res.ok) set({ renderProgress: (await res.json()) as RenderProgress });
            } catch {
              /* bridge not reachable yet */
            }
          })();
        };
        set({ renderProgress: null });
        pollProgress();
        progressTimer = setInterval(pollProgress, 1500);
      }
      let result: RenderResult;
      try {
        result = await backend.render({
          jobId,
          seed: editPlan?.seed ?? s.seed,
          songShape: live.songShape,
          genre: editPlan?.style?.genre ?? live.genre,
          sectionRole: editPlan?.style?.role,
          ...(editPlan
            ? { sectionsOverride: undefined }
            : { sectionsOverride: live.editedSections ?? undefined }),
          // User tempo (no 174 lock).
          bpm: editPlan?.bpm ?? clampProductBpm(live.bpm || DEFAULT_BPM),
          bpmTolerance: 2,
          durationBars: editPlan?.structureRef.bars ?? clampText2MusicBars(bars),
          ...(editPlan ? { structureRef: editPlan.structureRef, edit: editPlan.edit } : {}),
          sampleRateHz: DEFAULT_SAMPLE_RATE,
          bitDepth: DEFAULT_BIT_DEPTH,
          channels: 2,
          ...(opts?.batchSize ? { batchSize: opts.batchSize } : {}),
          prompt: editPlan?.style?.words
            ? { ...prompt, text: [editPlan.style.words, prompt.text].filter(Boolean).join(', ') }
            : prompt,
          layers: { ...live.layers },
          lora: live.loraPath ? [{ packId: live.loraPath, scale: live.loraScale }] : undefined,
          stemSchemaVersion: 'v0',
          master: live.masterOn,
          masterTarget: live.masterTarget ?? 'balanced',
          lmTemperature: COHERENCE_LM_TEMPERATURE[live.coherence ?? 'balanced'],
          sampler: live.sampler ?? 'ode',
          // Belt-and-suspenders: never send styleReference without explicit ownership attest
          styleReference: editPlan
            ? undefined
            : s.vibe && s.ownerConfirmed
              ? {
                  ...(s.vibeFile ? { file: s.vibeFile } : {}),
                  mode: s.styleRefMode,
                  intensity: s.vibeIntensity,
                  estimatedBpm: s.vibe.estimatedBpm,
                  energy: s.vibe.energy,
                  fileName: s.vibe.fileName,
                  ownerAttested: true,
                  hash: s.vibe.fingerprintHash,
                  brightness: s.vibe.brightness,
                  darknessHint: s.vibe.darknessHint,
                }
              : undefined,
        });
      } finally {
        heartbeat?.stop();
        if (progressTimer) clearInterval(progressTimer);
        set({ renderProgress: null });
        if (isAcePath) await releaseRenderWakeLock();
      }
      // Polish drops / best-of: hear the top-scored candidate (no extra history).
      if (opts?.autoPickBest && result.candidates?.length) {
        result = withMixCandidate(result, 0);
      }
      // New stems → drop decode cache; honor current mute/solo/gain immediately
      previewPlayer.clearStemCache();
      previewPlayer.onState = (ps) => set({ previewState: ps });
      await loadPreviewFromMixer(result, get().mixer);
      const mixStem = result.stems.find((x) => x.id === 'mix');
      previewPlayer.setAuthoritativeDuration(mixStem?.durationSec);
      if (mixerRefreshQueued) {
        mixerRefreshQueued = false;
        void refreshPreviewAfterMixerChange(set, get);
      }
            remixToastJobId = null; // allow one remix toast for this new result
      mixerUndoSnapshot = null; // #42 clears on Generate
      // mixerUndoAvailable cleared in set() below
      const dirty = computeMixerDirty(get().mixer);
      const fp = snapshotRenderFingerprint(get());
      const preserved = get();
      // Generate → ready before canPlay (never idle after successful load).
      const psAfter = previewPlayer.state;
      const previewReady: PreviewState =
        psAfter === 'ready' || psAfter === 'stopped' ? psAfter : 'ready';
      set({
        result,
        activeCandidate: 0,
        previousResult: preserved.result ?? get().previousResult,
        takeHistory: opts?.edit && preserved.result ? [...preserved.takeHistory, preserved.result] : [],
        loopRegion: null,
        waveformZoom: false,
        abFlashback: false,
        warnings: [
          ...preserved.warnings,
          ...(editPlan?.warning ? [editPlan.warning] : []),
          ...result.warnings,
        ],
        busy: false,
        flowStep: 'generated',
        mixerDirty: dirty,
        mixerUndoAvailable: false,
        paramsDirty: false,
        lastRenderFingerprint: fp,
        previewState: previewReady,
        editedSections: null,
        bars: result.structure?.bars ?? preserved.bars,
        // Style Ref preserve — generate must not drop attached vibe / ownership
        vibe: preserved.vibe,
        ownerConfirmed: preserved.ownerConfirmed,
        styleRefMode: preserved.styleRefMode,
        vibeIntensity: preserved.vibeIntensity,
        songShape: preserved.songShape,
        layers: preserved.layers,
      });
      const refUsed = Boolean(result.manifest.styleReference?.used);
      const backendLabel =
        result.backendId === 'offline-stub' || result.backendId.startsWith('offline')
          ? 'browser sketch'
          : result.backendId;
      // #55 persist seed+knobs only (no blob)
      try {
        const live = get();
        saveResumeDraft({
          seed: live.seed,
          bpm: live.bpm,
          bars: live.bars,
          energy: live.energy,
          darkness: live.darkness,
          chaos: live.chaos,
          promptText: live.promptText,
          vibeIntensity: live.vibeIntensity,
        });
      } catch {
        /* private storage */
      }
      if (opts?.edit) {
        const edit = opts.edit;
        if (edit.kind === 'splice') {
          pushToast('Arrangement updated — hit Play', 'success');
        } else {
          const styled = edit.kind === 'redo' ? edit.style : undefined;
          const styleBits = [styled?.genre, styled?.role].filter(Boolean).join(' ');
          pushToast(
            styleBits
              ? `Section redone as ${styleBits} — hit Play`
              : edit.kind === 'redo'
                ? 'Section redone — hit Play'
                : `Extended +${edit.deltaBars} bars — hit Play`,
            'success',
          );
        }
      } else if (opts?.variation === 'vary') {
        pushToast('New variation ready — hit Play', 'success');
      } else if (opts?.variation === 'again') {
        pushToast('Generated again — hit Play', 'success');
      } else {
        const vibeBit = refUsed ? ' · vibe on' : '';
        pushToast(
          `Ready · ${backendLabel} · ${result.bpmMeasured} BPM${vibeBit} — hit Play`,
          'success',
        );
      }
      // #47: soft cue when A/B previous is available (second+ Generate)
      if (get().previousResult) {
        pushToast('Hold B to A/B with previous sketch', 'info', 2600);
      }
    } catch (e) {
      const msg = formatStudioError(e instanceof Error ? e.message : String(e));
      set({ busy: false, error: msg });
      pushToast(msg, 'error', 0);
    }
  },

  generateAgain: async () => {
    await get().generate({ variation: 'again' });
  },

  vary: async () => {
    const buf = new Uint32Array(1);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(buf);
    } else {
      buf[0] = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    }
    const s = get();
    // Chaos ±0.15 (clamped 0–1) so Vary is audible + ACE caption energy words shift
    const sign = Math.random() < 0.5 ? -1 : 1;
    const nextChaos = Math.min(1, Math.max(0, (s.chaos ?? 0.25) + sign * 0.15));
    set({ seed: buf[0]! >>> 0, chaos: nextChaos });
    varyDiversityApplied = true;
    await get().generate({ variation: 'vary' });
  },

  redoSection: (index, style) =>
    get().generate({ edit: { kind: 'redo', sectionIndex: index, ...(style ? { style } : {}) } }),

  arrangeSection: async (op) => {
    const { result, busy } = get();
    if (busy) return;
    if (!result || !isStudioTake(result)) {
      pushToast('Arrangement editing needs a Studio (GPU) take', 'warn', 3600);
      return;
    }
    const structure = result.structure!;
    const mix = result.stems.find((s) => s.id === 'mix');
    const sourceBlob = result.rawMixBlob ?? mix?.blob;
    if (!sourceBlob) {
      pushToast('No Studio mix to edit', 'warn', 3200);
      return;
    }
    set({ busy: true, error: null });
    try {
      const decoded = decodeWavChannels(await sourceBlob.arrayBuffer());
      const bpm = result.bpmMeasured || structure.bpm;
      const plan = planArrange({
        op,
        channels: decoded.channels,
        structure,
        bpm,
        offsetSec: gridOffsetSec(result),
        sampleRateHz: decoded.sampleRate,
      });
      if (!plan) throw new Error('That arrangement change is not possible on this take');
      const splicedWav = encodeWav(
        plan.channels,
        decoded.sampleRate,
        decoded.bitDepth === 24 ? 24 : 16,
      );
      const style: SectionStyle | undefined =
        op.kind === 'insert' ? { role: roleForSectionName(op.name) } : undefined;
      set({ busy: false });
      await get().generate({
        edit: {
          kind: 'splice',
          source: splicedWav,
          structure: plan.structure,
          startSec: plan.repaint.startSec,
          endSec: plan.repaint.endSec,
          ...(style ? { style } : {}),
        },
      });
    } catch (e) {
      const msg = formatStudioError(e instanceof Error ? e.message : String(e));
      set({ busy: false, error: msg });
      pushToast(msg, 'error', 0);
    }
  },

  pickCandidate: async (index) => {
    const { result, busy, takeHistory } = get();
    if (busy || !result?.candidates?.length) return;
    const candidate = result.candidates[index];
    if (index < 0 || !candidate) return;
    // Swap stems to the candidate's mastered mix; raw/barGrid/master follow so
    // the next Redo edits this candidate's own raw audio.
    const next = withMixCandidate(result, index);
    const durationSec = next.stems.find((s) => s.id === 'mix')?.durationSec ?? 0;
    set({
      result: next,
      activeCandidate: index,
      takeHistory: [...takeHistory, result],
      warnings: [...get().warnings, `Picked Redo candidate ${index + 1} — no re-render`],
      flowStep: 'generated',
      loopRegion: null,
      abFlashback: false,
    });
    previewPlayer.clearStemCache();
    previewPlayer.onState = (ps) => set({ previewState: ps });
    try {
      await loadPreviewFromMixer(next, get().mixer);
      previewPlayer.setAuthoritativeDuration(durationSec);
      pushToast(`Candidate ${index + 1} selected — hit Play`, 'success', 2600);
    } catch (e) {
      const msg = formatStudioError(e instanceof Error ? e.message : String(e));
      set({ error: msg });
      pushToast(msg, 'error', 0);
    }
  },

  extendLastSection: (index, deltaBars) =>
    get().generate({ edit: { kind: 'extend', sectionIndex: index, deltaBars } }),

  polishDrops: async () => {
    const { result, busy } = get();
    if (busy) return;
    if (!result || !isStudioTake(result)) {
      pushToast('Polish drops needs a Studio (GPU) take', 'warn', 3600);
      return;
    }
    const dropIndexes = result
      .structure!.sections.map((s, i) => ({ name: s.name, i }))
      .filter((x) => x.name === 'drop')
      .map((x) => x.i);
    if (!dropIndexes.length) {
      pushToast('No drop sections to polish', 'warn', 3200);
      return;
    }
    set({ busy: true, error: null });
    let polished = 0;
    // One repaint per drop, best-of-2, auto-picking the top take score. Each
    // generate appends one takeHistory entry, so Undo steps back one drop.
    for (const sectionIndex of dropIndexes) {
      await get().generate({
        edit: { kind: 'redo', sectionIndex, style: { role: 'drop' } },
        batchSize: 2,
        autoPickBest: true,
      });
      if (get().error) break;
      polished++;
    }
    set({ busy: false });
    if (polished) {
      pushToast(
        `Polished ${polished} drop section${polished === 1 ? '' : 's'} — hit Play`,
        'success',
        3200,
      );
    }
  },

  recreateFromManifest: async (manifest) => {
    const params = recreateParamsFromManifest(manifest);
    const lmTemp = params.lmTemperature;
    const coherence: Coherence =
      lmTemp == null ? get().coherence : lmTemp <= 0.65 ? 'tight' : lmTemp >= 0.8 ? 'wild' : 'balanced';
    set({
      seed: params.seed >>> 0,
      bpm: clampProductBpm(params.bpm || DEFAULT_BPM),
      promptText: params.promptText,
      energy: params.energy,
      darkness: params.darkness,
      coherence,
      keepSeed: true,
      ...(params.masterTarget ? { masterTarget: params.masterTarget } : {}),
      ...(params.sampler ? { sampler: params.sampler } : {}),
    });
    await get().generate();
    if (!get().error) pushToast('Recreated from manifest — hit Play', 'success', 3200);
  },

  separateStems: async () => {
    const { result, stemsBusy } = get();
    if (stemsBusy) return;
    if (!result || !result.backendId.startsWith('ace-step')) {
      pushToast('Split stems needs a Studio (GPU) take', 'warn', 3600);
      return;
    }
    if (result.stemsReal) {
      pushToast('Stems are already real', 'info', 2200);
      return;
    }
    const mix = result.stems.find((s) => s.id === 'mix');
    if (!mix?.blob) {
      pushToast('No Studio mix blob to split', 'warn', 3200);
      return;
    }
    set({ stemsBusy: true, error: null });
    try {
      const real = await aceStepBackend.separateStems(mix.blob);
      if (!real.length) throw new Error('Demucs returned no usable stems');
      const stems = [...real, mix];
      // Honesty: only now may the "mirror mix" note go away.
      const dropMirror = (w: string) => !/mirror mix|share mix/i.test(w);
      const next: RenderResult = {
        ...result,
        stems,
        stemsReal: true,
        warnings: result.warnings.filter(dropMirror),
      };
      set({ result: next, stemsBusy: false, warnings: get().warnings.filter(dropMirror) });
      previewPlayer.clearStemCache();
      previewPlayer.onState = (ps) => set({ previewState: ps });
      await loadPreviewFromMixer(next, get().mixer);
      previewPlayer.setAuthoritativeDuration(mix.durationSec);
      pushToast(`Real stems ready · ${real.map((s) => s.id).join(', ')}`, 'success', 3400);
    } catch (e) {
      const msg = formatStudioError(e instanceof Error ? e.message : String(e));
      set({ stemsBusy: false, error: msg });
      pushToast(msg, 'error', 0);
    }
  },

  undoTakeEdit: async () => {
    const { takeHistory, mixer, busy } = get();
    if (busy || !takeHistory.length) return;
    const prev = takeHistory[takeHistory.length - 1]!;
    const discarded = get().result;
    set({
      result: prev,
      activeCandidate: 0,
      takeHistory: takeHistory.slice(0, -1),
      bars: prev.structure?.bars ?? get().bars,
      editedSections: null,
      loopRegion: null,
      abFlashback: false,
      flowStep: 'generated',
    });
    // The discarded take is no longer reachable from takeHistory — free its URLs.
    if (discarded && discarded !== prev) revokeResultUrls(discarded);
    previewPlayer.clearStemCache();
    previewPlayer.onState = (ps) => set({ previewState: ps });
    try {
      await loadPreviewFromMixer(prev, mixer);
      previewPlayer.setAuthoritativeDuration(prev.stems.find((x) => x.id === 'mix')?.durationSec);
      pushToast('Undid last edit — hit Play', 'info', 2400);
    } catch (e) {
      const msg = formatStudioError(e instanceof Error ? e.message : String(e));
      set({ error: msg });
      pushToast(msg, 'error', 0);
    }
  },

  play: async () => {
    try {
      const { result, mixer } = get();
      if (!result) {
        const msg = formatStudioError('Generate first, then Play.');
        set({ error: msg });
        pushToast(msg, 'error', 0);
        return;
      }
      // load → play (or toast). Style ref / mixerDirty must survive Play.
      previewPlayer.onState = (ps) => set({ previewState: ps });
      await loadPreviewFromMixer(result, mixer);
      if (mixerRefreshQueued) {
        mixerRefreshQueued = false;
        void refreshPreviewAfterMixerChange(set, get);
      }
      if (previewPlayer.state !== 'ready' && previewPlayer.state !== 'stopped') {
        set({ previewState: 'ready' });
      }
      await previewPlayer.play();
      if (previewPlayer.state !== 'playing') {
        await loadPreviewFromMixer(result, get().mixer);
        await previewPlayer.play();
      }
      if (previewPlayer.state !== 'playing') {
        const msg = formatStudioError('Preview could not start — hit Generate again, then Play.');
        set({
          error: msg,
          previewState: previewPlayer.state === 'idle' ? 'ready' : previewPlayer.state,
        });
        pushToast(msg, 'error', 0);
        return;
      }
      set({ previewState: 'playing', flowStep: 'played' });
    } catch (e) {
      const msg = formatStudioError(e instanceof Error ? e.message : String(e));
      set({ error: msg });
      pushToast(msg, 'error', 0);
    }
  },

  stop: () => previewPlayer.stop(),

  seekPreview: (ratio01) => {
    if (!get().result) return;
    previewPlayer.seek(ratio01);
    // Preserve ready|stopped|playing — never idle/loading from scrub
    const ps = previewPlayer.state;
    if (ps === 'ready' || ps === 'stopped' || ps === 'playing') {
      set({ previewState: ps });
    }
  },

  nudgeBar: (deltaBars) => {
    const { result } = get();
    const bars = result?.structure?.bars ?? 0;
    if (!result || bars <= 0) return;
    const cur = previewPlayer.getProgress();
    const next = Math.min(1, Math.max(0, (cur * bars + deltaBars) / bars));
    previewPlayer.seek(next);
    const ps = previewPlayer.state;
    if (ps === 'ready' || ps === 'stopped' || ps === 'playing') {
      set({ previewState: ps });
    }
  },

  setHelpOpen: (open) => set({ helpOpen: open }),

  restorePrevious: async () => {
    const { previousResult, result, mixer } = get();
    if (!previousResult) return;
    set({
      result: previousResult,
      activeCandidate: 0,
      previousResult: result,
      loopRegion: null,
      abFlashback: false,
      flowStep: 'generated',
      mixerUndoAvailable: false,
    });
    previewPlayer.clearStemCache();
    previewPlayer.onState = (ps) => set({ previewState: ps });
    try {
      await loadPreviewFromMixer(previousResult, mixer);
      const psAfter = previewPlayer.state;
      const previewReady =
        psAfter === 'ready' || psAfter === 'stopped' ? psAfter : 'ready';
      set({ previewState: previewReady, mixerDirty: computeMixerDirty(mixer) });
      pushToast('Previous sketch restored — hit Play', 'success', 2800);
    } catch (e) {
      const msg = formatStudioError(e instanceof Error ? e.message : String(e));
      set({ error: msg });
      pushToast(msg, 'error', 0);
    }
  },

  setLoopRegion: (start, end, opts) => {
    previewPlayer.setLoop(start, end);
    const loop = previewPlayer.getLoop();
    set({ loopRegion: loop });
    // #76 edge drag: trim without jumping playhead
    if (loop && opts?.seek !== false) previewPlayer.seek(loop.start);
  },

  clearLoopRegion: () => {
    previewPlayer.clearLoop();
    set({ loopRegion: null });
  },
  loopCurrentSection: () => {
    const s = get();
    const bars = s.result?.structure?.bars ?? 0;
    const sections = s.result?.structure?.sections;
    if (!s.result || bars <= 0 || !sections?.length) return;
    const progress = previewPlayer.getProgress();
    const { bar } = barBeatFromProgress(progress, bars);
    let cur = sections[0]!;
    for (const sec of sections) {
      if (bar >= sec.startBar && bar < sec.startBar + sec.lengthBars) {
        cur = sec;
        break;
      }
      if (bar >= sec.startBar) cur = sec;
    }
    const loop = sectionLoopRatios(cur.startBar, cur.lengthBars, bars);
    if (loop) {
      previewPlayer.setLoop(loop.start, loop.end);
      const live = previewPlayer.getLoop();
      set({ loopRegion: live });
    }
  },
  setWaveformZoom: (on) => set({ waveformZoom: !!on }),

  beginAbFlashback: async () => {
    const { previousResult, mixer, abFlashback } = get();
    if (!previousResult || abFlashback) return;
    // Set flag + toast first so Hold-B is observable even if decode/play fails (#47).
    set({ abFlashback: true, mixerAnnounce: 'A/B · previous sketch (hold B)' });
    pushToast('Hearing previous sketch — release B to return', 'info', 2800);
    previewPlayer.onState = (ps) => set({ previewState: ps });
    try {
      await loadPreviewFromMixer(previousResult, mixer);
      try {
        await previewPlayer.play();
      } catch {
        /* autoplay / AudioContext — flag stays on for UI */
      }
      set({ previewState: previewPlayer.state, abFlashback: true });
    } catch {
      // Keep abFlashback true so pill/toast remain observable; release B still ends (#47).
      set({ abFlashback: true, mixerAnnounce: 'A/B · previous sketch (hold B)' });
    }
  },

  endAbFlashback: async () => {
    const { result, mixer, abFlashback } = get();
    if (!abFlashback) return;
    set({ abFlashback: false, mixerAnnounce: 'A/B · back to current' });
    if (!result) return;
    previewPlayer.onState = (ps) => set({ previewState: ps });
    try {
      const wasPlaying = previewPlayer.state === 'playing';
      await loadPreviewFromMixer(result, mixer);
      if (wasPlaying) await previewPlayer.play();
      set({ previewState: previewPlayer.state });
    } catch {
      /* keep current */
    }
  },

  undoMixer: () => {
    if (!mixerUndoSnapshot) return;
    const mixer = cloneMixer(mixerUndoSnapshot);
    mixerUndoSnapshot = null;
    set({ mixer, mixerDirty: computeMixerDirty(mixer), mixerUndoAvailable: false });
    void refreshPreviewAfterMixerChange(set, get);
    pushToast('Mixer undo · one step back', 'info', 2200);
  },

  exportHeardSingle: () => {
    const { result, exportBitDepth } = get();
    if (!result) {
      const msg = formatStudioError('Generate first, then download what you heard.');
      set({ error: msg });
      pushToast(msg, 'error', 0);
      return;
    }
    const depthLabel = `${exportBitDepth}-bit Sketch`;
    pushToast(`Preparing mix you heard · ${depthLabel}…`, 'info', 2200);
    void (async () => {
      try {
        const live = get();
        const depth = live.exportBitDepth === 24 ? 24 : 16;
        const liveMixer = live.mixer;
        const ids = audibleStemIds(liveMixer.mute, liveMixer.solo, STEM_IDS);
        const anyMute = STEM_IDS.some((id) => liveMixer.mute[id]);
        const anySolo = STEM_IDS.some((id) => liveMixer.solo[id]);
        const anyGain = REMIX_STEM_IDS.some((id) => (liveMixer.gainDb[id] ?? 0) !== 0);
        const needsRemix = anyMute || anySolo || anyGain || live.mixerDirty;
        let blob: Blob;
        if (needsRemix) {
          const remixIds = remixStemIdsForResult(result, ids);
          const stems = result.stems.filter((x) => remixIds.includes(x.id as RemixStemId));
          if (!stems.length) throw new Error('All stems muted — unmute one to export what you heard.');
          const gains: Partial<Record<string, number>> = {};
          for (const stem of stems) {
            if (isRemixStem(stem.id)) gains[stem.id] = liveMixer.gainDb[stem.id] ?? 0;
          }
          blob = (await renderRemixedWavBlob(stems, gains, depth)).blob;
        } else {
          const mix = result.stems.find((x) => x.id === 'mix');
          if (!mix?.blob) throw new Error('No mix stem to download');
          const { ensureWavBitDepth } = await import('@/core/export/wav');
          blob = await ensureWavBitDepth(mix.blob, depth);
        }
        const { downloadBlob } = await import('@/core/export/download');
        const prefix =
          result.backendId === 'offline-stub' || result.backendId.startsWith('offline')
            ? `offline_stub_heard_${result.seed}`
            : `dnb_heard_${result.seed}`;
        downloadBlob(blob, `${prefix}.wav`);
        pushToast(`Downloaded the mix you heard · ${depth}-bit Sketch`, 'success', 2800);
      } catch (e) {
        const msg = formatStudioError(e instanceof Error ? e.message : String(e));
        set({ error: msg });
        pushToast(msg, 'error', 0);
      }
    })();
  },

  exportStems: () => {
    const { result, mixer, exportBitDepth } = get();
    if (!result) {
      const msg = formatStudioError('Generate first, then export.');
      set({ error: msg });
      pushToast(msg, 'error', 0);
      return;
    }
    const depth = exportBitDepth === 24 ? 24 : 16;
    const depthLabel = `${depth}-bit Sketch`;
    const sketchPrefix =
      result.backendId === 'offline-stub' || result.backendId.startsWith('offline')
        ? `offline_stub_sketch_${result.seed}`
        : `dnb_${result.backendId.replace(/[^a-z0-9_-]+/gi, '_')}_${result.seed}`;
    // #63 one export name chip/toast (stack ≤3 handled by toasts lib)
    const zipName = `${sketchPrefix}_export.zip`;
    const heardNote = computeMixerDirty(mixer) ? ' · + mix_as_heard if remixed' : ' · dry stems';
    pushToast(`Export · ${zipName} · ${depthLabel}${heardNote}`, 'info', 3200);
    void (async () => {
      try {
        // heard=exported: when mixer remixed, bake mix_as_heard.wav (same path as preview)
        const ids = audibleStemIds(mixer.mute, mixer.solo, STEM_IDS);
        const anyMute = STEM_IDS.some((id) => mixer.mute[id]);
        const anySolo = STEM_IDS.some((id) => mixer.solo[id]);
        const anyGain = REMIX_STEM_IDS.some((id) => (mixer.gainDb[id] ?? 0) !== 0);
        const needsRemix = anyMute || anySolo || anyGain;
        let asHeardMix: Blob | undefined;
        let preGluePeak = 0;
        if (needsRemix) {
          const remixIds = remixStemIdsForResult(result, ids);
          const stems = result.stems.filter((s) => remixIds.includes(s.id as RemixStemId));
          if (stems.length) {
            const gains: Partial<Record<string, number>> = {};
            for (const s of stems) {
              if (isRemixStem(s.id)) gains[s.id] = mixer.gainDb[s.id] ?? 0;
            }
            const remixed = await renderRemixedWavBlob(stems, gains, depth);
            asHeardMix = remixed.blob;
            preGluePeak = remixed.preGluePeak;
          }
        }
        const live = get();
        await exportZip(result, sketchPrefix, {
          bitDepth: depth,
          ...(asHeardMix ? { asHeardMix } : {}),
          sketchNotes: buildSketchNotes({
            seed: result.seed,
            bpm: result.bpmMeasured || 174,
            bars: result.structure?.bars ?? live.bars,
            energy: live.energy,
            darkness: live.darkness,
            chaos: live.chaos,
            bitDepth: depth as 16 | 24,
            mixAsHeard: Boolean(asHeardMix),
            promptText: live.promptText,
          }),
        });
        set({ flowStep: 'exported' });
        // #86 once DAW tip — skip if a first-play/export coach flag still pending (mutex)
        if (
          shouldShowExportDawTip() &&
          !shouldShowFirstPlayCoach() &&
          !shouldShowFirstExportCoach()
        ) {
          markExportDawTipSeen();
          pushToast('ZIP downloaded — open it in your music software', 'info', 4800);
        }
        // #51 Soft peak warn — never blocks Export. Push BEFORE success so stack keeps warn (#50).
        // Soft-limit may keep encoded peak <0.98; warn on pre-glue hot OR gain≥+6 OR peak≥threshold.
        const hotGain = REMIX_STEM_IDS.some((id) => (mixer.gainDb[id] ?? 0) >= GAIN_MAX);
        let peakHot = hotGain || preGluePeak >= EXPORT_HOT_PEAK_PREGLUE;
        try {
          const peakBlob =
            asHeardMix ??
            result.stems.find((s) => s.id === 'mix')?.blob ??
            null;
          if (peakBlob) {
            const encodedPeak = wavPcmPeakAbs(await peakBlob.arrayBuffer());
            if (encodedPeak >= EXPORT_HOT_PEAK || encodedPeak >= EXPORT_HOT_PEAK_PREGLUE) {
              peakHot = true;
            }
          }
        } catch {
          /* peak scan best-effort — hotGain alone still warns */
        }
        if (peakHot) {
          pushToast('Mix looks hot — Export still ran', 'warn', 5200);
        }
        // #44 Export success honesty strip (~5s) — mixerDirty drives copy
        const dirty = get().mixerDirty || !!asHeardMix;
        pushToast(
          dirty
            ? `Downloaded ZIP · ${depthLabel} · includes mix_as_heard`
            : `Downloaded ZIP · ${depthLabel} · dry stems + mix`,
          'success',
          5000,
        );
      } catch (e) {
        const msg = formatStudioError(e instanceof Error ? e.message : String(e));
        set({ error: msg });
        pushToast('ZIP failed — downloading stems individually as fallback', 'warn', 6000);
        exportAll(result, sketchPrefix, depth);
      }
    })();
  },
}));


/** Survive Vite HMR so concurrent agent edits don't wipe Style Ref / preview (E2E).
 *  Old saved data may still carry a `mode` key — it is never read (one layout). */
if (import.meta.hot) {
  import.meta.hot.accept();
  const saved = import.meta.hot.data.studioData as Record<string, unknown> | undefined;
  if (saved) {
    useStudioStore.setState({
      productTier: (saved.productTier as StudioState['productTier']) ?? 'sketch',
      moreOpen: saved.moreOpen as boolean,
      exportBitDepth: (saved.exportBitDepth as StudioState['exportBitDepth']) ?? DEFAULT_BIT_DEPTH,
      vibe: saved.vibe as StudioState['vibe'],
      ownerConfirmed: saved.ownerConfirmed as boolean,
      vibeIntensity: saved.vibeIntensity as number,
      result: saved.result as StudioState['result'],
      activeCandidate: 0,
      previousResult: (saved.previousResult as StudioState['previousResult']) ?? null,
      loopRegion: (saved.loopRegion as StudioState['loopRegion']) ?? null,
      mixer: saved.mixer as StudioState['mixer'],
      mixerDirty: saved.mixerDirty as boolean,
      previewState: saved.previewState as StudioState['previewState'],
      flowStep: saved.flowStep as StudioState['flowStep'],
      energy: saved.energy as number,
      darkness: saved.darkness as number,
      chaos: saved.chaos as number,
      seed: saved.seed as number,
      bars: saved.bars as number,
      bpm: saved.bpm as number,
      promptText: saved.promptText as string,
      genre: ((saved.genre as GenreId) in GENRES ? (saved.genre as GenreId) : 'dnb'),
      backendId: saved.backendId as string,
      paramsDirty: saved.paramsDirty as boolean,
      lastRenderFingerprint: saved.lastRenderFingerprint as StudioState['lastRenderFingerprint'],
    });
  }
  import.meta.hot.dispose(() => {
    const s = useStudioStore.getState();
    import.meta.hot!.data.studioData = {
      productTier: s.productTier,
      moreOpen: s.moreOpen,
      exportBitDepth: s.exportBitDepth,
      vibe: s.vibe,
      ownerConfirmed: s.ownerConfirmed,
      vibeIntensity: s.vibeIntensity,
      result: s.result,
      previousResult: s.previousResult,
      loopRegion: s.loopRegion,
      mixer: s.mixer,
      mixerDirty: s.mixerDirty,
      previewState: s.previewState,
      flowStep: s.flowStep,
      energy: s.energy,
      darkness: s.darkness,
      chaos: s.chaos,
      seed: s.seed,
      bars: s.bars,
      bpm: s.bpm,
      promptText: s.promptText,
      genre: s.genre,
      backendId: s.backendId,
      paramsDirty: s.paramsDirty,
      lastRenderFingerprint: s.lastRenderFingerprint,
    };
  });
}

export function listLoraPacks() {
  return loraPackManager.list();
}

export function loraNotes() {
  return loraPackManager.provenanceNotes;
}

export { REMIX_STEM_IDS };
