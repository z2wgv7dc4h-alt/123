# GRUNT - Implement from paid plan only (FCC)

## PARALLELIZE (Wyatt / Process Critic — do this first)
- Read `_cos-runs/EPIC-plan.md`. Implement every **GRUNT** item only.
- Use Claude Code **parallel subagents/Tasks** on **disjoint** GRUNT items (one session, many workers). Do NOT serial-nibble when items do not share files.
- Do NOT start a second DnB-FCC process. Stay in this session.
- If live-bus work broke tests: Tone mock must export `Gain`/`Compressor`/Limiter used by `PreviewPlayer.loadLiveFromStems` — `live-duck-envelope.test.ts` + `live-tweak-preview.test.ts` green. Stay on plan GRUNT + that mock/test fix only.

## Gate (iron)
- If `_cos-runs/EPIC-plan.md` is MISSING: STOP. Write `_cos-runs/FCC-WAITING.txt`. Exit.
- If plan exists: implement GRUNT / implement / tests. Skip PAID/design-only.
- Do NOT add Sketch LayersChips unlock or other out-of-plan scope this run.

## Done
- `npm.cmd test -- --run` + `npx.cmd tsc --noEmit` green.
- Soft-pass forbidden. No architecture rewrite.
