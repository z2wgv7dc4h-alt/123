# Wyatt DnB Studio

Phase 0 local-first studio. **Default: browser Sketch (CPU / OfflineStub).** Windows + RTX 5080 can enable **Studio ACE (GPU)** via one-shot install — only after `hasGpu: true` (prove live on your machine; do not soft-pass ACCEPTANCE).

## Simple Mode journey

1. **Style Ref (optional)** — Drop an MP3/WAV/FLAC **you own / have rights to** (file picker or drag-drop only — no YouTube, no URLs, no catalogs). Confirm ownership. Analysis stays in-browser; arrangement BPM stays **~174**. Generate still works with no upload.
2. **Generate** (`G`) — Hard-grid song layout + original kick / snare / hats / bass / mix WAVs (48 kHz, 16-bit).
3. **Play** (`Space`) — Mix preview in the browser (playback only — not the synth).
4. **Stem tweak (optional)** — Quick mute on the hero; full mute/solo/gain under More. Play updates live. Dry ZIP tracks never change.
5. **Again / Vary (optional)** — Again = same seed; Vary = new seed, same vibe. Ghosts after a result — not a 4th primary. Surprise Me under More.
6. **Export** (`E`) — ZIP: dry stem WAVs + manifest + MIDI. **If remixed**, also `mix_as_heard.wav` matching Play (same DSP path as preview).

≤3 clicks for Generate → Play → Export with no tweaks. Style Ref is never required.

Listen polish (cycle-9): Play autofocus after Generate; mixerDirty pulses Play (rehear); waveform loop edges + L section loop + Z zoom; post-export Favorite/Again/Vary strip; ZIP always includes `sketch_notes.txt` (seed/~174/knobs/honesty — style descriptors may include vibe words; still no catalog rips).

**Honesty:** original not clone · tempo ~174 · files stay local · sketch until GPU · remixed ZIP adds `mix_as_heard.wav` (dry stems stay).


## Windows one-shot (ACE)

On Wyatt’s RTX 5080 PC:

1. See `INSTALL.txt` or run `scripts\windows\INSTALL-AND-RUN.ps1`
2. Wait for models + bridge `:8766`
3. Generate uses Studio ACE only when probe `"hasGpu": true`; otherwise Sketch (CPU)

Full honesty table: [docs/TRY_ACE.md](docs/TRY_ACE.md). ACE stem lanes **share the mix** until LEGO/extract — use Sketch for true stem remix.

## Honest backends

| Path | Status |
|------|--------|
| **OfflineStub** (Sketch / CPU) | Default until probe `hasGpu: true` — real separate stems |
| **ACE-Step 1.5** (Studio / GPU) | Windows one-shot can go live when bridge probe `hasGpu: true`; fail-soft otherwise. Stem lanes share the ACE mix until LEGO/extract. |

Do **not** tick ACE/CUDA ACCEPTANCE until Wyatt proves live Generate on the 5080. See `INSTALL.txt`, [docs/TRY_ACE.md](docs/TRY_ACE.md), `sidecar/README.md`.

## Quick start

**Browser Sketch only:** `npm install` && `npm run dev` — open the printed URL.

**Windows + ACE:** `INSTALL.txt` / `scripts\windows\INSTALL-AND-RUN.ps1` (see [TRY_ACE.md](docs/TRY_ACE.md)).

## Docs / knowledge

| Doc | Purpose |
|-----|---------|
| [docs/NOOB_GUIDE.md](docs/NOOB_GUIDE.md) | Short walkthrough (this journey) |
| [docs/FIRST_RUN.md](docs/FIRST_RUN.md) | First 2 minutes + glossary links |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | Plain words for Simple + Power |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Structure / listen-modify / remix / export paths |
| [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) | Honest checkboxes (no soft-pass) |
| [docs/ux-helptip-copy.md](docs/ux-helptip-copy.md) | HelpTip catalog index |
| In-app `HelpPanel` + `HELP.*` | SoT: `src/ui/lib/helpCopy.ts` — opens once (`dnb-help-seen-v1`); Why ~174 in panel |
| [docs/WHY_174.md](docs/WHY_174.md) | Why ~174 BPM |
| [src-tauri/README.md](src-tauri/README.md) | Optional Tauri 2 shell (scaffold; browser primary) |
| [docs/SCREENSHOTS.md](docs/SCREENSHOTS.md) | Screenshot mindset + Simple sign-off sheet |

Also: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [LICENSE](LICENSE) (MIT).

## What works now (CPU)

- Vite + React + TypeScript UI (Simple + Power)
- Hard-grid song layout at ~174 BPM (`hard-grid-v0`)
- OfflineStub: real 48 kHz / 16-bit WAV stems + mix
- Tone/WebAudio preview of mix WAV only
- Style reference (Vibe Mirror v0) with ownership gate
- Stem mute/solo/gain → remixed Play; remixed Export adds `mix_as_heard.wav`
- Again / Vary; Simple quick-mute strip; Regen when settings change
- Surprise Me under More (allowlisted templates)
- Favorites under More (browser-local save/recall)
- Favorites panel under More (browser-local save/recall)
- AceStepBackend fail-soft GPU stub

## Not shipped yet

- LEGO stem extract/repaint / LoRA train; ACE live Generate **unproven until Wyatt’s 5080 run** (one-shot install in-tree)
- Tauri desktop **smoke** (src-tauri scaffold is in-tree; optional shell — browser Sketch still primary; no ACE/CUDA in base; ACCEPTANCE unchecked until desktop smoke)

## Legal boundaries (hard)

- Structure owns the grid. No artist-clone product / catalog rips; style text may pass vibe words (not scrubbed).
- Style Ref = **your** file only — no YouTube rips, no third-party catalog train/rip.
- OfflineStub never claims ACE stems from a reference.
- Forbidden in binary: ACE-Step-DAW / Strudel (AGPL), MusicGen NC, Matchering GPL, Pedalboard GPL, etc. (see ARCHITECTURE).

Feature notes: [docs/knowledge/](docs/knowledge/).
Why tempo: [docs/WHY_174.md](docs/WHY_174.md).
