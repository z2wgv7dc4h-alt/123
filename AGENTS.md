# DnB Studio — Agent Law

Studio (ACE-Step 1.5, real GPU) is the real generation path. Sketch
(`OfflineStubBackend`, CPU Float32Array synthesis) is a fallback, not a
sandbox that feeds Studio — they share only the deterministic
arrangement skeleton (`structureEngine.plan()`).

## Process

- Read `docs/HANDOFF.md` first. Its GAP LIST is the work queue.
- **Implement after the handoff exists.** Don't open src/ before the
  handoff and gap list are written and committed.
- One gap at a time: change, then Verify (targeted test or `tsc`), then
  the next. No batching.
- **Every fix gets a test.** "Verified by manual render" is not done —
  a bug shipped twice this project because of exactly that.
- Research-only work becomes a `TICKETS/NN.md` file, not code.
- Soft-pass forbidden. Prove with command output, not claims.

## Verify

```bash
npm.cmd install          # Windows: npm.cmd, never bare npm
npx tsc --noEmit
npx vitest run
```

**No song renders to "verify".** Render audio only when a gap's Verify
line names a file as the deliverable.

## Product bar

- Listen-first generator UI. Not a dumbed-down 3-click mode.
- While playing: click a section → select + seek; player, waveform and
  song map share ONE playhead/duration.
- Expand/×2 then Generate keeps the SAME seed and song; only that
  section stretches. Vary = new seed only.
- Live mute/solo/gain = `Tone.Channel` preview only. Tone.js is never
  the synthesis engine (`docs/ARCHITECTURE.md` has the why).
- Sound target: dancefloor DnB + dubstep half-time (snare-on-3) +
  optional trap-bounce 808s. Must slap, not toy.

## Legal

Personal, non-commercial project. The sample packs and breaks already
committed to this repo are fine to use and ship in-repo. Forbidden,
unchanged: an artist-clone product (impersonating a specific named
artist), and presenting fake ACE stems as real isolated stems — while
stems share the mix blob, the honesty label stays.

## Don't do

- No git history rewriting — that thread is closed and verified.
- No `@types/node` — this tsconfig has no `types` array, it would leak
  Node globals project-wide. Use a local ambient `.d.ts`
  (`src/core/audio/node-fs-shim.d.ts`).
- No LoRA, no new sample packs, no Tone live-preview re-architecture,
  no licensing essays.
