/**
 * ACE caption / prompt text — knob-driven energy words so Vary visibly changes the string.
 * Vibe-only tags; no artist names. Guitar/solo when layers on = honesty tags, not stem claims.
 */

import type { GenreId } from '../types';

export type AceCaptionLayers = {
  guitar?: boolean;
  solo?: boolean;
  vocalish?: boolean;
  extraDrums?: boolean;
};

export type AceCaptionInput = {
  energy: number;
  darkness: number;
  chaos?: number;
  layers?: AceCaptionLayers;
  /** Optional user style words (already scrubbed upstream). */
  userText?: string;
  descriptors?: string[];
  songShape?: string;
  /** Genre for captions — tempo is the job's bpm. Absent = dnb. */
  genre?: GenreId;
  /** Vary seed — 0 keeps the first in-band phrase (tests). */
  seed?: number;
};

/**
 * Phrases from the OLD starter prompt text (DEFAULT_DESCRIPTORS before
 * 2026-09-16). Saved drafts still carry them, so they reach the caption as
 * if the user typed them. Dropped unless the guitar layer is on.
 */
export const LEGACY_STARTER_GUITAR_PHRASES = ['distorted guitar riffs', 'rock-dnb crossover'] as const;

/** Shapes whose drums run half-time (StructureEngine halfTime). */
const HALF_TIME_SHAPES = new Set(['dubstep', 'half-time-drop']);

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function pickBand(phrases: readonly string[], seed = 0): string {
  if (!phrases.length) return '';
  const i = seed === 0 ? 0 : Math.abs(seed) % phrases.length;
  return phrases[i]!;
}

/** Energy: one short tag per band (tests regex laid-back/soft drive and stadium energy/high-drive). */
export function energyWords(energy: number, seed = 0): string {
  const e = clamp01(energy);
  if (e < 0.34) return pickBand(['laid-back soft drive', 'laid-back rolling groove'], seed);
  if (e < 0.67) return pickBand(['energetic dancefloor', 'energetic bouncy groove'], seed);
  return pickBand(['high-drive festival energy', 'stadium energy'], seed);
}

export function darknessWords(darkness: number, seed = 0): string {
  const d = clamp01(darkness);
  if (d < 0.34) return pickBand(['warm rolling reese bass', 'smooth detuned reese bass'], seed);
  if (d < 0.67) return pickBand(['heavy reese bass', 'driving reese bass'], seed);
  return pickBand(['dark growling reese bass', 'dark neuro growl bass'], seed);
}

/** Drum pattern: two-step when tidy, chopped amen when busy. */
export function chaosWords(chaos: number, seed = 0): string {
  const c = clamp01(chaos);
  if (c < 0.34) return pickBand(['controlled two-step breakbeat drums', 'controlled tight two-step drums'], seed);
  if (c < 0.67) return pickBand(['busy chopped amen break', 'busy syncopated amen breakbeat'], seed);
  return pickBand(['chaotic chopped amen breaks, dense percussion', 'chaotic jungle amen breaks, dense percussion'], seed);
}

function wobbleBassWords(darkness: number, seed = 0): string {
  const d = clamp01(darkness);
  if (d < 0.34) return pickBand(['deep wobble bass', 'rolling wobble bass'], seed);
  if (d < 0.67) return pickBand(['heavy wobble bass, metallic growls', 'heavy growl bass, wobble'], seed);
  return pickBand(['dark growling wobble bass, screeching mid bass', 'dark metallic growl bass, heavy wobble'], seed);
}

function jungleBassWords(darkness: number, seed = 0): string {
  const d = clamp01(darkness);
  if (d < 0.34) return pickBand(['warm deep sub bass', 'round deep sub bass'], seed);
  if (d < 0.67) return pickBand(['rolling sub bass', 'deep rolling sub bass'], seed);
  return pickBand(['dark rumbling sub bass', 'dark heavy sub bass'], seed);
}

type GenreCaption = {
  lead: string;
  halfTime: boolean;
  drums: (chaos: number, seed: number) => string;
  bass: (darkness: number, seed: number) => string;
};

export const GENRE_CAPTIONS: Record<GenreId, GenreCaption> = {
  dnb: { lead: 'drum and bass, instrumental', halfTime: false, drums: chaosWords, bass: darknessWords },
  dubstep: { lead: 'dubstep, instrumental', halfTime: true, drums: () => 'half-time drums, snare on 3', bass: wobbleBassWords },
  halftime: { lead: 'halftime drum and bass, instrumental', halfTime: true, drums: () => 'half-time breakbeat, snare on 3', bass: darknessWords },
  jungle: {
    lead: 'jungle, instrumental',
    halfTime: false,
    drums: (c) => (clamp01(c) < 0.34 ? 'rolling amen breaks' : 'chopped amen breaks, rapid break edits'),
    bass: jungleBassWords,
  },
};

