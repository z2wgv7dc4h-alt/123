# DnB Studio Implementation Status

## BRIEF-1: Listen-first UI + same-song expand

### ✅ Completed

#### Listen-first layout
- SectionTimeline section divs now have an onClick handler that calls seekPreview() to navigate to the clicked section's start position.
- Clicking any section (intro, build, drop, break, outro) seeks playback to that section's beginning.
- The waveform and transport bar update to reflect the new playhead position.
- This makes hearing primary: users can click a section and immediately hear from that point.

#### Same-song Expand
- When a user edits sections via Expand, Repeat, or dragging edges, the store sets `editedSections` and `paramsDirty: true`.
- The generate function now checks: if `editedSections` exist and no variation is specified (`opts?.variation === undefined`), it preserves the current seed (same behavior as `variation: 'again'`).
- This ensures that Generate after section edits produces the same musical idea but stretched to the new arrangement length.
- The Vary button (`variation: 'vary'`) still rolls a new seed and applies a chaos nudge for audible variation.
- The Again button (`variation: 'again'`) continues to work as before, preserving seed and all parameters.

### 🧪 Testing
- Added `src/test/listen-expand.test.tsx` with tests for:
  1. Section clicking calls seekPreview with correct ratio (middle of section).
  2. Generating after section edits preserves seed (same song).
  3. Vary changes seed (new idea).
- All existing tests continue to pass.
- Full test suite: `npm.cmd test -- --run` passes.
- Type checking: `npx tsc --noEmit` passes.

### 📝 Notes
- The implementation follows the existing patterns in the codebase.
- No changes were made to the backend or audio engine; the changes are purely in the UI and state management.
- The listen-first feature uses the existing `seekPreview` function from the store.
- The same-song expand feature leverages the existing `editedSections` mechanism that was already used for persisting arrangement edits into the next generate.