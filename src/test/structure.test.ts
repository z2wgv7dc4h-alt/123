import { describe, expect, it } from 'vitest';
import { structureEngine } from '../core/structure';
import { DEFAULT_BPM } from '../core/types';
import { structureToMidiBlob } from '../core/midi';
import { encodeWav } from '../core/export';

describe('structure', () => {
  it('plans hard-grid-v0 at 174 with MIDI + WAV smoke', async () => {
    const a = await structureEngine.plan({
      seed: 42,
      bpm: DEFAULT_BPM,
      bars: 32,
      energy: 0.7,
      breakDensity: 0.4,
    });
    expect(a.version).toBe('hard-grid-v0');
    expect(a.bpm).toBe(174);
    expect(a.sections.map((s) => s.name)).toEqual(
      expect.arrayContaining(['intro', 'build', 'drop', 'break', 'outro']),
    );
    expect(structureToMidiBlob(a).size).toBeGreaterThan(20);
    expect(encodeWav([new Float32Array(64), new Float32Array(64)], 48000, 16).size).toBeGreaterThan(44);
  });
});
