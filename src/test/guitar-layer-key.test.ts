/**
 * applyGuitarLayers/applyRockMidGrit used to synthesize at fixed hardcoded
 * pitches (writeGuitarChord at a bare 196 Hz / G3, the solo root at a bare
 * MIDI 57 / A3, writeRockMid at a bare 520 Hz) regardless of the song's
 * actual keyRoot — meaning the guitar/lead texture could land a semitone or
 * more off the bass in any key other than whatever those hardcoded values
 * happened to imply. Fixed to derive pitch from structure.keyRoot via
 * midiForRoot(). This locks in that the output actually changes with key
 * (not just that the code compiles) — soft-pass forbidden.
 */
import { describe, expect, it } from 'vitest';
import { structureEngine, midiForRoot } from '../core/structure';
import { applyGuitarLayers, applyRockMidGrit } from '../core/backends';
import type { StructureMap } from '../core/types';

async function planWithKey(keyRoot: string): Promise<StructureMap> {
  return structureEngine.plan({
    seed: 42,
    bpm: 174,
    bars: 16,
    energy: 0.75,
    darkness: 0.45,
    chaos: 0.25,
    breakDensity: 0.55,
    sampleRateHz: 48000,
    songShape: 'classic',
    keyRoot,
  });
}

describe('guitar/lead texture layers follow the song key (not a hardcoded pitch)', () => {
  it('applyGuitarLayers output differs between two different keys', async () => {
    const sr = 48000;
    const mapC = await planWithKey('C');
    const mapA = await planWithKey('A');
    // Same seed drives drum/bass timing identically; only keyRoot differs.
    const bufC = new Float32Array(sr * 8);
    const bufA = new Float32Array(sr * 8);
    applyGuitarLayers(bufC, mapC, sr, 0.75, { guitar: true, solo: true });
    applyGuitarLayers(bufA, mapA, sr, 0.75, { guitar: true, solo: true });

    expect(bufC.some((v) => v !== 0)).toBe(true);
    expect(bufA.some((v) => v !== 0)).toBe(true);
    expect(Array.from(bufC)).not.toEqual(Array.from(bufA));
  });

  it('applyGuitarLayers guitar chord is voiced relative to midiForRoot(keyRoot), not a fixed pitch', async () => {
    const sr = 48000;
    const mapC = await planWithKey('C');
    const mapDifferentRoot = { ...mapC, keyRoot: 'A' } as StructureMap;
    const bufDefaultKey = new Float32Array(sr * 8);
    const bufOverriddenKey = new Float32Array(sr * 8);
    applyGuitarLayers(bufDefaultKey, mapC, sr, 0.75, { guitar: true });
    applyGuitarLayers(bufOverriddenKey, mapDifferentRoot, sr, 0.75, { guitar: true });
    // C (midi 36) vs A (midi 45) is a real 9-semitone difference — output must diverge.
    expect(midiForRoot('C')).not.toBe(midiForRoot('A'));
    expect(Array.from(bufDefaultKey)).not.toEqual(Array.from(bufOverriddenKey));
  });

  it('applyRockMidGrit output differs between two different keys', async () => {
    const sr = 48000;
    const mapC = await planWithKey('C');
    const mapA = await planWithKey('A');
    const bufC = new Float32Array(sr * 8);
    const bufA = new Float32Array(sr * 8);
    applyRockMidGrit(bufC, mapC, sr, 0.75);
    applyRockMidGrit(bufA, mapA, sr, 0.75);
    expect(Array.from(bufC)).not.toEqual(Array.from(bufA));
  });
});
