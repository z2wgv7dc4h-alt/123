# UX must-fixes — Listen + Modify (USER PRIORITY)

Bar: after Generate, user can **hear**, **tweak**, **hear the tweak**, and **vary** without confusion. Soft-pass forbidden.

## Problem (current)

- Stem mute/solo/gain remixes preview in store, but **no clear UI feedback** that preview changed / is “dirty”
- Stem mixer buried under More (Simple) — listen→tweak loop is clumsy
- No first-class **Vary / Again** regenerate affordance
- Transport pill still raw `preview · {state}` — doesn’t say “Hearing your mix tweaks”

---

## P0 — Clear remix → preview feedback

### P0.1 Store: remix dirty flag

**File:** `src/ui/hooks/useStudioStore.ts`

- Add `mixerDirty: boolean` (true when any mute/solo/non-zero gain on remix stems)
- Recompute in `toggleMute` / `toggleSolo` / `setGainDb` (and reset `false` on successful `generate`)
- Optional: `previewRemixNote: string | null` set after `refreshPreviewAfterMixerChange` succeeds

### P0.2 Visible feedback chrome

| File | Change |
|------|--------|
| `TransportBar.tsx` | When `mixerDirty` && result: pill = `Hearing your tweaks` (playing) / `Tweaks ready — hit Play`. HelpTip `HELP.remixLive` |
| `StemMixer.tsx` | Banner when dirty: `Preview updated · download unchanged` + `Reset mix` button (clears mute/solo/gain) |
| `Waveform.tsx` | If peaks only from dry mix, add caption when dirty: `Waveform is the original render — listen for tweaks` OR recompute peaks from remixed buffer if cheap |
| `app.css` | `.remix-live` accent chip (cyan/green), subtle pulse once on dirty edge (respect reduced-motion) |

### P0.3 Toast (throttled)

On first dirty transition per result: one info toast from `HELP.remixLive` (don’t toast every slider tick — debounce / once-per-result).

---

## P0 — Transport listen loop

**File:** `TransportBar.tsx`

1. Human pill map (idle/loading/ready/playing/stopped + dirty variants)
2. While `playing` + dirty: Stop stays available; Play label can stay Play (replay)
3. After Generate: keep Play pulse until first play
4. Titles use HELP.* tone (no OfflineStub in Simple-facing strings)

---

## P1 — Stem tweaks within reach

### Simple Mode

**Files:** `App.tsx`, `StemMixer.tsx`

- After `result`, show a **compact remix strip** on the hero path (not only inside More):
  - Option A (preferred): `StemMixerCompact` under Waveform — kick/snare/hats/bass Mute only + “Open full mixer”
  - Option B: auto-open More’s stem `<details>` when result exists and user hits Play once
- Prefer A so ≤3-click Generate→Play→Export stays; tweaks are optional 4th+ actions

Compact row:
- 4 mute toggles + Reset + link `Full mixer`
- HelpTip `HELP.remixPreview`

### Power / More

- Full mixer as now; add **Reset mix** + dirty banner

---

## P1 — Regenerate / variation

**Files:** new `src/ui/components/VaryControls.tsx` (or Transport secondary row), `useStudioStore.ts`, `helpCopy.ts`

| Control | Placement | Behavior |
|---------|-----------|----------|
| **Again** | Ghost beside Generate after result (not a 4th primary) | `generate()` same seed/settings |
| **Vary** | Ghost beside Again | new seed (uint32) then `generate()`; keep vibe/energy/darkness/chaos/prompt |
| Surprise Me | More only (existing 11) | template+seed — do not duplicate on transport |

Copy: `HELP.again`, `HELP.vary` (already added in helpCopy.ts).

Rules:
- Never replace Export on the primary row
- Disable while `busy`
- Toast: `New variation ready — hit Play` / `Generated again — hit Play`

---

## P2 — Status honesty

**File:** `StatusPanel.tsx`

- Busy copy: drop OfflineStub jargon → `Creating your sketch…`
- Error tip: HELP.backend / badgeAce tone
- When mixerDirty: success line append `· preview has your tweaks (download unchanged)`

---

## Shipped this pass (2026-09-06)

- `mixerDirty` + transport remix pill + StemMixer banner + Reset + once-per-result toast
- Again / Vary ghosts under transport
- Simple `StemMixerCompact` under Waveform
- Waveform dirty caption; Status soft busy + dirty note
- Export: dry stems + optional `mix_as_heard.wav` via `renderRemixedWavBlob` (same glue path as preview)
- Tests: `mixer-dirty.test.ts`; suite green
- Surprise Me More-only UI (`SurpriseMe` in ParamPanel) + HelpTip

## Acceptance

- [x] Mute/solo/gain → user sees “Hearing your tweaks” / remix banner without reading docs
- [x] Reset mix returns dry preview + clears dirty
- [x] Again / Vary available after result; Surprise stays More-only
- [x] Simple can mute key parts without hunting (compact strip or equivalent)
- [x] Generate→Play→Export still ≤3 clicks with no tweaks
- [x] ZIP keeps dry stems; when dirty, also adds mix_as_heard.wav matching preview remix (copy updated)

## Builder order

1. mixerDirty + transport pill + stem banner + throttled toast (P0)
2. Again/Vary ghosts (P1)
3. Simple compact remix strip (P1)
4. Status copy soften (P2)
5. Waveform honesty caption (P0.2)

UX re-audits listen→tweak→hear loop on ping.
