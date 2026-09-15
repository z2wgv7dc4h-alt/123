# PAID — close tsc + P0.1 peak honesty

## Do
1. Run `npx.cmd tsc --noEmit` (interactive machine — must work). Fix any errors.
2. Critic audio P0.1 only: rename/dual-write sample-peak vs true-peak honesty in types + OfflineStub + manifest + one test. Files: `src/core/types/index.ts`, `src/core/backends/OfflineStubBackend.ts`, `src/core/export/manifest.ts`, related tests.
3. `npm.cmd test -- --run` green.
4. Stop. No UI/CSS. No PreviewPlayer live-bus rewrites.

## Done
tsc + tests green; peak metric honest in schema/manifest.
