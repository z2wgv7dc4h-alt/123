/**
 * Browser-local favorites shelf — seed + arrangement params + optional vibe hash.
 * Never uploads; never stores file bytes.
 */

export const FAVORITES_STORAGE_KEY = 'dnb-studio.favorites.v0';
export const FAVORITES_MAX = 24;

export type FavoriteSnapshot = {
  id: string;
  savedAt: number;
  label: string;
  seed: number;
  bpm: number;
  bars: number;
  energy: number;
  darkness: number;
  chaos: number;
  promptText: string;
  vibeIntensity: number;
  /** Vibe fingerprint hash when a style ref was attached (settings-only). */
  vibeHash: string | null;
  vibeFileName: string | null;
};

export type FavoriteInput = Omit<FavoriteSnapshot, 'id' | 'savedAt' | 'label'> & {
  label?: string;
};

function safeParse(raw: string | null): FavoriteSnapshot[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFavoriteSnapshot);
  } catch {
    return [];
  }
}

function isFavoriteSnapshot(v: unknown): v is FavoriteSnapshot {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.savedAt === 'number' &&
    typeof o.label === 'string' &&
    typeof o.seed === 'number' &&
    typeof o.bpm === 'number' &&
    typeof o.bars === 'number' &&
    typeof o.energy === 'number' &&
    typeof o.darkness === 'number' &&
    typeof o.chaos === 'number' &&
    typeof o.promptText === 'string' &&
    typeof o.vibeIntensity === 'number' &&
    (o.vibeHash === null || typeof o.vibeHash === 'string') &&
    (o.vibeFileName === null || typeof o.vibeFileName === 'string')
  );
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadFavorites(): FavoriteSnapshot[] {
  const s = storage();
  if (!s) return [];
  return safeParse(s.getItem(FAVORITES_STORAGE_KEY));
}

export function saveFavorites(list: FavoriteSnapshot[]): void {
  const s = storage();
  if (!s) return;
  const trimmed = list.slice(0, FAVORITES_MAX);
  s.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(trimmed));
}

function makeId(): string {
  return `fav_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultLabel(input: FavoriteInput): string {
  const bits = input.promptText
    .split(/[,·|]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 2);
  const head = bits.length ? bits.join(' · ') : `Seed ${input.seed}`;
  return head.length > 42 ? `${head.slice(0, 40)}…` : head;
}

/** Append a favorite; newest first. Returns the saved entry. */
export function addFavorite(input: FavoriteInput): FavoriteSnapshot {
  const entry: FavoriteSnapshot = {
    id: makeId(),
    savedAt: Date.now(),
    label: input.label?.trim() || defaultLabel(input),
    seed: input.seed >>> 0,
    bpm: Math.max(170, Math.min(176, Math.round(input.bpm))),
    bars: input.bars,
    energy: input.energy,
    darkness: input.darkness,
    chaos: input.chaos,
    promptText: input.promptText,
    vibeIntensity: input.vibeIntensity,
    vibeHash: input.vibeHash,
    vibeFileName: input.vibeFileName,
  };
  const next = [entry, ...loadFavorites().filter((f) => !sameSettings(f, entry))];
  saveFavorites(next);
  return entry;
}

/** True when seed+knobs+vibe hash match (ignore id/label/time). */
export function sameSettings(a: FavoriteSnapshot, b: FavoriteInput): boolean {
  return (
    a.seed === (b.seed >>> 0) &&
    a.bpm === b.bpm &&
    a.bars === b.bars &&
    a.energy === b.energy &&
    a.darkness === b.darkness &&
    a.chaos === b.chaos &&
    a.promptText === b.promptText &&
    a.vibeIntensity === b.vibeIntensity &&
    a.vibeHash === b.vibeHash
  );
}

export function removeFavorite(id: string): FavoriteSnapshot[] {
  const next = loadFavorites().filter((f) => f.id !== id);
  saveFavorites(next);
  return next;
}

/** Slight variation: keep knobs/prompt/vibe; new seed. */
export function slightVariationSeed(
  fav: FavoriteSnapshot,
  rng: () => number = () => {
    const buf = new Uint32Array(1);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(buf);
      return buf[0]!;
    }
    return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  },
): number {
  let next = rng() >>> 0;
  if (next === fav.seed) next = (next + 0x9e3779b9) >>> 0;
  return next;
}
