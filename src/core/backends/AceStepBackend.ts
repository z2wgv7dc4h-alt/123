/**
 * AceStepBackend â€” GPU path via localhost DnB bridge â†’ ACE-Step API on RTX 5080.
 * Probe: GET http://127.0.0.1:8766/probe (hasGpu true when ACE upstream is up).
 * Render: POST /render â†’ mixWavBase64 â†’ playable StemFile blobs.
 * Structure authority stays HardGridStructureEngine (MIDI/grid); ACE supplies timbre/mix.
 */
import type {
  AudioBackend,
  BackendCaps,
  BarGrid,
  HardwareProbe,
  RenderJob,
  RenderResult,
  StemFile,
  StemId,
  MasterReport,
  StudioCandidate,
  AceRequestRecord,
  RealBreakLoopProvenance,
} from '../types';
import { buildExportManifest } from '../export/manifest.ts';
import { structureEngine, deriveBreakDensity } from '../structure/StructureEngine.ts';
import { structureToMidiBlob } from '../midi/exportMidi.ts';
import { buildAceCaption, buildAceLyrics, buildAceTags } from '../prompt';
import { estimateBarGrid } from '../audio/downbeatGrid';
import { decodeWavToMono } from '../audio/onsetGrid';
import { decodeWavChannels, encodeWav } from '../export/wav';
import { masterStereo } from '../audio/master';
import { scoreTake } from '../audio/takeScore';
import { extractReferenceWindow } from '../audio/referenceWindow';
import { buildStudioBreakLayer, breakTempoOk, hasDropSections, STUDIO_BREAK_BPM } from '../audio/studioBreakLayer';
import { MASTER_TARGET_LUFS } from '../types';

const CAPS: BackendCaps = {
  fullSong: true,
  legoStems: true,
  extract: true,
  repaint: true,
  textureOneshots: false,
  maxDurationSec: 240,
  sampleRatesHz: [48000],
  loraLoad: true,
  requiresGpu: true,
};

