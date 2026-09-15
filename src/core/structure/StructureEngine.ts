import {
  DEFAULT_BPM,
  DEFAULT_PPQ,
  DEFAULT_SAMPLE_RATE,
  type BassNote,
  type BassRolePlan,
  type DrumRolePlan,
  type EnergyPoint,
  type Section,
  type StructureEngine,
  type StructureInput,
  type StructureMap,
} from '../types';
import { chance, lerp, mulberry32, pick, sectionSeed } from './rng';

const KEY_ROOTS = ['A', 'Am', 'F', 'Dm', 'E', 'Em', 'G', 'C'] as const;

function midiForRoot(root: string): number {
  const map: Record<string, number> = {
    C: 36, D: 38, E: 40, F: 41, G: 43, A: 45, B: 47,
    Am: 45, Dm: 38, Em: 40,
  };
  return map[root] ?? 45;
}

export function planSections(
  bars: number,
  rng: () => number,
  songShape: string = 'classic',
): Section[] {
  const shape = songShape || 'classic';
  // Proportions by shape — longer intros / breakdowns when asked.
  let introR = 0.14;
  let buildR = 0.12;
  let dropR = 0.34;
  let midR = 0.14; // break or breakdown
  let drop2R = 0;
  let useBreakdown = false;
  let doubleDrop = false;

  if (shape === 'long-intro') {
    introR = 0.28;
    buildR = 0.12;
    dropR = 0.3;
    midR = 0.12;
  } else if (shape === 'breakdown') {
    introR = 0.16;
    buildR = 0.1;
    dropR = 0.22;
    midR = 0.18;
    drop2R = 0.2;
    useBreakdown = true;
    doubleDrop = true;
  } else if (shape === 'double-drop') {
    introR = 0.14;
    buildR = 0.1;
    dropR = 0.22;
    midR = 0.12;
    drop2R = 0.24;
    doubleDrop = true;
  } else if (shape === 'dubstep' || shape === 'half-time-drop') {
    introR = 0.2;
    buildR = 0.14;
    dropR = 0.36;
    midR = 0.14;
  } else if (shape === 'trap-bounce') {
    // Still 174 DnB form — bounce-forward drop, not a trap-BPM fork
    introR = 0.12;
    buildR = 0.1;
    dropR = 0.4;
    midR = 0.14;
  }

  const intro = Math.max(shape === 'long-intro' ? 8 : 4, Math.round(bars * introR));
  const build = Math.max(4, Math.round(bars * buildR));
  const drop = Math.max(8, Math.round(bars * dropR));
  const mid = Math.max(4, Math.round(bars * midR));
  const drop2 = doubleDrop ? Math.max(8, Math.round(bars * drop2R)) : 0;
  let used = intro + build + drop + mid + drop2;
  let outro = Math.max(4, bars - used);
  // Absorb rounding leftover into outro
  used = intro + build + drop + mid + drop2 + outro;
  if (used < bars) outro += bars - used;

  const sections: Section[] = [
    { name: 'intro', startBar: 0, lengthBars: intro },
    { name: 'build', startBar: intro, lengthBars: build, fillHint: true },
    { name: 'drop', startBar: intro + build, lengthBars: drop },
  ];
  let cursor = intro + build + drop;
  if (useBreakdown) {
    sections.push({ name: 'breakdown', startBar: cursor, lengthBars: mid, fillHint: chance(rng, 0.5) });
  } else {
    sections.push({ name: 'break', startBar: cursor, lengthBars: mid, fillHint: chance(rng, 0.4) });
  }
  cursor += mid;
  if (doubleDrop && drop2 > 0) {
    sections.push({ name: 'drop', startBar: cursor, lengthBars: drop2 });
    cursor += drop2;
  }
  sections.push({ name: 'outro', startBar: cursor, lengthBars: outro });
  return sections;
}

