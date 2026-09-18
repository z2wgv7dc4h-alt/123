/**
 * Style-reference preprocessing: send ACE a 45 s window instead of a whole
 * track, picked as the loudest window (drop-like energy) so the reference
 * guides timbre without a 4-minute upload.
 */
import { decodeWavChannels, encodeWav } from '../export/wav';

export const REFERENCE_WINDOW_SEC = 45;
const HOP_SEC = 1;

/**
 * Start (seconds) of the loudest `windowSec` window, scanned on a `hopSec`
 * grid (plus the trailing window). Returns 0 when the file is shorter.
 */
export function loudestWindowStartSec(
  mono: Float32Array,
  sampleRateHz: number,
  windowSec = REFERENCE_WINDOW_SEC,
  hopSec = HOP_SEC,
): number {
  const win = Math.round(windowSec * sampleRateHz);
  if (mono.length <= win || sampleRateHz <= 0) return 0;
  const prefix = new Float64Array(mono.length + 1);
  for (let i = 0; i < mono.length; i++) prefix[i + 1] = prefix[i]! + mono[i]! * mono[i]!;
  const hop = Math.max(1, Math.round(hopSec * sampleRateHz));

  let bestStart = 0;
  let bestSum = -1;
  const consider = (start: number) => {
    const sum = prefix[start + win]! - prefix[start]!;
    if (sum > bestSum) {
      bestSum = sum;
      bestStart = start;
    }
  };
  for (let start = 0; start + win <= mono.length; start += hop) consider(start);
  consider(mono.length - win); // trailing window
  return bestStart / sampleRateHz;
}

function toMono(channels: readonly Float32Array[]): Float32Array {
  const n = channels[0]?.length ?? 0;
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (const ch of channels) sum += ch[i] ?? 0;
    mono[i] = sum / channels.length;
  }
  return mono;
}

/**
 * Decode a user style-reference and return a WAV blob of the loudest 45 s
 * window. Falls back to the original blob when it is already short or not
 * decodable (the bridge/ACE then sees the file unchanged).
 */
export async function extractReferenceWindow(file: Blob): Promise<Blob> {
  try {
    const decoded = decodeWavChannels(await file.arrayBuffer());
    const channels = decoded.channels;
    const n = channels[0]?.length ?? 0;
    const win = Math.round(REFERENCE_WINDOW_SEC * decoded.sampleRate);
    if (!n || n <= win) return file;
    const start = Math.round(loudestWindowStartSec(toMono(channels), decoded.sampleRate) * decoded.sampleRate);
    const sliced = channels.map((ch) => ch.subarray(start, start + win));
    return encodeWav(sliced, decoded.sampleRate, decoded.bitDepth === 24 ? 24 : 16);
  } catch {
    return file;
  }
}
