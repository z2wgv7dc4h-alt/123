# Screenshot notes (docs)

Capture these for README / release notes when a display is available (Phase 0 browser prototype):

1. **Header** — badges: CPU sketch · 174 (Simple); Power adds 16-bit Phase 0 · 48 kHz · browser sketch · ACE / RTX 5080 later; Simple / Power toggle.
2. **Transport** — numbered flow: **1 · Generate** → **2 · Play** → **Stop** → **3 · Export ZIP**; preview pill; kbd hint (G / Space·K / E).
3. **Section timeline** — colored intro → build → drop → break → outro segments with bar lengths + BPM/seed meta (empty-state before Generate).
4. **Stem mixer** — kick / snare / hats / bass / drums / mix with M/S and durations after render.
5. **Status panel** — idle `.empty-state` before Generate; success microcopy + job/backend/BPM meta after.
6. **Arrangement** — BPM band, seed + shuffle, Energy / Darkness / Chaos sliders, style text (genre only).
7. **Power Mode** — backend chips, ACE model slots disabled, LoRA fail-soft callout.

Avoid artist names in any prompt text visible in shots. Prefer dark UI at ~1120px wide.

---

## Screenshot mindset / sign-off sheet (Simple journey)

Use this checklist before calling screenshots “done.” Soft-pass forbidden.

### Mindset

- Shoot the **noob path**, not eng chrome: Style Ref (optional) → Generate → Play → quick mute → Export.
- Prefer **1280×800** desktop + **390** width mobile (or narrow pane). Tips must not clip.
- No hero clutter; no Surprise Me on the primary transport row.
- No OfflineStub / hard-grid-v0 / sidecar jargon in Simple-facing chrome in-frame.
- Files stay local story visible (owner check / “your files” — not YouTube).

### Sign-off sheet (tick only what the frame proves)

| # | Frame | Pass? |
|---|--------|-------|
| S1 | Idle Simple: HelpPanel “How it works · 3 clicks” readable; Why ~174 line present; coach empty-state points at Generate | [ ] |
| S2 | Style Ref drop zone optional; owner check; no gate before Generate | [ ] |
| S3 | Transport: **1 · Generate** dominant; Play/Export locked until after Generate | [ ] |
| S4 | After Generate: Play unlocked; success toast short; waveform or timeline visible | [ ] |
| S5 | Quick mute on hero; “Hearing your tweaks” / live preview without Regenerate | [ ] |
| S6 | Export ZIP affordance; remixed path mentions mix_as_heard only when remixed | [ ] |
| S7 | HelpTip (?) open at **390** — bubble fully on-screen | [ ] |
| S8 | HelpTip (?) open at **1280** (edge badge / transport) — bubble fully on-screen | [ ] |
| S9 | First-run: HelpPanel open once; after dismiss or Generate it stays closed on reload | [ ] |
| S10 | Power-only: softened “browser sketch” / “song layout ~174” — no OfflineStub / hard-grid-v0 | [ ] |

> **Capture deferred .** S1–S10 stay unchecked until real frames are shot. Soft-pass forbidden — do not invent greens or tick from chrome alone. Not a Builder gate for cycle-9.

### Do not ship shots that show

- Raw OfflineStub / StructureEngine / CUDA /probe strings in Simple Mode.
- Clipped tip bubbles or toasts overflowing the viewport.
- New gates or Surprise Me as a 4th primary before Generate.


---

## Cycle-7 re-audit checklist (must hit before ping)

Shoot **1280×800** and **390** width. Soft-pass forbidden.

| Check | Pass? |
|-------|-------|
| Style Ref headline sentence-case product hero (“Your MP3 → this vibe”) | [ ] |
| Transport **1 · Generate** visually dominant | [ ] |
| Stem-compact quick mute readable (not cramped) | [ ] |
| Tip focus ring on Generate + `?` | [ ] |
| Tip bubbles not clipped at 1280 and 390 | [ ] |
| `prefers-reduced-motion` — no distracting pulse storms | [ ] |
| Power footer/badge: no `hard-grid-v0` / `OfflineStub` user strings | [ ] |
| First-play coach Play-adjacent only (not Style Ref banner) | [ ] |
| Toast stack ≤3 visible | [ ] |


---

## Cycle-7 polish checklist (Builder)

Tick before calling screenshot pass done:

| Check | Pass? |
|-------|-------|
| Frames at **1280** and **390** (tips fully on-screen) | [ ] |
| Style Ref hero headline sentence-case; optional, no gate | [ ] |
| Transport **1 · Generate** visually dominant | [ ] |
| Stem-compact Quick mute on Simple after Generate | [ ] |
| HelpTip **?** focus ring visible when focused | [ ] |
| `prefers-reduced-motion`: no pulse spam on Generate/Play | [ ] |
| Toast stack ≤3; no OfflineStub / hard-grid-v0 in Simple chrome | [ ] |
| Sketch vs Studio labels honest (Sketch = browser CPU / 16-bit; Studio = local GPU when ready) | [ ] |