function sectionAt(sections: Section[], bar: number): Section {
  for (let i = sections.length - 1; i >= 0; i--) {
    const s = sections[i]!;
    if (bar >= s.startBar) return s;
  }
  return sections[0]!;
}

export type PatternFamily = 'amen' | 'twoStep' | 'syncopated';

/** Seed-driven drum grammar so Vary is audible (not just a new seed number). */
export function pickPatternFamily(rng: () => number): PatternFamily {
  return pick(rng, ['amen', 'twoStep', 'syncopated'] as const);
}

export function planDrums(
  bars: number,
  sections: Section[],
  energy: number,
  breakDensity: number,
  chaos: number,
  rng: () => number,
  halfTimeDrop = false,
  family: PatternFamily = 'amen',
  trapBounce = false,
): DrumRolePlan[] {
  const kickHits: DrumRolePlan['hits'] = [];
  const snareHits: DrumRolePlan['hits'] = [];
  const hatHits: DrumRolePlan['hits'] = [];
  const percHits: DrumRolePlan['hits'] = [];

  for (let bar = 0; bar < bars; bar++) {
    const sec = sectionAt(sections, bar);
    const inDrop = sec.name === 'drop';
    const inBuild = sec.name === 'build';
    const inBreak = sec.name === 'break' || sec.name === 'breakdown';
    const inBreakdown = sec.name === 'breakdown';
    const inIntro = sec.name === 'intro';
    const dropBoost = halfTimeDrop ? 0.38 : 0.25; // dubstep drops hit harder
    const localEnergy =
      inDrop ? Math.min(1, energy + dropBoost) :
      inBuild ? energy :
      sec.name === 'breakdown' ? energy * 0.4 :
      inBreak ? energy * 0.55 :
      inIntro ? energy * 0.45 : energy * 0.7;

    // Kick by pattern family (Vary must change groove)
    kickHits.push({ bar, beat: 0, velocity: lerp(0.8, 1, localEnergy) });
    if (trapBounce && (inDrop || inBuild)) {
      // Bounce kick: 1 + & of 2 / occasional 3 — 808 space between
      if (chance(rng, 0.7)) {
        kickHits.push({ bar, beat: 1.5, velocity: lerp(0.45, 0.75, localEnergy) });
      }
      if (chance(rng, 0.4 + chaos * 0.2)) {
        kickHits.push({ bar, beat: 2.75, velocity: 0.4 + rng() * 0.25 });
      }
    } else if (halfTimeDrop && inDrop) {
      // Half-time drop: heavy 1, optional 3 — room for wobble
      if (chance(rng, 0.55 + energy * 0.25)) {
        kickHits.push({ bar, beat: 2, velocity: lerp(0.65, 0.95, localEnergy) });
      }
      if (chance(rng, chaos * 0.25)) {
        kickHits.push({ bar, beat: 3.5, velocity: 0.4 + rng() * 0.25 });
      }
    } else if (family === 'amen') {
      if (inDrop || inBuild) {
        kickHits.push({ bar, beat: 2.5, velocity: lerp(0.55, 0.9, localEnergy) });
      }
      if (chance(rng, chaos * 0.35) && (inDrop || inBuild)) {
        kickHits.push({ bar, beat: 1.5, velocity: 0.5 + rng() * 0.3 });
      }
      if (chance(rng, breakDensity * 0.2) && inDrop) {
        kickHits.push({ bar, beat: 3.25, velocity: 0.45 });
      }
    } else if (family === 'twoStep') {
      if (inDrop || inBuild) {
        kickHits.push({ bar, beat: 2, velocity: lerp(0.7, 0.95, localEnergy) });
      }
      if (chance(rng, 0.35 + chaos * 0.3) && inDrop) {
        kickHits.push({ bar, beat: 3.5, velocity: 0.5 + rng() * 0.25 });
      }
    } else {
      // syncopated
      if (inDrop || inBuild) {
        kickHits.push({ bar, beat: 1.75, velocity: lerp(0.5, 0.85, localEnergy) });
        kickHits.push({ bar, beat: 2.75, velocity: lerp(0.45, 0.8, localEnergy) });
      }
      if (chance(rng, 0.4 + chaos * 0.4) && inDrop) {
        kickHits.push({ bar, beat: 0.75, velocity: 0.4 + rng() * 0.3 });
      }
      if (chance(rng, breakDensity * 0.25) && inDrop) {
        kickHits.push({ bar, beat: 3.5, velocity: 0.5 });
      }
    }

    // Dubstep / half-time-drop: ALWAYS snare on 3 (beat index 2) in drops and builds
    const halfTime =
      halfTimeDrop && (inDrop || inBuild || inBreakdown || (inBreak && chance(rng, 0.85)));
    if (trapBounce && (inDrop || inBuild)) {
      // Trap-flavored bounce at 174: snare on 3, ghost on 1
      snareHits.push({ bar, beat: 2, velocity: lerp(0.75, 1, localEnergy) }); // beat index 2 = "3" in 1-indexed
      if (chance(rng, 0.35) && chaos > 0.3) {
        snareHits.push({ bar, beat: 0, velocity: 0.25 + rng() * 0.15 });
      }
    } else if (halfTime || (inBreak && chance(rng, 0.55))) {
      snareHits.push({
        bar,
        beat: 2, // Force beat index 2 (the 3rd beat)
        velocity: lerp(halfTimeDrop && inDrop ? 0.85 : 0.6, 1, localEnergy),
      });
      // In half-time builds, optionally add a ghost snare before the main snare
      if (inBuild && halfTimeDrop && chance(rng, 0.4)) {
        snareHits.push({ bar, beat: 1.75, velocity: 0.35 + rng() * 0.2 });
      }
    } else if (family === 'twoStep' && (inDrop || inBuild)) {
      snareHits.push({ bar, beat: 1, velocity: lerp(0.85, 1, localEnergy) });
      snareHits.push({ bar, beat: 3, velocity: lerp(0.65, 0.9, localEnergy) });
    } else if (family === 'syncopated' && (inDrop || inBuild)) {
      snareHits.push({ bar, beat: 1, velocity: lerp(0.65, 0.95, localEnergy) });
      snareHits.push({ bar, beat: 2.5, velocity: lerp(0.4, 0.7, localEnergy) });
      snareHits.push({ bar, beat: 3, velocity: lerp(0.7, 1, localEnergy) });
    } else {
      snareHits.push({ bar, beat: 1, velocity: lerp(0.7, 1, localEnergy) });
      snareHits.push({ bar, beat: 3, velocity: lerp(0.7, 1, localEnergy) });
    }
    if (sec.fillHint && bar === sec.startBar + sec.lengthBars - 1) {
      // Widened per-family fill tables (Vary must change transitions)
      const fillBeats =
        family === 'amen'
          ? [2.5, 2.75, 3, 3.25, 3.5, 3.75]
          : family === 'twoStep'
            ? [2, 2.5, 3, 3.5, 3.75]
            : [1.75, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75];
      for (const b of fillBeats) {
        snareHits.push({ bar, beat: b, velocity: 0.4 + rng() * 0.5 });
      }
      // Amen / syncopated: occasional kick fill ghosts
      if (family !== 'twoStep' && chance(rng, 0.55 + chaos * 0.3)) {
        for (const b of family === 'syncopated' ? [3.25, 3.5] : [3.5]) {
          kickHits.push({ bar, beat: b, velocity: 0.35 + rng() * 0.25 });
        }
      }
    }

    // Hats — density by family; half-time drops stay roomy; trap = rolling bounce
    let hatStep = inDrop || inBuild ? 0.25 : 0.5;
    if (trapBounce && (inDrop || inBuild)) hatStep = 0.125;
    else if (halfTimeDrop && inDrop) hatStep = 0.5;
    else if (family === 'twoStep' && (inDrop || inBuild)) hatStep = 0.5;
    else if (family === 'syncopated' && (inDrop || inBuild)) hatStep = 0.125;
    for (let beat = 0; beat < 4; beat += hatStep) {
      const open = Math.abs(beat % 1 - 0.5) < 0.01;
      let vel = open
        ? lerp(0.35, 0.7, localEnergy)
        : lerp(0.2, 0.55, localEnergy) * (0.85 + rng() * 0.3);
      if (trapBounce) {
        // Alternating bounce velocities + roll peaks
        const bounce = 0.55 + 0.45 * Math.abs(Math.sin(beat * Math.PI));
        vel = lerp(0.18, 0.85, localEnergy) * bounce * (0.75 + rng() * 0.35);
        if (inDrop && beat >= 3 && chance(rng, 0.55 + chaos * 0.2)) {
          // end-of-bar roll denser
          vel *= 1.15;
        }
      }
      hatHits.push({ bar, beat, velocity: Math.min(1, vel) });
    }

    const percChance =
      family === 'syncopated'
        ? breakDensity * 0.28 + (inDrop ? 0.18 : 0)
        : breakDensity * 0.15 + (inDrop ? 0.1 : 0);
    if (chance(rng, percChance)) {
      percHits.push({
        bar,
        beat: pick(rng, family === 'twoStep' ? [1.5, 3.5] : [0.75, 1.75, 2.75, 3.5]),
        velocity: 0.35 + rng() * 0.4,
      });
    }
  }

  return [
    { role: 'kick', hits: kickHits },
    { role: 'snare', hits: snareHits },
    { role: 'hats', hits: hatHits },
    { role: 'perc', hits: percHits },
  ];
}

