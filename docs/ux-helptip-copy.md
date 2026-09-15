# HelpTip copy (living SoT mirror)
Source of truth: `src/ui/lib/helpCopy.ts`. Format: **What → When → What happens**.
A5 honesty: style descriptors **pass through** (not scrubbed). Soft-pass forbidden on “names scrubbed” tips.

| Key | Copy |
|-----|------|
| `styleRef` | What: Optional vibe from a track you own. When: Drop MP3/WAV before Generate (or skip). What happens: Biases mood — never clones the file. |
| `ownerCheck` | What: Your “I own this file” OK. When: Check before a drop attaches. What happens: Analysis stays in this browser — no catalog rips. |
| `vibeIntensity` | What: How strongly your upload nudges the sketch. When: After a Style Ref is attached. What happens: Low = light touch; High = stronger mood. Tempo stays ~174. |
| `energyNudge` | What: Fine-tunes how hard the drop hits. When: After vibe is applied; before next Generate. What happens: Higher = more drive. Applies on next Generate. |
| `darknessNudge` | What: Fine-tunes bass mood from your file. When: After vibe is applied; before next Generate. What happens: Higher = murkier bass. Applies on next Generate. |
| `hashPill` | What: Private session tag for the attached file. When: Power Mode with a Style Ref on. What happens: Shows which upload is active — nothing uploads. |
| `generate` | What: Builds a new drum & bass sketch here. When: Click Generate (G) anytime. What happens: Kick/snare/hats/bass near 174 BPM — original, not a clone. |
| `play` | What: Hear the mix preview in this browser. When: After Generate (Space). What happens: You listen; Space again stops, or Play again replays when it ends. |
| `stop` | What: Ends the mix preview. When: Click Stop or Space while playing. What happens: Playback stops; your sketch and mute/gain tweaks stay ready. |
| `exportZip` | What: Downloads a Sketch ZIP for your DAW. When: After you like it (E). What happens: Dry tracks + MIDI at 16|24; remixed Play adds mix_as_heard.wav. |
| `flowChips` | What: Progress chips only (not a checklist gate). When: Watch as you work. What happens: Idle → Generated → Played → Exported. Style Ref is never required. |
| `simpleMode` | What: Easy layout. When: Stay here for first runs. What happens: Style Ref → Generate → Play → Quick mute → Export. More hides extras. Product is still Sketch. |
| `powerMode` | What: Advanced layout. When: Flip to Power for deeper control. What happens: Engines, full mixer, section map, seed. Does not unlock Studio GPU by itself. |
| `productSketch` | What: Sketch — the product you have now. When: Always in this web app. What happens: CPU browser sound at ~174 BPM, 16-bit. Not Studio-quality AI. |
| `productStudio` | What: Studio — future GPU path. When: Needs a local GPU setup. What happens: Gated until ready; Generate stays on Sketch. No fake Studio audio. |
| `moreControls` | What: Extra knobs without leaving Simple. When: Open More anytime. What happens: Arrangement, stems, Surprise Me, status — main Generate/Play/Export stay put. |
| `badgeCpu174` | What: You are on Sketch (CPU) at ~174 BPM. When: Always in this build. What happens: That is the sound you hear now. Studio GPU later is not live here. |
| `badgeSketch16` | What: Sketch WAVs export at 16 or 24-bit. When: Pick depth under More/Export. What happens: Default 16-bit; 24-bit is still Sketch CPU — not Studio. |
| `badgeWebApp` | What: This is the web app build. When: You are in the browser. What happens: Files stay local; desktop shell comes after product modes. |
| `badgeAce` | What: Studio GPU path is live on this machine. When: Local GPU is online. What happens: Generate uses Studio ACE audio — still original, not a clone. |
| `studioGated` | What: Studio locked until local GPU is online. When: You open Studio without GPU. What happens: You still get Sketch audio — upgrade is honest. |
| `bpmLock` | What: Song tempo stays about 174 (classic drum & bass). When: Always on Generate. What happens: Upload may show another BPM — we do not force the song to match. |
| `energy` | What: How hard the drop hits. When: Move the slider, then Again or Vary. What happens: Higher = more drive. Mute/solo do not need this — only knobs do. |
| `darkness` | What: Bass mood. When: Move the slider, then Again or Vary. What happens: Higher = murkier, heavier bass. Changes bake in on the next render. |
| `chaos` | What: Fill and break density. When: Move the slider, then Again or Vary. What happens: Higher = more restless hats and edits. Bakes in on next render. |
| `seed` | What: A number that locks the song layout. When: Keep it to A/B knobs on the same skeleton. What happens: Same seed → same arrangement. Vary picks a new seed. |
| `styleText` | What: Free style words (deep bass, half-time, Pendulum-vibe…). When: Type mood or vibe words, then Generate / Again / Vary. What happens: Your words pass through as style descriptors — still no catalog rips or stem clones. |
| `stems` | What: Separate tracks (kick, snare, hats, bass). When: After Generate. What happens: Mute/Solo/Gain update Play live. ZIP keeps dry tracks (+ heard if remixed). |
| `stemMute` | What: Silences this part in Play. When: Click Mute after Generate. What happens: Preview updates live; dry ZIP track stays; remixed Export adds mix_as_heard. |
| `stemSolo` | What: Hear only this stem in Play. When: Click Solo after Generate. What happens: Preview updates live; dry ZIP stays; remixed Export matches Play. |
| `stemGain` | What: Loudness of this stem in Play (−24…+6 dB). When: Drag gain after Generate. What happens: Preview updates live; dry ZIP stays; remixed Export follows Play. |
| `waveform` | What: Loudness picture of the mix. When: Appears after Generate. What happens: Shows original render shape — if you remixed stems, trust your ears. |
| `sectionTimeline` | What: Song map (intro → drop). When: After Generate. What happens: Drag an edge or Expand/Repeat/×2, then Generate again to hear the longer part. |
| `timeline` | What: Song map (intro → build → drop…). When: After Generate. What happens: Shows how the sketch is paced so you know where you are. |
| `backendCpu` | What: Browser Sketch engine (CPU). When: Default in Simple / when Studio GPU is off. What happens: Generate works now — no GPU setup. |
| `backendGpu` | What: Studio GPU engine (richer sound later). When: Power → Backend if local GPU is live. What happens: Without GPU, you stay on Sketch. |
| `powerPanel` | What: Advanced Studio/Sketch controls. When: More or Power. What happens: Engines, export bit depth, style packs — Simple stays easy without these. |
| `powerCaps` | What: Plain-English engine limits. When: Power / More. What happens: Song length, stem rebuild plans, sample rates — no eng IDs. |
| `arrangement` | What: Knobs that change how the next sketch feels. When: Move a slider, then Regenerate or Vary. What happens: Mute/solo do not need Regenerate — knobs do. |
| `bpmPower` | What: Tempo stays near 174 (classic drum & bass). When: Only change if you want 170–176. What happens: Layout still locks measured tempo near 174 on render. |
| `backendSelect` | What: Chooses Sketch vs Studio engine. When: Power Mode. What happens: Sketch is ready now; Studio needs your local GPU setup. |
| `loraPack` | What: Optional style packs. When: Power Mode. What happens: Early packs for experiments; real training comes with Studio GPU later. |
| `aceModels` | What: ACE model sizes on your GPU PC. When: Power extras. Turbo = fast Generate now; Base later; XL needs more VRAM. What happens: Weights install outside the browser; this panel only shows status. |
| `statusPanel` | What: Ready / error / next-step messages. When: After Generate or if something looks off. What happens: Points you to Play, Export, or a fix. |
| `remixPreview` | What: Quick mute for key parts on the hero. When: After Generate. What happens: Play updates live — no Generate. ZIP keeps dry tracks + mix_as_heard if tweaked. |
| `vary` | What: New variation with a fresh layout (new seed). When: After a sketch, same vibe knobs. What happens: Different arrangement — still original DnB near 174. |
| `again` | What: Rebuild with same seed and current knobs. When: After Energy/Mood/Chaos changes. What happens: Same skeleton, new render. Use Vary for a fresh layout. |
| `remixLive` | What: Hearing mute/solo/volume tweaks live. When: After you remix stems. What happens: Keep listening or Export — ZIP adds mix_as_heard; dry tracks stay. |
| `favorites` | What: Saves this sketch’s settings in this browser. When: More → Favorites → Save after a sketch you like. What happens: Recall later — nothing uploads. |
| `favoritesAgain` | What: Loads a favorite and generates again. When: Click Again on a saved row. What happens: Same vibe rebuilt — original audio near 174 BPM. |
| `songShape` | What: The arc of the track (intro length, breakdown, double drop, dubstep feel). When: Before Generate. What happens: Changes section layout — not a second menu of knobs. |
| `layers` | What: Optional guitar / solo / vocal-ish / extra drums. When: After (or before) Generate. What happens: Adds original generative textures on next Generate/Vary — never artist stems. |
| `surpriseMe` | What: Random seed + mood template → new sketch. When: Under More (not on the main row). What happens: Fresh original near 174 BPM — then hit Play. |
| `favoritesVary` | What: Favorite knobs + new seed (slight variation). When: Click Slight variation on a saved row. What happens: Cousin of that sketch, then generates. |
| `glossaryStem` | What: Separate track = one part (kick/snare/hats/bass). When: In Play or Export. What happens: Dry = original ZIP file; mix_as_heard = remixed Play match. |
| `glossarySeed` | What: Number that locks song layout. When: Same seed + settings. What happens: Same arrangement. Vary picks a new seed. |
| `why174` | What: Classic energetic DnB sits near 174 BPM. When: Always here. What happens: Layout locks ~174 so drops feel right — upload BPM is not forced onto the song. |
| `playDisabled` | What: Play is locked. When: Before you Generate. What happens: Create a sketch first, then Play unlocks so you can hear the mix (Space). |
| `exportDisabled` | What: Export is locked. When: Before you Generate. What happens: Build a sketch first, then Export unlocks the ZIP for your music software (E). |
| `rehear` | What: Rehear your mute/solo/gain tweaks. When: After you change stems. What happens: Hit Play again — no Generate needed for stem changes. |
| `paramsVsMixer` | What: Knobs vs mute/solo. When: After a sketch. What happens: Knob changes need Regenerate/Vary; mute/solo/gain update Play live with no Generate. |
| `clearStyleRef` | What: Removes your Style Ref file. When: Click Clear on the vibe card. What happens: Upload detaches; knobs reset to defaults. Generate still works. |
| `exportHeardSingle` | What: One WAV of the mix you heard. When: After Generate (and optional mute tweaks). What happens: Downloads that preview mix — not the full dry-stem ZIP. |
| `paramsDirtyCue` | What: You changed arrangement knobs. When: This banner shows after a sketch. What happens: Regenerate (same seed) or Vary (new layout). Mute/solo skip this. |
| `waveformSeek` | What: Drag the wave to jump in the sketch. When: After Generate, while listening. What happens: Playhead moves; Drop is easy to find. |
| `sectionJump` | What: Jump to Intro/Build/Drop…. When: After a sketch exists. What happens: Playhead seeks that part so you can hear the Drop fast. |
| `mixerUndo` | What: Undo last mute/solo/gain. When: After a stem tweak. What happens: Mixer snaps back one step; Play follows live. |
| `firstPlayCoach` | What: Reminder to Play your new sketch. When: Right after your first Generate. What happens: Dismiss anytime; Play still works. |
| `exportDone` | What: Confirms Sketch ZIP contents. When: Right after Export. What happens: Reminds bit-depth + dry vs heard mix — still Sketch, not Studio. |
| `seedCopy` | What: Copy this sketch’s seed number. When: You want the same layout later. What happens: Seed hits the clipboard for paste/share. |
| `stemSoloHotkeys` | What: Keys 1–4 solo kick/snare/hats/bass. When: After Generate, not while typing. What happens: Preview solos that part live. |
| `holdBFlashback` | What: Hold B to hear the previous sketch. When: After you Generate again. What happens: Release B to return to the new one. |
| `waveformLoop` | What: Drag across the wave to loop a slice. When: After Generate. What happens: Esc clears; Space plays the loop. |
| `favoritesNudge` | What: Reminder to save a sketch you like. When: After your first Play. What happens: Opens a tip toward More → Favorites. |
| `againVaryHotkeys` | What: R rebuilds; V varies the layout. When: After a sketch, not while typing. What happens: Same as Again / Vary buttons. |
| `peakWarnExport` | What: Soft warning if the mix looks hot. When: On Export. What happens: Toast only — Export still runs. |
| `barBeatReadout` | What: Shows bar:beat and section under the wave. When: After Generate while you listen or scrub. What happens: Updates with the playhead. |
| `barNudge` | What: Step the playhead ±1 bar. When: After Generate — use ‹ › or , /. What happens: Jumps one bar on the wave; does not change the sketch. |
| `heardBadge` | What: Soft badge when Play hears your remix. When: After mute/solo/gain tweaks. What happens: Reminds Play matches tweaks; ZIP still keeps dry tracks. |
| `resumeDraft` | What: Restore last seed and knobs (no audio). When: After a prior Generate in this browser. What happens: Loads settings — hit Generate to rebuild. |
| `helpHotkey` | What: Open or close How it works. When: Press ? or H; Esc closes. What happens: Help opens without stealing G, Space, or E. |
| `waveformHoverTime` | What: Hover clock on the wave (mm:ss). When: After Generate, move over the wave. What happens: Shows exact time at that spot for scrubbing. |
| `sectionLoop` | What: Loop one section from Jump chips. When: Double-click a section chip after Generate. What happens: Sets a loop; single click still seeks. |
| `restorePrevious` | What: Bring back the previous sketch audio. When: After you Generate again (More/secondary). What happens: Swaps to the last take — hit Play to hear it. |
| `favoritesEmpty` | What: Empty Favorites tip toward Surprise Me. When: More → Favorites with nothing saved yet. What happens: Offers a fresh random sketch near 174. |
| `stemMuteHotkeys` | What: Shift+1–4 mutes kick/snare/hats/bass. When: After Generate, not while typing. What happens: Preview mutes that part live — no Generate. |
| `exportNamePreview` | What: Shows the ZIP file name on Export. When: You click Export. What happens: Toast names the file; dry stems (+ heard mix if remixed). |
| `exportBitDepth` | What: WAV bit depth for Sketch export. When: Power before Export. What happens: 16-bit default; 24-bit optional — still Sketch, not Studio GPU. |
| `clearLoop` | What: Clears the loop region on the wave. When: A loop is set (drag or section double-click). What happens: Esc or Clear stops looping; full sketch plays. |
| `dropWash` | What: Soft wash marks the Drop on the wave. When: After Generate with a Drop section. What happens: Visual cue only — seek, loop, and Play still work as usual. |
| `hotkeysSheet` | What: Shortcut list inside How it works. When: Open Help (? or H). What happens: Shows G/Space/E plus solos and R/V — no second hero strip. |
| `firstExportCoach` | What: Soft tip to Export your sketch. When: After first Play, near Export. What happens: Auto-fades; never stacks with the first-play coach. |
| `copySettings` | What: Copies seed + knobs as plain text. When: More → Arrangement after a sketch. What happens: Clipboard gets settings only — no audio file. |
| `sectionAnnounce` | What: Announces section changes for screen readers. When: Playhead enters Intro/Build/Drop…. What happens: Polite live update only — no toast clutter. |
| `loopEdges` | What: Drag loop edge handles on the wave. When: A loop is set. What happens: Trims loop ends; Esc still clears the whole loop. |
| `playAutofocus` | What: Focus moves to Play after Generate. When: A new sketch lands and you are not typing. What happens: Ready for Space; skips if HelpTip or typing. |
| `rehearPulse` | What: Play pulses after stem tweaks. When: mixerDirty and a sketch exists. What happens: Cue Play only — Generate never pulses for mute/solo/gain. |
| `emptyWaveformCta` | What: Empty wave points you to Generate. When: Before your first sketch. What happens: One tip only — no stacked coaches. |
| `postExportStrip` | What: Favorite / Again / Vary after Export. When: Under transport after a ZIP download. What happens: One low strip — save or rebuild without clutter. |
| `loopSectionHotkey` | What: L loops the section under the playhead. When: After Generate, not while typing. What happens: Sets a section loop; Esc clears. |
| `waveformZoom` | What: Z zooms the wave 2× around the playhead. When: After Generate on the waveform. What happens: Esc exits zoom; seek and loop still work. |
| `paramsWhatChanged` | What: Lists knobs you changed. When: Arrangement knobs diverge from the last sketch. What happens: Again or Vary — never pulses Generate for mute tweaks. |
| `stemLabelSolo` | What: Click a stem name (1–4) to exclusive-solo. When: Full mixer after Generate. What happens: Only that part plays; click again clears. |
| `sketchNotes` | What: sketch_notes.txt in the ZIP. When: Every Export. What happens: Seed, ~174 BPM, bars, knobs, depth — sketch honesty (original, no catalog rips). |
| `exportDawTip` | What: Reminder to open the ZIP in your DAW. When: Once after your first Export. What happens: Soft toast only; never stacks with coaches. |
| `sectionJumpLoopChip` | What: Loop chip on the Jump row. When: After Generate beside section chips. What happens: Loops the section under the playhead. |

