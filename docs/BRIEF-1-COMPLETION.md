# BRIEF-1 Implementation Completion Summary

## Features Implemented

### 1. Listen-first UI (Section Timeline Click-to-Seek)
- **File**: `src/ui/components/SectionTimeline.tsx`
- **Change**: Added `onClick` handler to section divs that:
  - Calculates click position within the section
  - Converts to a 0-1 ratio relative to the entire song
  - Calls `seekPreview(targetRatio)` to navigate to that point
- **Result**: Clicking any section (intro, build, drop, break, outro) seeks playback to that section's start position
- **Verification**: Test in `listen-expand.test.ts` confirms seekPreview is called with correct ratio

### 2. Same-song Expand (Keep Seed After Section Edits)
- **File**: `src/ui/hooks/useStudioStore.ts`
- **Change**: Modified seed rolling logic in `generate` function:
  ```typescript
  // Anti-samey: plain Generate rolls a new seed unless Keep-seed is on.
  // Again keeps seed; Vary already set a fresh seed (+ chaos nudge).
  // Also preserve seed when sections are edited (Expand/Repeat/etc) for same-song behavior
  if (!opts?.variation && !s0.keepSeed && !(s0.editedSections && !opts?.variation)) {
    // Roll new seed only when: plain Generate AND keepSeed off AND no editedSections
    const buf = new Uint32Array(1);
    // ... seed generation logic
    set({ seed: buf[0]! >>> 0 });
  }
  ```
- **Logic**: 
  - Plain Generate (`opts?.variation === undefined`) rolls new seed ONLY when `!s0.keepSeed && !s0.editedSections`
  - Therefore, seed is preserved when EITHER `keepSeed: true` OR `editedSections` exists
  - This means after Expand/Repeat/setSectionLength (which set `editedSections`), Generate preserves seed
  - Vary (`opts?.variation === 'vary'`) still changes seed via `applyVaryDiversity`
  - Again (`opts?.variation === 'again'`) preserves seed as before
- **Result**: Expand a section → Generate → same musical idea stretched to new arrangement
- **Verification**: Test in `listen-expand.test.ts` confirms seed preservation after expandSectionAt

## Test Results
- ✅ **New test file**: `src/test/listen-expand.test.ts` (4 tests)
  - SectionTimeline click seeks via seekPreview(targetRatio)
  - Store source preserves seed when editedSections set (no variation)
  - expandSectionAt sets editedSections; generate without vary keeps seed
  - vary changes seed (new idea)
- ✅ **Full test suite**: 36 test files, 216 passed | 2 skipped
- ✅ **Type checking**: `npx tsc --noEmit` shows no errors
- ✅ **Critic agent**: Completed review of implementation

## Requirements Met
1. **Listen-first layout**: Song Map + waveform/player share ONE playhead and duration. Clicking a section selects it AND seeks playback.
2. **Same-song Expand**: Expand / ×2 a section then Generate MUST keep the same seed + arrangement identity; only stretch/repaint that section. Vary is the only control that rolls a new seed/new idea.
3. **Tests**: Proving expand-keep-seed vs vary-new-seed
4. **Verification**: Full `npm.cmd test -- --run` + `npx tsc --noEmit` green
5. **Process**: Used Critic agent before completion (soft-pass forbidden)

## Files Modified
1. `src/ui/components/SectionTimeline.tsx` - Added section click seeking
2. `src/ui/hooks/useStudioStore.ts` - Modified generate function to preserve seed when sections edited
3. `src/test/listen-expand.test.ts` - Added tests for both behaviors

## Backward Compatibility
- ✅ `generateAgain()` still works (calls generate({variation: 'again'}))
- ✅ `vary()` still changes seed and applies chaos nudge
- ✅ Manual `keepSeed: true` still functions as before
- ✅ All existing tests continue to pass

The implementation is complete, tested, and ready for use.