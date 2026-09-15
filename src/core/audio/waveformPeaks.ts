/**
 * Downsample a mono buffer into absolute peak buckets for UI waveform strips.
 * Pure CPU — no Web Audio required (works in Node tests too).
 */
export function computeWaveformPeaks(mono: Float32Array, buckets = 128): number[] {
  const n = Math.max(1, buckets | 0);
  if (!mono.length) return Array.from({ length: n }, () => 0);
  const peaks = new Array<number>(n).fill(0);
  const stride = mono.length / n;
  for (let b = 0; b < n; b++) {
    const start = Math.floor(b * stride);
    const end = Math.min(mono.length, Math.floor((b + 1) * stride));
    let peak = 0;
    for (let i = start; i < end; i++) peak = Math.max(peak, Math.abs(mono[i]!));
    peaks[b] = peak;
  }
  // Soft normalize so quiet sketches still read as a visible shape
  let max = 0;
  for (const p of peaks) max = Math.max(max, p);
  if (max > 1e-8) {
    const g = 1 / max;
    for (let i = 0; i < peaks.length; i++) peaks[i]! *= g;
  }
  return peaks;
}

/** Rough RMS of a mono buffer — used in synth honesty tests. */
export function bufferRms(mono: Float32Array): number {
  if (!mono.length) return 0;
  let sum = 0;
  for (let i = 0; i < mono.length; i++) {
    const x = mono[i]!;
    sum += x * x;
  }
  return Math.sqrt(sum / mono.length);
}
