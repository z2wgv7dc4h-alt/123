# UX Audit — Cycle 1 (dnb-studio)

> **Status (2026-09-14 PT):** Style descriptors **pass through** (`scrubArtistNames` no-op). Historical “scrub + blocklist” lines below are outdated.


**Scope:** `/workspace/dnb-studio/src` React + CSS only. Audit only — no code changes in this cycle.  
**Date:** 2026-09-06 (PT)  
**Priorities:** (1) Simple ≤3 clicks Generate→Play→Export (2) Style ref “your MP3 → this vibe” user-owned only (3) God-tier polish/a11y/copy (4) Power depth without clutter.

---

## 1. UI tree (current files)

```
src/
  main.tsx                          → mounts App + styles/app.css
  App.tsx                           → shell: header, flow-hint, Help, Transport, Waveform,
                                      kbd-hint, SectionTimeline, main.grid, footer, Toasts
  styles/
    app.css                         → single global stylesheet (no CSS modules)
  ui/
    components/
      HelpPanel.tsx
      TransportBar.tsx
      Waveform.tsx
      SectionTimeline.tsx
      StyleReferencePanel.tsx       → NEW style-ref upload UI
      ParamPanel.tsx
      StemMixer.tsx
      StatusPanel.tsx
      PowerExtras.tsx               → Power Mode only (`mode === 'power'`)
      Toasts.tsx
    hooks/
      useStudioStore.ts             → zustand + generate/play/export/styleRef
      useTransportHotkeys.ts        → G / Space|K / E
    lib/
      toasts.ts
  core/                             → backends, styleRef/analyzeAudio, export, prompt scrub…
```

**Render order (Simple Mode):**  
`skip-link → header (badges + mode) → flow-hint → HelpPanel → TransportBar (+ transport-help) → Waveform → kbd-hint → SectionTimeline → main[StyleReference | Param | Stems | Status] → footer → Toasts`

**No pages/router** — single-page App.

---

## 2. Simple Mode click trace (Generate → Play → Export)

| Step | Action | Clicks | File |
|------|--------|--------|------|
| Load | Defaults ready (`mode: 'simple'`, seed/BPM set) | 0 | `useStudioStore.ts` |
| 1 | Click `1 · Generate` | **1** | `TransportBar.tsx` |
| — | Wait for busy→result (auto-loads mix preview) | 0 | `useStudioStore.ts` `generate` |
| 2 | Click `2 · Play` | **2** | `TransportBar.tsx` |
| 3 | Click `3 · Export ZIP` | **3** | `TransportBar.tsx` |

**Core path count: 3 clicks** (hotkeys G/Space/E = 0 mouse clicks). Style ref is optional and does **not** block Generate.

### What blocks feeling ≤3 / god-tier Simple

1. **Visual clutter above transport:** badges + tagline + flow-hint + HelpPanel + transport-help + empty Waveform + kbd-hint + empty Timeline before first Generate (`App.tsx`, `HelpPanel.tsx`, `TransportBar.tsx`, `Waveform.tsx`, `SectionTimeline.tsx`).
2. **Style ref buried in `main.grid`** below fold — optional path hard to discover (`App.tsx` L72–73, `StyleReferencePanel.tsx`).
3. **flow-hint copy** frames “optional style ref → Generate → Play → Export” as the core flow (`App.tsx` L58–60) — reads as 4 steps; conflicts with ≤3 spine.
4. **No next-step pulse on Play** after Generate succeeds — Export is `.btn.accent`, Play is plain `.btn` (`TransportBar.tsx`, `app.css`).
5. **Simple Mode still shows Power-ish Arrangement controls** always: seed, BPM, 3 sliders, style textarea (`ParamPanel.tsx`) + full StemMixer (`StemMixer.tsx`).
6. **Silent LoRA in Simple:** `loraPackId` defaults `'rock-dnb-energy-v0'` and `generate` always sends `lora` when set (`useStudioStore.ts` L161, L312) — Simple path is not visually “LoRA-free”.
7. **`initBackends` never called** from `App.tsx` / `main.tsx` — ACE offline warning only appears if something else probes; Simple honesty toast path incomplete.

