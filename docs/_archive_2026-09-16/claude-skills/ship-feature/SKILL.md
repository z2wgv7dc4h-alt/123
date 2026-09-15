---
name: ship-feature
description: Run Critic→Builder→QA loop for a scoped DnB feature
disable-model-invocation: true
---
Feature: $ARGUMENTS

1. Plan briefly (explore with subagents if needed)
2. Implement with Builder discipline
3. Run Critic subagent on the diff
4. Fix must-fixes
5. Run npm.cmd test -- --run and npx tsc --noEmit until green
6. Summarize files changed + how the user verifies (listen steps)
