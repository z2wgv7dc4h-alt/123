# Glossary (Simple + Power)

Living sync with `GLOSSARY_BLURBS` + HELP (What / When / What happens). Eng names stay in ARCHITECTURE / Power.

## Blurbs (SoT mirror)

| Key | Blurb |
|-----|-------|
| `styleRef` | Your own file as vibe inspiration — never a clone. Optional. |
| `generate` | Build an original ~174 BPM browser sketch. Shortcut G. |
| `play` | Hear the mix preview in this browser. Shortcut Space. |
| `exportZip` | Download dry tracks (+ mix_as_heard if remixed). Shortcut E. |
| `mixAsHeard` | Extra WAV in the ZIP that matches what Play heard after mute/solo/gain. |
| `again` | Same seed — rebuild with current settings. |
| `vary` | New seed — fresh layout, same vibe knobs. |
| `browserSketch` | CPU sound you hear now. Local GPU later is not live here. |
| `bpm174` | Song layout stays about 174 BPM (DnB). |
| `why174` | Why ~174? Classic energetic DnB tempo — layout stays locked here. |
| `rehear` | Hit Play again after stem tweaks — no Generate. |
| `playDisabled` | Play locked until you Generate. |
| `exportDisabled` | Export locked until you Generate. |
| `paramsVsMixer` | Knobs need Regenerate; mute updates Play live. |
| `exportHeardSingle` | One WAV of the mix you heard (not full ZIP). |
| `paramsDirtyCue` | Knobs changed — Regenerate or Vary to hear them. |
| `clearStyleRef` | Removes your Style Ref; Generate still works. |

## HELP glossary keys

| Key | Copy |
|-----|------|
| `glossaryStem` | What: Separate track = one part (kick/snare/hats/bass). When: In Play or Export. What happens: Dry = original ZIP file; mix_as_heard = remixed Play match. |
| `glossarySeed` | What: Number that locks song layout. When: Same seed + settings. What happens: Same arrangement. Vary picks a new seed. |
| `why174` | What: Classic energetic DnB sits near 174 BPM. When: Always here. What happens: Layout locks ~174 so drops feel right — upload BPM is not forced onto the song. |

## Why ~174?

See [WHY_174.md](WHY_174.md).

## New teaching terms (HELP)

| Term | Blurb / tip |
|------|-------------|
| Rehear | Hit Play again after stem tweaks — no Generate (`HELP.rehear`). |
| Play locked | Create a sketch first — then Play unlocks (`HELP.playDisabled`). |
| Export locked | Build a sketch first — then Export unlocks (`HELP.exportDisabled`). |
| Knobs vs mute | Knobs need Regenerate/Vary; mute/solo/gain update Play live (`HELP.paramsVsMixer`). |
| Download what I heard | One WAV of the preview mix — not the full dry-stem ZIP (`HELP.exportHeardSingle`). |
| Settings changed | Banner after knob edits — Regenerate or Vary (`HELP.paramsDirtyCue`). |
| Clear Style Ref | Removes upload; Generate still works (`HELP.clearStyleRef`). |

| Waveform seek | Drag the wave to jump in the sketch (`HELP.waveformSeek`). |
| Section jump | Jump playhead to Intro/Build/Drop (`HELP.sectionJump`). |
| Mixer undo | Undo last mute/solo/gain (`HELP.mixerUndo`). |
| First-Play coach | Reminder to Play after first Generate (`HELP.firstPlayCoach`). |
| Seed copy | Copy numeric seed to clipboard (`HELP.seedCopy`). |
| Export done tip | After Export: toast dry vs mix_as_heard; tip uses `HELP.exportDone`. |

| Solo hotkeys 1–4 | Solo kick/snare/hats/bass in Play (`HELP.stemSoloHotkeys`). |
| Hold-B flashback | Hold B to hear previous sketch (`HELP.holdBFlashback`). |
| Waveform loop | Drag wave to loop a slice; Esc clears (`HELP.waveformLoop`). |
| Favorites nudge | After first Play, tip toward Favorites (`HELP.favoritesNudge`). |
| R / V hotkeys | R = Again, V = Vary (`HELP.againVaryHotkeys`). |
| Peak warn export | Soft hot-mix warn toast on Export if peak ≥ threshold — Export still runs (`HELP.peakWarnExport`). |

| Bar:beat readout | Shows bar:beat + section under the wave (`HELP.barBeatReadout`). |
| Bar nudge | Step playhead ±1 bar (`HELP.barNudge`). |
| Heard badge | Soft cue when Play hears remix tweaks (`HELP.heardBadge`). |
| Resume draft | Restore last seed + knobs, no audio (`HELP.resumeDraft`). |
| Help hotkey | ? or H opens How it works (`HELP.helpHotkey`). |
| Hover time | mm:ss on wave hover (`HELP.waveformHoverTime`). |
| Section loop | Double-click Jump chip to loop section (`HELP.sectionLoop`). |
| Previous sketch | Restore previous take (`HELP.restorePrevious`). |
| Favorites empty | Empty Favorites → Surprise Me CTA (`HELP.favoritesEmpty`). |
| Shift+1–4 mute | Mute stems live (`HELP.stemMuteHotkeys`). |
| Export name preview | Toast shows ZIP file name on Export (`HELP.exportNamePreview`). |

---

## Modes

### Simple Mode
Easy path: **Generate → Play → Export** up front. Extra knobs live under **More**.
**Where:** header toggle (Simple / Power).

### Power Mode
Unlocks sound engines, optional style packs, full stem mixer, section map, and seed control. Same Generate → Play → Export spine.
**Where:** header toggle.

