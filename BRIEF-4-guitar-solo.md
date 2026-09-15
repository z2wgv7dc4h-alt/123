# BRIEF-4 — Guitar/Solo listen-expand (paid)

## Goal
Cutting-edge listen-first: while playing, click a Guitar/Solo (or lead) section and expand it in place; Generate keeps the same song (same seed). Vary remains the only new-idea action.

## Do
1. Wire Guitar/Solo (or equivalent lead) sections into the section map + click→seek like BRIEF-1 drums/sections.
2. Expand then Generate: keepSeed when editedSections set (same BRIEF-1 contract).
3. Tests for seek + keepSeed on that section type; `npm.cmd test -- --run` + `npx tsc --noEmit` green.
4. Soft-pass forbidden.

## Do NOT
- Touch snare/half-time audio (BRIEF-2 done).
- Touch player-duration / Vary-diversity work (BRIEF-3 FCC).
- Dual-write files ACTIVE FCC is editing if you can avoid it — prefer guitar/solo UI + structure paths.

## Done when
Tests + tsc green; short note of files changed.
