# GRUNT — paid sole writer (FCC harness broken this shape)

## Scope
- Read `_cos-runs/EPIC-plan.md`. Implement every **GRUNT** item only.
- Tone mock tests: if live-bus work broke tests, Tone mock must export `Gain`/`Compressor`/`Limiter` used by `PreviewPlayer.loadLiveFromStems` — `live-duck-envelope.test.ts` + `live-tweak-preview.test.ts` green.
- Stay on plan GRUNT + that mock/test fix only. No Sketch LayersChips unlock. No dual FCC.

## Gate
- If `_cos-runs/EPIC-plan.md` is MISSING: STOP. Write `_cos-runs/PAID-WAITING.txt`. Exit.
- Skip PAID/design-only sections; implement GRUNT only.

## Done
- `npm.cmd test -- --run` + `npx.cmd tsc --noEmit` green.
- Soft-pass forbidden. No architecture rewrite.
