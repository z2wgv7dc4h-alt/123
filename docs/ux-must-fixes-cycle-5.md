# UX must-fixes — cycle 5 (post P0 PASS · consumer polish)

Style Ref / HelpTip P0 **PASSED** re-audit. This cycle = leftover nits + noob polish. Soft-pass forbidden on copy tone.

## P0 — Copy tone leftovers (fast)

| File | Change |
|------|--------|
| `TransportBar.tsx` | Replace `title=` OfflineStub/ACE/sidecar jargon with HELP.* tone. ACE blocked: “Higher-quality engine needs a local GPU setup — switch engine in More, or use the browser sketch.” Generate default: “Creates an original sketch near 174 BPM (G).” Export title: “Downloads a ZIP for your music software (E).” |
| `TransportBar.tsx` | Preview pill: map `idle/loading/ready/playing/stopped` → `Ready to generate` / `Loading…` / `Ready to play` / `Playing` / `Stopped` |
| `TransportBar.tsx` | Shorten/remove `.transport-help` in Simple (tips already on buttons). Keep one line max if ACE blocked. |
| `StyleDropZone.tsx` | style-legal: `Optional. Drop a track you own — we bias mood and energy of an original sketch. Not a clone. No YouTube.` (drop “timbre”) |
| `App.tsx` Power flow-hint | Soften “ACE needs 5080 sidecar” → HELP.badgeAce / backend tone |

## P1 — Noob journey (N2/N3/N5 from Brainstormer, UX-gated)

| ID | File(s) | Change |
|----|---------|--------|
| N2 | ParamPanel, StemMixer, PowerExtras, SectionTimeline, Waveform, StatusPanel | `HelpTip` on every More `h2`; disabled controls explain why via ? or aria-describedby using HELP.* |
| N3 | `useStudioStore` export success / Toasts | One-time post-export tip: “ZIP downloaded — open it in your music software.” `sessionStorage` / store flag so it never nags |
| N5 | `App.tsx` | Single kbd strip: keep Power-only `.kbd-hint` OR fold into HelpPanel — never both + transport-help |

## P1 — Coach / empty

| File | Change |
|------|--------|
| `App.tsx` | Idle coach already good; ensure it hides when `result` OR after first Generate attempt; don’t show under vibe banner duplication |
| `StatusPanel.tsx` | Simple idle/success stay one-liners: Ready — hit Generate / Ready — hit Play; meta in details |
| `Waveform.tsx` | Empty dashed + HELP.waveform one-liner |

## P2 — Visual polish

| File | Change |
|------|--------|
| `app.css` | Style-ref h2 sentence-case ~1.2rem (if still uppercase-squashed) |
| `app.css` | `.app.simple` max-width ~960px; transport Generate slightly larger hit |
| `FlowStatusChips.tsx` | Ensure only `.next` pulses; Style never looks required |
| Footer | `Local · original sketches · your files only` |

## Out of scope here

- Surprise Me (11) — **shipped More-only** (`SurpriseMe` in ParamPanel; uses setters + `vary()`; not on hero)
- Favorites — still later / More-only; not started
- Stem hotkeys (15) — after 11
- Second owner gate — forbidden

## Acceptance

- [ ] No OfflineStub/sidecar/stems-speak in Simple-visible titles/help
- [ ] Human preview pill
- [ ] N3 fires once
- [ ] One shortcut surface
- [ ] ≤3-click spine intact

## Builder order

1. Transport/Style copy + pill (P0)
2. N5 dedupe shortcuts
3. N3 one-time export tip
4. N2 More h2 tips
5. P2 CSS polish
