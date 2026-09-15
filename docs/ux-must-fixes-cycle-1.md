# UX must-fixes — cycle 1 (Style Reference + Simple Mode)

Owner: UX → Builder. Legal: user-owned refs only; no artist-clone UI; no YouTube/catalog import.

## Click budget (current)

Simple Mode already labels **1 · Generate → 2 · Play → 3 · Export ZIP** on the transport. Core spine is 3 clicks **if** the user ignores panels. Gaps:

1. **Style Reference is invisible** — analyzer + OfflineStub bias exist; store/UI never wire them.
2. Simple Mode still surfaces Power-ish noise (seed shuffle, full stem mixer, badge soup, duplicate help).
3. Optional Style Ref must **not** break ≤3 clicks: upload is optional; Generate remains 1 click with defaults.

---

## P0 — Style Reference UI (live priority)

### P0.1 New component: Style Reference upload card

**Create** `src/ui/components/StyleReferencePanel.tsx`

- Headline copy: **Your MP3 → this vibe** (not “clone”, not artist names).
- Subcopy: *Upload a track you own. We bias energy/tempo/timbre of an original sketch — we never rip or recreate the file.*
- Controls:
  - Drag-drop zone + `<input type="file" accept={STYLE_REF_ACCEPT} />` from `@/core/styleRef`
  - Owner attestation checkbox (required before attach sticks): *I own or have rights to this file*
  - Intensity slider 0–1 (default ~0.55)
  - Clear / replace
  - Analysis readout: file name, duration, estimated BPM (or “outside DnB band — keeping ~174”), energy
- States: idle, analyzing, ready, error (bad type / decode fail / attestation missing)
- A11y: `role="region" aria-label="Style reference"`, live region for analysis, focusable dropzone (`tabIndex={0}` + Enter/Space opens file picker)
- **Never** show artist pickers, “sounds like…”, YouTube URLs, or catalog search

**Wire in** `src/App.tsx`

- Render `<StyleReferencePanel />` **above** transport in Simple Mode (and Power)
- Keep HelpPanel collapsed by default (already `details`)

### P0.2 Store + generate plumbing

**Edit** `src/ui/hooks/useStudioStore.ts`

- Add state: `styleRef: StyleReference | null`, `styleRefError: string | null`, `styleRefBusy: boolean`
- Actions: `attachStyleReference(file: File, ownerAttested: boolean)`, `setStyleRefIntensity(n)`, `clearStyleReference()`
- `attachStyleReference`: call `analyzeStyleReferenceFile`; require `ownerAttested === true`; store in-memory `StyleReference` (blob/arrayBuffer session-only)
- In `generate()` `backend.render({...})`, pass:
  ```ts
  styleReference: styleRef && styleRef.ownerAttested
    ? {
        intensity: styleRef.intensity,
        estimatedBpm: styleRef.analysis.estimatedBpm,
        energy: styleRef.analysis.energy,
        fileName: styleRef.fileName,
        ownerAttested: true,
      }
    : undefined
  ```
- Optional: when ref BPM nudges, `nudgeBpmTowardReference(s.bpm, styleRef.analysis.estimatedBpm)` before render; surface toast *Tempo nudged toward your reference (still DnB band)*
- Success toast: mention style bias when used: *…biased by your upload (original sketch, not a clone)*

### P0.3 Styles

**Edit** `src/styles/app.css`

- Add `.style-ref`, `.style-ref-drop`, `.style-ref-drop.active`, `.style-ref-drop.has-file`, `.style-ref-meta`, `.style-ref-attest`
- Match existing glass panel language (radius, border-glow, focus ring `--focus`)
- Drag-active: accent border + soft cyan glow
- Error: reuse `.status-error` patterns
- Mobile: full-width drop zone; don’t shrink below 44px hit targets

### P0.4 Copy / help updates

