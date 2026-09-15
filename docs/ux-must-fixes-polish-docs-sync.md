# UX must-fixes — consumer polish + living Help/Docs sync

Equal priority with features. Soft-pass forbidden. No jargon for noobs on Simple surfaces.

## P0 — Living knowledge sync (HelpPanel + HELP.* + Docs)

**Rule:** `src/ui/lib/helpCopy.ts` (`HELP.*`) is SoT for tip strings. HelpPanel + Status idle/busy + Transport help must paraphrase HELP, not invent eng jargon. Sync `docs/ux-helptip-copy.md` whenever HELP changes.

### P0.1 Rewrite `HelpPanel.tsx` (Simple-facing)

Replace StructureEngine / OfflineStub / Tone / stems / StructureMap / sidecar dump with:

```
How it works · 3 clicks
0 · Your MP3 → this vibe (optional) — drop a track you own; biases vibe; still ~174 BPM; not a clone
1 · Generate (G) — builds an original browser sketch
2 · Play (Space) — hear the mix preview
3 · Export ZIP (E) — download for your music software (adds mix_as_heard if you remixed)

Better sound later: local GPU setup in Power. No YouTube / artist clones.
Tips: same seed → same song layout · ? tips on controls · mute/solo update Play live
```

### P0.2 De-jargon Simple Status / Transport

| File | Change |
|------|--------|
| `StatusPanel.tsx` | Busy: `Creating your sketch…` — kill OfflineStub/sidecar in Simple idle/error tips |
| `TransportBar.tsx` | transport-help: HELP tone only; drop “stems” → “tracks / download” |
| `helpCopy.ts` | Soften remaining Simple-visible: `styleRef` drop “timbre”; `play` drop “Tone”; `badgeCpu174` keep GPU note short for Power badge only |

### P0.3 Docs sync

Update `docs/ux-helptip-copy.md` table to match current HELP.* (including remixLive, again, vary, favorites, surpriseMe, mix_as_heard). Add one line to `docs/ACCEPTANCE.md` or SCREENSHOTS: “In-app help SoT = helpCopy.ts”.

---

## P0 — Consumer visual polish (`app.css` + chrome)

### Typography / spacing

| Target | Change |
|--------|--------|
| `.app.simple` | `max-width: 960px`; consistent `--space-*` vertical rhythm between Style Ref → chips → transport → regen → waveform → stem-compact |
| `.style-drop-head h2` | ~1.15–1.25rem, weight 700, sentence case (not tiny uppercase lab label) |
| `.stem-compact-title` | Match section title weight; letter-spacing normal |
| `.header h1` | Keep clamp; tracking -0.01em |
| Tagline | `--text-sm`, muted, max 34rem |

### Transport / stem strip / regen beauty

| Target | Change |
|--------|--------|
| `.transport` | Keep hero glow; Generate slightly larger padding in Simple |
| `.vary-row` | Quieter than primary row (opacity/weight); don’t compete with Generate |
| `.stem-compact` | Glass panel align with Style Ref; 44px mute targets; clear separation from waveform |
| `.regen-affordance` | Pulse border once when appearing (reduced-motion: none); sit tight under transport |
| `.pill.remix-live` | Keep; ensure readable on transport purple |

### Motion / empty / toasts

| Target | Change |
|--------|--------|
| Next-action | Play pulse only when needed; chips `.next` only |
| `.coach-empty` | One card; auto-hide with result (already); tighten padding |
| Toasts | Cap stack 3; success short; no eng codes |
| `prefers-reduced-motion` | stem/regen/remix animations off |

### Footer

`Local · original sketches · your files only`

---

## Still ship (from prior cycles, if open)

1. Surprise Me / Favorites — `docs/ux-must-fixes-surprise-favorites.md` (More only)
2. Confirm `RegenAffordance` mounted under transport (tree shows import — verify visible when paramsDirty)

## Builder order

1. HelpPanel + Status/Transport de-jargon + helptip-copy.md sync
2. CSS Simple rhythm + stem-compact/transport/regen polish
3. Footer + toast/empty tighten
4. Surprise/Favorites P0
5. UX screenshot QA pass

## Acceptance

- [ ] HelpPanel has zero OfflineStub/StructureEngine/Tone/StructureMap for noobs
- [ ] HELP.* and HelpPanel and ux-helptip-copy.md agree
- [ ] Simple feels product-spaced at 1280 and mobile width
- [ ] Stem strip + regen bar look intentional, not bolted on
