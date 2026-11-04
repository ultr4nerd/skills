---
id: ISS-0001
title: backlog commands are safe to re-run (idempotent under replay)
kind: chore
status: cancelled
priority: P1
area: backlog
parent:
depends_on: []
created: 2026-10-23
updated: 2026-10-30
due:
owner:
branch:
estimate: L
tags: [runner, reliability]
---

## Context
An unsupervised runner (GitHub Actions, durable harness) may re-execute an interrupted command. Today start twice fails, log twice duplicates the line, tick twice is fine, done twice fails. Define the contract per command and make each one safe to repeat: same input -> same state, exit 0, no duplicate lines.

## Scope

## Acceptance criteria
- [ ] start on an issue already in-progress by the same owner exits 0 and logs nothing new
- [ ] log with a message identical to the last Log line within 10 minutes is a no-op (exit 0)
- [ ] learn/--learning with the same title reuses the existing doc instead of filing a duplicate
- [ ] done on an already-done issue exits 0 with a notice
- [ ] README documents the replay contract in one table
- [ ] tests cover every rule above

## Notes

## Log
- 2026-10-30 17:15 ultr4nerd: cancelled: only motivation was the unsupervised runner, which was dropped (decision 0001 rewritten 2026-10-30)

## Outcome
<!-- filled by `backlog done`: what shipped, how it was verified, learnings, follow-ups -->
