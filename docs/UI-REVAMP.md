# UI-REVAMP

## The problem

The layout is two products stacked on top of each other, plus a lot of
duplicated controls. From the live snapshot, confirmed in the code:

- `src/App.tsx:89-113` renders a **Simple | Power** toggle, and `App.tsx:130-159`
  and `App.tsx:162-180` render two different component trees for the two modes.
- `TransportBar.tsx:257-261`, `:282` and `:348` number the listening flow as
  `1 · Generate`, `2 · Play` and `3 · Export Sketch ZIP`. The Export label says
  "Sketch" even when Studio is live. `Waveform.tsx:370` repeats `1 · Generate`.
- **Stop is not next to Generate.** The DOM order in `TransportBar.tsx` is
  Generate (`:234`) → Play (`:266`) → Vary (`:309`) → Stop (`:321`) → Export (`:333`).
- **Vary shows up 5 times**: `TransportBar.tsx:313`, `TransportBar.tsx:495`,
  `RegenAffordance.tsx:72`, `PostExportStrip.tsx:71`, and `LayersChips.tsx:100`
  ("Vary with layers").
- **Again shows up 6 times**: `TransportBar.tsx:483`, `RegenAffordance.tsx:60`,
  `LayersChips.tsx:94`, `PostExportStrip.tsx:61`, `ParamPanel.tsx:44`, and
  `SectionTimeline.tsx:323` ("Generate with edits").
- **Surprise Me shows up twice**: `SurpriseMeButton.tsx:67` and the empty state
  at `FavoritesPanel.tsx:135`. Both are in the same More grid.
- **The export bit-depth picker shows up twice**: `TransportBar.tsx:401` and
  `PowerExtras.tsx:57`. **Download heard shows up twice**: `TransportBar.tsx:389`
  and `StemMixer.tsx:216`.
- Every section in the song map has **Expand** and **Repeat**, and drop sections
  also get **×2** (`SectionTimeline.tsx:238-280`).
- The style pack is a stub. `PowerExtras.tsx:201` has "Request style-pack train
  (GPU)", but `AceStepBackend.render()` never puts `job.lora` in the payload,
  and `sidecar/ace_bridge_server.py` has no LoRA handling at all.
- `PowerExtras.tsx:9-28` (`STUDIO_MODELS`) claims turbo is "what Generate uses
  now". But `AceStepBackend.ts:283` sends `checkpointId: 'acestep-v15-base'`.
- The default style text is `DEFAULT_DESCRIPTORS.slice(0, 4)`
  (`useStudioStore.ts:481`), which starts with `'energetic dancefloor drum and bass'`.
- There are 118 `<HelpTip>` usages across 22 files (22 of them in `TransportBar.tsx` alone).

## Current map

| Component | File | What it does today |
|---|---|---|
| App shell | `src/App.tsx` | Header honesty chip ("Studio · GPU" / "Sketch · CPU"), Simple/Power toggle, two layout trees, More toggle, `<main className="grid">` extras |
| Transport | `src/ui/components/TransportBar.tsx` | Generate, Play, primary Vary (only after listening), Stop, Export ZIP, Download heard, bit depth, clock, status pill, first-play/export coaches, FavoritesNudge; a second row with Again / Vary / Previous; help text |
| Waveform | `src/ui/components/Waveform.tsx` | Mix peaks canvas. Click seeks (`seekPreview`), drag sets a loop, Z zooms, `,` `.` nudge by a bar. In Power mode with no result, shows a `1 · Generate` button |
| Song map | `src/ui/components/SectionTimeline.tsx` | Section strip. Click seeks. Each section has Expand (+8 bars) and Repeat; drops also get ×2; section edges can be dragged. Also an energy strip, a seed/bpm meta line, and "Generate with edits" |
| Style text | `src/ui/components/SimpleWant.tsx` | "1 What do you want?" textarea bound to `promptText` |
| Style ref | `src/ui/components/StyleDropZone.tsx` | Attach an audio file, owner attestation, undo vibe knobs, clear/replace. On Studio this feeds the ACE `cover` task |
| Song shape | `src/ui/components/SongShapePicker.tsx` | Shape buttons and bar-length buttons |
| Layers | `src/ui/components/LayersChips.tsx` | Guitar / solo / vocal-ish / extra drums / real break toggles, plus "Re-generate with layers" and "Vary with layers" |
| Mixer | `src/ui/components/StemMixer.tsx` | `StemMixer` (M/S/gain per stem, undo, reset mix) and `StemMixerCompact` (mute, undo, reset, Download heard) |
| Regen strip | `src/ui/components/RegenAffordance.tsx` | "What changed", Again, Vary |
| Post-export strip | `src/ui/components/PostExportStrip.tsx` | Save favorite, Again, Vary |
| Resume strip | `src/ui/components/ResumeDraftStrip.tsx` | Restore the last seed and knobs |
| Params | `src/ui/components/ParamPanel.tsx` | Seed input, copy seed, copy seed + knobs, shuffle seed, keep-seed toggle, Again, knobs |
| Surprise | `src/ui/components/SurpriseMeButton.tsx` | Surprise me panel |
| Favorites | `src/ui/components/FavoritesPanel.tsx` | Save / Again / Vary / remove, plus a second Surprise me in the empty state |
| Tier | `src/ui/components/ProductTierPanel.tsx` | Sketch / Studio buttons (`setProductTier`) |
| Power extras | `src/ui/components/PowerExtras.tsx` | Second bit-depth picker, backend badges, audio-path select, capability chips, `STUDIO_MODELS` (wrong), style-pack select, train stub, provenance |
| Misc | `StatusPanel.tsx`, `HelpPanel.tsx`, `FlowStatusChips.tsx`, `Toasts.tsx`, `HelpTip.tsx` | Status, help, chips, toasts, the `?` tips |
| Hotkeys | `src/ui/hooks/useTransportHotkeys.ts` | G generate, Space/K play-stop, R again, V vary, E export, B A/B, Z zoom, L loop, `,` `.` nudge, `?`/h help, Esc |
| Store | `src/ui/hooks/useStudioStore.ts` | `generate` `:961`, `generateAgain` `:1236`, `vary` `:1240`, `play` `:1256`, `stop` `:1297`, `seekPreview` `:1299`, `expandSectionAt` `:869`, `repeatSectionAt` `:890` |

