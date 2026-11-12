---
id: ISS-0010
title: "backlog: branch check accepts a closed issue on its own branch"
kind: bug
status: done
priority: P1
area: backlog
parent:
depends_on: []
created: 2026-11-11
updated: 2026-11-11
due:
owner:
branch: fix/iss-0010-branch-check-closed-issue
estimate: S
tags: [memento]
---

## Context
With branchPattern set, check rejects the current branch once its issue is done, so the commit that runs backlog done on the issue's own branch (the normal PR flow) turns verify and that PR's CI red. Found by Memento ISS-0003 on v0.2.0. Also: the docmap README suggests the script name docs, but pnpm docs and npm docs are package-manager built-ins that exit 0 without running the script (a false green).

## Scope

## Acceptance criteria
- [x] check (b): a current branch whose issue is done or cancelled is accepted; only a missing issue or one that is todo or backlog is an error
- [x] tests cover done, cancelled and the still-rejected todo case
- [x] docmap README, SKILL.md and root README suggest the script name docmap and say why not docs
- [x] npm run verify is green

## Notes

## Log
- 2026-11-11 21:28 claude: started on fix/iss-0010-branch-check-closed-issue; plan in progress/ISS-0010.md
- 2026-11-11 21:30 claude: test first: done/cancelled on own branch failed check (b); fix accepts them, rejects only missing/todo/backlog; docmap script renamed in docs and package.json; version 0.2.1
- 2026-11-11 21:30 claude: done: check (b) now rejects a current branch only when its issue is missing, todo or backlog; done and cancelled are accept...

## Outcome
check (b) now rejects a current branch only when its issue is missing, todo or backlog; done and cancelled are accepted so an issue can be closed on its own branch (new test covers both; the todo test still rejects). The docmap script is suggested as `docmap` in README.md, skills/docmap/README.md and SKILL.md, with the reason (npm/pnpm docs built-ins exit 0 silently), and this repo's own script is renamed. Released as 0.2.1. npm run verify: OK.
