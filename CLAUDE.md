# DnB Studio — Claude Code / FCC

## Product bar (IMPORTANT)
- Cutting-edge generator UI: listen-first. NOT dumbed-down "3-click Simple Mode".
- While playing: click a section → select + seek; player, waveform, and song map share ONE playhead/duration.
- Expand/×2 a section then Generate MUST keep the SAME seed and song; only stretch/repaint that section. Vary = new idea/new seed only.
- Soft-pass forbidden. Prove with tests + evidence (command output).
- Legal: generative only — no catalog rips, no artist-clone product, no fake ACE isolated stems.
- Live mute/solo/gain = Tone.Channel mid-play. Param knobs = next Generate.
- Sound: dancefloor DnB + dubstep half-time (snare-on-3) + optional trap-bounce fat 808s. Must slap, not toy.
- Windows: use `npm.cmd` not bare `npm`.

## Verify
```
npm.cmd test -- --run
npx tsc --noEmit
```
Prefer targeted tests while iterating; full suite before claiming done.

## Workflow
Explore/plan for multi-file UI work. Use Critic subagent before done. Delegate research to subagents so main context stays clean. `/clear` between unrelated tasks.
