/**
 * ACE caption / prompt text — knob-driven energy words so Vary visibly changes the string.
 * Vibe-only tags; no artist names. Guitar/solo when layers on = honesty tags, not stem claims.
 */

import type { GenreId, SectionRole } from '../types';

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
  /** Section-focused caption (Redo / arrangement blocks). Absent = whole-song caption. */
  sectionRole?: SectionRole;
  /** Song-map section names in order — drives the arrangement sentence (whole-song captions only). */
  sections?: readonly string[];
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

function trapBassWords(darkness: number, seed = 0): string {
  const d = clamp01(darkness);
  if (d < 0.34) return pickBand(['deep 808 bass', 'round 808 bass, long sub'], seed);
  if (d < 0.67) return pickBand(['heavy 808 glides', 'distorted 808 bass, glides'], seed);
  return pickBand(['dark distorted 808 bass', 'dark heavy 808 slides'], seed);
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
  trap: { lead: 'trap, instrumental', halfTime: true, drums: () => 'rolling hi-hats, hard snare on 3, 808 kicks', bass: trapBassWords },
};

export const ROLE_WORDS: Record<SectionRole, string> = {
  intro: 'atmospheric intro, sparse drums, filtered',
  build: 'rising build-up, snare roll, riser fx, filter sweep, tension',
  drop: 'massive epic drop, full energy, heavy impact',
  breakdown: 'stripped-back breakdown, atmospheric pads, no heavy drums',
  outro: 'outro, drums fading out, sparse',
  switch: 'genre switch section, contrasting groove',
};

const GENRE_NAMES: Record<GenreId, string> = {
  dnb: 'drum and bass',
  dubstep: 'dubstep',
  halftime: 'halftime drum and bass',
  jungle: 'jungle',
  trap: 'trap',
};

const ROLE_NOUN: Record<SectionRole, string> = {
  intro: 'intro',
  build: 'build-up',
  drop: 'drop',
  breakdown: 'breakdown',
  outro: 'outro',
  switch: 'section',
};

function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Arrangement narrative from the song map, in ACE's example-caption style. */
export function arrangementSentence(sectionNames: readonly string[]): string {
  const clauses: string[] = [];
  let drops = 0;
  for (const name of sectionNames) {
    if (name === 'intro') clauses.push('opens with an atmospheric filtered intro');
    else if (name === 'build') clauses.push('rises through a build-up of snare rolls and risers');
    else if (name === 'drop') clauses.push(drops++ === 0 ? 'explodes into a massive drop' : 'hits another full-energy drop');
    else if (name === 'break' || name === 'breakdown') clauses.push('strips back for a breakdown with atmospheric pads');
    else if (name === 'outro') clauses.push('ends with a sparse outro');
  }
  return clauses.length ? `The arrangement ${joinList(clauses)}.` : '';
}

const LYRIC_TAG: Record<string, string> = {
  intro: '[Intro - atmospheric]',
  build: '[Build - rising tension]',
  drop: '[Drop - explosive]',
  break: '[Breakdown - stripped back]',
  breakdown: '[Breakdown - stripped back]',
  outro: '[Outro - fade out]',
};

/** ACE lyrics = temporal script. Structure tags only, never words to sing. */
export function buildAceLyrics(sectionNames: readonly string[]): string {
  const tags = sectionNames.map((n) => LYRIC_TAG[n]).filter((t): t is string => Boolean(t));
  return tags.length ? tags.join('\n\n') : '[Instrumental]';
}

/**
 * ACE caption as a short paragraph, matching ACE's shipped examples
 * (docs/ACE-NOTES.md "Captions and lyrics"): genre + energy or section role,
 * drums + bass, arrangement narrative, extras, mix. No BPM. Guitar/rock only
 * when the layer is on or typed. Shape words only for the selected shape.
 */
