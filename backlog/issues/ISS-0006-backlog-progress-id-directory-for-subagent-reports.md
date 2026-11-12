---
id: ISS-0006
title: "backlog: progress/<ID>/ directory for subagent reports"
kind: feature
status: done
priority: P1
area: backlog
parent:
depends_on: []
created: 2026-11-11
updated: 2026-11-11
due:
owner:
branch:
estimate: M
tags: [memento]
---

## Context
Subagents should write results to files and return only a path. Today progress/ISS-0001.review.md is reported as an orphan for a non-existent id, and nothing cleans up a directory. Memento SPEC-0002 U1.

## Scope

## Acceptance criteria
- [x] done and cancel delete progress/<ID>/ recursively together with progress/<ID>.md
- [x] check reports an orphan progress/<ID>/ directory with the same rule as an orphan progress/<ID>.md (issue missing, or not in-progress/blocked/review); entries not named like an issue id are ignored as today
- [x] SKILL.md and README document the convention: subagents write progress/<ID>/<topic>.md and reply with only the path
- [x] tests cover delete on done, delete on cancel and the orphan-directory error
- [x] npm run verify is green

## Notes

## Log
- 2026-11-11 18:29 claude: started; plan in progress/ISS-0006.md
- 2026-11-11 18:30 claude: plan: tests first; rmSync dir in done/cancel; check scans id-named dirs; docs in SKILL+README
- 2026-11-11 18:30 claude: RED: 3 new tests fail (done/cancel dir cleanup, orphan dir check)
- 2026-11-11 18:31 claude: GREEN: removeProgress helper in done/cancel; check scans id-named dirs; docs updated
- 2026-11-11 18:31 claude: done: `done` and `cancel` now remove `progress/<ID>/` recursively with the plan file (`removeProgress`). `check` reports an...

## Outcome
`done` and `cancel` now remove `progress/<ID>/` recursively with the plan file (`removeProgress`). `check` reports an orphan id-named directory with the same rule and message shape as an orphan file; non-id directories are ignored. Documented in SKILL.md and README. Verified by 3 new tests (RED then GREEN) and `npm run verify`.