function planBass(
  bars: number,
  sections: Section[],
  keyRoot: string,
  darkness: number,
  energy: number,
  chaos: number,
  rng: () => number,
  family: PatternFamily = 'amen',
  trapBounce = false,
): BassRolePlan {
  const root = midiForRoot(keyRoot);
  // Widened interval tables by darkness + family (Vary changes note language)
  let intervals: number[];
  if (trapBounce) {
    // 808-forward: heavy roots / fifths / octave, occasional minor 3rd
    intervals = darkness > 0.5
      ? [0, 0, 0, 0, 5, 7, 12, -5, 3]
      : [0, 0, 0, 5, 7, 12, 12, -5];
  } else if (darkness > 0.55) {
    intervals =
      family === 'twoStep'
        ? [0, 0, 0, 3, 5, 7, 10, -2, -5]
        : family === 'syncopated'
          ? [0, 0, 3, 3, 5, 6, 7, 10, 12, -2, -4]
          : [0, 0, 3, 5, 7, 10, -2, 8];
  } else {
    intervals =
      family === 'twoStep'
        ? [0, 0, 5, 7, 12, -5, 17]
        : family === 'syncopated'
          ? [0, 0, 2, 5, 7, 9, 12, 3, -5, -7]
          : [0, 0, 5, 7, 12, 3, -5, 10];
  }
  const notes: BassNote[] = [];
  let character: BassRolePlan['character'] =
    darkness > 0.65 ? 'growl' : darkness > 0.35 ? 'reese' : 'sub';
  // Trap bounce: fat 808 body = sub character (glide rendered in OfflineStub)
  if (trapBounce) character = 'sub';

  for (let bar = 0; bar < bars; bar++) {
    const sec = sectionAt(sections, bar);
    if (sec.name === 'intro' && bar < sec.startBar + 2) continue;
    if (sec.name === 'break' && chance(rng, 0.35)) continue;

    const density =
      sec.name === 'drop' ? 1 :
      sec.name === 'build' ? 0.85 :
      sec.name === 'outro' ? 0.5 : 0.65;

    // Family rhythm templates + chaos offbeats
    let beats: number[];
    if (trapBounce) {
      // Sparse 808 hits — long sustains, bounce from drums
      beats = chance(rng, 0.65) ? [0] : [0, 2];
      if (sec.name === 'drop' && chance(rng, 0.35)) beats.push(1.5);
    } else if (family === 'twoStep') {
      beats = chance(rng, 0.6) ? [0, 2] : [0, 2, 3];
    } else if (family === 'syncopated') {
      beats = chance(rng, 0.5) ? [0, 1.5, 2.5] : [0, 0.75, 2, 3.25];
    } else {
      beats = chance(rng, 0.55) ? [0, 2] : [0, 1.5, 3];
    }
    if (chance(rng, density * energy)) beats.push(1);
    if (chance(rng, chaos * 0.55)) beats.push(2.5);
    if (sec.name === 'drop' && chance(rng, 0.35 + chaos * 0.3)) beats.push(3);
    if (chance(rng, chaos * 0.25) && sec.name === 'drop') beats.push(0.5);
    if (family === 'syncopated' && chance(rng, 0.35 + chaos * 0.2)) beats.push(3.75);

    for (const beat of [...new Set(beats)]) {
      const interval = pick(rng, intervals);
      const dur = trapBounce
        ? (chance(rng, 0.55) ? 3 : 2) // fat held 808s
        : family === 'twoStep'
          ? (chance(rng, 0.45) ? 2 : 1)
          : family === 'syncopated'
            ? (chance(rng, 0.4) ? 0.75 : 1)
            : (chance(rng, 0.3) ? 1.5 : 1);
      notes.push({
        bar,
        beat,
        midi: root + interval,
        durationBeats: dur,
        velocity: lerp(0.55, 0.95, energy),
      });
    }
  }

  return { notes, character };
}

