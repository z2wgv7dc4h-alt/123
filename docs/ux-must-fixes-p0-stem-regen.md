# UX P0 — Simple compact stem strip + Regenerate affordance

USER/CoS priority. Soft-pass forbidden. Complements `ux-must-fixes-listen-modify.md`.

## P0.1 Compact stem strip (Simple, after result)

**Do not** bury mute/solo under More for the hear→tweak→rehear loop.

### Create `src/ui/components/StemMixerCompact.tsx`

Show **only when** `mode === "simple" && result`. Mount in `App.tsx` **under Waveform** (hero path), above More.

Controls:
- Rows: kick / snare / hats / bass (not drums/mix)
- Mute toggle per row (compact `btn tiny`)
- Optional: one Solo on focused row later — Mute-first is enough for P0
- `Reset mix` ghost when `mixerDirty`
- Link/button: `Full mixer` → `setMoreOpen(true)` (and expand stem details if needed)
- HelpTip: `HELP.remixPreview`
- Live banner when dirty: `Preview updated · download unchanged` (`role="status"`) + use `HELP.remixLive`

### Wire remix feedback (if not already)

`useStudioStore.ts`: `mixerDirty`, clear on Generate + Reset.
`TransportBar.tsx`: pill `Hearing your tweaks` / `Tweaks ready — hit Play`.

### CSS `app.css`

`.stem-compact`, `.stem-compact-row`, `.remix-live` — calm, dense, 44px targets, fits mobile.

### Acceptance

- [ ] After Generate in Simple, strip visible without opening More
- [ ] Mute → pill/banner shows tweak feedback; Play rehears
- [ ] Generate→Play→Export still ≤3 clicks if strip ignored
- [ ] ZIP still dry

---

## P0.2 Param tweak → clear Regenerate affordance

When user changes Energy / Darkness / Chaos / style text / vibe intensity **after** a result, they must see how to hear a new render (params do not live-remix the arrangement — only stems do).

### Store `src/ui/hooks/useStudioStore.ts`

- `paramsDirty: boolean` — true when energy/darkness/chaos/prompt/bars/bpm/seed/vibeIntensity diverge from `lastRenderFingerprint`
- Set fingerprint snapshot at end of successful `generate`
- `setEnergy` / `setDarkness` / `setChaos` / `setPromptText` / `setVibeIntensity` / etc. flip dirty when `result` exists

### UI affordance

**Create** `src/ui/components/RegenAffordance.tsx` (or fold into Transport secondary row):

When `paramsDirty && result && !busy`:
- Visible bar under transport (hero): `Settings changed ·` **`Regenerate`** primary-ghost + optional **`Vary`**
- `Regenerate` = Again (same seed) → `generate()`
- `Vary` = new seed → `generate()`
- Copy HelpTips: `HELP.again` / `HELP.vary`
- Dismiss not required — clears when generate succeeds

Simple Mode: this bar is **on hero** (not More). It is not a 4th transport primary equal to Export — secondary row is OK.

ParamPanel (More): when dirty, inline hint `Regenerate to hear these knobs` linking focus to the affordance / calling generate.

### Acceptance

- [ ] Move Energy after result → Regenerate bar appears
- [ ] Click Regenerate → new sketch → dirty clears → Play pulse
- [ ] Stem mute does **not** set paramsDirty (that is mixerDirty only)
- [ ] No second owner gate; Surprise stays More-only

---

## Builder order

1. mixerDirty + Transport pill + Reset (listen-modify P0)
2. StemMixerCompact mount under Waveform (this P0.1)
3. paramsDirty + RegenAffordance (this P0.2)
4. cycle-5 jargon + a11y hotkey ignore (parallel OK)

Ping UX for hear→tweak→rehear + param→regenerate re-audit.
