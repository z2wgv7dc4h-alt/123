/**
 * Player duration unity — one source; mismatch surfaced, never a lying total.
 */
import { describe, expect, it } from 'vitest';
import {
  barsToDurationSec,
  formatDurationMmSs,
  formatElapsedTotal,
  formatBarSectionClockLine,
  resolvePlaybackDuration,
} from '../ui/lib/barPosition';

describe('playback duration helpers', () => {
  it('barsToDurationSec matches 32 bars @ 174 ≈ 44.14s', () => {
    const sec = barsToDurationSec(32, 174);
    expect(sec).toBeCloseTo((32 * 4 * 60) / 174, 5);
    expect(formatDurationMmSs(sec)).toBe('0:44');
  });

  it('prefer mix over structure and live (one duration source)', () => {
    const mix = resolvePlaybackDuration({
      mixDurationSec: 40,
      liveDurationSec: null,
      bars: 32,
      bpm: 174,
    });
    expect(mix.source).toBe('mix');
    expect(mix.durationSec).toBe(40);
    expect(mix.mismatch).toBe(true); // 40 vs ~44.14
    expect(mix.mismatchNote).toMatch(/Length note/);

    const both = resolvePlaybackDuration({
      mixDurationSec: 40,
      liveDurationSec: 41.2,
      bars: 32,
      bpm: 174,
    });
    expect(both.source).toBe('mix');
    expect(both.durationSec).toBe(40);
    expect(both.mismatch).toBe(true);
  });

  it('no mismatch when audio ≈ structure', () => {
    const struct = barsToDurationSec(32, 174);
    const r = resolvePlaybackDuration({
      mixDurationSec: struct,
      bars: 32,
      bpm: 174,
    });
    expect(r.mismatch).toBe(false);
    expect(r.mismatchNote).toBeNull();
  });

  it('formatElapsedTotal and bar clock line stay consistent', () => {
    expect(formatElapsedTotal(12, 44.14)).toBe('0:12 / 0:44');
    const line = formatBarSectionClockLine(
      0.5,
      32,
      [
        { name: 'intro', startBar: 0, lengthBars: 8 },
        { name: 'drop', startBar: 16, lengthBars: 8 },
      ],
      44.14,
    );
    expect(line).toMatch(/^Bar 17\.1/);
    expect(line).toMatch(/Drop/);
    expect(line).toMatch(/32 bars/);
    expect(line).toMatch(/~0:44/);
  });

  it('falls back to structure when no audio length yet', () => {
    const r = resolvePlaybackDuration({ bars: 48, bpm: 174 });
    expect(r.source).toBe('structure');
    expect(r.durationSec).toBeCloseTo(barsToDurationSec(48, 174), 5);
    expect(r.mismatch).toBe(false);
  });
});
