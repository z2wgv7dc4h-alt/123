# UX must-fixes — cycle 3 DRAFT (after cycle-2 lands)

**LOCKED with Brainstormer (2026-09-06):** bias copy (not mirror); Surprise/Favorites off hero; non-blocking coach; pulse next action only; hero = tagline + style-ref + transport + waveform + one More.


Hold until cycle-2 re-audit passes. Then ship these for “stunning + dead easy.”

## Visual hierarchy

| File | Change |
|------|--------|
| `app.css` | Transport remains hero; style-ref card one step quieter (border cyan, transport purple) |
| `app.css` | `.app.simple .flow-hint` single line, less padding |
| `Waveform.tsx` + CSS | Empty state: faint dashed “Waveform after Generate” — no competing CTA |
| `SectionTimeline.tsx` | Simple: collapse empty timeline further; show only after result |

## Micro-interactions

| File | Change |
|------|--------|
| `TransportBar.tsx` | Play pulse only until first successful play this session (`hasPlayedOnce` local or store flag) |
| `StyleReferencePanel.tsx` | Brief success checkmark / “Ready · vibe locked” chip when attached |
| `Toasts.tsx` | Cap stack to 3; newer replaces same-kind success |

## Copy polish

| File | Change |
|------|--------|
| `ParamPanel.tsx` | Simple labels: `Drive`, `Mood`, `Chaos` with one-line hints |
| `footer` in `App.tsx` | Shorter: `Local · original sketches · your files only` |
| `HelpPanel` | Keep collapsed; summary `How it works · 3 clicks` |

## A11y

| File | Change |
|------|--------|
| `StemMixer.tsx` | `aria-label` Mute/Solo per stem |
| Focus order | style-ref → Generate → Play → Export natural tab order |

## Out of scope still

Artist clone, URL import, forcing style-ref.

## From Brainstormer delight pass (UX-filtered)

Accepted for cycle-3:
- Simple hero: style drop → transport → waveform; Param/Stems/Status behind **More**
- Tagline: `Original drum & bass · 174 BPM · your files stay local`
- Success: `Ready — hit Play` (meta in More)
- Pulse **next** transport action only; drop overlay; reduced-motion; focus rings

Rejected on hero (More / later only):
- Surprise me, Favorites Again/Vary as primary controls
- Blocking first-run coach marks
- “mirror its vibe” copy → use bias / “Your MP3 → this vibe”
