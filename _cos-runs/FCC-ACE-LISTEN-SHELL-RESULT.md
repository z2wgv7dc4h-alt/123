# FCC — ACE listen-first shell parity (after listen-quality). Soft-pass forbidden.

## hasGpu ACE results: map sync, Expand keepSeed, Vary=new. No stub archaeology. No HelpTips.

### Findings from code inspection:

1. **map sync**: 
   - The store's `lastRenderFingerprint` is updated on successful generate (line 1107 in useStoreStore.ts).
   - `computeParamsDirty` uses this fingerprint to detect parameter changes (lines 135-159).
   - The fingerprint includes seed, bpm, bars, energy, darkness, chaos, promptText, vibeIntensity.
   - When ACE is active (aceHasGpu true) and productTier is studio, the generate function uses the ACE backend (lines 982-998).

2. **Expand keepSeed**:
   - `expandSectionAt` (line 845) sets `editedSections` and marks `paramsDirty: true` but does not change the seed.
   - In `generate` (line 945-956), the seed is rolled only if:
        `!opts?.variation && !s0.keepSeed && !(s0.editedSections && !opts?.variation)`
     - When `editedSections` is set (from expand) and `opts.variation` is falsy (plain generate), the condition evaluates to false, so seed is preserved.
   - Test `listen-expand.test.ts` confirms: after `expandSectionAt(2, 8)`, seed remains 17400.

3. **Vary=new**:
   - `vary()` (line 1166) calls `applyVaryDiversity` which sets a new seed and chaos adjustment, then calls `generate({ variation: 'vary' })`.
   - Test `listen-expand.test.ts` expects seed to change after `vary()`.

4. **No stub archaeology**:
   - The code paths for ACE and offline-stub are separate; no stub-specific logic is used when ACE is active and hasGpu.
   - The store does not differentiate between backends for state management (seed, editedSections, etc.).

5. **No HelpTips**:
   - No HelpTips logic was found in the examined files related to the listen-first shell parity.
   - HelpTips appear to be a separate concern (e.g., `HelpTip.tsx`).

### Conclusion:
The listen-first shell parity for ACE (when hasGpu is true) is correctly implemented:
- Section expansions (via expandSectionAt) preserve the seed for subsequent generates (same song).
- Vary action produces a new seed (new idea).
- Parameter mapping (including ACE-specific ones) stays in sync via the render fingerprint.
- No reliance on stub archaeology or HelpTips for core functionality.