---

## 3. Style Reference audit

| Check | Status | Where |
|-------|--------|-------|
| UI present | **Yes** | `StyleReferencePanel.tsx` mounted in `App.tsx` |
| Core analyze | **Yes** | `core/styleRef/analyzeAudio.ts`, wired in `useStudioStore.setStyleReferenceFile` |
| Drag-drop | **Yes** | `StyleReferencePanel.tsx` drop handlers + `.style-ref-drop.over` |
| File picker | **Yes** | hidden input + `Choose file` label |
| Accept types | **Yes** | `STYLE_REF_ACCEPT` mp3/wav/flac |
| Legal copy (user-owned, no artist clone) | **Mostly OK** | hint: “you own”, “Not a clone UI”, “No YouTube…” |
| “your MP3 → this vibe” framing | **Weak** | subtitle: “I like this style → Generate uses it as a reference” — not vibe-forward |
| Owner attestation checkbox | **MISSING** | types comment expects checkbox (`types/index.ts` L296); UI hardcodes `setFile(file, true)` |
| Loading state | **Partial** | text “Analyzing…” + `.busy`; no progress bar / `aria-busy` on region |
| Error state inline | **MISSING** | errors only via store + toast (`setStyleReferenceFile` catch) |
| Clear + intensity | **Yes** | Clear btn + intensity slider when ready |
| Keyboard / dropzone a11y | **Weak** | drop div not focusable / no `role`; only Choose-file label is keyboardable |
| CSS | **Present** | `app.css` L725–794; **bug:** `.style-ref-input` `position:absolute` but `.style-ref-drop` not `position:relative` |
| Placement vs Simple spine | **Wrong** | in grid with Param/Stems — not adjacent to Transport |

No artist-clone UI found (good). Keep scrub + blocklist; do not invent “sounds like X artist”.

---

## 4. Polish / a11y / copy snapshot

**Good already:** skip-link, `prefers-reduced-motion`, focus-visible on inputs/buttons, empty states (Status/Timeline/Waveform), toast bus, Generate pulse while busy, artist scrub messaging.

**Gaps:**

| Area | Issue | File(s) |
|------|-------|---------|
| Stem M/S | No `aria-pressed` / `aria-label` (only gain has label) | `StemMixer.tsx` |
| Waveform empty | `aria-hidden="true"` hides empty guidance | `Waveform.tsx` L153 |
| Waveform states | CSS `.waveform.playing` / `.ready` unused in JSX | `Waveform.tsx`, `app.css` L670–676 |
| Toasts | CSS `.toast-kind` unused; no kind label in DOM | `Toasts.tsx`, `app.css` |
| Progress | `role="progressbar"` without `aria-valuetext` | `StatusPanel.tsx`, `SectionTimeline.tsx` |
| CSS debt | Triplicate `.waveform-placeholder`; duplicate `.toast-warn` | `app.css` |
| Contrast | `.badge.muted` / heavy muted meta on dark — borderline for small caps text | `app.css` `.badge.muted`, `.meta` |
| Play guidance | After Generate, Play not visually primary-next | `TransportBar.tsx` |
| Copy noise | “not a clone” / OfflineStub / ACE repeated in Help + transport-help + Status empty + flow-hint + footer | multiple |
| Fonts | CSS references IBM Plex Sans/Mono; `index.html` does not load them → system fallback | `index.html`, `app.css` |

---

## 5. MUST-FIX list (Builder)

### P0 — blocks Simple spine / legal honesty

#### P0-1 · Restore ≤3-click framing in Simple copy
- **Files:** `src/App.tsx`, `src/ui/components/HelpPanel.tsx`, `src/ui/components/TransportBar.tsx`
- **Change:**
  - `App.tsx` `flow-hint` (simple): `"Core flow (≤3 clicks): Generate → Play → Export ZIP · keys G / Space / E · active: ${backendId}"` (drop “optional style ref →” from core line).
  - `HelpPanel.tsx`: keep style ref as **optional tip**, not numbered step `0 ·` ahead of Generate→Play→Export; renumber so 1/2/3 stay Generate/Play/Export.
  - `TransportBar.tsx` `transport-help`: one short line; move ACE/OfflineStub essay to Help/Power.
