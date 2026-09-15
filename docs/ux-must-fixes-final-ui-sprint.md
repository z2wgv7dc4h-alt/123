# FINAL UI sprint — Simple Mode P0 (Ableton/Spotify bar)

Wyatt: UI looks garbage. Soft-pass forbidden. **No invent. No ACE install.** CSS/React only.

## Diagnosis (Simple)

Too much chrome before Generate:
- 3 badges (Sketch path + Web app + Studio later) + dual layout toggles + product tier chrome
- flow-hint + HelpPanel + Style Ref + FlowStatusChips + transport + strips = noisy stack
- Status panel still on Simple hero path competes with transport
- Footer + tagline repeat the same story



## P0.0 — Simple stack order (critical)

Current Simple puts **StyleDropZone under Waveform** — feels like afterthought, kills “Your MP3 → this vibe”.

**Required order:**
1. Minimal header (1 badge + title + tagline + Simple/Power)
2. `StyleDropZone` (optional vibe)
3. `TransportBar` (Generate dominant)
4. Resume/PostExport/Regen only when relevant
5. `Waveform` + `StemMixerCompact` after result
6. `More` then collapsed `HelpPanel`

Hide on Simple cold load: `ProductTierPanel` (move to More), `FlowStatusChips` until result, Status grid until result/error.

## P0.1 — Kill badge clutter (`App.tsx`)

**Simple Mode badges: ONE only**

```tsx
{isSimple ? (
  <span className="badge">{studioLive ? 'Studio · GPU' : 'Sketch · 174 BPM'}</span>
) : ( /* keep Power badges */ )}
```

- Remove Simple `Web app` badge
- Remove Simple `Studio later` badge (story lives in tagline/footer once)
- Keep one HelpTip on the remaining badge max

## P0.2 — Header hierarchy (`App.tsx`)

- Tagline Simple → `Original drum & bass · 174 BPM · files stay local` (drop “Sketch product ·”)
- Collapse Layout + Product toggles: in Simple show **only** a single text button `More` / Power entry — move ProductTierPanel fully under More (if not already)
- If ProductTierPanel renders on Simple hero → **hide until More/Power**

## P0.3 — Dead chrome before Generate (`App.tsx`)

Order should feel: **Title → Style Ref → Transport → (after result) Waveform/Quick mute**

| Cut or demote | Action |
|---------------|--------|
| `flow-hint` | Hide in Simple (HelpPanel + numbered buttons enough) OR one short line only when `!result` |
| `FlowStatusChips` | Hide until `result` OR demote under transport as tiny |
| `HelpPanel` | Keep collapsed; don’t auto-open if first-run already seen |
| `coach-empty` | Keep **one** line; remove if HelpPanel open |
| `StatusPanel` in `simple-status` | Hide until `result` or error; or collapse to toast-only on Simple |
| `vibe-inspire-banner` | Merge into Style Ref ready card — don’t double banner |
| Footer | Simple: `Local · your files only` only |

## P0.4 — Transport affordance (`TransportBar.tsx` + `app.css`)

- Generate: larger hit (min-height 44px), full primary glow
- Play / Export: equal secondary until enabled; then Play gets pulse when next
- Stop: visually quieter (already partial)
- Hide Again/Vary/Download heard/bit-depth **until** `result` (if any show early, demote)
- Preview pill: human labels only; don’t dominate row
- Max one coach strip under transport at a time (mutex already — verify no FavoritesNudge + coach)

## P0.5 — CSS density pass (`app.css`)

```css
.app.simple {
  max-width: 880px; /* tighter focus */
  padding-top: var(--space-4);
}
.app.simple .header { margin-bottom: var(--space-2); }
.app.simple .badge-row { margin-bottom: 0; gap: 0.35rem; }
.app.simple .badge { font-size: 0.65rem; padding: 0.18rem 0.5rem; }
.app.simple .tagline { font-size: var(--font-sm); opacity: 0.9; max-width: 28rem; }
.app.simple .style-ref-panel { margin-bottom: var(--space-3); }
.app.simple .transport {
  padding: 1.05rem 1.15rem;
  gap: 0.65rem;
}
.app.simple .transport .btn-generate,
.app.simple .transport .btn.primary {
  min-height: 2.75rem;
  padding: 0.7rem 1.25rem;
  font-size: 1rem;
  font-weight: 700;
}
.app.simple .flow-chips { display: none; } /* or .app.simple.pre-result */
.app.simple .simple-status { display: none; } /* show only with result/error via class */
.app.simple .footer { opacity: 0.55; margin-top: var(--space-5); font-size: 0.72rem; }
```

