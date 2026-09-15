/**
 * LoRA pack manager stub + provenance notes.
 * Training / adapters are GPU-sidecar only; browser holds metadata & gates.
 */
import type { LoRAPack, ProvenanceGate } from '../types';

const PROVENANCE_NOTES = [
  'Owner attestation required before any LoRA train job.',
  'Never train on third-party commercial catalogs or artist-name clones.',
  'excludedArtistNames must cover blocklist (no Pendulum / clone features).',
  'licenseScanOk + memorizationReview must pass before status=ready.',
  'Adapter target: dit_attention on ACE-Step base/xl-base only.',
  'Min clips + corpusPaths recorded in digests for audit.',
].join('\n');

function emptyProvenance(base: string): ProvenanceGate {
  return {
    ownerAttestation: false, // false until real owner corpus attested
    corpusPaths: [],
    excludedArtistNames: [
      'pendulum',
      'suno',
      'udio',
      'skrillex',
      'noisia',
      'andy c',
      'sub focus',
    ],
    licenseScanOk: false, // false until real corpus license scan
    minClips: 0,
    memorizationReview: 'pending',
    baseCheckpoint: base,
    adapterTarget: 'dit_attention',
  };
}

export class LoRAPackManager {
  private packs = new Map<string, LoRAPack>();

  get provenanceNotes(): string {
    return PROVENANCE_NOTES;
  }

  list(): LoRAPack[] {
    return [...this.packs.values()];
  }

  get(packId: string): LoRAPack | undefined {
    return this.packs.get(packId);
  }

  /** Register a stub pack (no weights). Training happens on CUDA sidecar. */
  createStub(opts: {
    packId: string;
    name: string;
    baseModel?: string;
    triggerTags?: string[];
  }): LoRAPack {
    const pack: LoRAPack = {
      packId: opts.packId,
      name: opts.name,
      baseModel: opts.baseModel ?? 'ACE-Step/Ace-Step1.5:acestep-v15-base',
      adapterPath: '',
      scale: 0.7,
      triggerTags: opts.triggerTags ?? ['energetic dancefloor drum and bass', 'reese bass'],
      provenance: emptyProvenance(opts.baseModel ?? 'acestep-v15-base'),
      createdAt: new Date().toISOString(),
      digests: { adapterSha256: '', corpusManifestSha256: '' },
      status: 'stub',
    };
    this.packs.set(pack.packId, pack);
    return pack;
  }

  /** Train is GPU-gated — always fails soft in browser Phase 0. */
  async requestTrain(packId: string): Promise<never> {
    const pack = this.packs.get(packId);
    if (!pack) throw new Error(`Unknown LoRA pack: ${packId}`);
    pack.status = 'failed';
    throw new Error(
      `LoRA train requires CUDA sidecar (RTX 5080 path). Pack "${pack.name}" stays stub. ` +
        `Provenance: memorizationReview=${pack.provenance.memorizationReview}. See docs/ARCHITECTURE.md §LoRA.`,
    );
  }

  validateProvenance(pack: LoRAPack): string[] {
    const issues: string[] = [];
    if (!pack.provenance.ownerAttestation) issues.push('ownerAttestation required');
    if (!pack.provenance.licenseScanOk) issues.push('licenseScanOk failed');
    if (pack.provenance.memorizationReview !== 'passed') {
      issues.push('memorizationReview not passed');
    }
    if (pack.provenance.minClips > 0 && pack.provenance.corpusPaths.length < pack.provenance.minClips) {
      issues.push('corpus below minClips');
    }
    return issues;
  }
}

export const loraPackManager = new LoRAPackManager();

// Seed a demo stub pack for Power Mode UI
loraPackManager.createStub({
  packId: 'rock-dnb-energy-v0',
  name: 'Rock-DnB Energy (stub)',
  triggerTags: ['rock-dnb crossover', 'aggressive transient drums', '174 bpm'],
});