### More
Reveals arrangement, stems, status, Surprise Me, Favorites, and Power extras without leaving Simple.
**Where:** **More** control near the main transport.

## Style reference

### Style reference (your file)
Optional. Drop an **MP3/WAV you own** for mood/energy inspiration. Never a clone. Generate still works with no upload.
**Where:** “Your MP3 → this vibe” / style drop zone above Generate.

### Vibe bias
How strongly your file nudges energy / bass mood / feel. Tempo stays about **174** either way.
**Where:** vibe intensity + Energy / Darkness nudges on the style card.

### Owner check
Required before a file can attach. Confirms you own or have rights; analysis stays in this browser.
**Where:** checkbox on the style drop zone.

## Transport

### Generate
One click builds an original ~174 BPM browser sketch (not a clone). Shortcut **G**.
**Where:** primary **1 · Generate**.

### Play
Previews the mix in the browser (playback only — not the synth). Shortcut **Space**.
**Where:** primary **2 · Play**.

### Export ZIP
Downloads dry stem WAVs + manifest + MIDI. If you remixed mute/solo/gain, also adds **`mix_as_heard.wav`** matching what you heard. Shortcut **E**.
**Where:** primary **3 · Export**.

### Sketch vs Studio (retail)
**Sketch** is the product you have now: CPU / web app · **16-bit** · original ~174 BPM. **Studio** is the future GPU / ACE path (paid/upgrade when ready) — **gated** until a local GPU probe succeeds. Soft-pass forbidden: OfflineStub never reads as Studio-quality AI.
**Where:** header Sketch|Studio product switch + badges; Export Sketch ZIP labeling.

### Sketch vs future GPU
What you hear now is the **browser sketch** (CPU). A higher-quality **local GPU** path is planned for later — not available in this browser build until that setup is online.
**Where:** badges / Power Mode engine list (user docs say “browser sketch” / “local GPU later”).

## Arrangement

### Seed
Same seed → same song layout. Useful for A/B tweaks without changing the skeleton.
**Where:** Seed control under More / Power.

### Song layout
Hard-grid arrangement (intro → build → drop…). Structure owns the bars; the sound engine only fills timbre/stems.
**Where:** section map after Generate; Power arrangement panel.

### ~174 BPM lock
Product tempo stays about **174**. A vibe file may show its own estimated BPM on the card, but the song layout does not tempo-clone the upload.
**Where:** BPM badge / Power BPM (UI band 170–176 is display/control; render targets 174).

### Energy / Darkness (bass mood) / Chaos
Drive and weight · murkier bass character · fill/break busyness. These nudge the sketch; they are not artist clones.
**Where:** arrangement sliders under More / Power.

## Listen and modify

### Separate tracks
Kick, snare, hats, bass (and related) stems you can mute/solo/gain for preview.
**Where:** **Quick mute** on Simple hero; full **Stems** mixer under More.

### Dry ZIP
Export always keeps the original stem WAVs for your music software.
**Where:** inside the downloaded ZIP.

### mix_as_heard
**Glossary owns the long form** (HelpTips stay short).

When mute / solo / gain differs from the dry mix, **Export ZIP** also adds `*_mix_as_heard.wav` — the same DSP path as Play — so your download matches what you heard. Dry separate-track WAVs always stay in the ZIP for your music software.

- Clean mixer (no mute/solo/gain tweak) → no `mix_as_heard` entry.
- Remixed → dry stems + `mix_as_heard`.
- See [knowledge/mix-as-heard.md](knowledge/mix-as-heard.md).

**Where:** ZIP download after Export; tips under Export / Stems / Quick mute (`HELP.exportZip`, `HELP.stems`, `HELP.glossaryStem`).


### Again
Regenerates with the **same seed** and current settings.
**Where:** **Again** under transport after a result; **Regenerate** on the settings-changed banner.

### Vary
New seed → fresh song layout, same vibe settings.
**Where:** **Vary** under transport / settings-changed banner.

### Surprise Me
Rolls a fresh random seed + allowlisted mood template, then generates. Lives under **More** — not on the main Generate / Play / Export row.
**Where:** More → Param panel (**Surprise Me**).

### Favorites
Save/recall seed + settings locally in this browser (not uploaded). **Where:** under **More** — Favorites panel.

## Sound engines

### Sound engine (browser sketch)
The CPU path that works now — original sketch, no GPU required. User-facing name: **browser sketch**.
**Where:** default engine; Simple Mode always uses this until a local GPU path is online.

### Sound engine (local GPU later)
Future ACE-Step CUDA sidecar on an RTX 5080-class machine. Selecting it without that service fails with a clear message.
**Where:** Power Mode engine list only.

## Related docs
- [Noob guide](NOOB_GUIDE.md)
- [First 2 minutes](FIRST_RUN.md)
- [HelpTip map](ux-helptip-copy.md) (mirror of `src/ui/lib/helpCopy.ts`)
- [Acceptance](ACCEPTANCE.md) · [Architecture](ARCHITECTURE.md) (Power / eng)


## Live tweaks vs next Generate (honesty)

- **Live (instant):** stem **mute / solo / gain** only — Tone.Channel mid-play. No remux.
- **Next Generate:** Drive / Mood / Chaos, song shape, arrangement expand/×2, Guitar/Solo layers.
- **Guitar / Solo:** generative Sketch textures (and ACE prompt tags when Studio is live) — **not** ripped artist stems.
- **ACE vs Sketch:** Sketch = browser CPU hard-grid; Studio ACE = GPU timbre when bridge `:8766` reports GPU. Structure (sections/BPM) still comes from StructureEngine.
