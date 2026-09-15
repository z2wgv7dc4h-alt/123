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

/** Energy band words — must differ across low/mid/high so tests can assert knob sensitivity. */
export function energyWords(energy: number, seed = 0): string {
  const e = clamp01(energy);
  if (e < 0.34) return pickBand(['laid-back groove, soft drive', 'laid-back pocket, soft drive'], seed);
  if (e < 0.67) return pickBand(['energetic dancefloor, solid drive', 'energetic bounce, solid drive'], seed);
  return pickBand(['stadium energy, high-drive drop', 'stadium rush, high-drive drop'], seed);
}

export function darknessWords(darkness: number, seed = 0): string {
  const d = clamp01(darkness);
  if (d < 0.34) return pickBand(['bright airy bass', 'bright open bass'], seed);
  if (d < 0.67) return pickBand(['weighted bass mood', 'weighted low mood'], seed);
  return pickBand(['dark murky reese', 'dark murky growl'], seed);
}

export function chaosWords(chaos: number, seed = 0): string {
  const c = clamp01(chaos);
  if (c < 0.34) return pickBand(['tight edits, controlled fills', 'tight pattern, controlled hats'], seed);
  if (c < 0.67) return pickBand(['busy fills, restless hats', 'busy edits, restless hats'], seed);
  return pickBand(['chaotic break edits, dense percussion', 'chaotic fills, dense percussion'], seed);
}

/**
 * Build ACE sidecar prompt.text from knobs (+ optional layers / user text).
 * Always includes energy/darkness/chaos words so Vary + knob changes alter the caption.
 */
export function buildAceCaption(input: AceCaptionInput): string {
  const energy = clamp01(input.energy);
  const darkness = clamp01(input.darkness);
  const chaos = clamp01(input.chaos ?? 0.25);

  const seed = input.seed ?? 0;
  const parts: string[] = [
    'rock drum and bass, original composition, instrumental, 174 bpm',
    energyWords(energy, seed),
    darknessWords(darkness, seed),
    chaosWords(chaos, seed),
  ];

  const user = input.userText?.trim();
  if (user) parts.push(user);

  if (input.descriptors?.length) {
    for (const d of input.descriptors) {
      const t = String(d ?? '').trim();
      if (t && !parts.some((p) => p.includes(t))) parts.push(t);
    }
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
  if (shape === 'dubstep' || shape === 'half-time-drop') {
    parts.push('half-time snare, heavy drop, wobble reese movement');
  }
  if (shape === 'trap-bounce') {
    parts.push('fat 808 glide bass, rolling bounce hats, punchy trap-flavored dnb at 174 bpm');
  }

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