- **Why:** Users read a 4-step spine; CoS priority is exactly 3 clicks.
- **AC:** Simple flow-hint contains exactly “Generate → Play → Export”; Help primary list is those 3; style ref called optional elsewhere.

#### P0-2 · Move Style Reference into Simple primary column (discoverable, not required)
- **Files:** `src/App.tsx`, `src/ui/components/StyleReferencePanel.tsx`, `src/styles/app.css`
- **Change:**
  - Render `<StyleReferencePanel />` **between** `TransportBar` and `Waveform` (or directly under transport as compact strip), not only inside `main.grid`.
  - Keep optional: empty dropzone must not add a required click before Generate.
  - Compact Simple variant: shorter hint + dropzone; hide intensity under `<details>` until file attached (or show intensity only when ready — already true — but collapse provenance verbosity).
- **Why:** “your MP3 → this vibe” is invisible below fold; upload UX fails discovery without breaking ≤3.
- **AC:** Style ref dropzone visible without scrolling on 1280×800 after load; Generate still works with zero style-ref interaction.

#### P0-3 · Owner attestation must be explicit (stop silent `true`)
- **Files:** `src/ui/components/StyleReferencePanel.tsx`, `src/ui/hooks/useStudioStore.ts`
- **Change:**
  - Add checkbox copy: `"I own this file (no YouTube / catalog rips)"` — default unchecked.
  - Disable Analyze/attach until checked **or** require check before `setStyleReferenceFile(..., true)`.
  - Do **not** call `setFile(file, true)` unconditionally; pass `ownerAttested` from checkbox state.
  - Reject / toast if drop attempted without attestation.
- **Why:** Types document attestation checkbox; silent `true` is dishonest and legal-risk adjacent.
- **AC:** Upload path cannot set `ownerAttested: true` without UI confirmation; unchecked → no ref attached + clear message.

#### P0-4 · Simple Mode must not silently apply Power LoRA default
- **Files:** `src/ui/hooks/useStudioStore.ts`
- **Change:** In `generate`, if `mode === 'simple'`, pass `lora: undefined` (or only apply LoRA when `mode === 'power'`). Optionally default `loraPackId` to `null` and set only in PowerExtras.
- **Why:** Simple Generate currently always sends `rock-dnb-energy-v0`; clutters mental model and Power/Simple boundary.
- **AC:** Simple generate job has no `lora` array; Power still can select packs.

---

### P1 — Style ref UX + a11y + next-step polish

#### P1-1 · Style ref copy → “your MP3 → this vibe”
- **Files:** `src/ui/components/StyleReferencePanel.tsx`
- **Change strings:**
  - `h2`: keep `"Style reference (your file)"` (legal-safe).
  - Replace drop-sub `"I like this style →…"` with `"Your MP3 → this vibe · biases tempo/energy (original sketch, not a clone)"`.
  - Shorten long hint; move ACE sidecar sentence to Help/Power.
- **Why:** Matches CoS wording; clearer value prop.
- **AC:** No “sounds like {artist}” anywhere; “your file” / “you own” retained; vibe phrase present.

#### P1-2 · Style ref feedback states (loading / error / ready)
- **Files:** `src/ui/components/StyleReferencePanel.tsx`, `src/styles/app.css`
- **Change:**
  - Region `aria-busy={busy}`; show `.gen-progress` while analyzing.
  - Inline `.status-error` / error text from last style-ref failure (local state or store slice), not toast-only.
  - Ready row: keep filename + BPM/energy; add `"Ready · Generate to apply vibe"`.
- **Why:** Failed decode currently only toast — easy to miss.
- **AC:** Invalid file shows inline error in panel; analyzing shows progress; ready shows CTA to Generate.

