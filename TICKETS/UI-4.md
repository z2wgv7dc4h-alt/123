# UI-4 Tests: Play does not call render; Expand keeps seed

**Status: Unverified.** No `button-contract.test.ts` exists; partial coverage in `transport-cluster.test.ts`.

File: new `src/test/button-contract.test.ts` (extend, don't duplicate, `src/test/listen-expand.test.ts` / `src/test/structure-expand.test.ts` if a case already exists)

Change: Tests only. Stub the ACE probe (`backendRegistry.get('ace-step-1.5').probe`)
and spy on `render` for every registered backend. Cases:
1. With a loaded `result`, `play()` → `render` is called 0 times.
2. `stop()` → `result` is the same object, and `canPlayPreview(result, previewState)` is true.
3. `generate()` with `keepSeed: false` and `editedSections: null` → the seed changes.
4. `expandSectionAt(i, 8)` then `generate()` → the seed is unchanged, and the `sectionsOverride` passed to `render` differs from `result.structure.sections` only at index `i`.
5. `vary()`, with or without `editedSections` → the seed changes.

Do not: assert that only one section's audio is re-rendered (ACE repaint is not
wired). Do not render real audio. Do not hit the network. Do not change
`useStudioStore.ts` unless a case fails; then fix only that case, in the same change.

Done when: all 5 cases pass. Case 1 fails if a `backend.render` call is added to `play()`.

Verify: `npx vitest run src/test/button-contract.test.ts && npx tsc --noEmit`