| File | Change |
|------|--------|
| `HelpPanel.tsx` | Add optional step *0 · Style reference (your file)* between intro and Generate; stress ownership |
| `TransportBar.tsx` | Tip line: *Optional: drop your MP3 above for vibe bias* |
| `StatusPanel.tsx` | When `result.manifest.styleReference?.used`, show provenance line from `note` / fileName |
| `uiMessages.ts` | Map style-ref errors (*must be MP3/WAV/FLAC you own*, Web Audio required, attestation) |
| `flow-hint` in `App.tsx` | Simple: `Optional style ref → Generate → Play → Export` |

### P0.5 Tests

**Edit / add** `src/test/style-ref-ui.test.ts` (or extend honesty/polish)

- Reject non-audio / missing attestation (unit on store helpers)
- Confirm render job omits `styleReference` when cleared
- Confirm OfflineStub warning string still says not a clone (existing backend path)

**Acceptance**

- [ ] User can attach owned MP3/WAV/FLAC with checkbox
- [ ] Generate without upload still 1 click
- [ ] Generate with upload passes `styleReference` into OfflineStub
- [ ] No artist-clone affordances in UI strings
- [ ] Manifest/export provenance honest (`acePathActive: false` on stub)

---

## P1 — God-tier Simple Mode declutter

### P1.1 Hide Power noise in Simple

| File | Change |
|------|--------|
| `ParamPanel.tsx` | Simple: hide Seed + Shuffle seed (keep Energy/Darkness/Chaos + style text). Power: keep seed/bars |
| `StemMixer.tsx` | Simple: collapse behind `<details>` *Preview stem mix (optional)* OR hide until after first Generate; Power: always open |
| `App.tsx` | Simple: trim badge row to 2 chips max (`Browser prototype` + `CPU sketch`); move ACE/5080 to Power/footer only |
| `App.tsx` | Simple: drop duplicate `.kbd-hint` under waveform if HelpPanel + transport-help already cover G/Space/E — keep one |
| `SectionTimeline.tsx` / Waveform | Keep visible (proof of generate) — good polish |

### P1.2 Transport polish

**Edit** `TransportBar.tsx` + `app.css`

- After Generate succeeds: briefly emphasize **2 · Play** (`.btn.pulse` or `.btn.accent` until first play)
- While `previewState === 'playing'`: Play → shows as active / Stop primary-adjacent
- `aria-keyshortcuts` on Generate/Play/Export
- Disable Export with clearer title when no result (already disabled)

### P1.3 Status / empty states

**Edit** `StatusPanel.tsx`

- Idle empty: one short path, not triple restatement of Generate/Play/Export (HelpPanel owns the long version)
- Ready success: keep one CTA sentence; move verbose meta behind `<details>Job details</details>` in Simple

---

## P2 — Polish / a11y backlog

| File | Change |
|------|--------|
| `StemMixer.tsx` | `aria-label` on M/S buttons (`Mute kick`, `Solo snare`); visible text optional |
| `Toasts.tsx` | Ensure `role="status"` / `aria-live` for success; `role="alert"` for error |
| `app.css` | Deduplicate repeated `.waveform-placeholder` / `.toast-warn` blocks |
| `ParamPanel.tsx` | Style text placeholder: *e.g. reese bass, half-time break — no artist names* |
| Contrast | Verify `.badge.muted` / `.hint` vs `--bg` (aim WCAG AA for body text) |

---

## Out of scope / do not build

- Artist name autocomplete, “sounds like X”, SoundCloud/YouTube paste
- Uploading refs to any server/catalog
- Claiming ACE cover/repaint until sidecar + `acePathActive` true

## Implementation order for Builder

1. Store styleRef + generate wiring (P0.2)
2. `StyleReferencePanel` + CSS + App mount (P0.1 / P0.3)
3. Copy/help/status (P0.4)
4. Tests (P0.5)
5. Simple declutter (P1.*)
6. A11y polish (P2)

