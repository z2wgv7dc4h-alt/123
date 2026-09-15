/**
 * AceStepBackend â€” GPU path via localhost DnB bridge â†’ ACE-Step API on RTX 5080.
 * Probe: GET http://127.0.0.1:8766/probe (hasGpu true when ACE upstream is up).
 * Render: POST /render â†’ mixWavBase64 â†’ playable StemFile blobs.
 * Structure authority stays HardGridStructureEngine (MIDI/grid); ACE supplies timbre/mix.
 */
import type {
  AudioBackend,
  BackendCaps,
  HardwareProbe,
  RenderJob,
  RenderResult,
  StemFile,
  StemId,
} from '../types';
import { buildExportManifest } from '../export/manifest.ts';
import { structureEngine, deriveBreakDensity } from '../structure/StructureEngine.ts';
import { structureToMidiBlob } from '../midi/exportMidi.ts';
import { buildAceCaption, buildAceTags } from '../prompt';

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
/** Studio default DiT when the probe did not name one (start-ace-stack.ps1). */
export const ACE_DEFAULT_CHECKPOINT = 'acestep-v15-base';
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
 * DCW: training-free, negligible-compute quality correction. ACE-Step
 * enables it by default for Turbo and disables it for non-Turbo — this
 * project always uses acestep-v15-base, so it was off on every render
 * until this was wired. "low" is the starting mode DCW.md recommends.
 */
export const ACE_DCW_ENABLED = true;
export const ACE_DCW_MODE = 'low' as const;
/**
 * LM on for text2music: the 5Hz LM plans the track (audio codes). The bridge
 * keeps use_cot_caption/use_cot_language false so the LM cannot rewrite our
 * concrete DnB caption or invent sung words; its only vocal-free structure
 * comes from the section map. Cover/repaint still force thinking off.
 */
export const ACE_THINKING = true;
/**
 * Cover strength for real audio2audio. ACE-Step's own API doc recommends
 * low values (~0.2) for style transfer; the schema default of 1.0 is
 * closer to literal reconstruction of the source.
 */
export const ACE_COVER_STRENGTH = 0.25;

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
export const ACE_RENDER_TIMEOUT_MS = 240_000;
export function getAceSidecarBase(): string {
  return aceSidecarBase();
}
/** @deprecated prefer getAceSidecarProbeUrl() — kept for tests */
export const ACE_SIDECAR_BASE = typeof window !== "undefined" ? `${window.location.origin}/ace-bridge` : "http://127.0.0.1:8766";
export const ACE_SIDECAR_PROBE_URL = `${ACE_SIDECAR_BASE}/probe`;
export const ACE_SIDECAR_RENDER_URL = `${ACE_SIDECAR_BASE}/render`;
export function getAceSidecarProbeUrl(): string {
  return `${aceSidecarBase()}/probe`;
}
export function getAceSidecarRenderUrl(): string {
  return `${aceSidecarBase()}/render`;
}

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
    const structure = job.structureRef ?? await structureEngine.plan({
      seed: job.seed,
      bpm: job.bpm,
      bars: job.durationBars,
      energy: job.prompt.energy,
      darkness: job.prompt.darkness,
      chaos: job.prompt.chaos,
      breakDensity: deriveBreakDensity({ chaos: job.prompt.chaos ?? 0.25 }),
      sampleRateHz: job.sampleRateHz,
      songShape: job.songShape,
      sectionsOverride: job.sectionsOverride,
    });

    // Real audio2audio: when the user attached their own audio, send the
    // actual bytes so ACE can run `cover` against them. Without this the
    // reference only ever survives as a few scalar knob nudges.
    const styleAudio = job.styleReference?.file;
    const srcAudioBase64 =
      styleAudio && job.styleReference?.ownerAttested ? await blobToBase64(styleAudio) : undefined;

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
      seed: job.seed,
    });
    // Snapshot for Status chrome — the payload actually posted, not a claim.
    // Cover/repaint skip the LM (source audio is the plan), text2music runs it.
    const thinking = srcAudioBase64 ? false : ACE_THINKING;
    const acePayload = {
      thinking,
      captionFamily: /drum and bass|dnb/i.test(caption) ? 'DnB' : 'other',
      steps: sampler.inferenceSteps,
      model: checkpoint ?? ACE_DEFAULT_CHECKPOINT,
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
          durationBars: job.durationBars,
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
          dcwEnabled: ACE_DCW_ENABLED,
          dcwMode: ACE_DCW_MODE,
          ...(srcAudioBase64
            ? {
                srcAudioBase64,
                srcAudioFileName: job.styleReference?.fileName ?? 'style-ref.wav',
                audioCoverStrength: ACE_COVER_STRENGTH,
              }
            : {}),
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

    const order: StemId[] = ['kick', 'snare', 'hats', 'bass', 'drums', 'mix'];
    const stems: StemFile[] = [];
    for (const id of order) {
      const fromStem = data.stems?.find((s) => s.id === id)?.wavBase64 || mixB64;
      stems.push(stemFromB64(id, fromStem, durationSec, sr, bitDepth));
    }

    // Detect shared mix blob: any stem that fell back to mixB64 (no real extract)
    const returnedIds = new Set(
      (data.stems ?? []).filter((s) => s?.id && s.wavBase64).map((s) => String(s.id)),
    );
    const stemsShareMixBlob = order.some((id) => id !== 'mix' && !returnedIds.has(id));

    const warnings = [
      ...(Array.isArray(data.warnings) ? data.warnings.map(String) : []),
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
      // Only true when the reference audio was actually sent for a cover
      // render — a reference that merely exists but was reduced to knob
      // nudges must not claim the ACE path consumed it.
      acePathActive: Boolean(srcAudioBase64),
      notes,
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
    };
  }
}

export const aceStepBackend = new AceStepBackend();

