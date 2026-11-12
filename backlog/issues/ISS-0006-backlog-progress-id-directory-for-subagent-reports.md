---
id: ISS-0006
title: "backlog: progress/<ID>/ directory for subagent reports"
kind: feature
status: todo
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
- [ ] done and cancel delete progress/<ID>/ recursively together with progress/<ID>.md
- [ ] check reports an orphan progress/<ID>/ directory with the same rule as an orphan progress/<ID>.md (issue missing, or not in-progress/blocked/review); entries not named like an issue id are ignored as today
- [ ] SKILL.md and README document the convention: subagents write progress/<ID>/<topic>.md and reply with only the path
- [ ] tests cover delete on done, delete on cancel and the orphan-directory error
- [ ] npm run verify is green

## Notes

## Log

## Outcome
<!-- filled by `backlog done`: what shipped, how it was verified, learnings, follow-ups -->
