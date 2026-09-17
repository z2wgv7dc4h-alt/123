/** Central HelpTip copy — import HELP.* only; do not invent tip strings in components.
 * Every tip: What: → When: → What happens: (plain English for noobs). Prefer ≤160 chars on Simple tips.
 */

export const HELP = {
  styleRef:
    'What: Optional reference you own. When: Drop before Generate. What happens: Sketch maps mood only; Studio shapes the sound from it. Original, not a copy.',
  ownerCheck:
    'What: Your “I own this file” OK. When: Check before a drop attaches. What happens: Required before the file is used. Audio goes to your local GPU only.',
  vibeIntensity:
    'What: How strongly your upload steers the result. When: After a Style Ref is attached. What happens: Low = light touch; High = stronger. Tempo stays ~174.',
  energyNudge:
    'What: Fine-tunes how hard the drop hits. When: After vibe is applied; before next Generate. What happens: Higher = more drive. Applies on next Generate.',
  darknessNudge:
    'What: Fine-tunes bass mood from your file. When: After vibe is applied; before next Generate. What happens: Higher = murkier bass. Applies on next Generate.',
  hashPill:
    'What: Private session tag for the attached file. When: A Style Ref is on. What happens: Shows which upload is active — nothing uploads.',
  generate:
    'What: Builds a new drum & bass sketch here. When: Click Generate (G) anytime. What happens: Kick/snare/hats/bass near 174 BPM — original, not a clone.',
  play:
    'What: Hear the mix preview in this browser. When: After Generate (Space). What happens: You listen; Space again stops, or Play again replays when it ends.',
  stop:
    'What: Ends the mix preview. When: Click Stop or Space while playing. What happens: Playback stops; your sketch and mute/gain tweaks stay ready.',
  exportZip:
    'What: Downloads a Sketch ZIP for your DAW. When: After you like it (E). What happens: Dry tracks + MIDI at 16|24; remixed Play adds mix_as_heard.wav.',
  flowChips:
    'What: Progress chips only (not a checklist gate). When: Watch as you work. What happens: Idle → Generated → Played → Exported. Style Ref is never required.',
  productSketch:
    'What: Sketch — the product you have now. When: Always in this web app. What happens: CPU browser sound at ~174 BPM, 16-bit. Not Studio-quality AI.',
  productStudio:
    'What: Studio — future GPU path. When: Needs a local GPU setup. What happens: Gated until ready; Generate stays on Sketch. No fake Studio audio.',
  badgeCpu174:
    'What: You are on Sketch (CPU) at ~174 BPM. When: Always in this build. What happens: That is the sound you hear now. Studio GPU later is not live here.',
  badgeSketch16:
    'What: Sketch WAVs export at 16 or 24-bit. When: Pick depth under More/Export. What happens: Default 16-bit; 24-bit is still Sketch CPU — not Studio.',
  badgeAce:
    'What: Studio GPU path is live on this machine. When: Local GPU is online. What happens: Generate uses Studio ACE audio — still original, not a clone.',
  studioGated:
    'What: Studio locked until local GPU is online. When: You open Studio without GPU. What happens: You still get Sketch audio — upgrade is honest.',
  bpmLock:
    'What: Song tempo. When: Before Generate. What happens: 174 = drum & bass, 140 = dubstep, 85 = half-time. Applies on next Generate.',
  energy:
    'What: How hard the drop hits. When: Move the slider, then Again or Vary. What happens: Higher = more drive. Mute/solo do not need this — only knobs do.',
  darkness:
    'What: Bass mood. When: Move the slider, then Again or Vary. What happens: Higher = murkier, heavier bass. Changes bake in on the next render.',
  chaos:
    'What: Fill and break density. When: Move the slider, then Again or Vary. What happens: Higher = more restless hats and edits. Bakes in on next render.',
  seed:
    'What: A number that locks the song layout. When: Keep it to A/B knobs on the same skeleton. What happens: Same seed → same arrangement. Vary picks a new seed.',
  styleText:
    'What: Free style words (deep bass, half-time, Pendulum-vibe…). When: Type mood or vibe words, then Generate / Again / Vary. What happens: Your words pass through as style descriptors — still no catalog rips or stem clones.',
  stems:
    'What: Separate tracks (kick/snare/hats/perc/bass). When: After Generate. What happens: Mute/Solo/Gain update Play live; drums/mix are buses ZIP keeps dry',
  stemsSharedMix:
    'What: Mute/Solo are preview-relative (shared mix). When: After Studio ACE Generate. What happens: Not isolated stems — tweaks shape Play only.',
  stemMute:
    'What: Silences this part in Play. When: Click Mute after Generate. What happens: Preview updates live; dry ZIP track stays; remixed Export adds mix_as_heard.',
  stemSolo:
    'What: Hear only this stem in Play. When: Click Solo after Generate. What happens: Preview updates live; dry ZIP stays; remixed Export matches Play.',
  stemGain:
    'What: Loudness of this stem in Play (−24…+6 dB). When: Drag gain after Generate. What happens: Preview updates live; dry ZIP stays; remixed Export follows Play.',
  waveform:
    'What: Loudness picture of the mix. When: Appears after Generate. What happens: Shows original render shape — if you remixed stems, trust your ears.',
  sectionTimeline:
    'What: Song map (intro → drop). When: After Generate. What happens: Drag an edge or Expand/Repeat/×2, then Generate again to hear the longer part.',
  expandSection:
    'What: Expand section +8 bars. When: Click Expand on a section. What happens: Only this section changes; same seed; rest of song stays.',
  repeatSection:
    'What: Repeat section after itself. When: Click Repeat on a section. What happens: Only this section changes; same seed; rest of song stays.',
  dropX2:
    'What: Double drop section length. When: Click ×2 on drop section. What happens: Only this section changes; same seed; rest of song stays.',
  backendCpu:
    'What: Browser Sketch engine (CPU). When: Default / when Studio GPU is off. What happens: Generate works now — no GPU setup.',
  backendGpu:
    'What: Studio GPU engine (richer sound later). When: More → Audio path if local GPU is live. What happens: Without GPU, you stay on Sketch.',
  powerPanel:
    'What: Advanced Studio/Sketch controls. When: Under More. What happens: Engines, export bit depth, style packs — the main screen stays easy without these.',
  powerCaps:
    'What: Plain-English engine limits. When: Under More. What happens: Song length, stem rebuild plans, sample rates — no eng IDs.',
  arrangement:
    'What: Knobs that change how the next sketch feels. When: Move a slider, then Regenerate or Vary. What happens: Mute/solo do not need Regenerate — knobs do.',
  bpmPower:
    'What: Tempo stays near 174 (classic drum & bass). When: Only change if you want 170–176. What happens: Layout still locks measured tempo near 174 on render.',
  backendSelect:
    'What: Chooses Sketch vs Studio engine. When: Under More. What happens: Sketch is ready now; Studio needs your local GPU setup.',
  loraPack:
    'What: Optional style packs. When: Under More. What happens: Early packs for experiments; real training comes with Studio GPU later.',
  aceModels:
    'What: ACE model sizes on your GPU PC. When: Under More. Turbo = fast Generate now; Base later; XL needs more VRAM. What happens: Weights install outside the browser; this panel only shows status.',
  statusPanel:
    'What: Ready / error / next-step messages. When: After Generate or if something looks off. What happens: Points you to Play, Export, or a fix.',
  remixPreview:
    'What: Quick mute for key parts on the hero. When: After Generate. What happens: Play updates live — no Generate. ZIP keeps dry tracks + mix_as_heard if tweaked.',
  vary:
    'What: New variation with a fresh layout (new seed). When: After a sketch, same vibe knobs. What happens: Different arrangement — still original DnB near 174.',
  again:
    'What: Rebuild with same seed and current knobs. When: After Energy/Mood/Chaos changes. What happens: Same skeleton, new render. Use Vary for a fresh layout.',
  remixLive:
    'What: Hearing mute/solo/volume tweaks live. When: After you remix stems. What happens: Keep listening or Export — ZIP adds mix_as_heard; dry tracks stay.',
  favorites:
    'What: Saves this sketch’s settings in this browser. When: More → Favorites → Save after a sketch you like. What happens: Recall later — nothing uploads.',
  favoritesAgain:
    'What: Loads a favorite and generates again. When: Click Again on a saved row. What happens: Same vibe rebuilt — original audio near 174 BPM.',
  songShape:
    'What: The arc of the track (intro length, breakdown, double drop, half-time drop). When: Before Generate. What happens: Changes section layout — not a second menu of knobs.',
  layers:
    'What: Optional guitar / solo / vocal-ish / extra drums. When: After (or before) Generate. What happens: Adds original generative textures on next Generate/Vary — never artist stems.',

  surpriseMe:
    'What: Random seed + song shape + mood template. When: Under More (not on the main row). What happens: Fresh layout and vibe near 174 BPM — then hit Play.',
  favoritesVary:
    'What: Favorite knobs + new seed (slight variation). When: Click Slight variation on a saved row. What happens: Cousin of that sketch, then generates.',
  glossaryStem:
    'What: Separate track = one part (kick/snare/hats/perc/bass). When: In Play or Export. What happens: Dry = original ZIP file; mix_as_heard = remixed Play match; drums/mix are combined buses (Mute/Solo like elementals).',
  glossarySeed:
    'What: Number that locks song layout. When: Same seed + settings. What happens: Same arrangement. Vary picks a new seed.',
  why174:
    'What: Classic energetic DnB sits near 174 BPM. When: Always here. What happens: Layout locks ~174 so drops feel right — upload BPM is not forced onto the song.',
  /** Disabled Play — teach next step. */
  playDisabled:
    'What: Play is locked. When: Before you Generate. What happens: Create a sketch first, then Play unlocks so you can hear the mix (Space).',
  /** Disabled Export — teach next step. */
  exportDisabled:
    'What: Export is locked. When: Before you Generate. What happens: Build a sketch first, then Export unlocks the ZIP for your music software (E).',
  /** Hear tweaks again after mute/solo/gain. */
  rehear:
    'What: Rehear your mute/solo/gain tweaks. When: After you change stems. What happens: Hit Play again — no Generate needed for stem changes.',
  /** Knobs vs mute/solo — teach the regen vs live split. */
  paramsVsMixer:
    'What: Knobs vs mute/solo. When: After a sketch. What happens: Knob changes need Regenerate/Vary; mute/solo/gain update Play live with no Generate.',
  /** Clear Style Ref control. */
  clearStyleRef:
    'What: Removes your Style Ref file. When: Click Clear on the vibe card. What happens: Upload detaches; knobs reset to defaults. Generate still works.',
  /** Single WAV of what Play heard. */
  exportHeardSingle:
    'What: One WAV of the mix you heard. When: After Generate (and optional mute tweaks). What happens: Downloads that preview mix — not the full dry-stem ZIP.',
  /** RegenAffordance when arrangement knobs diverge. */
  paramsDirtyCue:
    'What: You changed arrangement knobs. When: This banner shows after a sketch. What happens: Regenerate (same seed) or Vary (new layout). Mute/solo skip this.',
  /** #40 Waveform seek scrub */
  waveformSeek:
    'What: Drag the wave to jump in the sketch. When: After Generate, while listening. What happens: Playhead moves; Drop is easy to find.',
  /** #41 Section jump chips */
  sectionJump:
    'What: Jump to Intro/Build/Drop…. When: After a sketch exists. What happens: Playhead seeks that part so you can hear the Drop fast.',
  /** #42 Mixer undo */
  mixerUndo:
    'What: Undo last mute/solo/gain. When: After a stem tweak. What happens: Mixer snaps back one step; Play follows live.',
  /** #43 First-Play coach */
  firstPlayCoach:
    'What: Reminder to Play your new sketch. When: Right after your first Generate. What happens: Dismiss anytime; Play still works.',
  /** #44 Export success honesty */
  exportDone:
    'What: Confirms Sketch ZIP contents. When: Right after Export. What happens: Reminds bit-depth + dry vs heard mix — still Sketch, not Studio.',
  /** #45 Seed copy */
  seedCopy:
    'What: Copy this sketch’s seed number. When: You want the same layout later. What happens: Seed hits the clipboard for paste/share.',
  /** #46 Stem solo hotkeys 1–4 */
  stemSoloHotkeys:
    'What: Keys 1–4 solo kick/snare/hats/bass. When: After Generate, not while typing. What happens: Preview solos that part live.',
  /** #47 Hold-B A/B flashback */
  holdBFlashback:
    'What: Hold B to hear the previous sketch. When: After you Generate again. What happens: Release B to return to the new one.',
  /** #48 Waveform loop region */
  waveformLoop:
    'What: Drag across the wave to loop a slice. When: After Generate. What happens: Esc clears; Space plays the loop.',
  /** #49 Post-Play favorites nudge */
  favoritesNudge:
    'What: Reminder to save a sketch you like. When: After your first Play. What happens: Opens a tip toward More → Favorites.',
  /** #50 R/V Again/Vary hotkeys */
  againVaryHotkeys:
    'What: R rebuilds; V varies the layout. When: After a sketch, not while typing. What happens: Same as Again / Vary buttons.',
  /** #51 Soft peak warn on Export */
  peakWarnExport:
    'What: Soft warning if the mix looks hot. When: On Export. What happens: Toast only — Export still runs.',
  /** #52 Bar:beat + section under waveform */
  barBeatReadout:
    'What: Shows bar:beat and section under the wave. When: After Generate while you listen or scrub. What happens: Updates with the playhead.',
  /** #53 ±1 bar nudge */
  barNudge:
    'What: Step the playhead ±1 bar. When: After Generate — use ‹ › or , /. What happens: Jumps one bar on the wave; does not change the sketch.',
  /** #54 Heard remix badge near Play */
  heardBadge:
    'What: Soft badge when Play hears your remix. When: After mute/solo/gain tweaks. What happens: Reminds Play matches tweaks; ZIP still keeps dry tracks.',
  /** #55 Resume last seed+knobs */
  resumeDraft:
    'What: Restore last seed and knobs (no audio). When: After a prior Generate in this browser. What happens: Loads settings — hit Generate to rebuild.',
  /** #57 Help hotkey */
  helpHotkey:
    'What: Open or close How it works. When: Press ? or H; Esc closes. What happens: Help opens without stealing G, Space, or E.',
  /** #58 Waveform hover time */
  waveformHoverTime:
    'What: Hover clock on the wave (mm:ss). When: After Generate, move over the wave. What happens: Shows exact time at that spot for scrubbing.',
  /** #59 Section dblclick loop */
  sectionLoop:
    'What: Loop one section from Jump chips. When: Double-click a section chip after Generate. What happens: Sets a loop; single click still seeks.',
  /** #60 Restore previous sketch */
  restorePrevious:
    'What: Bring back the previous sketch audio. When: After you Generate again (More/secondary). What happens: Swaps to the last take — hit Play to hear it.',
  /** #61 Favorites empty Surprise CTA */
  favoritesEmpty:
    'What: Empty Favorites tip toward Surprise Me. When: More → Favorites with nothing saved yet. What happens: Offers a fresh random sketch near 174.',
  /** #62 Shift+1–4 mute */
  stemMuteHotkeys:
    'What: Shift+1–4 mutes kick/snare/hats/bass. When: After Generate, not while typing. What happens: Preview mutes that part live — no Generate.',
  /** #63 Export name preview */
  exportNamePreview:
    'What: Shows the ZIP file name on Export. When: You click Export. What happens: Toast names the file; dry stems (+ heard mix if remixed).',
  /** Sketch 16|24-bit export (Critic P1 — not Studio). */
  exportBitDepth:
    'What: WAV bit depth for Sketch export. When: Under More, before Export. What happens: 16-bit default; 24-bit optional — still Sketch, not Studio GPU.',
  /** #64 Clear loop chip */
  clearLoop:
    'What: Clears the loop region on the wave. When: A loop is set (drag or section double-click). What happens: Esc or Clear stops looping; full sketch plays.',
  /** #65 Drop wash highlight */
  dropWash:
    'What: Soft wash marks the Drop on the wave. When: After Generate with a Drop section. What happens: Visual cue only — seek, loop, and Play still work as usual.',
  /** #66 HelpPanel Keys sheet */
  hotkeysSheet:
    'What: Shortcut list inside How it works. When: Open Help (? or H). What happens: Shows G/Space/E plus solos and R/V — no second hero strip.',
  /** #67 First-export coach */
  firstExportCoach:
    'What: Soft tip to Export your sketch. When: After first Play, near Export. What happens: Auto-fades; never stacks with the first-play coach.',
  /** #68 Copy settings pack */
  copySettings:
    'What: Copies seed + knobs as plain text. When: More → Arrangement after a sketch. What happens: Clipboard gets settings only — no audio file.',
  /** #69 Section-enter aria */
  sectionAnnounce:
    'What: Announces section changes for screen readers. When: Playhead enters Intro/Build/Drop…. What happens: Polite live update only — no toast clutter.',
  /** #76 Loop edge handles */
  loopEdges:
    'What: Drag loop edge handles on the wave. When: A loop is set. What happens: Trims loop ends; Esc still clears the whole loop.',
  /** #77 Play autofocus after Generate */
  playAutofocus:
    'What: Focus moves to Play after Generate. When: A new sketch lands and you are not typing. What happens: Ready for Space; skips if HelpTip or typing.',
  /** #78 mixerDirty rehear pulse on Play */
  rehearPulse:
    'What: Play pulses after stem tweaks. When: mixerDirty and a sketch exists. What happens: Cue Play only — Generate never pulses for mute/solo/gain.',
  /** #79 empty waveform CTA */
  emptyWaveformCta:
    'What: Empty wave points you to Generate. When: Before your first sketch. What happens: One tip only — no stacked coaches.',
  /** #80 post-export Favorite/Again/Vary strip */
  postExportStrip:
    'What: Favorite / Again / Vary after Export. When: Under transport after a ZIP download. What happens: One low strip — save or rebuild without clutter.',
  /** #81 L = loop current section */
  loopSectionHotkey:
    'What: L loops the section under the playhead. When: After Generate, not while typing. What happens: Sets a section loop; Esc clears.',
  /** #82 Waveform Z zoom */
  waveformZoom:
    'What: Z zooms the wave 2× around the playhead. When: After Generate on the waveform. What happens: Esc exits zoom; seek and loop still work.',
  /** #83 params What changed chip */
  paramsWhatChanged:
    'What: Lists knobs you changed. When: Arrangement knobs diverge from the last sketch. What happens: Again or Vary — never pulses Generate for mute tweaks.',
  /** #84 stem-label exclusive solo */
  stemLabelSolo:
    'What: Click a stem name (1–4) to exclusive-solo. When: Full mixer after Generate. What happens: Only that part plays; click again clears.',
  /** #85 sketch_notes.txt in ZIP */
  sketchNotes:
    'What: sketch_notes.txt in the ZIP. When: Every Export. What happens: Seed, ~174 BPM, bars, knobs, depth — sketch honesty (original, no catalog rips).',
  /** #86 once-flag post-export DAW tip */
  exportDawTip:
    'What: Reminder to open the ZIP in your DAW. When: Once after your first Export. What happens: Soft toast only; never stacks with coaches.',
  keepSeed:
    'What: Lock seed so Generate keeps the same layout. When: Toggle before Generate. What happens: Off (default) rolls a new seed each Generate.',
  transportClock:
    'What: Elapsed / total of the current mix. When: After Generate while you play or pause. What happens: Uses real audio length until the next Generate.',
  songLengthChips:
    'What: Quick 32 / 48 / 64 bar length. When: Before Generate (or after). What happens: Sets bar count; new length applies on next Generate.',
  durationMismatch:
    'What: Audio length and bar map disagree. When: After Generate if WAV and bars×BPM differ by more than half a second. What happens: Clocks keep the real audio length; map time is shown as a note — never a fake total.',
  /** #87 Section Jump Loop mini-chip */
  sectionJumpLoopChip:
    'What: Loop chip on the Jump row. When: After Generate beside section chips. What happens: Loops the section under the playhead.',
} as const;

