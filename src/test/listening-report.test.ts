/**
 * Listening-set report helpers: duration / integrated LUFS / sample peak on a
 * synthetic stereo buffer. The script itself is run by the user (never agents).
 */
import { describe, expect, it } from 'vitest';
import {
  analyzeMix,
  channelDurationSec,
  listeningReportCsv,
  samplePeakDbFS,
} from '../core/audio/listeningReport';

const SR = 48000;

function sine(seconds: number, amplitude: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < out.length; i++) {
    out[i] = amplitude * Math.sin((2 * Math.PI * 440 * i) / SR);
  }
  return out;
}

describe('listening report helpers', () => {
  it('measures duration from the longest channel', () => {
    expect(channelDurationSec([new Float32Array(SR), new Float32Array(SR * 2)], SR)).toBeCloseTo(2);
    expect(channelDurationSec([], SR)).toBe(0);
    expect(channelDurationSec([new Float32Array(SR)], 0)).toBe(0);
  });

  it('reads sample peak in dBFS (-Infinity for silence)', () => {
    expect(samplePeakDbFS([sine(1, 0.5), sine(1, 0.5)])).toBeCloseTo(20 * Math.log10(0.5), 2);
    expect(samplePeakDbFS([new Float32Array(SR)])).toBe(-Infinity);
  });

  it('reports finite LUFS and a louder buffer outranks a quiet one', () => {
    const quiet = analyzeMix([sine(2, 0.3), sine(2, 0.3)], SR, { name: 'quiet', seed: 1 });
    const loud = analyzeMix([sine(2, 0.8), sine(2, 0.8)], SR, { name: 'loud', seed: 2 });
    expect(Number.isFinite(quiet.integratedLufs)).toBe(true);
    expect(Number.isFinite(loud.integratedLufs)).toBe(true);
    expect(loud.integratedLufs).toBeGreaterThan(quiet.integratedLufs);
    expect(loud.durationSec).toBeCloseTo(2);
    expect(loud.samplePeakDbFS).toBeCloseTo(20 * Math.log10(0.8), 2);
  });

  it('handles silence without NaN', () => {
    const row = analyzeMix([new Float32Array(SR)], SR, { name: 'silent', seed: 3 });
    expect(row.integratedLufs).toBe(-Infinity);
    expect(row.samplePeakDbFS).toBe(-Infinity);
  });

  it('formats the CSV header and rows (blank for non-finite)', () => {
    const csv = listeningReportCsv([
      { name: 'dnb-festival', seed: 17400, durationSec: 88.27, integratedLufs: -9.5, samplePeakDbFS: -1.2 },
      { name: 'silent', seed: 1, durationSec: 0, integratedLufs: -Infinity, samplePeakDbFS: -Infinity },
    ]);
    const lines = csv.trimEnd().split('\n');
    expect(lines[0]).toBe('name,seed,durationSec,integratedLufs,samplePeakDbFS');
    expect(lines[1]).toBe('dnb-festival,17400,88.27,-9.50,-1.20');
    expect(lines[2]).toBe('silent,1,0.00,,');
    expect(csv.endsWith('\n')).toBe(true);
  });
});
