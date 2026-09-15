# UX — Player + length readability (Wyatt P0)

Soft-pass forbidden. Mute Channels stay green. No invent.

Clocks/`resolvePlaybackDuration` already in tree — tighten **readability + honesty**, don’t fork a second duration math.

## P0.1 — One readable clock story (Simple)

**Problem:** Transport + Waveform both show elapsed/total + bar/section → noisy; noob can’t find “how long is this.”

| Surface | Simple Mode |
|---------|-------------|
| Transport | **Compact only:** `0:12 / 0:48` (+ mismatch chip if any). Drop bar/section line here. |
| Waveform | **Full:** `0:12 / 0:48` + `bar · section` under playhead (scrub home). |
| Cold load | No clocks until `result`. |

Files: `TransportBar.tsx` (gate bar line `mode !== 'simple'`), `Waveform.tsx` keep full, `app.css` `.transport-clock` denser on Simple.

## P0.2 — Length before Generate

`SongShapePicker` already shows `N bars · ~m:ss` — keep.
After Expand (×2 / drag): toast must include **new** `~m:ss` from pending bars (not old mix length). Copy: `Arrangement ~1:24 on next Generate`.

## P0.3 — Keep seed off Simple hero

`Keep seed` next to Generate fights Vary/Again (“same every time”). Simple: move under **More** (or Power only). Default stays off.

## P0.4 — Stem HELP honesty (ACE shared mix)

`HELP.stems` still “Separate tracks / dry tracks” — FAIL on ACE shared-mix.
- Sketch / OfflineStub elementals: keep separate-tracks copy.
- ACE / shared mix blob: `Mute/Solo are preview-relative (shared mix until real stems)` — never “isolated stems.”

Wire via backend/gpuUsed or `result.provenance` flag Builder already has; don’t soft-claim isolation.

## Acceptance
- [ ] Simple: one obvious elapsed/total; section line only on waveform
- [ ] Shape + Expand show honest ~duration
- [ ] Keep seed not on Simple Generate row
- [ ] HELP never claims isolated stems on shared-mix ACE
- [ ] Same `resolvePlaybackDuration` everywhere — no second clock math

Builder order: P0.1 → P0.3 → P0.4 → P0.2 toast. Ping UX re-glance.
