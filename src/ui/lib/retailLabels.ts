/** Plain-English labels for user-visible chrome — never leak OfflineStub / hard-grid-v0. */

import type { AcePayloadSnapshot } from '@/core/types';

export function retailBackendLabel(backendId: string): string {
  if (backendId === 'offline-stub' || backendId.startsWith('offline')) return 'browser sketch';
  if (backendId.startsWith('ace-step')) return 'Studio GPU';
  return backendId;
}

/**
 * Header audio-path chip. Once a buffer exists it labels THAT buffer
 * (result.backendId), not the latest probe — a Sketch fallback render must
 * not show "Studio" just because ACE answered a probe afterwards.
 */
export function heardAudioPathChip(
  resultBackendId: string | null | undefined,
  studioLive: boolean,
): { live: boolean; label: string } {
  if (resultBackendId) {
    const studio = resultBackendId.startsWith('ace-step');
    return { live: studio, label: studio ? 'Studio · GPU' : 'Sketch · CPU' };
  }
  return { live: studioLive, label: studioLive ? 'Studio ready · GPU' : 'Sketch · CPU' };
}

export function retailStructureLabel(version: string | undefined | null): string {
  if (!version) return 'song layout ~174';
  if (/hard-grid/i.test(version)) return 'song layout ~174';
  return version;
}

/** ACE DiT checkpoint → retail model name (no engine IDs in chrome). */
export function retailModelLabel(checkpoint: string | undefined | null): string {
  const id = String(checkpoint ?? '').toLowerCase();
  if (id.includes('turbo')) return 'turbo';
  if (id.includes('sft')) return 'SFT';
  if (id.includes('xl')) return 'XL';
  return 'base';
}

/** One honest line describing the Studio payload actually sent. */
export function retailAcePayloadLabel(payload: AcePayloadSnapshot): string {
  return (
    `thinking ${payload.thinking} · caption family ${payload.captionFamily} · ` +
    `${payload.steps} steps · model ${retailModelLabel(payload.model)}`
  );
}

/** Capability chip keys → retail English (PowerExtras caps-list). */
const CAP_LABELS: Record<string, string> = {
  fullSong: 'Full song',
  legoStems: 'Stem rebuild',
  extract: 'Extract',
  repaint: 'Repaint',
  loraLoad: 'Style packs',
  maxDurationSec: 'Max length',
  sampleRatesHz: 'Sample rate',
};

export function retailCapLabel(capKey: string): string {
  return (
    CAP_LABELS[capKey] ??
    capKey
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (c) => c.toUpperCase())
      .trim()
  );
}

/** Format a boolean/planned capability value for chrome. */
export function retailCapState(on: boolean, plannedWhenOff = false): string {
  if (on) return 'on';
  return plannedWhenOff ? 'later' : 'off';
}

/** Convenience list for tests / callers that want full chip strings. */
export function retailCapabilityChips(caps: {
  fullSong: boolean;
  legoStems: boolean;
  extract: boolean;
  repaint: boolean;
  loraLoad: boolean;
  maxDurationSec: number;
  sampleRatesHz: number[];
}): string[] {
  return [
    `${retailCapLabel('fullSong')} · ${retailCapState(caps.fullSong)}`,
    `${retailCapLabel('legoStems')} · ${retailCapState(caps.legoStems, true)}`,
    `${retailCapLabel('extract')} · ${retailCapState(caps.extract)}`,
    `${retailCapLabel('repaint')} · ${retailCapState(caps.repaint)}`,
    `${retailCapLabel('loraLoad')} · ${retailCapState(caps.loraLoad)}`,
    `${retailCapLabel('maxDurationSec')} · ${caps.maxDurationSec}s`,
    `${retailCapLabel('sampleRatesHz')} · ${caps.sampleRatesHz.join('/')} Hz`,
  ];
}
