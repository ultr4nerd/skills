---
id: ISS-0007
title: "backlog: opt-in branch binding (branchPattern)"
kind: feature
status: todo
priority: P1
area: backlog
parent:
depends_on: [ISS-0006]
created: 2026-11-11
updated: 2026-11-11
due:
owner:
branch:
estimate: M
tags: [memento]
---

## Context
Projects that work one issue per branch want the tracker to enforce it. Opt-in so current users see no change. Memento SPEC-0002 U2.

## Scope

## Acceptance criteria
- [ ] new config key branchPattern (default unset = current behaviour) with placeholders {num} (zero-padded number), {id} and {slug}
- [ ] start records the branch in frontmatter (from --branch, else the current git branch) and warns when it does not match the pattern for that issue
- [ ] check: with branchPattern set, every in-progress issue's branch must match the pattern for its own number
- [ ] check: when the current branch is known (BACKLOG_BRANCH, else git when available; silently skipped otherwise) and matches the pattern, the issue it encodes must exist and be in-progress, review or blocked
- [ ] README config table and SKILL.md hard rules mention it; tests cover each rule; npm run verify is green

## Notes

## Log

## Outcome
<!-- filled by `backlog done`: what shipped, how it was verified, learnings, follow-ups -->
