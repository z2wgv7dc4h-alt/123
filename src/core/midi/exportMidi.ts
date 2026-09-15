/**
 * Minimal Type-0 MIDI writer from StructureMap (drums + bass).
 * ACE-Step does not export MIDI — structure engine is the sole authority.
 */
import type { StructureMap } from '../types';
import { DEFAULT_PPQ } from '../types';

function vlq(value: number): number[] {
  const bytes: number[] = [];
  let buffer = value & 0x7f;
  while ((value >>= 7)) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }
  for (;;) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return bytes;
}

function writeStr(arr: number[], s: string) {
  for (let i = 0; i < s.length; i++) arr.push(s.charCodeAt(i));
}

const DRUM_NOTE: Record<string, number> = {
  kick: 36,
  snare: 38,
  hats: 42,
  perc: 39,
  break: 40,
};

export function structureToMidiBlob(map: StructureMap): Blob {
  const ppq = map.ppq || DEFAULT_PPQ;
  type Ev = { tick: number; bytes: number[] };
  const events: Ev[] = [];

  // tempo meta
  const micros = Math.round(60_000_000 / map.bpm);
  events.push({
    tick: 0,
    bytes: [0xff, 0x51, 0x03, (micros >> 16) & 0xff, (micros >> 8) & 0xff, micros & 0xff],
  });
  // time signature 4/4
  events.push({ tick: 0, bytes: [0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08] });

  for (const plan of map.drums) {
    const note = DRUM_NOTE[plan.role] ?? 37;
    for (const h of plan.hits) {
      const tick = Math.round((h.bar * 4 + h.beat) * ppq);
      const vel = Math.max(1, Math.min(127, Math.round(h.velocity * 127)));
      events.push({ tick, bytes: [0x99, note, vel] }); // ch 10
      events.push({ tick: tick + Math.round(ppq / 4), bytes: [0x89, note, 0] });
    }
  }

  for (const n of map.bassRole.notes) {
    const tick = Math.round((n.bar * 4 + n.beat) * ppq);
    const dur = Math.round(n.durationBeats * ppq);
    const vel = Math.max(1, Math.min(127, Math.round((n.velocity ?? 0.8) * 127)));
    const note = Math.max(24, Math.min(84, n.midi));
    events.push({ tick, bytes: [0x90, note, vel] });
    events.push({ tick: tick + dur, bytes: [0x80, note, 0] });
  }

  events.sort((a, b) => a.tick - b.tick || a.bytes[0]! - b.bytes[0]!);

  const track: number[] = [];
  let last = 0;
  for (const ev of events) {
    const delta = ev.tick - last;
    last = ev.tick;
    track.push(...vlq(delta), ...ev.bytes);
  }
  track.push(...vlq(0), 0xff, 0x2f, 0x00); // end of track

  const header: number[] = [];
  writeStr(header, 'MThd');
  header.push(0, 0, 0, 6, 0, 0, 0, 1, (ppq >> 8) & 0xff, ppq & 0xff);
  writeStr(header, 'MTrk');
  const len = track.length;
  header.push((len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff);

  const bytes = new Uint8Array([...header, ...track]);
  return new Blob([bytes], { type: 'audio/midi' });
}
