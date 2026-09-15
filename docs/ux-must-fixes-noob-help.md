# UX must-fixes — Noob Help Pass (USER PRIORITY)

Goal: absolute beginners feel guided without adding clicks to Generate → Play → Export.
Pattern: every non-obvious control gets a tiny **?** popover (not native `title=` alone).

Cycle-2 progress: StyleDropZone (“Your MP3 → this vibe”), owner gate, a11y, More — keep.
This pass: help chrome + coach copy + leftover Simple declutter.

## P0 — Shared HelpTip

**Create** `src/ui/components/HelpTip.tsx` + CSS in `app.css` + optional `src/ui/lib/helpCopy.ts`

- `?` button, click/Enter toggle, Escape + outside close, focus return
- Popover max ~18rem, plain English, touch-friendly (no title-only)
- Place beside labels (`label-with-help`), never inside Generate/Play/Export

## P0 — Wire ? (hero first)

| File | Control | Intent |
|------|---------|--------|
| StyleDropZone.tsx | h2 Your MP3 → this vibe | Optional own-file inspiration; not a clone |
| StyleDropZone.tsx | Owner checkbox | Required before attach; stays in browser |
| StyleDropZone.tsx | Vibe intensity / Energy / Darkness | Bias strength + fine-tune; 174 BPM locked |
| StyleDropZone.tsx | hash pill | Hide in Simple OR explain fingerprint |
| TransportBar.tsx | Generate / Play / Export / Stop | One-click sketch / preview / ZIP download / stop |
| FlowStatusChips.tsx | chip row | Progress only; style-ref never required |
| App.tsx | Simple/Power + More | Easy path vs advanced |
| ParamPanel.tsx | Energy/Darkness/Chaos/Seed/BPM/Style text | Plain one-liners |
| StemMixer.tsx | M/S/Gain | Remix Play; remixed Export adds mix_as_heard.wav; dry stems stay |
| Waveform / SectionTimeline / PowerExtras | as present | Short what-is-this |

## P0 — Coach empty (one card, non-blocking)

- App idle: `Hit 1 · Generate — or drop your track above first (optional).` Auto-fade after first Generate.
- Status Simple idle/success: `Ready — hit Generate` / `Ready — hit Play`
- Waveform empty: appears after Generate
- No modal stack

## P1 — Declutter still open

- Tagline: `Original drum & bass · 174 BPM · your files stay local`
- Simple ≤2 badges; drop kbd-hint + backend jargon in flow-hint
- `.app.simple` density; hash pill Power-only; Status meta in `<details>`
- Pulse **next** chip/Play only

## Acceptance

- [ ] Every non-obvious control has visible ?
- [ ] Keyboard + SR; Escape closes
- [ ] ≤3 clicks Generate→Play→Export without upload
- [ ] Style Ref front and center; ownership required
- [ ] Legal copy holds

## Builder order

1. HelpTip + CSS + helpCopy
2. StyleDropZone + Transport + chips
3. Coach/Status one-liners
4. Param/Stem/Power ?
5. App Simple declutter + next-action pulse
