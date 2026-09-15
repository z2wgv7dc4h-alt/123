@AGENTS.md

# DnB Studio — Claude Code

The law lives in `AGENTS.md` (imported above) — this file exists only
because Claude Code reads `CLAUDE.md` by convention; other tools read
`AGENTS.md` directly. Keep them in sync — if you edit one, edit both.

## Claude Code specifics

- Delegate research (reading the real ACE-Step-1.5 repo, WebSearch, log
  digging) to subagents so main context stays clean — this project's
  docs got long partly from not doing this consistently.
- Use a Critic-style adversarial pass before calling multi-file UI work
  done.
- `docs/HANDOFF.md` is the pickup entry point every session.
  `docs/SESSION-DUMP.md` is the full inventory behind it — read that one
  before assuming something wasn't tried or a resource wasn't checked.
