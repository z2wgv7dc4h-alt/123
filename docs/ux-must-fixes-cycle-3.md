# UX must-fixes — cycle 3 (consumer-grade + HelpTip pass)

Bar: Ableton/Spotify-class Simple Mode. Soft-pass forbidden.
Also supersedes `ux-must-fixes-noob-help.md` + cycle-3-draft for Builder order.

## P0 blockers (broken / incomplete NOW)

### P0.1 HelpTip API mismatch — tips are empty/wrong

Call sites (`App.tsx`, `TransportBar.tsx`) pass:
- `label={long body text}` + `ariaLabel={…}`

Component (`HelpTip.tsx`) expects:
- `text` (body) + optional `label` (aria name)

**Fix `src/ui/components/HelpTip.tsx`** to accept BOTH shapes without breaking callers:

```ts
type HelpTipProps = {
  /** Preferred: body copy */
  text?: string;
  /** Alias used by current call sites for body copy */
  label?: string;
  ariaLabel?: string;
  className?: string;
};
// body = text ?? label (when label looks like body) 
// OR: prefer text; if only label+ariaLabel, body=label, aria=ariaLabel
// Simplest: body = text ?? label; aria = ariaLabel ?? (text ? label : 'More info')
```

Recommended normalize:
- `body = text ?? label ?? ''`
- `aria = ariaLabel ?? (text ? (label ?? 'More info') : 'More info')`
- If both `text` and `label` and `ariaLabel`: body=`text`, aria=`ariaLabel`, ignore label-as-aria

Also: Escape closes; click-outside closes; keep click toggle for touch.

### P0.2 Missing HelpTip CSS

**`src/styles/app.css`** — add (names must match component):

- `.help-tip-wrap { position: relative; display: inline-flex; vertical-align: middle; }`
- `.help-tip-btn` — 22px circle, muted, next to controls
- `.help-tip-bubble` — popover under/above, max-width 18rem, z-index 50, dark glass, readable
- `.transport-btn-wrap { display: inline-flex; align-items: center; gap: 0.35rem; }`
- Deduplicate old `.help-tip` prose class vs new control (rename prose to `.help-prose` if colliding)

### P0.3 Wire ? everywhere non-obvious (gaps)

Already: App badges/Power, Transport Generate/Play/Export.
**Still missing — wire now:**

| File | Where |
|------|-------|
| `StyleDropZone.tsx` | h2, owner checkbox, vibe intensity, energy/darkness nudges |
| `FlowStatusChips.tsx` | chip row header/? |
| `ParamPanel.tsx` | Energy, Darkness, Chaos, Seed, BPM, Style text |
| `StemMixer.tsx` | M/S/Gain legend |
| `Waveform.tsx` | label |
| `SectionTimeline.tsx` | heading |
| `StatusPanel.tsx` | heading (optional) |
| `PowerExtras.tsx` | backend / LoRA / ACE |
| `App.tsx` | More controls button |
| `TransportBar.tsx` | Stop (short ?) |

Copy source: `docs/ux-must-fixes-noob-help.md` table (plain English, no jargon dumps).

### P0.4 Fonts actually load

`index.html` — add IBM Plex Sans + Mono (or self-host under `public/fonts`).
Currently CSS names the family but **no @import / link** → system fallback only (prototype feel).

---

## P1 — Typography / spacing / motion (premium)

### Tokens in `:root` (`app.css`)

```css
--font-sans: "IBM Plex Sans", ...;
--font-mono: "IBM Plex Mono", ...;
--space-1: 0.25rem; --space-2: 0.5rem; --space-3: 0.75rem; --space-4: 1rem; --space-5: 1.5rem;
--text-xs: 0.72rem; --text-sm: 0.85rem; --text-md: 1rem; --text-lg: clamp(1.45rem, 2.4vw, 1.9rem);
--ease-out: cubic-bezier(0.22, 1, 0.36, 1);
--dur-fast: 120ms; --dur: 180ms;
```

### Hierarchy

| File | Change |
|------|--------|
| `app.css` | `h1` tracking tighter, weight 650–700; tagline `--text-sm` muted |
| `StyleDropZone` CSS | h2 **sentence case** hero (not tiny uppercase) — consumer: “Your MP3 → this vibe” ~1.15–1.25rem |
| `.app.simple` | tighter vertical rhythm; panels less padded; max-width 960–1040 for focus |
| Transport | primary Generate dominant; Play/Export optically equal after result; Stop quieter |
| Chips | `.flow-chip.next` pulse only next step; reduced-motion: no pulse |

### Motion

- Prefer opacity/transform 180ms `--ease-out` on panels/toasts/dropzone `.over`
- No new infinite loops except next-action pulse + gen progress
- `prefers-reduced-motion` already partial — extend to flow-chip pulse + transport pulse

---

## P1 — Empty states / coach

| File | Copy |
|------|------|
| `App.tsx` idle coach | `Hit 1 · Generate — or drop your track above (optional).` Auto-hide after first Generate |
| `StatusPanel.tsx` | Idle: `Ready — hit Generate.` Success: `Ready — hit Play.` Meta in `<details>` |
| `Waveform.tsx` empty | Soft dashed + one line |
| Remove | Duplicate transport-help essay once ?s work; keep one short line max in Simple |

---

## P1 — Style Ref premium

| File | Change |
|------|--------|
| `StyleDropZone.tsx` | Sub: `Drop a track you own to bias this vibe (optional)` |
| | Drop CTA centered, min-height ~7.5rem, stronger idle glow |
| | Simple: hide hash pill |
| `app.css` | Dropzone focus-visible ring; drag state Spotify-calm (cyan wash, not chaos) |

---

## P2 — Chrome declutter leftovers

- Simple: drop `.kbd-hint` if still present
- Footer shorter: `Local · original sketches · your files only`
- HelpPanel summary: `How it works · 3 clicks`
- Preview pill: humanize `preview · ready` → `Ready to play` / `Playing` (TransportBar)

---

## Acceptance

- [x] HelpTip shows real body text at every wired site (API fixed) — `normalizeHelpTipProps`: body=`text??label`, Escape + pointerdown-outside close, click toggle; verified via `helptip.test.ts`
- [x] ? CSS looks intentional (not unstyled browser button) — `.help-tip-btn` 22px circle, `.help-tip-bubble` z-index 50 dark glass, `.transport-btn-wrap`; prose renamed `.help-prose`
- [x] Style Ref + Transport + Param/Stem/Power all have ? — Transport Generate/Play/Stop/Export; StyleDropZone; FlowStatusChips; Waveform; SectionTimeline; App More/Simple/Power; Param/Stem/PowerExtras/Status
- [x] IBM Plex loads — Google Fonts Sans+Mono linked in `index.html`
- [x] Simple: Generate→Play→Export ≤3 clicks; style optional — unchanged flow; style still optional
- [ ] Next-action pulse only; reduced-motion OK — P1 leftover (partial prefers-reduced-motion exists)
- [ ] Feels product, not “Browser prototype” lab (badge copy: consider `Web app` not prototype) — P1/P2 leftover


## Builder order

1. Fix HelpTip props + CSS (P0.1–P0.2) — **ship first, broken now**
2. Wire remaining ? (P0.3) + fonts (P0.4)
3. Type/spacing/motion tokens + Style Ref hero type (P1)
4. Coach/Status/Waveform (P1)
5. Chrome leftovers (P2)

UX re-audits immediately after P0.1–P0.3.