## GLOSSARY_BLURBS

| Key | Blurb |
|-----|-------|
| `styleRef` | Your own file as vibe inspiration — never a clone. Optional. |
| `generate` | Build an original ~174 BPM browser sketch. Shortcut G. |
| `play` | Hear the mix preview in this browser. Shortcut Space. |
| `exportZip` | Download dry tracks at 16|24-bit (+ mix_as_heard if remixed). Shortcut E. |
| `exportBitDepth` | Sketch export WAV depth: 16 (default) or 24-bit — not Studio. |
| `mixAsHeard` | Extra WAV in the ZIP that matches what Play heard after mute/solo/gain. |
| `again` | Same seed — rebuild with current settings. |
| `vary` | New seed — fresh layout, same vibe knobs. |
| `browserSketch` | Sketch = CPU sound you hear now. Studio GPU later is not live here. |
| `productSketch` | Sketch product — CPU/browser now, 16-bit. |
| `productStudio` | Studio product — GPU/ACE later; gated until live. |
| `bpm174` | Song layout stays about 174 BPM (DnB). |
| `why174` | Why ~174? Classic energetic DnB tempo — layout stays locked here. |
| `rehear` | Hit Play again after stem tweaks — no Generate. |
| `playDisabled` | Play locked until you Generate. |
| `exportDisabled` | Export locked until you Generate. |
| `paramsVsMixer` | Knobs need Regenerate; mute updates Play live. |
| `exportHeardSingle` | One WAV of the mix you heard (not full ZIP). |
| `paramsDirtyCue` | Knobs changed — Regenerate or Vary to hear them. |
| `clearStyleRef` | Removes your Style Ref; Generate still works. |
| `waveformSeek` | Drag the waveform to jump in the sketch. |
| `sectionJump` | Jump playhead to Intro/Build/Drop… |
| `mixerUndo` | Undo last mute/solo/gain tweak. |
| `exportDone` | Confirms dry vs mix_as_heard in the ZIP. |
| `seedCopy` | Copy the numeric seed to clipboard. |
| `stemSoloHotkeys` | Keys 1–4 solo kick/snare/hats/bass in Play. |
| `holdBFlashback` | Hold B to hear the previous sketch. |
| `waveformLoop` | Drag the wave to loop a slice; Esc clears. |
| `favoritesNudge` | After Play, tip to save in Favorites. |
| `againVaryHotkeys` | R = Again, V = Vary (when not typing). |
| `peakWarnExport` | Soft toast if export mix looks hot — still exports. |
| `barBeatReadout` | Bar:beat and section follow the playhead. |
| `barNudge` | Step ±1 bar with ‹ › or , /. |
| `heardBadge` | Soft cue when Play hears remix tweaks. |
| `resumeDraft` | Restore last seed + knobs (no audio file). |
| `helpHotkey` | ? or H opens help; Esc closes. |
| `waveformHoverTime` | Hover the wave for mm:ss. |
| `sectionLoop` | Double-click a Jump chip to loop that section. |
| `restorePrevious` | Swap back to the previous sketch. |
| `favoritesEmpty` | Empty Favorites can launch Surprise Me. |
| `stemMuteHotkeys` | Shift+1–4 mute stems live. |
| `exportNamePreview` | Toast shows the ZIP file name on Export. |
| `clearLoop` | Clear the waveform loop region. |
| `dropWash` | Soft Drop highlight on the waveform. |
| `hotkeysSheet` | Shortcut list inside HelpPanel only. |
| `firstExportCoach` | Soft Export tip after first Play. |
| `copySettings` | Copy seed + knobs text from Arrangement. |
| `sectionAnnounce` | Screen reader notes section changes. |
| `loopEdges` | Drag loop edge handles on the wave. |
| `playAutofocus` | Focus moves to Play after Generate. |
| `rehearPulse` | Play pulses after stem tweaks — not Generate. |
| `emptyWaveformCta` | Empty wave points at Generate. |
| `postExportStrip` | Favorite / Again / Vary after Export. |
| `loopSectionHotkey` | L loops the current section. |
| `waveformZoom` | Z zooms the wave 2× around playhead. |
| `paramsWhatChanged` | Lists changed knobs — Again or Vary. |
| `stemLabelSolo` | Click stem name (1–4) to exclusive-solo. |
| `sketchNotes` | ZIP includes sketch_notes.txt. |
| `exportDawTip` | Once: open ZIP in your DAW tip. |
| `sectionJumpLoopChip` | Jump-row Loop chip for current section. |
