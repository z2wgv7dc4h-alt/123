/**
 * Allowlisted genre templates for the style preset picker and Surprise Me.
 * Genre descriptors only — never artist, band, or track names.
 */

import type { GenreId } from '@/core/types';

export type GenreTemplate = {
  id: string;
  label: string;
  genre: GenreId;
  bpm: number;
  /** Freeform style text (pass-through on Generate). */
  promptText: string;
  energy: number;
  darkness: number;
  chaos: number;
  /** Song shape this style wants (e.g. long builds need double-drop). */
  songShape?: 'classic' | 'long-intro' | 'breakdown' | 'double-drop';
};

export const GENRE_TEMPLATES: readonly GenreTemplate[] = [
  {
    id: 'liquid-glow',
    label: 'Liquid glow',
    genre: 'dnb',
    bpm: 174,
    promptText: 'liquid drum and bass, warm pads, rolling amens, deep sub',
    energy: 0.55,
    darkness: 0.35,
    chaos: 0.2,
  },
  {
    id: 'neuro-pressure',
    label: 'Neuro pressure',
    genre: 'dnb',
    bpm: 174,
    promptText: 'neurofunk pressure, reese bass, tight breaks, dark atmosphere',
    energy: 0.85,
    darkness: 0.7,
    chaos: 0.35,
  },
  {
    id: 'jump-up',
    label: 'Jump-up bounce',
    genre: 'dnb',
    bpm: 174,
    promptText: 'jump up bounce, wobble bass, energetic dancefloor, gated stabs',
    energy: 0.9,
    darkness: 0.4,
    chaos: 0.45,
  },
  {
    id: 'halftime-weight',
    label: 'Half-time weight',
    genre: 'halftime',
    bpm: 170,
    promptText: 'halftime drum and bass, heavy half-time drums, distorted supersaw, massive reese bass',
    energy: 0.8,
    darkness: 0.55,
    chaos: 0.3,
  },
  {
    id: 'techstep-grid',
    label: 'Techstep grid',
    genre: 'dnb',
    bpm: 174,
    promptText: 'techstep grid, cold atmosphere, precise hats, industrial bass',
    energy: 0.7,
    darkness: 0.65,
    chaos: 0.25,
  },
  {
    id: 'roller-groove',
    label: 'Roller groove',
    genre: 'dnb',
    bpm: 174,
    promptText: 'roller groove, deep bass, subtle fills, late-night energy',
    energy: 0.65,
    darkness: 0.5,
    chaos: 0.22,
  },
  {
    id: 'dancefloor-rush',
    label: 'Dancefloor rush',
    genre: 'dnb',
    bpm: 174,
    promptText: 'energetic dancefloor drum and bass, aggressive transient drums, bright lead',
    energy: 0.88,
    darkness: 0.3,
    chaos: 0.4,
  },
  {
    id: 'festival-anthem',
    label: 'Festival anthem',
    genre: 'dnb',
    bpm: 174,
    promptText: 'festival drum and bass, huge supersaw synth leads, heavy distorted guitars, massive reese bass, punchy breakbeat drums, long riser build, anthemic stadium drop, loud polished master',
    energy: 0.9,
    darkness: 0.4,
    chaos: 0.3,
    songShape: 'double-drop',
  },
  {
    id: 'dubstep-drop',
    label: 'Dubstep drop',
    genre: 'dubstep',
    bpm: 140,
    promptText: 'dubstep, heavy wobble bass, metallic growl bass, half-time drums, massive drop, loud polished master',
    energy: 0.9,
    darkness: 0.7,
    chaos: 0.4,
  },
  {
    id: 'forest-fog',
    label: 'Forest fog',
    genre: 'jungle',
    bpm: 165,
    promptText: 'atmospheric jungle, organic breaks, misty pads, soft sub',
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

/** Build Surprise Me params: new seed + template knobs + template genre/tempo. */
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
  genre: GenreId;
  templateId: string;
} {
  const template = pickGenreTemplate(opts?.pickIndex);
  return {
    seed: randomUint32(opts?.rng),
    bpm: template.bpm,
    promptText: template.promptText,
    energy: template.energy,
    darkness: template.darkness,
    chaos: template.chaos,
    genre: template.genre,
    templateId: template.id,
  };
}

/** Params a preset click applies. Seed untouched; no generate. */
export function templateParams(id: string): {
  promptText: string;
  energy: number;
  darkness: number;
  chaos: number;
  genre: GenreId;
  bpm: number;
  songShape?: GenreTemplate['songShape'];
} | null {
  const t = GENRE_TEMPLATES.find((g) => g.id === id);
  if (!t) return null;
  return {
    promptText: t.promptText,
    energy: t.energy,
    darkness: t.darkness,
    chaos: t.chaos,
    genre: t.genre,
    bpm: t.bpm,
    ...(t.songShape ? { songShape: t.songShape } : {}),
  };
}
