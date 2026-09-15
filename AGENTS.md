# DnB Studio — Agent Law

Studio (ACE-Step 1.5, real GPU) is the real generation path. Sketch
(OfflineStubBackend, CPU Float32Array synthesis) is a fallback, not a
sandbox that feeds into Studio — they share only the deterministic
arrangement skeleton. Read `docs/HANDOFF.md` first, every session.

## Process law (added 2026-09-16 — non-negotiable)

- **Lead writes tickets.** New work gets a `TICKETS/NN.md` file (File /
  Change / Do not / Done when / Verify) before code changes start. A
  session executing a ticket does not spawn new ones ad hoc — flag scope
  creep back to the lead instead.
- **No music generation unless Verify requires a file.** Don't render
  audio "just to check" outside what a ticket's Verify step calls for.
- **Every fix gets a test.** No exceptions logged as "verified by manual
  render" and left there — see `docs/SESSION-DUMP.md` §2's Shared
  Structure Engine entry for what that gap costs (a bug that shipped
  twice because the first fix's own verification was manual only).

## Product bar

- Cutting-edge, listen-first generator UI. Not a dumbed-down "3-click
  Simple Mode."
- While playing: click a section → select + seek. Player, waveform, and
  song map share ONE playhead/duration.
- Expand/×2 a section then Generate MUST keep the SAME seed and song —
  only that section stretches/repaints. Vary = new seed only.
- Soft-pass forbidden. Prove with tests + real command output, not
  claims.
- Live mute/solo/gain = `Tone.Channel` mid-play (preview only). Param
  knobs apply on next Generate. Tone.js is never the synthesis engine —
  see `docs/ARCHITECTURE.md`'s Tone.js note for why (deterministic
  reproducibility + the Node-based render/test workflow depends on it).
- Sound target: dancefloor DnB + dubstep half-time (snare-on-3) + optional
  trap-bounce fat 808s. Must slap, not toy.
- Windows: use `npm.cmd`, not bare `npm`.

## Legal (relaxed 2026-09-16 — read the actual scope, don't over-apply)

- Personal, non-commercial project. GPL/AGPL/NC-licensed tools/libraries
  are fine. Real breakbeat/catalog-derived samples are fine (owner's
  explicit call — "i dont care about catalog rips go crazy").
- Still hard-forbidden, unaffected by the above: an artist-clone
  *product* (impersonating a specific named artist), claiming isolated
  ACE stems are real when they're not (fix that honestly — ticket 05 —
  don't just relabel it away), training on third-party catalogs as a
  data pipeline.
- Read a sample pack's actual bundled license file, not its landing
  page's blurb — two packs from the same vendor differed materially
  this session.

## Verify

```bash
npm.cmd install
npx tsc --noEmit
npx vitest run
scripts/windows/start-ace-stack.ps1   # only when a ticket needs the live GPU stack
```
Targeted tests while iterating; full suite before calling anything done.

## Workflow

Explore/plan for multi-file UI work. Delegate research to subagents so
main context stays clean. `/clear` between unrelated tickets. Full
Don't-do list with the *why* for each: `docs/SESSION-DUMP.md` §6.