function energyCurve(sections: Section[], base: number, halfTimeDrop = false): EnergyPoint[] {
  const pts: EnergyPoint[] = [];
  const dropBoost = halfTimeDrop ? 0.42 : 0.3;
  const introDip = halfTimeDrop ? 0.38 : 0.3;
  for (const s of sections) {
    const mid = s.startBar + Math.floor(s.lengthBars / 2);
    const level =
      s.name === 'drop' ? Math.min(1, base + dropBoost) :
      s.name === 'build' ? Math.min(1, base + (halfTimeDrop ? 0.18 : 0.1)) :
      s.name === 'break' || s.name === 'breakdown' ? Math.max(0.12, base - (halfTimeDrop ? 0.35 : 0.25)) :
      s.name === 'intro' ? Math.max(0.15, base - introDip) :
      Math.max(0.22, base - 0.15);
    pts.push({ bar: s.startBar, level: Math.max(0.08, level - 0.1) });
    pts.push({ bar: mid, level });
    pts.push({ bar: s.startBar + s.lengthBars - 1, level: level * 0.95 });
  }
  return pts;
}

export class HardGridStructureEngine implements StructureEngine {
  readonly id = 'hard-grid-v0';

  async plan(input: StructureInput): Promise<StructureMap> {
    const bpm = input.bpm || DEFAULT_BPM;
    const bars = Math.max(16, input.bars || 32);
    const sampleRateHz = input.sampleRateHz ?? DEFAULT_SAMPLE_RATE;
    const seed = input.seed >>> 0;
    const rng = mulberry32(seed);
    const darkness = input.darkness ?? 0.45;
    const chaos = input.chaos ?? 0.25;
    const energy = Math.min(1, Math.max(0, input.energy));
    const breakDensity = Math.min(1, Math.max(0, input.breakDensity));
    const shape = input.songShape ?? 'classic';
    const halfTime = shape === 'dubstep' || shape === 'half-time-drop';
    const trapBounce = shape === 'trap-bounce';

    // Song-identity picks (key, groove family, bass timbre) are drawn first,
    // in a fixed order, from the single top-level rng — never from a
    // section-count-dependent position. This keeps them stable whether this
    // is a fresh generate or an Expand/×2/Repeat replan of the same seed
    // (which skips planSections below via sectionsOverride).
    const keyRoot = input.keyRoot ?? pick(rng, KEY_ROOTS);
    const patternFamily = pickPatternFamily(rng);
    let bassCharacter: BassRolePlan['character'] =
      darkness > 0.65 ? 'growl' : darkness > 0.35 ? 'reese' : 'sub';
    if (trapBounce) {
      // Trap bounce: lock fat 808 sub
      bassCharacter = 'sub';
    } else if (halfTime) {
      // Dubstep / half-time: reese or growl only — wobble body, never thin sub-only
      bassCharacter = pick(rng, ['reese', 'growl', 'reese'] as const);
    } else if (darkness > 0.28 && darkness < 0.72) {
      // Mid darkness: seed can flip bass character so Vary changes timbre too
      bassCharacter = pick(rng, ['sub', 'reese', 'growl'] as const);
    }

    const sections =
      input.sectionsOverride?.length
        ? input.sectionsOverride.map((s, i, arr) => {
            const start = arr.slice(0, i).reduce((n, x) => n + x.lengthBars, 0);
            return { ...s, startBar: start };
          })
        : planSections(bars, rng, shape);
    const plannedBars = sections.reduce((n, s) => n + s.lengthBars, 0);
    const barsFinal = Math.max(16, plannedBars || bars);

    // Plan each section's drum/bass hits from its own independent RNG
    // sub-stream, keyed only by (seed, section index). This is what makes
    // Expand/×2/Repeat (which only changes one section's lengthBars) leave
    // every other section's drum+bass content byte-identical — a shared
    // sequential rng would otherwise shift every downstream section's draws.
    const kickHits: DrumRolePlan['hits'] = [];
    const snareHits: DrumRolePlan['hits'] = [];
    const hatHits: DrumRolePlan['hits'] = [];
    const percHits: DrumRolePlan['hits'] = [];
    const bassNotes: BassNote[] = [];

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i]!;
      const localSections: Section[] = [{ ...sec, startBar: 0 }];
      const secRng = mulberry32(sectionSeed(seed, i));

