# UX must-fixes — cycle 4 (consumer bar · soft-pass forbidden)

Re-audit after cycle-3 CSS land: **tips still broken**, hero tips **regressed**, fonts missing.

## P0 — Fix broken HelpTip system (ship first)

### P0.1 Unify API in `HelpTip.tsx`

Call sites use `label` (body) + `ariaLabel`. Component requires `text` and uses `label` as aria.
`ParamPanel` imports `LabelWithTip` which **does not exist** in `HelpTip.tsx` → build break.

**Replace** `src/ui/components/HelpTip.tsx` with:

```tsx
export type HelpTipProps = {
  text?: string;
  /** Body copy alias used by current call sites */
  label?: string;
  ariaLabel?: string;
  className?: string;
};

export function HelpTip({ text, label, ariaLabel, className = '' }: HelpTipProps) {
  const body = (text ?? label ?? '').trim();
  const aria = ariaLabel ?? (text ? (label ?? 'More info') : 'More info');
  // render ? with body in bubble; if !body return null
  // Escape closes; pointer-down outside closes; keep click toggle for touch
}

export function LabelWithTip({
  tip, tipLabel, children,
}: { tip: string; tipLabel?: string; children: React.ReactNode }) {
  return (
    <span className="label-with-help">
      {children}
      <HelpTip text={tip} ariaLabel={tipLabel ?? 'More info'} />
    </span>
  );
}
```

### P0.2 Restore hero-path tips (regression)

| File | Restore |
|------|---------|
| `TransportBar.tsx` | ? beside Generate / Play / Export / Stop (plain English, no Tone.js jargon for noobs) |
| `App.tsx` | ? on Power toggle + More controls; optional on CPU badge |
| `StyleDropZone.tsx` | ? on h2, owner checkbox, vibe intensity, energy/darkness |
| `FlowStatusChips.tsx` | one ? for progress meaning |

### P0.3 Fonts

`index.html` `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

(Or self-host woffs in `public/fonts` if offline-first preferred.)

### P0.4 Typecheck gate

`npx tsc --noEmit` must pass — no missing `LabelWithTip`, no missing `text` props.

---

## P1 — Premium visual system (`app.css`)

### Design tokens

```css
:root {
  --font-sans: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;
  --space-1: 0.25rem; --space-2: 0.5rem; --space-3: 0.75rem;
  --space-4: 1rem; --space-5: 1.5rem; --space-6: 2rem;
  --text-xs: 0.75rem; --text-sm: 0.875rem; --text-md: 1rem;
  --text-lg: clamp(1.5rem, 2.5vw, 2rem);
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --dur: 180ms;
}
body { font-family: var(--font-sans); }
```

### Hierarchy / spacing

| Selector / file | Change |
|-----------------|--------|
| `.app.simple` | `max-width: 960px`; vertical gaps `--space-3/4` |
| `.header h1` | `--text-lg`, tracking -0.01em, weight 700 |
| `.tagline` | `--text-sm`, max-width 34rem |
| `.style-drop-head h2` | **sentence-case hero** 1.2rem, weight 700, no uppercase squash |
| `.style-drop-zone` | min-height 7.5rem; calm cyan idle glow; focus-visible ring |
| `.transport` | keep hero; Generate dominant; Stop optical secondary |
| `.btn.primary` | slightly larger padding in Simple |
| `.flow-chip.next` | only next step pulses; `prefers-reduced-motion: none` |
| `.help-tip-bubble` | z-index 80; 0.82rem line-height 1.4; shadow like Spotify sheet |
| Badge | Simple: rename `Browser prototype` → `Web app` |

### Motion

- Panel/toast/dropzone transitions: opacity+transform `--dur` `--ease`
- No extra infinite animations beyond gen-progress + single next pulse

---

## P1 — Empty states (product copy)

| File | Copy |
|------|------|
| App idle coach | `Hit Generate — or drop your track above (optional).` |
| Status idle | `Ready — hit Generate.` |
| Status success | `Ready — hit Play.` |
| Waveform empty | `Waveform appears after Generate.` |
| Transport pill | `Ready to play` / `Playing` / `Stopped` (not raw enum) |

---

## P2 — Coverage leftovers

- PowerExtras every gated control gets ?
- StemMixer already partially wired — fix props after P0.1
- Hide vibe hash pill in Simple
- Footer: `Local · original sketches · your files only`
- Kill duplicate transport-help paragraph once tips restored

---

## Acceptance (Ableton/Spotify bar)

- [ ] `tsc` clean; every HelpTip shows body text
- [ ] Generate/Play/Export/? work on hero
- [ ] Style Ref h2 reads as product headline, not lab label
- [ ] IBM Plex visibly loaded
- [ ] Simple ≤3 clicks; optional upload; ownership gate intact
- [ ] Feels shipped product, not prototype demo

## Builder order

1. P0.1 HelpTip + LabelWithTip API
2. P0.2 restore Transport/App/StyleDropZone tips
3. P0.3 fonts + P0.4 tsc
4. P1 tokens/hierarchy/motion
5. P1 empty-state copy
6. P2 leftovers

UX re-audits the second P0 is green.
