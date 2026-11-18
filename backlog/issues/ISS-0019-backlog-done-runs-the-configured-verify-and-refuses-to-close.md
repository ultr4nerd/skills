---
id: ISS-0019
title: backlog done runs the configured verify and refuses to close on red
kind: feature
status: done
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
- [x] done runs backlog.json verify when set explicitly and refuses with exit 1 when it fails
- [x] done does not run anything when verify is not set in backlog.json (prints the hint as today)
- [x] the verify result (command, exit code) is written to the issue Log
- [x] --force skips it and logs that it was skipped
- [x] README and SKILL.md document it
- [x] npm run verify green

## Notes

## Log
- 2026-11-18 15:19 claude: started; plan in progress/ISS-0019.md
- 2026-11-18 15:22 claude: done runs backlog.json verify via shell from root when set explicitly; --no-verify/--force skip and log; retro counts 'verify skipped' as friction; 3 new tests, 46/46
- 2026-11-18 15:22 claude: verify passed: npm run verify
- 2026-11-18 15:22 claude: done: backlog done now runs the verify command when backlog.json sets it (shell, project root) and refuses with exit 1 on a...

## Outcome
backlog done now runs the verify command when backlog.json sets it (shell, project root) and refuses with exit 1 on a non-zero exit, leaving the issue in-progress; success logs 'verify passed: <cmd>'. Unset verify keeps the old behaviour (default pnpm verify is only printed). --no-verify and --force skip it and log 'verify skipped', a new retro friction signal. Docs: SKILL.md hard rule + commands, README config + done row. Verified: 3 new tests (red verify refuses, skip flags log, unset runs nothing), backlog suite 46/46, and this very done ran npm run verify green.
