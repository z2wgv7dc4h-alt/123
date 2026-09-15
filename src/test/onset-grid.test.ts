/**
 * Critic A13 — automated kick/snare median |onset−grid| ≤15ms @48kHz.
 * OfflineStub + hard-grid-v0 is structure authority at 174.
 * Soft-pass forbidden: threshold is hard ≤15 ms.
 */
import { describe, expect, it } from 'vitest';
import { offlineStubBackend } from '../core/backends';
import { DEFAULT_BIT_DEPTH, DEFAULT_BPM, DEFAULT_SAMPLE_RATE } from '../core/types';
import {
  ONSET_GRID_MEDIAN_MAX_MS,
  decodeWavToMono,
  measureKickSnareOnsetGrid,
} from '../core/audio/onsetGrid';

if (typeof URL.createObjectURL !== 'function') {
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => 'node://blob';
  (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
}

const SEED = 17400;

describe('Critic A13: kick/snare onset vs 174 hard grid', () => {
  it(
    'OfflineStub seed-stable mix: median |onset−grid| ≤15ms @48kHz (kick+snare)',
    async () => {
      const result = await offlineStubBackend.render({
        jobId: 'a13_onset_grid',
        seed: SEED,
        bpm: DEFAULT_BPM,
        bpmTolerance: 2,
        durationBars: 16,
        sampleRateHz: DEFAULT_SAMPLE_RATE,
        bitDepth: DEFAULT_BIT_DEPTH,
        channels: 2,
        prompt: {
          descriptors: ['energetic dancefloor drum and bass'],
          energy: 0.75,
          darkness: 0.45,
          chaos: 0.2,
        },
        stemSchemaVersion: 'v0',
      });

      // Seed-stable structure authority
      expect(result.structure?.version).toBe('hard-grid-v0');
      expect(result.structure?.bpm).toBe(174);
      expect(result.bpmMeasured).toBe(174);

      const kickStem = result.stems.find((s) => s.id === 'kick');
      const snareStem = result.stems.find((s) => s.id === 'snare');
      expect(kickStem?.blob).toBeTruthy();
      expect(snareStem?.blob).toBeTruthy();
      expect(kickStem!.sampleRateHz).toBe(48000);
      expect(snareStem!.sampleRateHz).toBe(48000);

      const kickWav = decodeWavToMono(await kickStem!.blob!.arrayBuffer());
      const snareWav = decodeWavToMono(await snareStem!.blob!.arrayBuffer());
      expect(kickWav.sampleRateHz).toBe(48000);
      expect(snareWav.sampleRateHz).toBe(48000);

      // Same seed → identical structure (seed-stable)
      const again = await offlineStubBackend.render({
        jobId: 'a13_onset_grid_b',
        seed: SEED,
        bpm: DEFAULT_BPM,
        bpmTolerance: 2,
        durationBars: 16,
        sampleRateHz: DEFAULT_SAMPLE_RATE,
        bitDepth: DEFAULT_BIT_DEPTH,
        channels: 2,
        prompt: {
          descriptors: ['energetic dancefloor drum and bass'],
          energy: 0.75,
          darkness: 0.45,
          chaos: 0.2,
        },
        stemSchemaVersion: 'v0',
      });
      expect(JSON.stringify(again.structure?.drums)).toBe(JSON.stringify(result.structure?.drums));

      // Prefer left channel (undelayed) — snare stem uses micro-Haas on R
      const report = measureKickSnareOnsetGrid({
        structure: result.structure!,
        kickMono: kickWav.left,
        snareMono: snareWav.left,
        sampleRateHz: kickWav.sampleRateHz,
      });

      // Must match most planned hits — silent miss does not soft-pass the gate
      expect(report.kick.matched).toBeGreaterThan(0);
      expect(report.snare.matched).toBeGreaterThan(0);
      expect(report.kick.missed / Math.max(1, report.kick.expectedCount)).toBeLessThan(0.15);
      expect(report.snare.missed / Math.max(1, report.snare.expectedCount)).toBeLessThan(0.15);

      // Hard gate — no soft toBeLessThan(50)
      expect(report.kick.medianAbsErrorMs).toBeLessThanOrEqual(ONSET_GRID_MEDIAN_MAX_MS);
      expect(report.snare.medianAbsErrorMs).toBeLessThanOrEqual(ONSET_GRID_MEDIAN_MAX_MS);
      expect(report.combinedMedianAbsErrorMs).toBeLessThanOrEqual(ONSET_GRID_MEDIAN_MAX_MS);

      // Diagnostics for CI / failure triage
      console.log(
        'A13 onset-grid',
        JSON.stringify({
          bpm: report.bpm,
          hopSec: report.hopSec,
          kick: {
            expected: report.kick.expectedCount,
            matched: report.kick.matched,
            missed: report.kick.missed,
            medianMs: report.kick.medianAbsErrorMs,
            maxMs: report.kick.maxAbsErrorMs,
          },
          snare: {
            expected: report.snare.expectedCount,
            matched: report.snare.matched,
            missed: report.snare.missed,
            medianMs: report.snare.medianAbsErrorMs,
            maxMs: report.snare.maxAbsErrorMs,
          },
          combinedMedianMs: report.combinedMedianAbsErrorMs,
        }),
      );
    },
    90_000,
  );
});