#### P1-3 · Style ref a11y + CSS containment
- **Files:** `src/ui/components/StyleReferencePanel.tsx`, `src/styles/app.css`
- **Change:**
  - Dropzone: `role="button"` + `tabIndex={0}` + Enter/Space opens file picker; `aria-label="Drop or choose your audio file"`.
  - `.style-ref-drop { position: relative; }` so `.style-ref-input` absolute clip is contained.
  - Ensure Choose-file `label.btn` gets `:focus-within` ring.
- **Why:** Keyboard users can’t use drop zone; absolute input may escape panel.
- **AC:** Keyboard-only can attach a file; no clipped/orphaned file input; focus ring visible.

#### P1-4 · After Generate, elevate Play as next click
- **Files:** `src/ui/components/TransportBar.tsx`, `src/styles/app.css`
- **Change:** When `result && previewState !== 'playing'`, add `className="btn accent pulse"` (or `btn primary` secondary style) on Play; clear pulse on play/export. Optionally `aria-keyshortcuts` already via titles — keep.
- **Why:** Hierarchy currently Generate > Export > Play; spine is Generate→**Play**→Export.
- **AC:** Post-generate, Play visually pulses/highlighted until first Play or new Generate.

#### P1-5 · Stem mixer accessible mute/solo
- **Files:** `src/ui/components/StemMixer.tsx`
- **Change:** On M/S buttons: `aria-pressed={!!mixer.mute[id]}` / `solo`; `aria-label={`${id} mute`}` / `${id} solo``.
- **Why:** Icon-only buttons fail SR/name computation.
- **AC:** VoiceOver/NVDA announces pressed state for M/S.

#### P1-6 · Waveform empty + playing states
- **Files:** `src/ui/components/Waveform.tsx`
- **Change:**
  - Remove `aria-hidden` on empty; use `aria-label="Mix waveform empty — generate to fill"`.
  - Apply `className` with `playing` when `previewState==='playing'`, `ready` when peaks loaded and not playing.
- **Why:** CSS already exists; empty state hidden from AT; play feedback weak.
- **AC:** Classes toggle with previewState; empty state announced.

#### P1-7 · Call `initBackends` once on mount
- **Files:** `src/App.tsx` (or `main.tsx`)
- **Change:** `useEffect(() => { void useStudioStore.getState().initBackends(); }, []);`
- **Why:** ACE-offline warning path dead; backendId may stay stale vs registry.
- **AC:** On load, OfflineStub selected; ACE-offline warning appears once if probe fails.

---

### P2 — Simple declutter / Power depth / CSS hygiene

#### P2-1 · Simple Mode: collapse Arrangement to essentials
- **Files:** `src/ui/components/ParamPanel.tsx`, `src/styles/app.css`
- **Change:** When `mode==='simple'`, show only Energy (+ optional Darkness) OR a single “Vibe” slider; put Seed / BPM / Chaos / Style text inside `<details>` “More controls” (or Power-only for Seed/BPM/Bars).
- **Why:** Power depth leaking into Simple clutters ≤3 path.
- **AC:** Simple default view ≤2 sliders + optional details; Power unchanged full panel.

#### P2-2 · Simple Mode: demote StemMixer
- **Files:** `src/App.tsx`, `src/ui/components/StemMixer.tsx`
- **Change:** Wrap StemMixer in `<details className="panel">` for Simple, or gate behind `mode==='power'` + keep mix-only Play in Simple.
- **Why:** Mute/solo/gain is Power depth; Simple needs Play of full mix.
- **AC:** Simple load does not show 6 stem rows expanded; Power shows full mixer.

#### P2-3 · Toast kind labels + CSS dedupe
- **Files:** `src/ui/components/Toasts.tsx`, `src/styles/app.css`
- **Change:** Render `<span className="toast-kind">{t.kind}</span>`; delete duplicate `.toast-warn` / triplicate `.waveform-placeholder` blocks.
- **Why:** Dead CSS + weaker toast scanability.
- **AC:** One rule each; kind visible on toasts.

#### P2-4 · Load IBM Plex (or drop the reference)
- **Files:** `index.html` **or** `src/styles/app.css`
- **Change:** Either add Google Fonts / self-host link for IBM Plex Sans + Mono, or set `font-family` to system-ui stack only.
- **Why:** Designed typeface never loads → polish gap.
- **AC:** Computed font matches declared stack.

#### P2-5 · Progressbar `aria-valuetext`
- **Files:** `src/ui/components/StatusPanel.tsx`, `src/ui/components/SectionTimeline.tsx`
- **Change:** `aria-valuetext="Generating sketch"` on `.gen-progress`.
- **Why:** Indeterminate bars need text for AT.
- **AC:** SR announces generating state.

#### P2-6 · PowerExtras: reduce always-on noise
- **Files:** `src/ui/components/PowerExtras.tsx`
- **Change:** Collapse model download slots + provenance into `<details>` by default; keep Backend select + LoRA + callout visible.
- **Why:** Power depth without wall of disabled Download buttons.
- **AC:** Power first screen = backend + LoRA + short ACE callout; downloads behind details.

#### P2-7 · Contrast pass on muted chrome
- **Files:** `src/styles/app.css`
- **Change:** Bump `--muted` toward `#b0b8cc` or raise `.badge.muted` / `.meta` / `.kbd-hint` font-size/weight; verify `--warn` on dashed callout.
- **Why:** Small uppercase muted badges risk <4.5:1.
- **AC:** Muted body text ≥4.5:1 on `--bg` / panel.

