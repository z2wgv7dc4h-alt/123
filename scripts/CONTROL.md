# Dual Claude — efficient SOP

## Commands
cos.ps1 status   # only way to know
cos.ps1 run -Which fcc|paid -Brief .\BRIEF-….md
cos.ps1 stop -Which fcc|paid

## CoS chat rules
- After START: silence until DONE/FAIL/blocker (one line).
- Never claim live/idle without `cos.ps1 status` same turn.
- Lost writer: one relaunch, then escalate.
- No investigation theater. No new scripts.
