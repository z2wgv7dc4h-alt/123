# FCC GRUNT — ACE checkpointId fallback lies about which model ran (thin)

Soft-pass forbidden. Run AFTER `ace-listen-quality` EXITs (same file).

## Gap
`src/core/backends/AceStepBackend.ts` requests `checkpointId:
'acestep-v15-base'` in the render POST body (~L205), but both places that
read the response back — the manifest builder call (~L305) and the
returned `RenderResult` (~L320) — fall back to
`String(data.checkpointId || 'acestep-v15-turbo')` if the bridge response
omits the field. If that ever happens, the UI/manifest claims *turbo* ran
when *base* was what was requested (and is what's actually installed per
`_cos-runs/FCC-ACE-PROVE-RESULT.md`) — a provenance lie.
`src/test/ace-backend-render.test.ts:47` always sets `checkpointId` in its
mock, so this fallback branch has zero test coverage today.

## Do
1. Change both fallbacks (~L305, ~L320 — re-grep for exact current lines
   first) from `'acestep-v15-turbo'` to `'acestep-v15-base'` so the default
   matches what was actually requested in the same function, not a
   different checkpoint.
2. Add a test in `src/test/ace-backend-render.test.ts`: mock a bridge
   response that **omits** `checkpointId` entirely, assert the returned
   `RenderResult.checkpointId` and the built manifest's `checkpointId` are
   both `'acestep-v15-base'` — not `'acestep-v15-turbo'`. Keep the existing
   test (which sets `checkpointId` explicitly) unchanged/green.
3. `npm.cmd test -- --run` + `npx tsc --noEmit` (if approval works this
   session — note honestly if denied, don't fabricate a result).
4. Write `_cos-runs/FCC-ACE-CHECKPOINT-HONESTY-RESULT.md`.

## Files ONLY
`src/core/backends/AceStepBackend.ts`, `src/test/ace-backend-render.test.ts`.
Out: `thinking` field, bridge/job param changes, `useStudioStore.ts`,
`BackendRegistry.ts`, anything already owned by `ace-listen-quality`/
`ace-listen-shell`.
