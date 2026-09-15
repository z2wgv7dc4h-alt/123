# RESEARCH DELTA — parked 2026-09-14 ~13:50 PT (Wyatt shutdown — do not auto-launch)

Source: Researcher PM routine. NEW vs morning 5080-pins.

## Finding
ACE Generate ignores Shape temporal script.
- Official: Caption = global; Lyrics = temporal (`[Intro]`/`[Build]`/`[Silence]`/`[Drop]`/`[Breakdown]`/`[Outro]`), not bare `[Instrumental]`.
- StructureEngine plans sections, but AceStepBackend POSTs structureRef without sections; ace_bridge_server hardcodes lyrics: "[Instrumental]".
- Also AceStepBackend hardcodes checkpointId: acestep-v15-turbo vs CANON/start-ace-stack acestep-v15-base.

## Change when Wyatt reopens pipeline
1. src/core/backends/AceStepBackend.ts — send structure.sections (name/startBar/lengthBars); checkpoint acestep-v15-base
2. sidecar/ace_bridge_server.py — map sections → instrumental lyrics tags; optional 1-bar [Silence] before first drop; fallback [Instrumental] only if no sections
3. Optional src/core/prompt/buildAceLyrics.ts — StructureEngine = MIDI/grid authority; lyrics = ACE temporal hints only

Fits STUDIO-QUEUE after snare/trap/drop-silence. Enables drop-silence + ACE prove quality.
