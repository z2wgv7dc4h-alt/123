/**
 * ACE caption / prompt text — knob-driven energy words so Vary visibly changes the string.
 * Vibe-only tags; no artist names. Guitar/solo when layers on = honesty tags, not stem claims.
 */

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

/**
 * Energy band words — must differ across low/mid/high so tests can assert
 * knob sensitivity (required substrings: low -> "laid-back"/"soft drive",
 * high -> "stadium energy"/"high-drive" — src/test/ace-caption-vary.test.ts
 * regex-matches these). Enriched with real DnB subgenre vocabulary (liquid,
 * rolling breakbeats, jump up) instead of generic mood adjectives that could
 * describe any dance genre — per ACE-Step's own prompting guidance,
 * concrete/specific tags outperform vague ones.
 */
export function energyWords(energy: number, seed = 0): string {
  const e = clamp01(energy);
  if (e < 0.34) return pickBand(['laid-back groove, soft drive, liquid dnb feel', 'laid-back pocket, soft drive, smooth rolling breaks'], seed);
  if (e < 0.67) return pickBand(['energetic dancefloor, solid drive, rolling breakbeats', 'energetic bounce, solid drive, rolling amen breaks'], seed);
  return pickBand(['stadium energy, high-drive drop, jump up bassline', 'stadium rush, high-drive drop, jump up energy'], seed);
}

/** Every band names a Reese or growl bass — the DnB bass sound, not "bright airy bass". */
export function darknessWords(darkness: number, seed = 0): string {
  const d = clamp01(darkness);
  if (d < 0.34) return pickBand(['smooth rolling reese bass, liquid dnb', 'warm detuned reese bass, melodic liquid dnb'], seed);
  if (d < 0.67) return pickBand(['weighted bass mood, rolling reese bass', 'weighted low mood, driving reese bass'], seed);
  return pickBand(['dark murky reese bass, neurofunk-leaning', 'dark murky growl bass, neurofunk energy'], seed);
}

export function chaosWords(chaos: number, seed = 0): string {
  const c = clamp01(chaos);
  if (c < 0.34) return pickBand(['tight edits, controlled fills, precise breakbeat chops', 'tight pattern, controlled hats, clean amen chops'], seed);
  if (c < 0.67) return pickBand(['busy fills, restless hats, chopped breakbeats', 'busy edits, restless hats, syncopated amen breaks'], seed);
  return pickBand(['chaotic break edits, dense percussion, jungle-style breakbeat chops', 'chaotic fills, dense percussion, ragga jungle chops'], seed);
}

/**
 * Drum groove: two-step (kick 1, snare 2 and 4 at 174) when the break is
 * tidy, chopped amen when it's busier. Half-time shapes get no groove word
 * here — their shape tag names the half-time snare instead.
 */
export function grooveWords(chaos: number, songShape?: string): string {
  if (songShape && HALF_TIME_SHAPES.has(songShape)) return '';
  return clamp01(chaos) < 0.34 ? 'two-step breakbeat, snare on 2 and 4' : 'chopped amen break';
}

/**
 * Build ACE sidecar prompt.text from knobs (+ optional layers / user text).
 * Always includes energy/darkness/chaos words so Vary + knob changes alter the caption.
 *
 * Order follows ACE-Step's prompting guidance: genre -> concrete drums/bass ->
 * mood -> BPM last. Guitar and rock words appear only when the guitar/solo
 * layer is on or the user typed them. Shape tags only for the selected shape.
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

  pushPhrases('drum and bass, instrumental');
  pushPhrases(grooveWords(chaos, input.songShape));
  pushPhrases('tight punchy drums, sub bass');
  pushPhrases(energyWords(energy, seed));
  pushPhrases(darknessWords(darkness, seed));
  pushPhrases(chaosWords(chaos, seed));

  const legacy = new Set<string>(LEGACY_STARTER_GUITAR_PHRASES);
  const pushUser = (phrase: string) => {
    if (!guitarOn && legacy.has(phrase.trim().toLowerCase())) return;
    const t = phrase.trim().toLowerCase();
    if (/\b\d+\s*bpm\b/.test(t)) return;
    const halfTimeShape = input.songShape === 'half-time-drop' || input.songShape === 'dubstep';
    if (!halfTimeShape && /half-time|dubstep|snare on 3/.test(t)) return;
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
