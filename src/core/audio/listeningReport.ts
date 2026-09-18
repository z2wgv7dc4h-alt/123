/**
 * Listening-set report helpers (pure): duration, integrated LUFS and sample
 * peak for decoded mix channels. Reuses the same BS.1770 measurement the
 * mastering path uses, so a listening report matches what Studio applies.
 */
import { integratedLufs } from './master';

export type ListeningReportRow = {
  name: string;
  seed: number;
  durationSec: number;
  integratedLufs: number;
  samplePeakDbFS: number;
  /** Present on a failed render so report.csv records what happened. */
  error?: string;
};

/** Max absolute sample across all channels, in dBFS (silence → -Infinity). */
export function samplePeakDbFS(channels: readonly Float32Array[]): number {
  let peak = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]!);
      if (a > peak) peak = a;
    }
  }
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
}

/** Duration in seconds of the longest channel at the given sample rate. */
export function channelDurationSec(channels: readonly Float32Array[], sampleRate: number): number {
  if (!channels.length || sampleRate <= 0) return 0;
  let frames = 0;
  for (const ch of channels) frames = Math.max(frames, ch.length);
  return frames / sampleRate;
}

/** One report row from decoded channels. Missing right channel reuses left. */
export function analyzeMix(
  channels: readonly Float32Array[],
  sampleRate: number,
  meta: { name: string; seed: number },
): ListeningReportRow {
  const left = channels[0] ?? new Float32Array(0);
  const right = channels[1] ?? left;
  const lufs = integratedLufs(left, right, sampleRate);
  return {
    name: meta.name,
    seed: meta.seed,
    durationSec: channelDurationSec(channels, sampleRate),
    integratedLufs: Number.isFinite(lufs) ? lufs : -Infinity,
    samplePeakDbFS: samplePeakDbFS(channels),
  };
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : '';
}

/** Quote a CSV field when it holds a comma, quote or newline (error messages). */
function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** CSV for the listening set: header + one row per render (failures included). */
export function listeningReportCsv(rows: readonly ListeningReportRow[]): string {
  const header = 'name,seed,durationSec,integratedLufs,samplePeakDbFS,error';
  const lines = rows.map((r) =>
    [
      csvField(r.name),
      r.seed,
      fmt(r.durationSec),
      fmt(r.integratedLufs),
      fmt(r.samplePeakDbFS),
      csvField(r.error ?? ''),
    ].join(','),
  );
  return [header, ...lines].join('\n') + '\n';
}
