---
id: ISS-0025
title: "backlog check treats progress/<EPIC>/ as orphan while the epic has open children"
kind: bug
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
Found in the first crew run (ISS-0003, 2026-11-18): crew writes epic-level files (critique, explorer reports) to progress/<EPIC>/, but epics never go in-progress, so backlog check reported 'orphan progress directory (ISS-0003 is todo)' and verify went red.

## Scope

## Acceptance criteria
- [x] check accepts progress/<EPIC>/ while the epic has at least one child that is not done or cancelled
- [x] check still reports it once every child is closed, and still reports progress/<EPIC>.md files
- [x] test covers both cases
- [x] README documents it
- [x] npm run verify green

## Notes

## Log
- 2026-11-18 16:36 claude: started; plan in progress/ISS-0025.md
- 2026-11-18 16:36 claude: created as ISS-0023 on main while iss-0003-plan already allocated ISS-0023/0024 (ids are per-branch); renamed to ISS-0025 by hand
- 2026-11-18 16:37 claude: check: progress/<EPIC>/ is live while the epic has a child not done/cancelled; new test fails on the old code and passes now (47/47)
- 2026-11-18 16:38 claude: verify passed: npm run verify
- 2026-11-18 16:38 claude: done: backlog check accepts progress/<EPIC>/ while the epic has at least one open child; it still flags the directory once ...

## Outcome
backlog check accepts progress/<EPIC>/ while the epic has at least one open child; it still flags the directory once all children are closed and still flags progress/<EPIC>.md. Test proven red on the old code, green now; backlog suite 47/47; README check row updated; verify green (run by done).