---

## 6. Quick wins vs structural

| Quick wins (≤1–2h) | Structural (half-day+) |
|--------------------|-------------------------|
| P0-1 copy/framing | P0-2 layout move + compact style-ref strip |
| P0-4 LoRA gate in generate | P2-1/P2-2 Simple declutter (Param/Stems) |
| P1-1 string swap | P0-3 attestation UX + store contract |
| P1-4 Play pulse class | P1-2 inline error/progress for style-ref |
| P1-5 Stem aria-* | P2-6 PowerExtras information architecture |
| P1-6 Waveform classNames | P2-4 font loading strategy |
| P1-7 initBackends useEffect | |
| P2-3 CSS dedupe | |
| P2-5 aria-valuetext | |
| P1-3 `position:relative` + dropzone keyboard | |

---

## 7. Legal / out-of-scope (do NOT build)

- No “sounds like {artist}”, artist picker, clone, or YouTube/catalog fetch UI.
- Keep `scrubArtistNames` + blocklist.
- Style ref = **user-owned file only** (File API); ACE cover/repaint remains sidecar-gated messaging.

---

## 8. Acceptance smoke (manual)

1. Cold load Simple → click Generate → Play → Export ZIP = **3 clicks**, download starts.
2. Style ref: check “I own…” → drop MP3 → see BPM/energy → Generate → Status shows style ref line; no artist UI.
3. Keyboard: Tab to Generate, activate; Space plays; E exports; style-ref Choose file reachable.
4. Power: LoRA/backend visible; Simple generate has no LoRA in job.
5. `prefers-reduced-motion`: no pulse/slide animations.

---

## 9. File checklist (exists today — edit these)

- `src/App.tsx`
- `src/main.tsx` / `index.html` (init + fonts)
- `src/styles/app.css`
- `src/ui/components/TransportBar.tsx`
- `src/ui/components/HelpPanel.tsx`
- `src/ui/components/StyleReferencePanel.tsx`
- `src/ui/components/ParamPanel.tsx`
- `src/ui/components/StemMixer.tsx`
- `src/ui/components/StatusPanel.tsx`
- `src/ui/components/Waveform.tsx`
- `src/ui/components/SectionTimeline.tsx`
- `src/ui/components/Toasts.tsx`
- `src/ui/components/PowerExtras.tsx`
- `src/ui/hooks/useStudioStore.ts`

**Supporting (read-only for this UX pass unless wiring):**  
`src/core/styleRef/analyzeAudio.ts`, `src/core/uiMessages.ts`, `src/core/types/index.ts`
