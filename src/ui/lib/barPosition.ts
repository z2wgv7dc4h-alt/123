import type { Section } from '@/core/types';

/** Pure helpers for #52 bar:beat+section and #53 ±1 bar nudge. */

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** 0-based bar index + 1-based beat (1–4) from playhead ratio. */
export function barBeatFromProgress(
  progress01: number,
  bars: number,
): { bar: number; beat: number } {
  if (bars <= 0) return { bar: 0, beat: 1 };
  const p = clamp01(progress01);
  const totalBeats = bars * 4;
  const beatPos = Math.min(totalBeats - 1e-9, p * totalBeats);
  const bar = Math.min(bars - 1, Math.max(0, Math.floor(beatPos / 4)));
  const beat = Math.min(4, Math.max(1, Math.floor(beatPos % 4) + 1));
  return { bar, beat };
}

export function sectionAtBar(
  bar: number,
  sections: readonly Section[] | undefined,
): string | null {
  if (!sections?.length) return null;
  let cur: Section | null = null;
  for (const s of sections) {
    if (bar >= s.startBar && bar < s.startBar + s.lengthBars) {
      cur = s;
      break;
    }
    if (bar >= s.startBar) cur = s;
  }
  if (!cur) return null;
  return cur.name.charAt(0).toUpperCase() + cur.name.slice(1);
}

export function formatBarBeatSection(
  progress01: number,
  bars: number,
  sections?: readonly Section[],
): string {
  const { bar, beat } = barBeatFromProgress(progress01, bars);
  const sec = sectionAtBar(bar, sections);
  const head = `${bar + 1}:${beat}`;
  return sec ? `${head} · ${sec}` : head;
}

/** Nudge playhead by ±deltaBars; returns new 0..1 ratio. */
export function nudgeBarRatio(
  progress01: number,
  bars: number,
  deltaBars: number,
): number {
  if (bars <= 0) return clamp01(progress01);
  const nextBar = progress01 * bars + deltaBars;
  return clamp01(nextBar / bars);
}

/** mm:ss from ratio × durationSec (#58). */
export function formatMmSs(progress01: number, durationSec: number): string {
  const sec = Math.max(0, clamp01(progress01) * Math.max(0, durationSec));
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Section → loop region ratios (#59). */
export function sectionLoopRatios(
  startBar: number,
  lengthBars: number,
  totalBars: number,
): { start: number; end: number } | null {
  if (totalBars <= 0 || lengthBars <= 0) return null;
  const start = clamp01(startBar / totalBars);
  const end = clamp01((startBar + lengthBars) / totalBars);
  if (end - start < 0.02) return null;
  return { start, end };
}


/** #65 Drop section → wash highlight ratios on waveform. */
export function dropWashRatios(
  sections: readonly { name: string; startBar: number; lengthBars: number }[] | undefined,
  totalBars: number,
): { start: number; end: number } | null {
  if (!sections?.length || totalBars <= 0) return null;
  const drop = sections.find((s) => s.name === 'drop');
  if (!drop || drop.lengthBars <= 0) return null;
  return sectionLoopRatios(drop.startBar, drop.lengthBars, totalBars);
}

/** Bars × 4 beats × 60/bpm → seconds (structure estimate). */
export function barsToDurationSec(bars: number, bpm: number): number {
  if (!(bars > 0) || !(bpm > 0) || !Number.isFinite(bars) || !Number.isFinite(bpm)) return 0;
  return (bars * 4 * 60) / bpm;
}

/** Absolute seconds → m:ss (not ratio-based). */
export function formatDurationMmSs(sec: number): string {
  const s = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/** Always-on transport clock: elapsed / total. */
export function formatElapsedTotal(elapsedSec: number, totalSec: number): string {
  return `${formatDurationMmSs(elapsedSec)} / ${formatDurationMmSs(totalSec)}`;
}

export type PlaybackDurationSource = 'live' | 'mix' | 'structure';

export type PlaybackDuration = {
  /** Honest playable length for clocks / remaining. */
  durationSec: number;
  source: PlaybackDurationSource;
  /** Structure estimate bars×BPM. */
  structureSec: number;
  /** True when audio length and structure disagree by >0.5s. */
  mismatch: boolean;
  /** Short UI note when mismatch — never a lying total. */
  mismatchNote: string | null;
};

const MISMATCH_SEC = 0.5;

/**
 * One duration source for playhead / timers.
 * Prefer live max buffer, else mix stem durationSec, else bars×BPM.
 * When arrangement is dirty, callers should pass current audio length (mix/live)
 * and result.structure.bars — not the pending edited bars.
 */
export function resolvePlaybackDuration(opts: {
  mixDurationSec?: number | null;
  liveDurationSec?: number | null;
  bars: number;
  bpm: number;
}): PlaybackDuration {
  const structureSec = barsToDurationSec(opts.bars, opts.bpm);
  const live = opts.liveDurationSec != null && opts.liveDurationSec > 0 ? opts.liveDurationSec : 0;
  const mix = opts.mixDurationSec != null && opts.mixDurationSec > 0 ? opts.mixDurationSec : 0;

  let durationSec: number;
  let source: PlaybackDurationSource;
  // Mix WAV is the one duration source; live graph can disagree after mute/limiter.
  if (mix > 0) {
    durationSec = mix;
    source = 'mix';
  } else if (live > 0) {
    durationSec = live;
    source = 'live';
  } else {
    durationSec = structureSec;
    source = 'structure';
  }

  const audioSec = source === 'structure' ? 0 : durationSec;
  const mismatch =
    audioSec > 0 && structureSec > 0 && Math.abs(audioSec - structureSec) > MISMATCH_SEC;

  let mismatchNote: string | null = null;
  if (mismatch) {
    mismatchNote = `Length note · audio ${formatDurationMmSs(audioSec)} vs map ~${formatDurationMmSs(structureSec)}`;
  }

  return { durationSec, source, structureSec, mismatch, mismatchNote };
}

/**
 * Second clock line: `Bar N.B · Section · {bars} bars · ~M:SS`
 * Uses structure bars for bar:beat; approx (~) from structureSec unless durationSec given.
 */
export function formatBarSectionClockLine(
  progress01: number,
  bars: number,
  sections: readonly { name: string; startBar: number; lengthBars: number }[] | undefined,
  approxSec: number,
): string {
  if (bars <= 0) return '—';
  const { bar, beat } = barBeatFromProgress(progress01, bars);
  const secName = sectionAtBar(bar, sections as any);
  const approx = formatDurationMmSs(approxSec);
  const head = `Bar ${bar + 1}.${beat}`;
  const mid = secName ? ` · ${secName}` : '';
  return `${head}${mid} · ${bars} bars · ~${approx}`;
}
