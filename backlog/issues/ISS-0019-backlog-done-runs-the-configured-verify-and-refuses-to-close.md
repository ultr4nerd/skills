---
id: ISS-0019
title: backlog done runs the configured verify and refuses to close on red
kind: feature
status: todo
priority: P1
area: backlog
parent:
depends_on: []
created: 2026-11-18
updated: 2026-11-18
due:
owner:
branch:
estimate: S
tags: []
---

## Context
Today done only prints the verify command; an agent can close an issue without running it. done should run verify itself, but only when backlog.json sets verify explicitly (the built-in default 'pnpm verify' would break projects without pnpm). --force keeps working for humans; a --no-verify escape is logged.

## Scope

## Acceptance criteria
- [ ] done runs backlog.json verify when set explicitly and refuses with exit 1 when it fails
- [ ] done does not run anything when verify is not set in backlog.json (prints the hint as today)
- [ ] the verify result (command, exit code) is written to the issue Log
- [ ] --force skips it and logs that it was skipped
- [ ] README and SKILL.md document it
- [ ] npm run verify green

## Notes

## Log

## Outcome
<!-- filled by `backlog done`: what shipped, how it was verified, learnings, follow-ups -->
