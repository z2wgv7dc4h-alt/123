# BRIEF-3 — Honest player + Vary diversity (parallel; do NOT touch BRIEF-2 snare/half-time audio)

## Goal
Product feel: player duration is honest; Vary makes a clearly different idea.

## Do
1. Player: show real elapsed/total (or bar·section) that matches audible length — no fake/stuck timers.
2. Vary: two consecutive Vary generations must fail a same-audio / same-seed check (new idea). Expand+Generate still keeps seed (BRIEF-1).
3. Tests: unit coverage for duration honesty + Vary seed/diversity; `npm.cmd test -- --run` and `npx tsc --noEmit` green.
4. Soft-pass forbidden.

## Do NOT
- Edit snare / half-time / drop-punch audio paths that BRIEF-2 (paid) may be touching.
- Regress BRIEF-1 seekPreview / keepSeed on Expand→Generate.

## Done when
Tests + tsc green; short note of files changed.