export type HelpKey = keyof typeof HELP;

/** Tiny plain-English glossary for noobs — UI may link; keep in sync with docs/GLOSSARY.md. */
export const GLOSSARY_BLURBS = {
  styleRef: 'Your own file as a reference. Sketch biases mood; Studio conditions on the audio. Optional.',
  generate: 'Build an original ~174 BPM browser sketch. Shortcut G.',
  play: 'Hear the mix preview in this browser. Shortcut Space.',
  exportZip: 'Download dry tracks at 16|24-bit (+ mix_as_heard if remixed). Shortcut E.',
  exportBitDepth: 'Sketch export WAV depth: 16 (default) or 24-bit — not Studio.',
  mixAsHeard: 'Extra WAV in the ZIP that matches what Play heard after mute/solo/gain.',
  again: 'Same seed — rebuild with current settings.',
  vary: 'New seed — fresh layout, same vibe knobs.',
  browserSketch: 'Sketch = CPU sound you hear now. Studio GPU later is not live here.',
  productSketch: 'Sketch product — CPU/browser now, 16-bit.',
  productStudio: 'Studio product — GPU/ACE later; gated until live.',
  bpm174: 'Song layout stays about 174 BPM (DnB).',
  why174: 'Why ~174? Classic energetic DnB tempo — layout stays locked here.',
  rehear: 'Hit Play again after stem tweaks — no Generate.',
  playDisabled: 'Play locked until you Generate.',
  exportDisabled: 'Export locked until you Generate.',
  paramsVsMixer: 'Knobs need Regenerate; mute updates Play live.',
  exportHeardSingle: 'One WAV of the mix you heard (not full ZIP).',
  paramsDirtyCue: 'Knobs changed — Regenerate or Vary to hear them.',
  clearStyleRef: 'Removes your Style Ref; Generate still works.',
  waveformSeek: 'Drag the waveform to jump in the sketch.',
  sectionJump: 'Jump playhead to Intro/Build/Drop…',
  mixerUndo: 'Undo last mute/solo/gain tweak.',
  exportDone: 'Confirms dry vs mix_as_heard in the ZIP.',
  seedCopy: 'Copy the numeric seed to clipboard.',
  stemSoloHotkeys: 'Keys 1–4 solo kick/snare/hats/bass in Play.',
  holdBFlashback: 'Hold B to hear the previous sketch.',
  waveformLoop: 'Drag the wave to loop a slice; Esc clears.',
  favoritesNudge: 'After Play, tip to save in Favorites.',
  againVaryHotkeys: 'R = Again, V = Vary (when not typing).',
  peakWarnExport: 'Soft toast if export mix looks hot — still exports.',
  barBeatReadout: 'Bar:beat and section follow the playhead.',
  barNudge: 'Step ±1 bar with ‹ › or , /.',
  heardBadge: 'Soft cue when Play hears remix tweaks.',
  resumeDraft: 'Restore last seed + knobs (no audio file).',
  helpHotkey: '? or H opens help; Esc closes.',
  waveformHoverTime: 'Hover the wave for mm:ss.',
  sectionLoop: 'Double-click a Jump chip to loop that section.',
  restorePrevious: 'Swap back to the previous sketch.',
  favoritesEmpty: 'Empty Favorites can launch Surprise Me.',
  stemMuteHotkeys: 'Shift+1–4 mute stems live.',
  exportNamePreview: 'Toast shows the ZIP file name on Export.',
  clearLoop: 'Clear the waveform loop region.',
  dropWash: 'Soft Drop highlight on the waveform.',
  hotkeysSheet: 'Shortcut list inside HelpPanel only.',
  firstExportCoach: 'Soft Export tip after first Play.',
  copySettings: 'Copy seed + knobs text from Arrangement.',
  sectionAnnounce: 'Screen reader notes section changes.',
  loopEdges: 'Drag loop edge handles on the wave.',
  playAutofocus: 'Focus moves to Play after Generate.',
  rehearPulse: 'Play pulses after stem tweaks — not Generate.',
  emptyWaveformCta: 'Empty wave points at Generate.',
  postExportStrip: 'Favorite / Again / Vary after Export.',
  loopSectionHotkey: 'L loops the current section.',
  waveformZoom: 'Z zooms the wave 2× around playhead.',
  paramsWhatChanged: 'Lists changed knobs — Again or Vary.',
  stemLabelSolo: 'Click stem name (1–4) to exclusive-solo.',
  sketchNotes: 'ZIP includes sketch_notes.txt.',
  exportDawTip: 'Once: open ZIP in your DAW tip.',
  sectionJumpLoopChip: 'Jump-row Loop chip for current section.',
} as const;

