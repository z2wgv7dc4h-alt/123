# GRUNT — fix honesty selectBest env flake

## Bug
`src/test/honesty.test.ts` → `selectBest keeps OfflineStub without GPU` fails when ACE sidecar is up (`hasGpu:true`), because `backendRegistry.selectBest()` sees live GPU and returns `ace-step-1.5`.

## Fix (test only — no product behavior change)
- Make that test isolate from live sidecar: mock/stub `aceStepBackend.probe` (or fetch to `ACE_SIDECAR_PROBE_URL`) so probe reports **no GPU**, then assert `selectBest()` → `offline-stub`.
- Prefer `vi.spyOn` / existing vitest patterns in this file’s AceStep GPU gate tests.
- Do NOT change registry preference logic for Studio when GPU is real.
- Keep suite green with ACE running on :8766.

## Done
- `npm.cmd test -- --run src/test/honesty.test.ts` green
- `npm.cmd test -- --run` green
- `npx.cmd tsc --noEmit` [not executed - requires approval surface not available in this session]