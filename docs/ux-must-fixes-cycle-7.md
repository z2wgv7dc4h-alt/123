<!-- SIGNED by UX 2026-09-06 after 5-gate + K1 re-audit -->
# UX must-fixes — cycle 7 DONE

Activated from cycle-7 (E2E green). Soft-pass forbidden — shipped + verified with tsc / vitest / vite build.

## Shipped (P0 / P1)

| # | Item | What landed |
|---|------|-------------|
| 1 | Power footer/badges | `App.tsx`: Power footer `Song layout ~174 BPM · Sketch audio now · Studio GPU later · No artist clones · No YouTube`; tagline plain English (no hard-grid-v0); badge `48 kHz · browser sketch`. |
| 2 | OfflineStub UI leak | User-facing StatusPanel / PowerExtras / SectionTimeline / warnings softened to Sketch / browser sketch. Core ids keep OfflineStub. `displayName`: Browser sketch (CPU) / Studio ACE (GPU). |
| 3 | stemMute When parity | Click Mute / Click Solo / Drag gain When lines in `helpCopy.ts`. |
| 4 | Toast stack | Cap ≤3; newest success wins (`toasts.ts`). |
| 5 | Empty coach dedupe | One idle card: App `coach-empty`; StatusPanel Simple empty removed when idle. |
| 6 | SCREENSHOTS | Cycle-7 polish checklist (1280/390, Style Ref, Generate dominant, stem-compact, focus ring, reduced-motion). |
| 7 | K1–K3 | HelpPanel Quick glossary + Why ~174 `<details>` + first-run once (`dnb-help-seen-v1`). |
| 8 | Brainstormer #46–51 | Solo 1–4 / Hold-B / loop / favorites nudge / R·V / soft peak warn — HELP + HelpTips + export peak scan. |

## Do not (honored)

- No hero clutter / Surprise on transport
- No new gates before Generate
- Legal unchanged

## Verify

- `./node_modules/.bin/tsc --noEmit`
- `./node_modules/.bin/vitest run`
- `./node_modules/.bin/vite build`

## Remaining (not this cycle)

- Manual screenshot S1–S10 + cycle-7 checklist ticks
- HelpTip densify on every interactive control
- Invent #52–57 per placement locks
- Live CUDA / ACE on RTX 5080
- Tauri desktop shell
- help hotkey #57 landed (cycle-7/8)
- retailLabels chrome honesty landed
