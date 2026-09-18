import type {
  ExportManifest,
  RenderJob,
  StemFile,
  StructureMap,
  StyleReferenceProvenance,
  RealBreakLoopProvenance,
} from '../types/index.ts';
import { DEFAULT_PPQ } from '../types/index.ts';

/** Honest style-reference provenance — OfflineStub never sets acePathActive. */
export function buildStyleReferenceProvenance(
  job: RenderJob,
  opts: { acePathActive: boolean; backendId: string },
): StyleReferenceProvenance | undefined {
  const ref = job.styleReference;
  if (!ref) return undefined;
  const ace = opts.acePathActive;
  return {
    used: true,
    source: 'user-upload',
    hash: (ref as { hash?: string }).hash,
    userOwned: true as const,
    fileName: ref.fileName,
    estimatedBpm: ref.estimatedBpm,
    energy: ref.energy,
    intensity: ref.intensity,
    ownerAttested: ref.ownerAttested,
    acePathActive: ace,
    note: ace
      ? 'User-owned style reference consumed by ACE-Step sidecar (cover / reference_audio path).'
      : `Inspired by YOUR file — original browser-sketch output (not a tempo clone / not Studio stems). Backend: ${opts.backendId}.`,
  };
}

export function buildExportManifest(opts: {
  job: RenderJob;
  structure: StructureMap;
  stems: StemFile[];
  backendId: string;
  checkpointId: string;
  bpmMeasured: number;
  gpuUsed: boolean;
  /** When true, ACE actually used the reference. OfflineStub must pass false. */
  acePathActive?: boolean;
  /** Optional stem-v0 honesty notes (drums bus / perc). */
  notes?: string[];
  /** Set when a real breakbeat loop was blended into the mix (Sketch only). */
  realBreakLoop?: RealBreakLoopProvenance;
}): ExportManifest {
  const { job, structure, stems, backendId, checkpointId, bpmMeasured, gpuUsed } = opts;
  const acePathActive = opts.acePathActive === true;
  const styleReference = buildStyleReferenceProvenance(job, { acePathActive, backendId });
  return {
    schemaVersion: 'stem-v0',
    jobId: job.jobId,
    seed: job.seed,
    bpmTarget: job.bpm,
    bpmMeasured,
    sampleRateHz: job.sampleRateHz,
    bitDepth: job.bitDepth,
    backendId,
    checkpointId,
    structureVersion: structure.version,
    prompt: {
      text: job.prompt.text ?? job.prompt.descriptors.join(', '),
      tags: [...job.prompt.descriptors],
      energy: job.prompt.energy,
      darkness: job.prompt.darkness,
    },
    ...(job.songShape ? { songShape: job.songShape } : {}),
    loraPackIds: (job.lora ?? []).map((l) => l.packId),
    stems: stems.map((s) => ({
      id: s.id,
      path: `${s.id}.wav`,
      channels: s.channels,
      samplePeakDbFS: s.samplePeakDbFS,
      peakMetric: s.peakMetric,
      truePeakDbTP: s.truePeakDbTP,
    })),
    createdAt: new Date().toISOString(),
    snapPolicy: structure.snapPolicy,
    ppq: structure.ppq ?? DEFAULT_PPQ,
    samplesPerBar: structure.samplesPerBar,
    gpuUsed,
    productTier: gpuUsed ? 'studio' : 'sketch',
    ...(styleReference ? { styleReference } : {}),
    ...(opts.realBreakLoop ? { realBreakLoop: opts.realBreakLoop } : {}),
    ...(opts.notes?.length ? { notes: [...opts.notes] } : {}),
  };
}
