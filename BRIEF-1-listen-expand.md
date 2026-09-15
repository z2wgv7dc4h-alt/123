# BRIEF 1 — Listen-first UI + same-song expand

## Goal
Make DnB Studio a cutting-edge *generator* UI (listen-first), and fix Expand so it keeps the same song.

## Must ship
1. **Listen-first layout**: Song Map + waveform/player share ONE playhead and duration. Clicking a section selects it AND seeks playback. Intent/params can collapse after Generate — hearing is primary, not a 3-click wizard.
2. **Same-song Expand**: Expand / ×2 a section then Generate MUST keep the same seed + arrangement identity; only stretch/repaint that section. **Vary** is the only control that rolls a new seed/new idea.
3. Tests proving expand-keep-seed vs vary-new-seed. Full `npm.cmd test -- --run` + `npx tsc --noEmit` green.
4. Soft-pass forbidden. Use Critic agent before claiming done.

## Out of scope this pass
Half-time snare-on-3, drop anatomy, trap fat-808, guitar layers (next briefs).

## Verify for Wyatt
Generate → Play → click sections (seek) → Expand a slap section → Generate again → hear SAME song stretched, not a new track → Vary → hear a different idea.
