<!-- SIGNED by UX 2026-09-06 cycle-8 re-audit -->
# UX must-fixes — cycle 8 DONE

Soft-pass forbidden — shipped + verified with tsc / vitest / vite build.

## Landed in cycle 7
- Power footer/badge plain English
- retailLabels JobMeta/timeline/flow-hint
- stem tip When parity
- coaches deduped
- toast cap <=3
- SCREENSHOTS checklist
- K1-K3 help knowledge
- help hotkey P2
- tests+build green
- Brainstormer #46–51 (solo 1–4 / Hold-B / loop / favorites nudge / R·V / peak warn)

## Shipped this cycle (P0 / P1)

| # | Item | What landed |
|---|------|-------------|
| 1 | StemMixer boot | Confirmed parse/transpile OK; invent #46/#47/#48/#50 green (`invent-46-51.test.ts`). |
| 2 | PowerExtras chips | Eng IDs → `retailCapLabel` / `retailCapState` (Full song, Stem rebuild, Extract, Repaint, Style packs…). |
| 3 | PowerExtras copy | Callout / Audio path / Download on GPU machine / Style pack — no sidecar / CUDA-gated / soft-pass in UI. |
| 4 | No OfflineStub / hard-grid in UI | StatusPanel / ProductTier / `formatStudioError` sanitize; core ids unchanged. |
| 5 | HelpTip densify | Thin tips expanded; Power HELP + `powerCaps` / `exportBitDepth` wired. |
| 6 | Green | tsc / vitest / vite build |

## Do not (honored)

- Legal unchanged
- No soft-pass Studio audio
- No hero clutter / Surprise on transport

## Acceptance

- [x] no eng IDs in PowerExtras capability chrome
- [x] HelpTip densify filed
- [x] restore strip deferred (already wired #55)
- [x] test+build green
- [x] PowerExtras addendum: zero sidecar / CUDA-gated / soft-pass forbidden in UI copy

## Verify

- `./node_modules/.bin/tsc --noEmit`
- `./node_modules/.bin/vitest run`
- `./node_modules/.bin/vite build`

## Notes

- Generate-Play-Export already green — this cycle is chrome honesty + help polish.
- ACE/GPU still deferred to RTX 5080 (no soft-pass).
