# UI-REVAMP — from song generator to take editor

**Updated 2026-09-17.** The first plan (one layout, one transport cluster, less
duplication) is done. The plan now changes direction: generate a take, keep it,
then edit that take with ACE repaint instead of re-rolling the whole song.

## Done

| Ticket | Commit | What landed |
|---|---|---|
| UI-1 | `ac11db6` | Play · Stop · Generate · Vary in one cluster |
| UI-2 | `905fac2` | One layout; Simple/Power removed |
| UI-3 | `da3625f`, `313beaf` | Export and extra Vary/Surprise demoted to More |
| UI-4 | — | No dedicated `button-contract.test.ts` exists; Play/Stop contracts are partly covered by `transport-cluster.test.ts`. **Unverified.** |
| UI-5 | `8626978` | Compact Play/Stop on the waveform card |
| UI-6 | `756e116` | Style text + song shape above Generate |
| — | `8d2de74` | Home help cull; Expand/Repeat/×2 only on the selected section |
| — | `265dde0`, `c9c878f` | Style preset picker; genre row (DnB / Dubstep / Half-time / Jungle) |

## Target home screen

```
Intent   [DnB·174] [Dubstep·140] [Half-time·170] [Jungle·165]
         presets …   style text …   tempo   length/shape
Go       [ Generate ]  [ Vary ]
Hear     waveform + bar grid · ▶ ■ · [Keep take]
Edit     song map · selected section: [Redo] [Extend +8] [Extend +16] [Duplicate] [Move]
         take history: v1 · v2 · v3  [Undo]
More ▸   export · mixer · style ref (cover) · layers · favorites · surprise · advanced · help
```

## Button contract

| Button | Contract |
|---|---|
| Play / Stop | Play the current buffer; never render. Stop keeps the buffer. |
| Generate | New whole song (text2music). New seed unless keep-seed is on (More). |
| Vary | New whole song, always a new seed. |
| Keep take | Marks the current buffer as the take. Edits apply to it. |
| Redo section | ACE **repaint** of that bar range on the take; outside the crossfade the rest is unchanged. Studio only. |
| Extend +N | Repaint past the end of the take (last section), or duplicate + seam repaint (middle, R-4). Studio only. |
| Duplicate / Move | The app splices audio at bar lines, then repaints short windows over the seams. Studio only. |
| Undo | Return to the previous take version. No render. |

On Sketch, the edit buttons are disabled with an honest "Studio only" label.

## Tickets

| # | Ticket | Depends on |
|---|---|---|
| 1 | R-2 keep take + Redo/Extend on the selected section + take history | R-1 (done `4c4d2e6`) |
| 2 | R-3 downbeat detection: bar grid aligned to the take | R-2 |
| 3 | R-4 duplicate / move sections with seam repaint | R-3 |
| 4 | UI-7 skin pass (glass, one accent, icons, fewer `?`) | R-4 |
| 5 | R-5 mastering stage (loudness) | — |

## Open cleanup

- The `PowerExtras` "Request style-pack train (GPU)" button does nothing. Remove it
  unless the user decides LoRA is in.
- `src/test/e2e-invariants.test.ts` asserts current labels. R-2 and UI-7 must
  update those assertions deliberately, not delete them.
