/** Fingerprint-shaped snapshot for #83 What-changed labels (no store import). */
export type ParamsSnapshot = {
  seed: number;
  bpm: number;
  bars: number;
  energy: number;
  darkness: number;
  chaos: number;
  promptText: string;
  vibeIntensity: number;
};

const LABELS: { key: keyof ParamsSnapshot; label: string }[] = [
  { key: 'energy', label: 'Energy' },
  { key: 'darkness', label: 'Mood' },
  { key: 'chaos', label: 'Chaos' },
  { key: 'seed', label: 'Seed' },
  { key: 'bpm', label: 'BPM' },
  { key: 'bars', label: 'Bars' },
  { key: 'promptText', label: 'Style text' },
  { key: 'vibeIntensity', label: 'Vibe' },
];

/** #83 Human labels for knobs that diverge from last render fingerprint. */
export function listChangedParamLabels(
  fp: ParamsSnapshot | null,
  s: ParamsSnapshot,
): string[] {
  if (!fp) return [];
  const out: string[] = [];
  for (const { key, label } of LABELS) {
    if (fp[key] !== s[key]) out.push(label);
  }
  return out;
}