export function buildAceCaption(input: AceCaptionInput): string {
  const energy = clamp01(input.energy);
  const darkness = clamp01(input.darkness);
  const chaos = clamp01(input.chaos ?? 0.25);
  const guitarOn = Boolean(input.layers?.guitar || input.layers?.solo);
  const seed = input.seed ?? 0;

  const genre: GenreId = input.genre ?? 'dnb';
  const g = GENRE_CAPTIONS[genre];
  const name = GENRE_NAMES[genre];
  const shapeHalfTime = HALF_TIME_SHAPES.has(input.songShape ?? '');
  const role = input.sectionRole;
  const drums = genre === 'dnb' && shapeHalfTime ? 'heavy half-time drums' : g.drums(chaos, seed);
  const bass = g.bass(darkness, seed);

  const sentences: string[] = [];
  sentences.push(
    role
      ? `An instrumental ${name} ${ROLE_NOUN[role]} — ${ROLE_WORDS[role]}.`
      : `An instrumental ${name} track with ${energyWords(energy, seed)}.`,
  );
  if (role === 'breakdown') {
    sentences.push(`It strips back to ${bass} and atmospheric pads.`);
  } else {
    const sub = /\bsub\b|808/.test(bass) ? '' : ' and a deep sub bass';
    sentences.push(`It is driven by ${drums} and ${bass}, with tight punchy drums${sub}.`);
  }
  if (!role && input.sections?.length) {
    const arrangement = arrangementSentence(input.sections);
    if (arrangement) sentences.push(arrangement);
  }

  // Extras (user words, layers, shape) — skip anything the paragraph already says.
  // A phrase counts as said when it, or its last two words, already appear
  // ("rolling reese bass" is covered by "heavy reese bass").
  const extras: string[] = [];
  const alreadySaid = (phrase: string) => {
    const text = [...sentences, ...extras].join(' ').toLowerCase();
    const p = phrase.toLowerCase();
    const tail = p.split(/\s+/).filter(Boolean).slice(-2).join(' ');
    return text.includes(p) || (tail.length > 0 && text.includes(tail));
  };
  const addExtra = (phrase: string) => {
    const t = phrase.trim();
    if (t && !alreadySaid(t)) extras.push(t);
  };
  const addExtras = (text: string) => text.split(',').forEach(addExtra);

  // Shape words first: they are the deliberate pick, so a loose user phrase
  // ("snare on 3") must not shadow the shape's full phrasing.
  const shape = input.songShape;
  if (shape === 'dubstep') addExtras('half-time snare, wobble growl bass, dubstep-influenced drop');
  else if (shape === 'half-time-drop') addExtras('half-time snare on 3, heavy weighted drop, rolling reese movement');
  else if (shape === 'trap-bounce') addExtras('fat 808 glide bass, rolling bounce hats, punchy trap-flavored dnb');

  const legacy = new Set<string>(LEGACY_STARTER_GUITAR_PHRASES);
  const halfTimeOk = shapeHalfTime || g.halfTime;
  const addUser = (phrase: string) => {
    const t = phrase.trim().toLowerCase();
    if (!t) return;
    if (!guitarOn && legacy.has(t)) return;
    if (/\b\d+\s*bpm\b/.test(t)) return;
    if (!halfTimeOk && /half-time|dubstep|snare on 3/.test(t)) return;
    addExtra(phrase);
  };
  input.userText?.split(',').forEach(addUser);
  for (const d of input.descriptors ?? []) String(d ?? '').split(',').forEach(addUser);

  if (input.layers?.guitar) addExtras('rock-dnb crossover, original rock-dnb guitar riffs, distorted rhythm guitar');
  if (input.layers?.solo) addExtras('original lead guitar solo, expressive rock-dnb crossover lead');
  if (input.layers?.vocalish) addExtras('vocal-ish synth texture, chopped pad vocalese');
  if (input.layers?.extraDrums) addExtras('extra breakbeat layers, dense percussion fills');

  if (extras.length) sentences.push(`It also features ${joinList(extras)}.`);
  sentences.push('The mix is polished and club-ready, with no vocals.');
  return sentences.join(' ');
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
