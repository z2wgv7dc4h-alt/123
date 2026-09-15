# License-clean sample audio (optional fixtures)

Drop **ONLY** user-owned / properly licensed sample audio here.

## Allowed
- WAV or MP3 you own, or that you have an explicit license to use in local tests
- Naming suggestion: `*.wav` or `*.mp3` (e.g. `my-drop-loop.wav`)

## Forbidden
- Catalog rips, sample-pack dumps without a clear personal license
- YouTube downloads / ripped streams / commercial track clones
- Anything you would not attest as user-owned in the Style Reference UI

## How tests use this folder
- `src/test/license-clean-fixtures.test.ts` **auto-discovers** `*.wav` / `*.mp3` in this directory when present.
- If the folder is empty (aside from this README), the optional license-clean block is **skipped** via `describe.skipIf` / `it.skipIf` — never a soft pass, never invented greens.
- Synthetic QA audio lives under `../synthetic/` (always exercised); keep that separate from license-clean drops.
