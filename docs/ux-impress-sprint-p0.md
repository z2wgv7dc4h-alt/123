# IMPRESS sprint — UX Simple P0 (10m, soft-pass forbidden)

One pass. No invent. No App.tsx stack-order rewrite (Style Ref → Transport holds).

## Already green (do not touch)
- Cold-load: 1 chip → Style Ref → Transport; Waveform/stems after result; More = tier/help
- Footer `Local · your files only`; max-width 880; Generate glass/glow CSS present

## Ship now (Builder <10m)

### 1. Dead chrome — kill Simple flow chips (`App.tsx`)
After gen, `FlowStatusChips` still competes with Play. Journey is the three buttons.

```tsx
// DELETE Simple branch:
// {isSimple && result && <FlowStatusChips />}
// Keep Power: {!isSimple && <FlowStatusChips />}
```

### 2. Generate → Play handoff (`TransportBar.tsx` + `app.css`) — Brainstormer delight
On Generate success (result lands, preview idle):
- Play: soft **1.2s** glow/pulse (class already `playPulse` / `accent pulse`) — ensure it fires once on new result
- `aria-live="polite"` status: **Ready — hit Play** (replace engineer “Generated” toast if any)
- `prefers-reduced-motion`: static accent outline only (no animation)

Files: `TransportBar.tsx` (+ toast/status if StatusPanel emits “Generated”); CSS already has `.app.simple .transport .btn-play.pulse` / `soft-pulse`.

### 3. Contrast nits (`app.css` only)
```css
.app.simple .honesty-chip.sketch {
  color: var(--text);
  border-color: rgba(154, 163, 184, 0.55);
  background: rgba(154, 163, 184, 0.12);
}
.app.simple .transport .btn-generate:disabled {
  opacity: 0.55; /* stay readable, not washed */
}
.app.simple .transport .btn-play:disabled,
.app.simple .transport .btn-export:disabled {
  opacity: 0.45;
}
```

## Acceptance
- [ ] Simple after Generate: no flow chips; Play is the loudest next control
- [ ] Screen reader / live region says Ready — hit Play
- [ ] vitest stays green; no ACE/script edits

Ping UX after land. Then idle.

---

## Re-glance (2026-09-14) — PASS

| Item | Result |
|------|--------|
| Simple flow chips removed | PASS (`App.tsx` Power-only) |
| Play glow-once 1.2s + aria-live Ready — hit Play | PASS (`playGlowOnce` + reduced-motion outline) |
| Chip contrast + disabled 0.55/0.45 | PASS (`app.css` IMPRESS block) |
| Simple stack order untouched | PASS |

Soft-pass forbidden — acceptance met. Idle.