## How the handlers behave today (read from the store)

- **`play()`** calls `loadPreviewFromMixer(result, mixer)` and then
  `previewPlayer.play()`. It never calls `backend.render`. The only `.render(`
  call in the store is inside `generate()` (`useStudioStore.ts:1112`).
- **`stop()`** is `previewPlayer.stop()`. It does not touch `result`.
- **`generate()`** rolls a new seed only when
  `!opts?.variation && !s0.keepSeed && !s0.editedSections` (`:972`). It also
  re-probes ACE on every call and switches `productTier` to `'studio'` whenever
  the probe answers (`:986-993`).
- **`vary()`** always sets a new seed and nudges chaos by ±0.15, then calls
  `generate({ variation: 'vary' })`.
- **Expand, Repeat and ×2** only edit `editedSections` and set `paramsDirty`.
  The next Generate keeps the seed and sends `sectionsOverride`, but it
  **re-renders the whole song**. Nothing today renders "that section only".

## Target: one screen

```
[Sketch | Studio]                                   seed · bpm

waveform + song map          (display + seek only — NO primary Play here)

[ Play ]  [ Stop ]  [ Generate ]  [ Vary ]
  buffer    halt      new idea      new seed

Selected section: Drop   [×2 this section only]

More ▸ export · mixer · style-ref · layers · favorites · surprise · stems
```

- There is **one layout**: no Simple/Power split and no numbered steps.
- The only primary row is **Play · Stop · Generate · Vary**, all in one cluster.
- Section actions apply to the **selected** section. They are no longer repeated on every segment.
- Everything else goes behind **More**, with one copy of each control.

## Button contract (must be testable)

| Button | Contract | Store call | Status today |
|---|---|---|---|
| Play | Plays the existing buffer. **Never renders.** | `play()` | Already true. It isn't locked by a test yet (UI-4). |
| Stop | Stops playback. **Keeps the buffer**, and Play works again right after. | `stop()` | Already true. Not locked by a test yet (UI-4). |
| Generate | New seed, **unless** a section ×2/Expand intent is active. In that case it keeps the seed and changes only that section's arrangement. | `generate()` | Mostly true. `keepSeed` (`ParamPanel.tsx:143`) is an extra exception the contract doesn't mention. |
| Vary | **Always** a new seed. | `vary()` | True. |
| Export | Not step 3 of listening. It lives in More. | `exportStems()` | False today (UI-3). |

**What "that section only" means here.** In this pass it means the seed is kept
and `sectionsOverride` differs from the rendered sections only at the selected
index. It does **not** mean only that audio span is re-rendered. On Studio, ACE
still regenerates the whole track. Real per-section audio would need ACE
`repaint`, which is listed in `CAPS` but not wired. That is out of scope here,
so the UI copy must not promise it.

**Decided (user, 2026-09-16):** `keepSeed` lives behind More and never goes on
the main bar. The UI-4 tests run with `keepSeed: false`.

## Tickets (not implemented)

| ID | Title |
|---|---|
| UI-1 | Move Play/Stop next to Generate/Vary. Same handlers. No other chrome. |
| UI-2 | Remove Simple vs Power as two products. One layout. |
| UI-3 | Demote Export, the second Vary, both Surprise Me buttons, and the style-pack train behind More. |
| UI-4 | Tests: Play does not call render; Expand keeps the seed. |

Still not ticketed, and waiting for the user: a selected-section model to replace
the per-segment Expand/Repeat/×2 buttons, cutting the HelpTip count, and the
default style text (the text itself belongs to S-2).

Heads-up: `src/test/e2e-invariants.test.ts` has 9 assertions on the current
labels and modes. UI-2 and UI-3 must update those assertions on purpose, not delete them.
