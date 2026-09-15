/**
 * Locks in voice leading for the bass line: before this fix, every bass note
 * was an independent random pick from an interval table relative to a FIXED
 * root, so two harmonically "valid" picks could land 15+ semitones apart
 * from EACH OTHER — audibly a random-pitch generator, not a bassline (real
 * user complaint: Sketch "doesn't compose anything that sounds composed").
 * nearestOctaveTo() re-octaves each note toward the previous one, so within
 * a section every step must be small. Soft-pass forbidden — this asserts
 * the actual generated note deltas, not just that a helper function exists.
 */
import { describe, expect, it } from 'vitest';
import { structureEngine } from '../core/structure';
import type { BassNote, Section } from '../core/types';

const MAX_STEP_WITHIN_SECTION = 6; // nearestOctaveTo searches ±2 octaves in 12-semitone steps

function sectionAt(sections: readonly Section[], bar: number): Section {
  let cur = sections[0]!;
  for (const s of sections) {
    if (bar >= s.startBar) cur = s;
  }
  return cur;
}

function maxWithinSectionStep(notes: readonly BassNote[], sections: readonly Section[]): number {
  const sorted = [...notes].sort((a, b) => a.bar - b.bar || a.beat - b.beat);
  let max = 0;
  let prevMidi: number | null = null;
  let prevSectionName: string | null = null;
  for (const n of sorted) {
    const sec = sectionAt(sections, n.bar);
    if (prevMidi != null && sec.name === prevSectionName) {
      max = Math.max(max, Math.abs(n.midi - prevMidi));
    }
    prevMidi = n.midi;
    prevSectionName = sec.name;
  }
  return max;
}

describe('bass voice leading (composition honesty)', () => {
  it('consecutive bass notes within a section never leap more than a tritone+ (was seen leaping 19 semitones before the fix)', async () => {
    for (const seed of [17400, 1, 4111889323, 2611060857]) {
      const map = await structureEngine.plan({
        seed,
        bpm: 174,
        bars: 32,
        energy: 0.75,
        darkness: 0.45,
        chaos: 0.25,
        breakDensity: 0.55,
        sampleRateHz: 48000,
        songShape: 'classic',
      });
      const worst = maxWithinSectionStep(map.bassRole.notes, map.sections);
      expect(worst, `seed ${seed}: worst within-section bass step was ${worst} semitones`).toBeLessThanOrEqual(
        MAX_STEP_WITHIN_SECTION,
      );
    }
  });

  it('holds across darkness / family / trap-bounce variants, not just the default preset', async () => {
    const variants = [
      { darkness: 0.2, songShape: 'classic' },
      { darkness: 0.8, songShape: 'classic' },
      { darkness: 0.45, songShape: 'trap-bounce' },
      { darkness: 0.45, songShape: 'dubstep' },
    ] as const;
    for (const v of variants) {
      const map = await structureEngine.plan({
        seed: 555,
        bpm: 174,
        bars: 32,
        energy: 0.75,
        darkness: v.darkness,
        chaos: 0.25,
        breakDensity: 0.55,
        sampleRateHz: 48000,
        songShape: v.songShape,
      });
      const worst = maxWithinSectionStep(map.bassRole.notes, map.sections);
      expect(worst, `${JSON.stringify(v)}: worst step ${worst}`).toBeLessThanOrEqual(MAX_STEP_WITHIN_SECTION);
    }
  });

  it('is still fully deterministic: same seed produces byte-identical bass note sequence', async () => {
    const plan = () =>
      structureEngine.plan({
        seed: 999,
        bpm: 174,
        bars: 16,
        energy: 0.6,
        darkness: 0.5,
        chaos: 0.3,
        breakDensity: 0.5,
        sampleRateHz: 48000,
        songShape: 'classic',
      });
    const a = await plan();
    const b = await plan();
    expect(JSON.stringify(a.bassRole.notes)).toEqual(JSON.stringify(b.bassRole.notes));
  });
});