      const secDrums = planDrums(
        sec.lengthBars,
        localSections,
        energy,
        breakDensity,
        chaos,
        secRng,
        halfTime,
        patternFamily,
        trapBounce,
      );
      for (const role of secDrums) {
        const target =
          role.role === 'kick' ? kickHits :
          role.role === 'snare' ? snareHits :
          role.role === 'hats' ? hatHits : percHits;
        for (const hit of role.hits) {
          target.push({ ...hit, bar: hit.bar + sec.startBar });
        }
      }

      const secBass = planBass(
        sec.lengthBars,
        localSections,
        keyRoot,
        darkness,
        energy,
        chaos,
        secRng,
        patternFamily,
        trapBounce,
      );
      for (const note of secBass.notes) {
        bassNotes.push({ ...note, bar: note.bar + sec.startBar });
      }
    }

    const drums: DrumRolePlan[] = [
      { role: 'kick', hits: kickHits },
      { role: 'snare', hits: snareHits },
      { role: 'hats', hits: hatHits },
      { role: 'perc', hits: percHits },
    ];
    const kick = drums.find((d) => d.role === 'kick')!;
    const bassRole: BassRolePlan = { notes: bassNotes, character: bassCharacter };

    // samples per bar at 4/4: (60/bpm)*4 * sr
    const samplesPerBar = Math.round((60 / bpm) * 4 * sampleRateHz);

    return {
      version: 'hard-grid-v0',
      bpm,
      bars: barsFinal,
      ppq: DEFAULT_PPQ,
      samplesPerBar,
      snapPolicy: 'hard',
      sampleRateHz,
      sections,
      drumRole: kick,
      drums,
      bassRole,
      energyCurve: energyCurve(sections, energy, halfTime),
      keyRoot,
      seed: input.seed,
      patternFamily,
    };
  }
}

export const structureEngine = new HardGridStructureEngine();