function aceSidecarBase(): string {
  // Browser (incl. phone on LAN): same-origin Vite proxy -> PC localhost:8766 (avoids firewall/CORS).
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/ace-bridge`;
  }
  return 'http://127.0.0.1:8766';
}
/**
 * ACE-Step inference parameters, checked against ACE-Step 1.5's own
 * docs/en/INFERENCE.md: base "1-200 (recommended 32-64)", high-quality tip
 * "Use base model with inference_steps=64 or higher" + "Enable use_adg=True";
 * turbo "recommended 8" and ADG is ignored there.
 */
export const ACE_BASE_INFERENCE_STEPS = 64;
export const ACE_TURBO_INFERENCE_STEPS = 8;
/** @deprecated name kept for tests — the base/SFT step count. */
export const ACE_INFERENCE_STEPS = ACE_BASE_INFERENCE_STEPS;
/** Studio default DiT when the probe did not name one: XL-turbo (4B, offload). */
export const ACE_DEFAULT_CHECKPOINT = 'acestep-v15-xl-turbo';
export const ACE_GUIDANCE_SCALE = 7.0;

export function isTurboCheckpoint(checkpoint: string | null | undefined): boolean {
  return /turbo/i.test(String(checkpoint ?? ''));
}

/** Steps + ADG for the checkpoint ACE actually has loaded. */
export function aceSamplerFor(checkpoint: string | null | undefined): {
  inferenceSteps: number;
  useAdg: boolean;
} {
  return isTurboCheckpoint(checkpoint)
    ? { inferenceSteps: ACE_TURBO_INFERENCE_STEPS, useAdg: false }
    : { inferenceSteps: ACE_BASE_INFERENCE_STEPS, useAdg: true };
}
/** Timestep shift — base-model-only per ACE-Step docs. */
export const ACE_SHIFT = 3.0;
/**
 * LM on for text2music: the 5Hz LM plans the track (audio codes). The bridge
 * keeps use_cot_caption/use_cot_language false so the LM cannot rewrite our
 * concrete DnB caption or invent sung words; its only vocal-free structure
 * comes from the section map. Cover/repaint still force thinking off.
 */
export const ACE_THINKING = true;
/**
 * Cover strength for real audio2audio (style-ref attached only). ACE-Step's
 * own API doc recommends ~0.2 for light style transfer; the schema default
 * of 1.0 is closer to literal reconstruction. 0.55 is the default here, and
 * overrides are clamped to the validated 0.35-0.7 window.
 */
export const ACE_COVER_STRENGTH = 0.55;
export const ACE_COVER_STRENGTH_MIN = 0.35;
export const ACE_COVER_STRENGTH_MAX = 0.7;

/** Clamp a cover-strength override into ACE's validated window. */
export function clampCoverStrength(value?: number | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ACE_COVER_STRENGTH;
  return Math.min(ACE_COVER_STRENGTH_MAX, Math.max(ACE_COVER_STRENGTH_MIN, value));
}

/**
 * Redo repaint controls. `batchSize` asks ACE for best-of-N mixes in one task
 * so the user can pick one; the bridge caps it at 4. Strength is 0..1.
 */
export const ACE_REDO_BATCH_SIZE = 3;
/**
 * Generate best-of-2 in one GPU task: the bridge returns every ACE batch
 * result file as `candidates`, so the browser picks a take without re-rendering.
 */
export const ACE_TEXT2MUSIC_BATCH_SIZE = 2;
export const ACE_REPAINT_STRENGTH_DEFAULT = 0.5;
export function clampRepaintStrength(value?: number | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ACE_REPAINT_STRENGTH_DEFAULT;
  return Math.min(1, Math.max(0, value));
}

/** text2music below this many bars renders too short to be useful; clamp it. */
export const ACE_TEXT2MUSIC_MIN_BARS = 16;
export function clampText2MusicBars(durationBars: number): number {
  return Math.max(ACE_TEXT2MUSIC_MIN_BARS, durationBars);
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000; // avoid arg-count limits on large files
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export const ACE_PROBE_TIMEOUT_MS = 12000;
// XL-turbo + CPU offload is slower than plain turbo; allow 11 min.
export const ACE_RENDER_TIMEOUT_MS = 660_000;
export function getAceSidecarBase(): string {
  return aceSidecarBase();
}
/** @deprecated prefer getAceSidecarProbeUrl() — kept for tests */
export const ACE_SIDECAR_BASE = typeof window !== "undefined" ? `${window.location.origin}/ace-bridge` : "http://127.0.0.1:8766";
export const ACE_SIDECAR_PROBE_URL = `${ACE_SIDECAR_BASE}/probe`;
export const ACE_SIDECAR_RENDER_URL = `${ACE_SIDECAR_BASE}/render`;
export const ACE_SIDECAR_STEMS_URL = `${ACE_SIDECAR_BASE}/stems`;
export function getAceSidecarProbeUrl(): string {
  return `${aceSidecarBase()}/probe`;
}
export function getAceSidecarRenderUrl(): string {
  return `${aceSidecarBase()}/render`;
}
export function getAceSidecarStemsUrl(): string {
  return `${aceSidecarBase()}/stems`;
}

/** Demucs htdemucs output is 4-track; only these map to our StemIds. */
export const DEMUCS_STEM_IDS = ['drums', 'bass', 'other'] as const;
export const DEMUCS_TIMEOUT_MS = 300_000;

function failSoftNotes(extra?: string): string[] {
  const notes = [
    'GPU required (CUDA). Local path: RTX 5080 via ACE API :8001 + DnB bridge :8766.',
    'Fail-soft: without probe.hasGpu=true â†’ OfflineStub sketch.',
    'Run scripts/windows/start-ace-stack.ps1 then npm run dev.',
  ];
  if (extra) notes.push(extra);
  return notes;
}

function b64ToBlob(b64: string, mime = 'audio/wav'): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function stemFromB64(id: StemId, b64: string, durationSec: number, sampleRateHz: number, bitDepth: number): StemFile {
  const blob = b64ToBlob(b64);
  return {
    id,
    url: URL.createObjectURL(blob),
    blob,
    channels: 2,
    sampleRateHz,
    bitDepth,
    durationSec,
  };
}

export class AceStepBackend implements AudioBackend {
  readonly id = 'ace-step-1.5';
  readonly role = 'song' as const;
  readonly displayName = 'Studio ACE (GPU)';
  readonly capabilities = CAPS;
  readonly preferredCheckpoints = [
    'ACE-Step/Ace-Step1.5:acestep-v15-sft',
    'ACE-Step/Ace-Step1.5:acestep-v15-base',
    'ACE-Step/Ace-Step1.5:acestep-v15-turbo',
  ] as const;
  readonly deviceHint = 'cuda:0' as const;
  /** DiT the bridge reported on the last GPU probe; null = not reported. */
  loadedCheckpoint: string | null = null;

  private failSoft(extra?: string): HardwareProbe {
    return {
      hasGpu: false,
      vramGb: undefined,
      backend: this.id,
      notes: failSoftNotes(extra),
    };
  }

  async probe(): Promise<HardwareProbe> {
    if (typeof fetch !== 'function') {
      return this.failSoft('fetch unavailable in this runtime');
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ACE_PROBE_TIMEOUT_MS);
    try {
      const res = await fetch(getAceSidecarProbeUrl(), {
        method: 'GET',
        signal: ctrl.signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return this.failSoft(`sidecar /probe HTTP ${res.status}`);
      let data: { hasGpu?: unknown; vramGb?: unknown; notes?: unknown; checkpoint?: unknown };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        return this.failSoft('sidecar /probe returned non-JSON');
      }
      if (data?.hasGpu === true) {
        const notesFromSidecar = Array.isArray(data.notes) ? data.notes.map((n) => String(n)) : [];
        this.loadedCheckpoint =
          typeof data.checkpoint === 'string' && data.checkpoint ? data.checkpoint : null;
        return {
          hasGpu: true,
          vramGb: typeof data.vramGb === 'number' ? data.vramGb : undefined,
          checkpoint: this.loadedCheckpoint ?? undefined,
          backend: this.id,
          notes: [
            ...notesFromSidecar,
            'Sidecar /probe hasGpu=true â€” Studio ACE path active',
          ],
        };
      }
      return this.failSoft('sidecar reachable but hasGpuâ‰ true');
    } catch {
      return this.failSoft('sidecar unreachable â€” start start-ace-stack.ps1');
    } finally {
      clearTimeout(timer);
    }
  }

  prepareStyleReferenceForAce(_job: RenderJob): { hash?: string; pending: true } {
    return {
      hash:
        _job.styleReference && 'hash' in _job.styleReference
          ? (_job.styleReference as { hash?: string }).hash
          : undefined,
      pending: true,
    };
  }

  async cancel(_jobId: string): Promise<void> {
    /* bridge cancel not wired */
  }

  async render(job: RenderJob): Promise<RenderResult> {
    // Real audio uploads. `reference` (default) is text2music timbre/mix
    // guidance via ACE's `reference_audio`; `cover` is real audio2audio that
    // switches task_type and goes over as `src_audio`. A repaint edit always
    // uses `src_audio` for the take, and may still carry a reference.
    const styleAudio = job.styleReference?.file;
    const styleMode = job.styleReference?.mode ?? 'reference';
    const editAudio = job.edit?.source;
    const ownerAttested = Boolean(job.styleReference?.ownerAttested);
    // text2music = no source audio: no repaint edit and not a cover render.
    const isText2Music = !editAudio && !(styleMode === 'cover' && styleAudio && ownerAttested);
    const requestedBars = job.durationBars;
    const durationBars = isText2Music ? clampText2MusicBars(requestedBars) : requestedBars;
    if (durationBars !== requestedBars) {
      console.warn(
        `ACE text2music durationBars ${requestedBars} < ${ACE_TEXT2MUSIC_MIN_BARS}; clamped to ${durationBars}`,
      );
    }

    const structure = job.structureRef ?? await structureEngine.plan({
      seed: job.seed,
      bpm: job.bpm,
      bars: durationBars,
      energy: job.prompt.energy,
      darkness: job.prompt.darkness,
      chaos: job.prompt.chaos,
      breakDensity: deriveBreakDensity({ chaos: job.prompt.chaos ?? 0.25 }),
      sampleRateHz: job.sampleRateHz,
      songShape: job.songShape,
      sectionsOverride: job.sectionsOverride,
    });

    // Send ACE only the loudest 45 s window of the user's reference (drop-like
    // energy), not the whole track. Edits keep their own untrimmed source.
    const styleAudioForAce =
      styleAudio && ownerAttested ? await extractReferenceWindow(styleAudio) : undefined;
    const styleAudioB64 = styleAudioForAce ? await blobToBase64(styleAudioForAce) : undefined;
    const srcAudioBase64 = editAudio
      ? await blobToBase64(editAudio)
      : styleMode === 'cover'
        ? styleAudioB64
        : undefined;
    const refAudioBase64 = styleMode === 'reference' ? styleAudioB64 : undefined;

    // Only name a checkpoint the server said it has loaded; otherwise the
    // bridge uses ACE's loaded model. Hardcoding base here overrode SFT.
    const checkpoint = this.loadedCheckpoint;
    const sampler = aceSamplerFor(checkpoint ?? ACE_DEFAULT_CHECKPOINT);
    const caption = buildAceCaption({
      energy: job.prompt.energy,
      darkness: job.prompt.darkness,
      chaos: job.prompt.chaos,
      layers: job.layers,
      userText: job.prompt.text,
      descriptors: job.prompt.descriptors,
      songShape: job.songShape,
      genre: job.genre,
      sectionRole: job.sectionRole,
      sections: job.sectionRole ? undefined : structure.sections.map((s) => s.name),
      seed: job.seed,
    });
    // Snapshot for Status chrome — the payload actually posted, not a claim.
    // Cover/repaint skip the LM (source audio is the plan), text2music runs it.
    const thinking = srcAudioBase64 ? false : ACE_THINKING;
    const acePayload = {
      thinking,
      captionFamily: job.genre === 'dubstep'
        ? 'Dubstep'
        : job.genre === 'trap'
          ? 'Trap'
          : job.genre === 'jungle'
            ? 'Jungle'
            : /drum and bass|dnb/i.test(caption)
              ? 'DnB'
              : 'other',
      steps: sampler.inferenceSteps,
      model: checkpoint ?? ACE_DEFAULT_CHECKPOINT,
    };

    // Exact ACE request (minus audio blobs) for the manifest / Recreate.
    const aceLyrics = buildAceLyrics(structure.sections.map((s) => s.name));
    const aceRequest: AceRequestRecord = {
      caption,
      lyrics: aceLyrics,
      bpm: job.bpm,
      seed: job.seed,
      model: checkpoint ?? ACE_DEFAULT_CHECKPOINT,
      thinking,
      inferenceSteps: sampler.inferenceSteps,
      useAdg: sampler.useAdg,
      guidanceScale: ACE_GUIDANCE_SCALE,
      shift: ACE_SHIFT,
      lmTemperature: typeof job.lmTemperature === 'number' ? job.lmTemperature : 0.7,
      sampler: job.sampler ?? 'ode',
      masterTarget: job.masterTarget ?? 'balanced',
      ...(job.edit
        ? {
            repaint: {
              startSec: job.edit.startSec,
              endSec: job.edit.endSec,
              mode: job.edit.mode ?? 'balanced',
              strength: clampRepaintStrength(job.edit.strength),
            },
          }
        : {}),
      ...(job.styleReference && 'hash' in job.styleReference && job.styleReference.hash
        ? { referenceHash: job.styleReference.hash }
        : {}),
    };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ACE_RENDER_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(getAceSidecarRenderUrl(), {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          jobId: job.jobId,
          seed: job.seed,
          bpm: job.bpm,
          bpmTolerance: job.bpmTolerance,
          durationBars,
          sampleRateHz: job.sampleRateHz,
          bitDepth: job.bitDepth,
          channels: job.channels,
          // LM plans the track; bridge locks caption/language CoT off so the
          // concrete DnB caption survives and the section map is the only text.
          // Cover tasks have source audio to plan from, so the bridge forces
          // thinking off there.
          thinking,
          inferenceSteps: sampler.inferenceSteps,
          useAdg: sampler.useAdg,
          guidanceScale: ACE_GUIDANCE_SCALE,
          shift: ACE_SHIFT,
          ...(typeof job.lmTemperature === 'number' && Number.isFinite(job.lmTemperature)
            ? { lmTemperature: job.lmTemperature }
            : {}),
          ...(job.sampler === 'ode' || job.sampler === 'sde' ? { sampler: job.sampler } : {}),
          ...(job.edit
            ? {
                srcAudioBase64,
                srcAudioFileName: 'take.wav',
                taskType: 'repaint',
                repaintStartSec: job.edit.startSec,
                repaintEndSec: job.edit.endSec,
                repaintMode: job.edit.mode ?? 'balanced',
                repaintStrength: clampRepaintStrength(job.edit.strength),
                // Best-of-N: bridge returns every result file as a candidate.
                batchSize: job.batchSize ?? ACE_REDO_BATCH_SIZE,
              }
            : srcAudioBase64
              ? {
                  srcAudioBase64,
                  srcAudioFileName: job.styleReference?.fileName ?? 'style-ref.wav',
                  audioCoverStrength: clampCoverStrength(job.styleReference?.coverStrength),
                }
              : {
                  // Best-of-N generated takes in one GPU task.
                  batchSize: job.batchSize ?? ACE_TEXT2MUSIC_BATCH_SIZE,
                }),
          // Reference mode: text2music timbre/mix guidance, task_type unchanged.
          // Rides alongside the repaint `src_audio` when both are present.
          ...(refAudioBase64
            ? {
                refAudioBase64,
                refAudioFileName: job.styleReference?.fileName ?? 'style-ref.wav',
              }
            : {}),
          // ACE lyrics = timeline: song-map structure tags, no words.
          lyrics: aceLyrics,
          prompt: {
            text: caption,
            tags: buildAceTags({
              energy: job.prompt.energy,
              darkness: job.prompt.darkness,
              chaos: job.prompt.chaos,
              layers: job.layers,
              descriptors: job.prompt.descriptors,
              seed: job.seed,
            }),
            energy: job.prompt.energy,
            darkness: job.prompt.darkness,
          },
          structureRef: {
            version: structure.version,
            bpm: structure.bpm,
            bars: structure.bars,
            samplesPerBar: structure.samplesPerBar,
            // ACE has zero temporal signal without this — bridge maps these to
            // lyric section tags so the drop/build/breakdown actually land where
            // the arrangement map says they do, instead of one flat instrumental blob.
            sections: structure.sections.map((s) => ({
              name: s.name,
              startBar: s.startBar,
              lengthBars: s.lengthBars,
            })),
          },
          stemSchemaVersion: job.stemSchemaVersion,
          ...(checkpoint ? { checkpointId: checkpoint } : {}),
        }),
      });
    } catch (e) {
      clearTimeout(timer);
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `ACE sidecar /render failed (${msg}). Start scripts/windows/start-ace-stack.ps1 (ACE :8001 + bridge :8766).`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 503) {
      throw new Error(
        'ACE GPU path offline (sidecar 503). Start ACE API on :8001 and ace_bridge_server.py on :8766.',
      );
    }
    if (!res.ok) {
      let detail = '';
      try {
        detail = await res.text();
      } catch {
        /* ignore */
      }
      throw new Error(`ACE sidecar /render HTTP ${res.status}: ${detail.slice(0, 400)}`);
    }

    const data = (await res.json()) as {
      jobId?: string;
      seed?: number;
      bpmMeasured?: number;
      backendId?: string;
      checkpointId?: string;
      gpuUsed?: boolean;
      mixWavBase64?: string;
      warnings?: string[];
      candidates?: Array<{ wavBase64?: string; durationSec?: number }>;
      stems?: Array<{
        id?: string;
        wavBase64?: string;
        durationSec?: number;
        sampleRateHz?: number;
        bitDepth?: number;
      }>;
    };

    const mixB64 = data.mixWavBase64 || data.stems?.find((s) => s.id === 'mix')?.wavBase64;
    if (!mixB64) {
      throw new Error('ACE sidecar returned no mixWavBase64 â€” generation produced no audio');
    }

    const durationSec =
      data.stems?.find((s) => s.id === 'mix')?.durationSec ??
      (structure.samplesPerBar * structure.bars) / job.sampleRateHz;
    const sr = job.sampleRateHz;
    const bitDepth = job.bitDepth;

    // Decode failures are surfaced, never silent — otherwise R-5 mastering,
    // R-3 barGrid and E-1 splices quietly no-op on real takes.
    const decodeWarnings: string[] = [];

    // Reference tone match (any style-ref mode) when the file decodes.
    let reference: { channels: Float32Array[]; sampleRate: number } | undefined;
    if (styleAudio) {
      try {
        const refDecoded = decodeWavChannels(await styleAudio.arrayBuffer());
        reference = { channels: refDecoded.channels, sampleRate: refDecoded.sampleRate };
      } catch {
        /* reference not decodable — fall back to the genre tilt */
      }
    }

    // Mastering loudness preset (Balanced -11 is the Studio default).
    const targetLufs =
      MASTER_TARGET_LUFS[job.masterTarget ?? 'balanced'] ?? MASTER_TARGET_LUFS.balanced;

    const bytesFromB64 = (b64: string): Uint8Array => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    };
    const b64FromBytes = (bytes: Uint8Array): string => {
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
      return btoa(binary);
    };

    type ProcessedCandidate = StudioCandidate & { rawB64: string; mixB64: string; score: number };

    // Studio real break layer — additive, pre-mastering; the RAW mix stays
    // untouched so take edits never bake in the loop.
    let realBreak: RealBreakLoopProvenance | undefined;
    let realBreakTempoSkipped = false;

    // EVERY candidate gets its own raw decode, bar grid and master pass, so
    // picking any take keeps edits (rawMixBlob) and R-3 grid in sync.
    const processCandidate = async (rawB64: string): Promise<ProcessedCandidate> => {
      const rawBytes = bytesFromB64(rawB64);
      let decoded: ReturnType<typeof decodeWavChannels> | undefined;
      let decodeError: string | undefined;
      try {
        decoded = decodeWavChannels(rawBytes.buffer);
      } catch (e) {
        decodeError = e instanceof Error ? e.message : String(e);
        decodeWarnings.push(`Candidate decode skipped: ${decodeError}`);
      }
      let candidateGrid: BarGrid | undefined;
      try {
        const mono = decodeWavToMono(rawBytes.buffer);
        candidateGrid = estimateBarGrid(mono.mono, mono.sampleRateHz, structure.bpm);
      } catch (e) {
        decodeWarnings.push(`Bar grid skipped: ${e instanceof Error ? e.message : String(e)}`);
      }
      let mixB64 = rawB64;
      let candidateMaster: MasterReport | undefined;
      // Layer the licensed break under drop bars BEFORE mastering.
      if (decoded && decoded.channels.length === 2 && job.layers?.realBreak !== false) {
        if (!breakTempoOk(structure.bpm)) {
          realBreakTempoSkipped = true;
        } else if (hasDropSections(structure)) {
          const layer = await buildStudioBreakLayer({
            totalSamples: decoded.channels[0]!.length,
            sampleRateHz: decoded.sampleRate,
            bpm: structure.bpm,
            chaos: job.prompt.chaos ?? 0.25,
            sections: structure.sections,
            samplesPerBar: structure.samplesPerBar,
            offsetSec: candidateGrid?.offsetSec ?? 0,
            ...(typeof job.realBreakGainDb === 'number' ? { gainDb: job.realBreakGainDb } : {}),
          });
          if (layer) {
            const bus = layer.bus;
            for (let i = 0; i < bus.length; i++) {
              decoded.channels[0]![i] = decoded.channels[0]![i]! + bus[i]!;
              decoded.channels[1]![i] = decoded.channels[1]![i]! + bus[i]!;
            }
            if (!realBreak) {
              realBreak = {
                used: true,
                loopName: layer.loopName,
                patternFamily: layer.patternFamily,
                gain: layer.gain,
                note: `Mix contains a real pre-recorded breakbeat loop (${layer.loopName}) blended under drop bars — this render is not 100% synthesized.`,
              };
            }
          }
        }
      }
      if (job.master !== false && decoded && decoded.channels.length === 2) {
        try {
          const mastered = masterStereo(
            decoded.channels[0]!,
            decoded.channels[1]!,
            decoded.sampleRate,
            {
              targetLufs,
              ...(reference ? { reference } : {}),
              genre: job.genre ?? 'dnb',
            },
          );
          const masteredWav = encodeWav([mastered.left, mastered.right], sr, 16);
          mixB64 = b64FromBytes(new Uint8Array(await masteredWav.arrayBuffer()));
          candidateMaster = mastered.report;
        } catch (e) {
          decodeWarnings.push(
            `Mastering skipped: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      } else if (job.master !== false && !decoded) {
        decodeWarnings.push(`Mastering skipped: ${decodeError ?? 'unsupported WAV'}`);
      }
      const score = decoded
        ? scoreTake({
            channels: decoded.channels,
            sampleRateHz: decoded.sampleRate,
            bpm: structure.bpm,
            genre: job.genre ?? 'dnb',
            structure,
          }).total
        : 0;
      return {
        raw: b64ToBlob(rawB64),
        mix: b64ToBlob(mixB64),
        ...(candidateGrid ? { barGrid: candidateGrid } : {}),
        ...(candidateMaster ? { master: candidateMaster } : {}),
        rawB64,
        mixB64,
        score,
      };
    };

    const rawCandidateB64 = (data.candidates ?? [])
      .map((c) => (typeof c?.wavBase64 === 'string' && c.wavBase64 ? c.wavBase64 : null))
      .filter((b): b is string => b !== null);
    const rawList = rawCandidateB64.length ? rawCandidateB64 : [mixB64];
    let processed: ProcessedCandidate[] = [];
    for (const rawB64 of rawList) processed.push(await processCandidate(rawB64));

    // Rank best-first so Take A is the best-scoring take.
    let candidateScores: number[] | undefined;
    if (processed.length > 1) {
      processed.sort((a, b) => b.score - a.score);
      candidateScores = processed.map((c) => c.score);
    }
    const primary = processed[0]!;
    const candidateBlobs: StudioCandidate[] =
      processed.length > 1
        ? processed.map((c) => ({
            raw: c.raw,
            mix: c.mix,
            ...(c.barGrid ? { barGrid: c.barGrid } : {}),
            ...(c.master ? { master: c.master } : {}),
          }))
        : [];

    // Candidate A drives the heard take, its stems and edits. Keep rawMixBlob
    // for the single un-mastered path only (no candidate list to fall back on).
    const activeMixB64 = primary.mixB64;
    const barGrid = primary.barGrid;
    const masterReport = primary.master;
    const rawMixBlob = processed.length > 1 || primary.master ? primary.raw : undefined;

    const order: StemId[] = ['kick', 'snare', 'hats', 'bass', 'drums', 'mix'];
    const stems: StemFile[] = [];
    for (const id of order) {
      const fromStem = data.stems?.find((s) => s.id === id)?.wavBase64 || activeMixB64;
      stems.push(stemFromB64(id, fromStem, durationSec, sr, bitDepth));
    }

    // Detect shared mix blob: any stem that fell back to mixB64 (no real extract)
    const returnedIds = new Set(
      (data.stems ?? []).filter((s) => s?.id && s.wavBase64).map((s) => String(s.id)),
    );
    const stemsShareMixBlob = order.some((id) => id !== 'mix' && !returnedIds.has(id));

    const taskLabel = srcAudioBase64 ? (job.edit ? 'repaint' : 'cover') : 'text2music';
    const payloadLine =
      `ACE payload · task ${taskLabel} · thinking ${acePayload.thinking} · ` +
      `caption ${acePayload.captionFamily} · ${acePayload.steps} steps · ${acePayload.model}` +
      (srcAudioBase64 && !job.edit
        ? ` · cover strength ${clampCoverStrength(job.styleReference?.coverStrength)}`
        : '') +
      (refAudioBase64 ? ' · reference audio' : '');
    const bridgeWarnings = (Array.isArray(data.warnings) ? data.warnings.map(String) : []).filter(
      (w) => !/thinking\s*=|rock/i.test(w),
    );
    const warnings = [
      payloadLine,
      ...bridgeWarnings,
      ...decodeWarnings,
      ...(primary.master
        ? [
            `Mastered to ${targetLufs} LUFS (measured ${primary.master.lufsAfter.toFixed(1)}, ` +
              `peak ${primary.master.peakDbAfter.toFixed(1)} dBFS)`,
          ]
        : []),
      ...(realBreakTempoSkipped
        ? [`Real break layer off at ${structure.bpm} BPM (loops are cut at ${STUDIO_BREAK_BPM})`]
        : []),
      ...(realBreak
        ? [`Real break layer: ${realBreak.loopName} under drop bars (${realBreak.gain.toFixed(2)}× gain)`]
        : []),
      'Studio ACE (GPU) â€” original generation; not an artist clone',
      'Stem lanes may share mix until ACE lego/extract is wired',
    ];

    const notes = [
      'ACE GPU mix via localhost bridge; structure/MIDI from hard-grid-v0',
      'Stem elementals currently mirror mix (honest â€” not OfflineStub synth)',
    ];
    if (job.layers?.guitar || job.layers?.solo) {
      // Never claim isolated guitar stem while elementals still share mix
      warnings.push(
        'Guitar/Solo layers: prompt vibe tags only â€” no isolated guitar stem while ACE stems share mix blob (Needs Studio / gated until lego extract)',
      );
      notes.push(
        'layers.guitar/solo = honesty tags / prompt bias only; not ACE extract; not an isolated guitar stem',
      );
      if (stemsShareMixBlob || !returnedIds.has('other')) {
        notes.push(
          'synth/lego vibe-only until extract â€” do not treat kick/snare/bass/other as separated guitar',
        );
      }
    }

    const heardCheckpoint = String(data.checkpointId || checkpoint || 'unknown');
    const midiBlob = structureToMidiBlob(structure);
    const manifest = buildExportManifest({
      job,
      structure,
      stems,
      backendId: this.id,
      checkpointId: heardCheckpoint,
      bpmMeasured: Number(data.bpmMeasured ?? structure.bpm),
      gpuUsed: true,
      // Only true when the reference audio was actually sent to ACE — either
      // as `src_audio` (cover, not a take edit) or as `reference_audio`.
      acePathActive: Boolean((srcAudioBase64 && !job.edit) || refAudioBase64),
      notes,
      aceRequest,
      ...(primary.master ? { master: primary.master } : {}),
      ...(realBreak ? { realBreakLoop: realBreak } : {}),
    });

    return {
      jobId: data.jobId || job.jobId,
      seed: data.seed ?? job.seed,
      bpmMeasured: Number(data.bpmMeasured ?? structure.bpm),
      stems,
      mixdownPreviewWav: stems.find((s) => s.id === 'mix')?.url,
      warnings,
      backendId: this.id,
      checkpointId: heardCheckpoint,
      acePayload,
      structure,
      midiBlob,
      manifest,
      barGrid,
      ...(rawMixBlob ? { rawMixBlob } : {}),
      ...(candidateBlobs.length > 1
        ? { candidates: candidateBlobs, ...(candidateScores ? { candidateScores } : {}) }
        : {}),
      ...(masterReport ? { master: masterReport } : {}),
    };
  }

  /**
   * Real stem separation via the bridge's Demucs v4 endpoint. Returns
   * StemFiles for drums/bass/other (htdemucs's vocals track is dropped — this
   * is an instrumental studio). Throws with the install hint on a 501.
   */
  async separateStems(mix: Blob): Promise<StemFile[]> {
    const mixWavBase64 = await blobToBase64(mix);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), DEMUCS_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(getAceSidecarStemsUrl(), {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ mixWavBase64 }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`ACE sidecar /stems failed (${msg}). Start the ACE stack on the GPU PC.`);
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 501) {
      let hint = 'pip install demucs';
      try {
        const detail = (await res.json()) as { installHint?: string };
        if (detail?.installHint) hint = detail.installHint;
      } catch {
        /* keep default hint */
      }
      throw new Error(`Demucs is not installed on the bridge PC — run: ${hint}`);
    }
    if (!res.ok) {
      let detail = '';
      try {
        detail = await res.text();
      } catch {
        /* ignore */
      }
      throw new Error(`ACE sidecar /stems HTTP ${res.status}: ${detail.slice(0, 400)}`);
    }

    const data = (await res.json()) as {
      stems?: Array<{ id?: string; wavBase64?: string; durationSec?: number }>;
    };
    const stems: StemFile[] = [];
    for (const raw of data.stems ?? []) {
      const id = String(raw.id ?? '').toLowerCase();
      if (!(DEMUCS_STEM_IDS as readonly string[]).includes(id) || !raw.wavBase64) continue;
      const blob = b64ToBlob(raw.wavBase64);
      let sampleRateHz = 44100; // Demucs htdemucs outputs 44.1 kHz
      let durationSec = typeof raw.durationSec === 'number' ? raw.durationSec : 0;
      try {
        const decoded = decodeWavToMono(await blob.arrayBuffer());
        sampleRateHz = decoded.sampleRateHz;
        durationSec = decoded.mono.length / decoded.sampleRateHz;
      } catch {
        /* header not PCM — keep response duration */
      }
      stems.push({
        id: id as StemId,
        url: URL.createObjectURL(blob),
        blob,
        channels: 2,
        sampleRateHz,
        bitDepth: 16,
        durationSec,
      });
    }
    return stems;
  }
}

export const aceStepBackend = new AceStepBackend();

