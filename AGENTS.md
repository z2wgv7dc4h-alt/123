# DnB Studio — Agent Law

Studio (ACE-Step 1.5, real GPU) is the real generation path.
Sketch (`OfflineStubBackend`, CPU Float32Array synthesis) is the CPU
fallback. They share only the deterministic arrangement skeleton
(`structureEngine.plan()`).

## Build / verify

Windows: use `npm.cmd`, never bare `npm`.

```
npm.cmd test -- --run
npx tsc --noEmit
```

Every fix gets a test.

No audio generation unless a Verify line requires a file.

## Legal

Personal, non-commercial project. The sample packs and breaks already
committed to this repo are allowed. No artist-clone product. Do not
label ACE extract output as real isolated stems from a track we don't
have.

## Hard limits

Do not rewrite git history.

Do not invent extra rules. This file is the whole law.

## Work

Implement the `docs/HANDOFF.md` gap list when the user says GO.
Nothing else.
