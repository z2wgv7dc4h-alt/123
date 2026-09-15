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

export function darknessWords(darkness: number, seed = 0): string {
  const d = clamp01(darkness);
  if (d < 0.34) return pickBand(['bright airy bass, liquid dnb', 'bright open bass, melodic liquid dnb'], seed);
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
 * Build ACE sidecar prompt.text from knobs (+ optional layers / user text).
 * Always includes energy/darkness/chaos words so Vary + knob changes alter the caption.
 *
 * Tag order follows ACE-Step's own prompting guidance (genre -> concrete
 * elements -> mood -> production -> BPM last, 5-12 keywords, specificity
 * over generality): the old caption led with a fused "rock drum and bass"
 * phrase and buried "174 bpm" mid-sentence, then filled the rest with vague
 * mood adjectives ("energetic dancefloor, solid drive") that could describe
 * house or techno just as well — nothing told the model this was
 * specifically drum and bass. Lead with an unambiguous, concrete DnB genre
 * lock (real breakbeat/bass vocabulary) before introducing the rock
 * crossover flavor, and put BPM at the end where the model expects it.
 */
export function buildAceCaption(input: AceCaptionInput): string {
  const energy = clamp01(input.energy);
  const darkness = clamp01(input.darkness);
  const chaos = clamp01(input.chaos ?? 0.25);

  const seed = input.seed ?? 0;
  const parts: string[] = [
    'drum and bass',
    'instrumental',
    'rolling breakbeats',
    'sub bass',
    energyWords(energy, seed),
    darknessWords(darkness, seed),
    chaosWords(chaos, seed),
    'rock-dnb crossover',
  ];

  // Split user text into individual comma phrases and dedup each against
  // what's already queued — pushing it as one un-split blob (the old
  // behavior) let phrases like "rock-dnb crossover" duplicate a structural
  // tag above with no way to catch it, since the containment check only
  // ever ran on `descriptors`, never on `userText` itself (confirmed in the
  // raw ACE log: "rock-dnb crossover" and "174 bpm" both appeared twice).
  const pushDeduped = (phrase: string) => {
    const t = phrase.trim();
    if (t && !parts.some((p) => p.toLowerCase().includes(t.toLowerCase()))) parts.push(t);
  };
  const user = input.userText?.trim();
  if (user) user.split(',').forEach(pushDeduped);

  if (input.descriptors?.length) {
    for (const d of input.descriptors) pushDeduped(String(d ?? ''));
  }

  if (input.layers?.guitar) {
    parts.push('original rock-dnb guitar riffs, distorted rhythm guitar');
  }
  if (input.layers?.solo) {
    parts.push('original lead guitar solo, expressive rock-dnb crossover lead');
  }
  if (input.layers?.vocalish) {
    parts.push('vocal-ish synth texture, chopped pad vocalese, no lyrics');
  }
  if (input.layers?.extraDrums) {
    parts.push('extra breakbeat layers, dense percussion fills');
  }

  const shape = input.songShape;
  if (shape === 'dubstep') {
    parts.push('half-time snare, wobble growl bass, dubstep-influenced drop');
  } else if (shape === 'half-time-drop') {
    parts.push('half-time snare, heavy weighted drop, rolling reese movement');
  }
  if (shape === 'trap-bounce') {
    parts.push('fat 808 glide bass, rolling bounce hats, punchy trap-flavored dnb');
  }

  // BPM last — ACE-Step's own prompting guidance expects it as a trailing
  // tag, not buried mid-sentence. Product tempo is a hard-locked ~174.
  pushDeduped('174 bpm');

  return parts.join(', ').replace(/,\s*,/g, ',').trim();
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
