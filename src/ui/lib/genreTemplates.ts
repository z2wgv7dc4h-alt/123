/**
 * Allowlisted genre / mood templates for Surprise Me.
 * Genre descriptors only — never artist, band, or track names.
 */

export type GenreTemplate = {
  id: string;
  label: string;
  /** Freeform style text (pass-through on Generate). */
  promptText: string;
  energy: number;
  darkness: number;
  chaos: number;
};

export const GENRE_TEMPLATES: readonly GenreTemplate[] = [
  {
    id: 'liquid-glow',
    label: 'Liquid glow',
    promptText: 'liquid drum and bass, warm pads, rolling amens, deep sub, 174 bpm',
    energy: 0.55,
    darkness: 0.35,
    chaos: 0.2,
  },
  {
    id: 'neuro-pressure',
    label: 'Neuro pressure',
    promptText: 'neurofunk pressure, reese bass, tight breaks, dark atmosphere, 174 bpm',
    energy: 0.85,
    darkness: 0.7,
    chaos: 0.35,
  },
  {
    id: 'jump-up',
    label: 'Jump-up bounce',
    promptText: 'jump up bounce, wobble bass, energetic dancefloor, gated stabs, 174 bpm',
    energy: 0.9,
    darkness: 0.4,
    chaos: 0.45,
  },
  {
    id: 'halftime-weight',
    label: 'Half-time weight',
    promptText: 'half-time break, heavy drums, distorted supersaw, rock-dnb crossover, 174 bpm',
    energy: 0.8,
    darkness: 0.55,
    chaos: 0.3,
  },
  {
    id: 'techstep-grid',
    label: 'Techstep grid',
    promptText: 'techstep grid, cold atmosphere, precise hats, industrial bass, 174 bpm',
    energy: 0.7,
    darkness: 0.65,
    chaos: 0.25,
  },
  {
    id: 'roller-groove',
    label: 'Roller groove',
    promptText: 'roller groove, deep bass, subtle fills, late-night energy, 174 bpm',
    energy: 0.65,
    darkness: 0.5,
    chaos: 0.22,
  },
  {
    id: 'dancefloor-rush',
    label: 'Dancefloor rush',
    promptText: 'energetic dancefloor drum and bass, aggressive transient drums, bright lead, 174 bpm',
    energy: 0.88,
    darkness: 0.3,
    chaos: 0.4,
  },
  {
    id: 'forest-fog',
    label: 'Forest fog',
    promptText: 'atmospheric jungle, organic breaks, misty pads, soft sub, 174 bpm',
    energy: 0.5,
    darkness: 0.45,
    chaos: 0.28,
  },
] as const;

export type RandomUint32 = () => number;

/** Crypto-backed uint32; injectable for tests. */
export function randomUint32(rng?: RandomUint32): number {
  if (rng) return rng() >>> 0;
  const buf = new Uint32Array(1);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
    return buf[0]! >>> 0;
  }
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}

/** Pick a template; injectable index picker for tests. */
export function pickGenreTemplate(
  pickIndex: (n: number) => number = (n) => Math.floor(Math.random() * n),
): GenreTemplate {
  const i = Math.abs(pickIndex(GENRE_TEMPLATES.length)) % GENRE_TEMPLATES.length;
  return GENRE_TEMPLATES[i]!;
}

/** Build Surprise Me params: new seed + template knobs; BPM stays product default. */
export function buildSurpriseParams(opts?: {
  rng?: RandomUint32;
  pickIndex?: (n: number) => number;
}): {
  seed: number;
  bpm: number;
  promptText: string;
  energy: number;
  darkness: number;
  chaos: number;
  templateId: string;
} {
  const template = pickGenreTemplate(opts?.pickIndex);
  return {
    seed: randomUint32(opts?.rng),
    bpm: 174,
    promptText: template.promptText,
    energy: template.energy,
    darkness: template.darkness,
    chaos: template.chaos,
    templateId: template.id,
  };
}
