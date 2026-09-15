# UX — Process-first Simple + layers (Wyatt’s 4)

Align Critic: **Channels-first**. Soft-pass forbidden. No artist-clone.

## Already in tree (keep)
Simple path exists: `SimpleWant` → `StyleDropZone` → `SongShapePicker` → `Transport` → (result) Waveform / SectionTimeline / StemMixerCompact → `LayersChips`.

## P0.1 — Live tweaks honesty (`TransportBar` + HELP) — until Channels green
If mute/solo/gain do **not** move audio mid-play:
- Pill: never `Hearing your tweaks` while playing
- Coach: change “stem mutes update live” → `Hit Play again to hear your mix`
- HELP.stemMixer / remixLive: say remux-on-Play, not live
When Channels land: restore live copy + keep StemMixerCompact under Waveform.

## P0.2 — Gate Expand + Layers chrome (`App.tsx`) — Critic bar
Until live-during-play demoable:
```tsx
{/* Hide until Channels green OR at least after result + honest gate */}
{result && liveMixerOk && <SectionTimeline />}  // Expand
{result && liveMixerOk && <LayersChips />}      // Guitar/Solo
```
Cold-load `LayersChips` today = FAIL (shows before Generate).

Interim if Channels not ready: hide both; put Layers under More with `Needs Studio` when `!aceHasGpu`.

## P0.3 — Process labels (copy only)
| Step | Control | Label |
|------|---------|-------|
| 1 | SimpleWant + StyleDrop | Style (prompt top; vibe MP3 optional) |
| 2 | SongShapePicker | Shape |
| 3 | Transport Generate | Generate |
| 4 | Waveform + compact stems | Hear |
| 5 | SectionTimeline | Expand (after live) |
| 6 | LayersChips | Add layers (after live) |
| 7 | Export on Transport | Export |

Placeholder SimpleWant → `Describe the vibe (e.g. rock DnB, bright drops…)`.
Layers on-toggle: keep `Applies on next Generate · original textures only`.
Studio gate on Layers: if `!aceHasGpu` show chip disabled + `Needs Studio` — never claim lego on Sketch.

## P0.4 — Expand UX (after live)
Edge-drag + “×2 this drop”; toast `Arrangement on next Generate` — no looped-WAV fake. HelpTip on SectionTimeline.

## Builder order
1. Tone.Channel live path (Researcher) + honesty copy swap if still remux
2. Gate SectionTimeline + LayersChips per P0.2
3. Placeholder + Needs Studio on Layers
4. Expand drag only after (1)

Ping UX for re-glance when live-during-play is demoable.
