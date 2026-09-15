# FCC GRUNT — north-star listen parity (next after BPM lock)

## Product bar
Listen-first: player + waveform + section map share one playhead/duration; Expand keeps seed; Vary = new idea; live mute/solo/gain mid-play.

## Do (mechanical, tests first)
1. Grep/read TransportBar, Waveform, SectionTimeline, barPosition/resolvePlaybackDuration — find any remaining playhead/duration drift or Expand/Vary seed bugs.
2. Add/extend vitest gates only for concrete gaps (no UI redesign). Prefer `listen-expand`, `playback-duration`, `waveform-seek`, `live-tweak-preview`.
3. Fix only what tests prove broken. npm.cmd test -- --run + npx.cmd tsc --noEmit green.
4. Out: peak-metric P0.1, ACE/GPU, CSS rewrite, LayersChips.

## Done
Tests prove playhead/Expand/Vary/live-tweak honesty; suite+tsc green.
