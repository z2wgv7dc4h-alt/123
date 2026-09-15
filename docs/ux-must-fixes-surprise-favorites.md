# UX must-fixes — Surprise Me + Favorites (P0 next)

> **Status (2026-09-14 PT):** Style descriptors **pass through** (`scrubArtistNames` no-op). Historical “scrub + blocklist” lines below are outdated.


Listen-modify mostly signed off; close RegenAffordance mount first (see below). Soft-pass forbidden.

## Blocker before “full listen-modify PASS”

**File:** `src/App.tsx`

Mount `<RegenAffordance />` on hero under Transport (after `TransportBar` / before Waveform or immediately under vary-row). Component exists at `RegenAffordance.tsx` but is **unmounted** — paramsDirty cue never appears.

---

## P0 — Surprise Me (More only)

### Create `src/ui/components/SurpriseMeButton.tsx`

- Ghost button label: `Surprise me`
- HelpTip: `HELP.surpriseMe`
- onClick: pick allowlisted template descriptors + `seed = random uint32` + keep bpm 174 band + optional keep vibe → `generate({ variation: 'vary' })` or dedicated `surpriseMe()` in store
- **Placement:** inside More only — ParamPanel footer or PowerExtras-adjacent Simple More grid — **never** transport primary row
- Disable while `busy`; toast `Surprise ready — hit Play`
- Vitest: injectable RNG for seed

### Store (optional)

`surpriseMe(): Promise<void>` — sets prompt from allowlist templates (no artist names), new seed, generate.

### Acceptance

- [ ] Not on transport hero primaries
- [ ] 174 locked; scrub still runs
- [ ] HELP.surpriseMe wired

---

## P0 — Favorites (browser-local)

### Create `src/ui/components/FavoritesPanel.tsx` (More only)

- Save current fingerprint: seed, bpm, energy, darkness, chaos, prompt, vibeIntensity, vibe fileName (not file bytes unless small — prefer settings-only P0)
- List saved favorites; **Again** loads settings + generateAgain; optional **Vary** from favorite
- Storage: `localStorage` key `dnb-studio.favorites.v0` — never server
- HelpTip: `HELP.favorites` / `HELP.favoritesAgain`
- Empty state: `No favorites yet — save after a sketch you like`

### Placement

- More panel section below ParamPanel
- After Play success: optional one ghost `Save favorite` near Again/Vary row (**not** a 4th primary) — once per result max

### Acceptance

- [ ] Save/load round-trip in same browser
- [ ] No artist-clone; no upload
- [ ] Hero stays Generate→Play→Export clean

---

## Builder order

1. Mount RegenAffordance (listen-modify sign-off)
2. SurpriseMeButton in More
3. FavoritesPanel localStorage + Save ghost
4. UX re-audit
