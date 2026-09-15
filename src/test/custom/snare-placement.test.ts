import { describe, expect, it } from 'vitest';
import { planDrums, HardGridStructureEngine } from '../../core/structure/StructureEngine';
import { Section } from '../../types';

describe('Snare Placement Check', () => {
  it('asserts half-time drop snares land on beat index 2 (beat 3), never beat index 1', () => {
    const bars = 4;
    const sections: Section[] = [
      { name: 'drop', startBar: 0, lengthBars: 4, fillHint: false }
    ];
    const energy = 0.8;
    const breakDensity = 0.5;
    const chaos = 0.2;
    const rng = () => 0.5;
    const halfTimeDrop = true;

    const drumPlan = planDrums(
      bars,
      sections,
      energy,
      breakDensity,
      chaos,
      rng,
      halfTimeDrop
    );

    const snareHits = drumPlan.find(d => d.role === 'snare')?.hits || [];
    const kickHits = drumPlan.find(d => d.role === 'kick')?.hits || [];

    console.log('SNARE HITS:', JSON.stringify(snareHits));
    console.log('KICK HITS:', JSON.stringify(kickHits));
    console.log('SNARE BEATS:', JSON.stringify(snareHits.map(h => h.beat)));

    // Every bar of the drop section must carry a half-time backbeat snare.
    expect(snareHits.length).toBe(bars);

    for (const hit of snareHits) {
      // Half-time drop: snare must land on beat index 2 (the "3"), never
      // the on-beat backbeat position (beat index 1) that a normal
      // (non-half-time) pattern would use.
      expect(hit.beat).toBe(2);
      expect(hit.beat).not.toBe(1);
    }

    // Confirm every bar is actually represented on beat 3.
    const beatsPerBar = snareHits.map(h => h.beat);
    expect(beatsPerBar).toEqual([2, 2, 2, 2]);
  });

  it('asserts trapBounce drop and build snares land on beat index 2 (beat 3), allow ghost at beat 0', () => {
    const bars = 4;
    const sections: Section[] = [
      { name: 'build', startBar: 0, lengthBars: 2, fillHint: false },
      { name: 'drop', startBar: 2, lengthBars: 2, fillHint: false }
    ];
    const energy = 0.8;
    const breakDensity = 0.5;
    const chaos = 0.2;
    const rng = () => 0.5;
    const trapBounce = true;

    const drumPlan = planDrums(
      bars,
      sections,
      energy,
      breakDensity,
      chaos,
      rng,
      false, // halfTimeDrop
      'amen', // patternFamily
      trapBounce
    );

    const snareHits = drumPlan.find(d => d.role === 'snare')?.hits || [];
    const kickHits = drumPlan.find(d => d.role === 'kick')?.hits || [];

    console.log('TRAP BOUNCE SNARE HITS:', JSON.stringify(snareHits));
    console.log('TRAP BOUNCE KICK HITS:', JSON.stringify(kickHits));
    console.log('TRAP BOUNCE SNARE BEATS:', JSON.stringify(snareHits.map(h => h.beat)));

    // Every bar must have a primary snare on beat index 2 (the "3")
    expect(snareHits.length).toBeGreaterThanOrEqual(bars); // At least one per bar, possibly more with ghosts

    // Check that every bar has a snare on beat 2 (primary backbeat)
    const beatsPerBar = snareHits.map(h => h.beat);
    for (let bar = 0; bar < bars; bar++) {
      const barSnareBeats = snareHits.filter(h => h.bar === bar).map(h => h.beat);
      // Must have at least one snare on beat 2 (the "3")
      expect(barSnareBeats).toContain(2);
      // Should not have snare on beat 1 (the "2") as primary backbeat in trap bounce
      // Ghost snares are allowed on beat 0 only
      const nonGhostBeats = barSnareBeats.filter(beat => beat !== 0);
      expect(nonGhostBeats.every(beat => beat === 2)).toBe(true);
    }
  });

  it('end-to-end: generateStructure with half-time-drop and trap-bounce shapes assert drop-section snare hits are all beat===2', async () => {
    // Test half-time-drop shape
    const engine = new HardGridStructureEngine();
    const halfTimeInput = {
      bpm: 174,
      bars: 32,
      energy: 0.7,
      darkness: 0.5,
      chaos: 0.2,
      breakDensity: 0.4,
      seed: 12345,
      songShape: 'half-time-drop'
    };

    const halfTimeMap = await engine.plan(halfTimeInput);
    const halfTimeSnareHits = halfTimeMap.drums.find(d => d.role === 'snare')?.hits || [];

    console.log('HALF-TIME-DROP SNARE HITS:', JSON.stringify(halfTimeSnareHits.slice(0, 10)));
    console.log('HALF-TIME-DROP SNARE BEATS:', JSON.stringify(halfTimeSnareHits.map(h => h.beat)));

    // Check drop section snares are on beat 2
    const dropSections = halfTimeMap.sections.filter(s => s.name === 'drop');
    expect(dropSections.length).toBeGreaterThan(0);

    for (const section of dropSections) {
      const sectionSnares = halfTimeSnareHits.filter(h => h.bar >= section.startBar && h.bar < section.startBar + section.lengthBars);
      expect(sectionSnares.length).toBeGreaterThan(0);

      for (const hit of sectionSnares) {
        // Primary snare must be on beat 2 (the "3")
        expect(hit.beat).toBe(2);
        // No primary snare on beat 1 (the "2") in drop sections
        // Note: ghost snares might be present but we're checking the primary placement
      }
    }

    // Test trap-bounce shape
    const trapBounceInput = {
      bpm: 174,
      bars: 32,
      energy: 0.7,
      darkness: 0.5,
      chaos: 0.2,
      breakDensity: 0.4,
      seed: 12345,
      songShape: 'trap-bounce'
    };

    const trapBounceMap = await engine.plan(trapBounceInput);
    const trapBounceSnareHits = trapBounceMap.drums.find(d => d.role === 'snare')?.hits || [];

    console.log('TRAP-BOUNCE SNARE HITS:', JSON.stringify(trapBounceSnareHits.slice(0, 10)));
    console.log('TRAP-BOUNCE SNARE BEATS:', JSON.stringify(trapBounceSnareHits.map(h => h.beat)));

    // Check drop section snares are on beat 2
    const trapDropSections = trapBounceMap.sections.filter(s => s.name === 'drop');
    expect(trapDropSections.length).toBeGreaterThan(0);

    for (const section of trapDropSections) {
      const sectionSnares = trapBounceSnareHits.filter(h => h.bar >= section.startBar && h.bar < section.startBar + section.lengthBars);
      expect(sectionSnares.length).toBeGreaterThan(0);

      for (const hit of sectionSnares) {
        // Primary snare must be on beat 2 (the "3")
        expect(hit.beat).toBe(2);
        // No primary snare on beat 1 (the "2") in drop sections for trap bounce
        // Ghost snares are allowed on beat 0 only
        if (hit.beat !== 0) { // Not a ghost snare
          expect(hit.beat).toBe(2);
        }
      }
    }
  });
});