Contrast: ensure `--muted` on badges isn’t washed out; primary button text pure white.

## P0.6 — Style Ref calm (`StyleDropZone` / CSS)

- One headline, one subline, owner check, drop zone — cut extra legal paragraph length
- Drop zone min-height ~6.5rem (not huge empty)
- Ready card: no duplicate “Inspired by YOUR file” if App also shows vibe-inspire-banner

## Acceptance

- [ ] Simple cold load: ≤1 badge, no flow-hint essay, transport dominates
- [ ] Generate is the loudest control on screen
- [ ] After Generate: Play pulse clear; Quick mute appears without More
- [ ] No invent features; no ACE install script changes
- [ ] Soft-pass forbidden — Wyatt should feel “product” not “lab”

## Builder order (5-min sprint)

1. App.tsx badge/tagline/flow-hint/Status demote
2. app.css Simple density block above
3. TransportBar quiet secondary until result
4. Dedupe vibe banners
5. Ping UX — then idle

UX will re-glance Simple cold load after land.

---

## Cold-load re-glance (2026-09-14) — FAIL (soft-pass forbidden)

Stack order **PASS**: 1 chip → Style Ref → Transport → (result) Waveform/stems; More holds tier/help. Flow chips / Status / ProductTier demoted correctly. Again/Vary / Download heard gated.

Still **FAIL** vs Ableton/Spotify bar:

### P0.7 — Hide empty Waveform on Simple cold load (`App.tsx` + `Waveform.tsx`)

Cold load still mounts empty waveform CTA (“Peaks appear…” + second Generate). Competes with hero Transport.

```tsx
// App.tsx — Simple: only after result
{result && <Waveform />}
{/* Power can keep empty Waveform if useful */}
{!isSimple && <Waveform />}
```

Or inside `Waveform.tsx`: `if (!result && mode === 'simple') return null;`

### P0.8 — Simple footer shorter (`App.tsx`)

Now: `Local Sketch · ${exportBitDepth}-bit · your files stay here`  
Required Simple: `Local · your files only`  
(bit-depth stays Power / under More)

### P0.9 — Density leftovers (`app.css`)

- `.app.simple { max-width: 880px; }` (still 960)
- Tagline Simple → `Original drum & bass · 174 BPM · files stay local` (drop long Generate→Play→Export echo)
- `.app.simple .footer { opacity: 0.55; font-size: 0.72rem; }`

### P0.10 — Vibe banner dedupe

If StyleDropZone ready-card already says inspired-by-your-file, drop App `vibe-inspire-banner` on Simple (or keep banner, cut card line — one story only).

## Acceptance (re-glance)

- [ ] Simple cold: no empty waveform chrome
- [ ] Footer one quiet line, no bit-depth
- [ ] max-width 880; tagline short
- [ ] One vibe story max
- [ ] Soft-pass still forbidden

Builder: land P0.7–P0.10 only. No invent. Ping UX. Then idle.

---

## Cold-load re-glance vs CoS tree (2026-09-14) — PASS

Checked App.tsx + Waveform + app.css after CoS FINAL land (Builder deferred to avoid overwrite).

| Check | Result |
|-------|--------|
| 1 honesty chip → Style Ref → Transport | PASS |
| Waveform / stems only after result (Simple) | PASS (`(result \|\| !isSimple)` + Waveform `simple && !result → null`) |
| More holds ProductTier + Help | PASS |
| Footer Simple `Local · your files only` | PASS |
| Tagline short | PASS |
| max-width 880 | PASS |
| Vibe banner demoted off Simple | PASS (`!isSimple && vibe`) |
| Flow chips / Status demoted | PASS |

Soft-pass forbidden — acceptance met. **No further UX PRs** (CoS freeze). Remaining product proof is ACE live on Wyatt’s PC, not Simple chrome.