/**
 * Build ACE sidecar prompt.text from knobs (+ optional layers / user text).
 * Always includes energy/darkness/chaos words so Vary + knob changes alter the caption.
 *
 * Order: genre -> drums -> bass -> energy -> production. Guitar/rock only when the layer is on or typed. Shape tags only for the selected shape.
 */
export function buildAceCaption(input: AceCaptionInput): string {
  const energy = clamp01(input.energy);
  const darkness = clamp01(input.darkness);
  const chaos = clamp01(input.chaos ?? 0.25);
  const guitarOn = Boolean(input.layers?.guitar || input.layers?.solo);

  const seed = input.seed ?? 0;
  const parts: string[] = [];
  // Substring dedup: a phrase already covered by a queued part is skipped.
  const pushDeduped = (phrase: string) => {
    const t = phrase.trim();
    if (t && !parts.some((p) => p.toLowerCase().includes(t.toLowerCase()))) parts.push(t);
  };
  const pushPhrases = (text: string) => text.split(',').forEach(pushDeduped);

  // ACE musicians guide: short caption = genre, instruments, one mood, production.
  const genre: GenreId = input.genre ?? 'dnb';
  const g = GENRE_CAPTIONS[genre];
  const shapeHalfTime = HALF_TIME_SHAPES.has(input.songShape ?? '');
  pushPhrases(g.lead);
  pushPhrases(genre === 'dnb' && shapeHalfTime ? 'heavy half-time drums' : g.drums(chaos, seed));
  pushPhrases(g.bass(darkness, seed));
  pushPhrases(genre === 'dnb' ? 'tight punchy drums, sub bass' : 'tight punchy drums, heavy sub bass');
  pushPhrases(energyWords(energy, seed));
  pushPhrases('polished club mix');

  const legacy = new Set<string>(LEGACY_STARTER_GUITAR_PHRASES);
  const pushUser = (phrase: string) => {
    if (!guitarOn && legacy.has(phrase.trim().toLowerCase())) return;
    const t = phrase.trim().toLowerCase();
    if (/\b\d+\s*bpm\b/.test(t)) return;
    const halfTimeOk = shapeHalfTime || g.halfTime;
    if (!halfTimeOk && /half-time|dubstep|snare on 3/.test(t)) return;
    pushDeduped(phrase);
  };
  const user = input.userText?.trim();
  if (user) user.split(',').forEach(pushUser);
  for (const d of input.descriptors ?? []) String(d ?? '').split(',').forEach(pushUser);

  if (input.layers?.guitar) {
    pushPhrases('rock-dnb crossover, original rock-dnb guitar riffs, distorted rhythm guitar');
  }
  if (input.layers?.solo) {
    pushPhrases('original lead guitar solo, expressive rock-dnb crossover lead');
  }
  if (input.layers?.vocalish) {
    pushPhrases('vocal-ish synth texture, chopped pad vocalese, no lyrics');
  }
  if (input.layers?.extraDrums) {
    pushPhrases('extra breakbeat layers, dense percussion fills');
  }

  const shape = input.songShape;
  if (shape === 'dubstep') {
    pushPhrases('half-time snare, wobble growl bass, dubstep-influenced drop');
  } else if (shape === 'half-time-drop') {
    pushPhrases('half-time snare on 3, heavy weighted drop, rolling reese movement');
  } else if (shape === 'trap-bounce') {
    pushPhrases('fat 808 glide bass, rolling bounce hats, punchy trap-flavored dnb');
  }

  // No BPM in caption: tempo goes in the ACE bpm field.

  return parts.join(', ');
}

/** Tags array for ACE payload — includes guitar/solo honesty tags when layers on. */
export function buildAceTags(input: AceCaptionInput): string[] {
  const tags: string[] = [...(input.descriptors ?? []).map(String)];
  if (input.layers?.guitar) tags.push('guitar');
  if (input.layers?.solo) tags.push('lead solo');
  const seed = input.seed ?? 0;
  tags.push(energyWords(input.energy, seed).split(',')[0]!.trim());
  tags.push(darknessWords(input.darkness, seed).split(',')[0]!.trim());
  tags.push(chaosWords(input.chaos ?? 0.25, seed).split(',')[0]!.trim());
  return tags.filter(Boolean);
}
