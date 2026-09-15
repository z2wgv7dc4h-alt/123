# UX must-fixes — cycle 2 (god-tier Simple Mode)

P0 Style Reference **landed** (panel + store + generate wiring). This cycle = beauty + effortless flow + legal attestation + declutter.

## Re-audit snapshot

| Check | Status |
|-------|--------|
| Optional upload (Generate still 1-click) | Pass |
| `generate()` passes `styleReference` | Pass |
| No artist-clone UI | Pass |
| Panel above transport (story order) | **Fail** — panel is in `.grid` below |
| Headline “Your MP3 → this vibe” | **Fail** — uses “Style reference (your file)” |
| Owner attestation checkbox | **Fail** — `setFile(file, true)` auto-attests |
| Dropzone keyboard a11y | **Fail** — mouse/drag only |
| Simple declutter (seed / stems / badges) | **Fail** — still noisy |

---

## P0 — Style Reference feel effortless + legal

### P0.1 Move panel into the primary flow

**File:** `src/App.tsx`

- Move `<StyleReferencePanel />` from `.grid` to **between** `HelpPanel` and `TransportBar` (full width).
- Keep `.grid` as Param / Stems / Status / Power only.
- Update skip-link optional: `href="#style-ref"` then transport, or keep `#transport` and give style-ref `id="style-ref"`.

### P0.2 Copy hierarchy (calm neon DnB)

**File:** `src/ui/components/StyleReferencePanel.tsx`

Replace heading/hint/drop titles:

```tsx
<h2>Your MP3 → this vibe</h2>
<p className="hint">
  Optional. Drop a track <strong>you own</strong> — we bias an original sketch’s tempo / energy / timbre.
  Not a clone. No YouTube or catalog.
</p>
// drop empty:
<p className="style-ref-drop-title">{busy ? 'Analyzing…' : 'Drop your track'}</p>
<p className="style-ref-drop-sub">MP3 · WAV · FLAC · stays in this browser</p>
```

HelpPanel step 0: rename to match (“Your MP3 → this vibe”).

Transport tip add: `Optional: drop your track above for vibe bias ·`

### P0.3 Owner attestation (required)

**Files:** `StyleReferencePanel.tsx`, `useStudioStore.ts`

- Local state `ownerOk` checkbox **before** attach sticks:
  - Label: `I own or have rights to this file`
  - Choosing/dropping a file with `ownerOk === false` → toast warn, do **not** call `setStyleReferenceFile`
  - Or: analyze only after checkbox; disable Choose file until checked
- Store: **remove** default `ownerAttested = true`. Require explicit `true` or reject.
- `generate()`: if `ref && !ref.ownerAttested` omit `styleReference` (belt-and-suspenders)
- CSS: `.style-ref-attest` row under drop zone (checkbox + label, 44px hit)

### P0.4 Dropzone a11y + polish

**Files:** `StyleReferencePanel.tsx`, `app.css`

- Drop div: `role="button"`, `tabIndex={0}`, `aria-label="Drop or choose a style reference audio file"`
- Enter/Space → `inputRef.current?.click()`
- `aria-busy={busy}`, live region for analyzing/ready
- CSS:
  - `.style-ref-drop { width: 100%; min-height: 7.5rem; align-items: center; text-align: center; }`
  - Soft inner glow on idle; stronger on `.over`
  - `.style-ref-panel` full-bleed above transport: slightly stronger border `rgba(110,231,255,0.28)`, no competing with transport’s purple hero
  - Position `.style-ref-input` with `clip` pattern; keep label/button focusable

---

## P1 — Zero clutter Simple Mode (≤3 clicks spine)

### P1.1 App chrome

**File:** `src/App.tsx`

Simple mode badges: only
- `Browser prototype`
- `CPU sketch · 174`

Hide `16-bit Phase 0`, `48 kHz…`, `ACE / RTX 5080 later` unless Power (or footer only).

Remove `.kbd-hint` under waveform in Simple (Help + transport-help enough). Keep in Power optional.

`flow-hint` Simple shorten to:
`Generate → Play → Export · optional vibe ref above · G / Space / E`

### P1.2 ParamPanel

**File:** `src/ui/components/ParamPanel.tsx`

Simple: show Energy / Darkness / Chaos + style text only.
Hide BPM number (locked 174 is fine — show read-only pill `174 BPM` if needed), hide Seed + Shuffle.
Power: keep BPM/seed/bars/shuffle.

Placeholder on textarea: `reese bass, half-time break — no artist names`

### P1.3 StemMixer

**File:** `src/ui/components/StemMixer.tsx`

Simple: wrap entire panel body in `<details className="stem-mixer-details"><summary>Preview stem mix (optional)</summary>…</details>`
Power: always expanded (no details).

### P1.4 StatusPanel

**File:** `src/ui/components/StatusPanel.tsx`

Simple idle: one line — `Hit 1 · Generate when ready.` (Help owns the essay).
Simple ready: keep success CTA; wrap `meta-list` in `<details><summary>Job details</summary>`.

### P1.5 Transport visual hierarchy

**Files:** `TransportBar.tsx`, `app.css`

- After `result` and not yet played: add `pulse` or `btn accent` on **2 · Play**
- While playing: Stop gets slight emphasis; Play disabled (already)
- `aria-keyshortcuts="g"` / `Space` / `e` on the three primary buttons
- Ensure Generate remains the only `.btn.primary` until result exists; then Play briefly shares attention

---

## P2 — CSS god-tier pass (calm neon / dark DnB)

**File:** `src/styles/app.css`

1. Deduplicate repeated `.waveform-placeholder` / `.toast-warn` blocks.
2. Simple-mode density: `.app.simple` (set class on root from `App.tsx` via `mode`)  
   - `.app.simple .grid { gap: 0.75rem; }`  
   - `.app.simple .panel { padding: 0.9rem 1rem; }`  
   - `.app.simple .tagline { max-width: 36rem; }`
3. Style-ref full-width card above transport — margin `0 0 0.85rem`; drop zone centered content.
4. Focus: ensure checkbox + dropzone use `var(--focus)`.
5. Prefer reduced-motion: no new infinite animations on style-ref.

---

## Do not

- Artist pickers, “sounds like”, URL paste
- Force style-ref before Generate
- Claim ACE cover until sidecar + `acePathActive`

## Builder order

1. P0.1 move panel + P0.2 copy (30 min feel win)
2. P0.3 attestation + store harden
3. P0.4 a11y/CSS dropzone
4. P1.1–P1.5 declutter + transport
5. P2 `.app.simple` density

## Acceptance

- [ ] Cold load → Generate → Play → Export still ≤3 clicks with no upload
- [ ] Style ref sits above transport; headline “Your MP3 → this vibe”
- [ ] Cannot attach without ownership checkbox
- [ ] Simple hides seed/shuffle; stems collapsed; badges ≤2
- [ ] Dropzone keyboard operable; focus rings visible