/** Simple-facing keys that must stay short and jargon-free (≤160). */
export const SIMPLE_HELP_KEYS = [
  'styleRef',
  'ownerCheck',
  'vibeIntensity',
  'energyNudge',
  'darknessNudge',
  'generate',
  'exportZip',
  'productSketch',
  'productStudio',
  'badgeCpu174',
  'badgeSketch16',
  'badgeAce',
  'studioGated',
  'bpmLock',
  'energy',
  'darkness',
  'stems',
  'stemsSharedMix',
  'stemMute',
  'stemSolo',
  'stemGain',
  'waveform',
  'sectionTimeline',
  'arrangement',
  'statusPanel',
  'remixPreview',
  'remixLive',
  'surpriseMe',
  'playDisabled',
  'exportDisabled',
  'rehear',
  'paramsDirtyCue',
  'paramsVsMixer',
  'clearStyleRef',
  'exportHeardSingle',
  'waveformSeek',
  'sectionJump',
  'mixerUndo',
  'firstPlayCoach',
  'exportDone',
  'seedCopy',
  'stemSoloHotkeys',
  'holdBFlashback',
  'waveformLoop',
  'favoritesNudge',
  'againVaryHotkeys',
  'peakWarnExport',
  'barBeatReadout',
  'barNudge',
  'heardBadge',
  'resumeDraft',
  'helpHotkey',
  'waveformHoverTime',
  'sectionLoop',
  'restorePrevious',
  'favoritesEmpty',
  'stemMuteHotkeys',
  'exportNamePreview',
  'exportBitDepth',
  'powerCaps',
  'clearLoop',
  'dropWash',
  'hotkeysSheet',
  'firstExportCoach',
  'copySettings',
  'sectionAnnounce',
  'loopEdges',
  'playAutofocus',
  'rehearPulse',
  'emptyWaveformCta',
  'postExportStrip',
  'loopSectionHotkey',
  'waveformZoom',
  'paramsWhatChanged',
  'stemLabelSolo',
  'sketchNotes',
  'exportDawTip',
  'sectionJumpLoopChip',
  'keepSeed',
  'transportClock',
  'songLengthChips',
  'expandSection',
  'repeatSection',
  'dropX2',
] as const satisfies readonly HelpKey[];
