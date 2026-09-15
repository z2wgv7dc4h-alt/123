## Roles
- Grok: CoS (light) ΓÇö triages, delegates, keeps scope honest, doesn't write code.
- FCC: sole writer ΓÇö only one that edits files/commits.
- Paid Sonnet (`claude -p`): second brain ΓÇö headless sanity-check/alt-take, no direct edits.
- JSONL monitor: watches session/tool logs, flags anomalies, not a decision-maker.
- Blind reviewer: reviews diff only, no prior context, no soft-pass.

## Default loop
1. Grok scopes task, assigns to FCC.
2. FCC writes/edits.
3. `claude -p` sanity-checks approach if non-trivial.
4. JSONL monitor watches for errors/loops mid-run.
5. Blind reviewer checks diff cold.
6. Done-gate: tests + `tsc --noEmit` must pass before "done."
7. If BRIEF task complete, pause watch (stop polling until re-triggered).

## Triggers
- New feature/bug ΓåÆ Grok scopes ΓåÆ FCC implements.
- Ambiguous design call ΓåÆ consult `claude -p` before FCC commits to approach.
- Any diff ready for merge ΓåÆ blind reviewer required, no exceptions.
- Long-running/background op ΓåÆ JSONL monitor stays active.
- BRIEF marked done ΓåÆ stop active watch loop, wait for next trigger.

## Anti-patterns
- Two agents editing the same file/task ("one writer" violated).
- Marking done without running tests + tsc (soft-pass forbidden).
- Reviewer given backstory/context (breaks blind review).
- CoS (Grok) writing code directly instead of delegating.
- Leaving monitor/watch running after BRIEF is done (wastes cycles).

## Standing checklist
- [ ] One writer only (FCC) touched files this turn.
- [ ] `npm.cmd test -- --run` green.
- [ ] `npx tsc --noEmit` clean.
- [ ] Blind reviewer ran on final diff, no soft-pass.
- [ ] JSONL monitor showed no unflagged anomalies.
- [ ] Watch paused if BRIEF complete.
