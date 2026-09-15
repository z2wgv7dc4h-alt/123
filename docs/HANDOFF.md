# Handoff

**Last code commit**: `4f4ef20` — "feat: real audio2audio (ACE cover) for style ref + honest style-ref copy".
Gaps 1–10 are closed (`5bc5767`, `cf62381`, `4f4ef20`). Do not reopen them.

Studio (ACE-Step 1.5, GPU) is the real path; Sketch (`OfflineStubBackend`,
CPU) is the fallback. They share only `structureEngine.plan()`.

Law is `AGENTS.md` + `CLAUDE.md` only. Archived docs in
`docs/_archive_2026-09-16/` are not law and are not read.

## New work

Two tracks. Each ticket is one change. Implement one ticket only when the user
names it (e.g. "IMPLEMENT UI-1").

| Track | Plan | Tickets |
|---|---|---|
| UI-REVAMP | `docs/UI-REVAMP.md` | `TICKETS/UI-1.md` … `TICKETS/UI-4.md` |
| REVIEW-SOUND | `docs/REVIEW-SOUND.md` | `TICKETS/S-1.md` … `TICKETS/S-5.md` |

Suggested order: UI-4 tests can land with or before UI-1; UI-1 → UI-2 → UI-3.
S-1 before any listening experiment (S-3, S-5), so we know which backend was heard.

## Leftover research tickets (not scheduled)

- `TICKETS/05.md` — ACE `extract` task for real separated stems.
- `TICKETS/07.md` — raw (non-pre-cut) sample tempo work.

## Don't do

- **No audio renders to "verify".** Verification is a targeted test or `tsc`.
  Listening tests are run by the user, not by an agent sitting in a generate loop.
- **No LoRA.** No style-pack training, no LoRA loading.
- **No git history rewriting.**
- **No archive as law.** Do not read or cite `docs/_archive_*`.
- **No `@types/node`.** This tsconfig has no `types` array, so it would leak
  Node globals into browser files. Use a narrow ambient `.d.ts` — see
  `src/core/audio/node-fs-shim.d.ts`.
