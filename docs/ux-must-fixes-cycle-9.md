# UX must-fixes — cycle 9 (no screenshot dependency)

Cycle-8 **SIGNED**. Cycle-9 Builder gate **SIGNED** (code-level; no soft-pass).
**S1–S10 screenshots:** held for Wyatt/defer — **not part of this cycle’s Builder gate**.

## P0 — Invent-hotkey QA + #76–81 — LANDED

Placement locks held:

| Rule | Detail |
|------|--------|
| Play-adjacent only | mixerDirty pulses **Play** only (#78) — never Generate |
| Coach mutex | Waveform empty CTA owns empty tip (#79); first-play/export coaches unchanged; DAW tip mutex (#86) |
| One strip | PostExportStrip under transport (#80); ResumeDraft hides when result exists |
| Hotkeys | L/Z added; G/Space/E untouched; ignore typing/HelpTip |
| HELP | What/When/What happens ≤~160; ux-helptip-copy.md synced |

Landed order: #77 → #78 → #76 → #81 → #79 → #80.

## P0 — Invent #82–87 — LANDED

| ID | Status |
|----|--------|
| #86 DAW tip once-flag | Landed (`dnb-export-daw-tip-v1`) |
| #83 What-changed chip | Landed (RegenAffordance) |
| #84 Stem-label exclusive solo | Landed (digits 1–4 on kick/snare/hats/bass + Keys SoT) |
| #87 Jump-row Loop chip | Landed |
| #82 Waveform Z zoom 2× | Landed |
| #85 sketch_notes.txt | Landed in every ZIP |

## P1 — Banner density

At most one transient coach visible. Vibe inspire banner OK with low-profile ResumeDraftStrip / PostExportStrip.

## P2 — Deferred (not this gate)

- Real S1–S10 captures
- ACE/GPU Studio path
- Tauri desktop shell

## Acceptance (cycle-9)

- [x] #76–81 after invent-hotkey green; never pulse Generate on mixerDirty
- [x] Coach mutex holds with new coaches/toasts
- [x] #82–87 respect placement + stem digit rule
- [x] ≤3-click spine unchanged
- [x] No screenshot requirement to close cycle-9

## Builder order (done)

1. invent-hotkey QA green (#64–69 ticked)
2. #76–81
3. #82–87
4. Unit+tsc+vite green — UX re-audit (code-level) ready; shots separate
