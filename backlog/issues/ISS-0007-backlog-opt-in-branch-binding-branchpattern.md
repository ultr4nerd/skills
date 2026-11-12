---
id: ISS-0007
title: "backlog: opt-in branch binding (branchPattern)"
kind: feature
status: done
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
- [x] new config key branchPattern (default unset = current behaviour) with placeholders {num} (zero-padded number), {id} and {slug}
- [x] start records the branch in frontmatter (from --branch, else the current git branch) and warns when it does not match the pattern for that issue
- [x] check: with branchPattern set, every in-progress issue's branch must match the pattern for its own number
- [x] check: when the current branch is known (BACKLOG_BRANCH, else git when available; silently skipped otherwise) and matches the pattern, the issue it encodes must exist and be in-progress, review or blocked
- [x] README config table and SKILL.md hard rules mention it; tests cover each rule; npm run verify is green

## Notes

## Log
- 2026-11-11 18:34 claude: started; plan in progress/ISS-0007.md
- 2026-11-11 18:34 claude: plan: tests first; helpers branchRegex/currentBranch; wire into startIssue + collectChecks; docs. Note start already accepts --branch (records only when given); auto-detect of git branch is new and only active with branchPattern
- 2026-11-11 18:35 claude: RED: 8 of 14 new branchPattern tests fail as expected (33 others pass); implementing helpers next
- 2026-11-11 18:36 claude: GREEN: 41/41 backlog tests; README + SKILL updated
- 2026-11-11 18:36 claude: done: Added opt-in branchPattern: helpers (branchRegex/parseBranch/expectedBranch/branchProblem/currentBranch) in backlog.m...

## Outcome
Added opt-in branchPattern: helpers (branchRegex/parseBranch/expectedBranch/branchProblem/currentBranch) in backlog.mjs; start/next --claim record the branch (--branch, else current branch when pattern set) and warn on mismatch to stderr; check rules (a) and (b). 14 new tests (RED 8 failing, then GREEN 41/41). Before: start recorded --branch only when given, no git detection. README and SKILL updated. Follow-up: none.
Added opt-in branchPattern: helpers (branchRegex/parseBranch/expectedBranch/branchProblem/currentBranch) in backlog.mjs; start/next --claim record the branch (--branch, else current branch when pattern set) and warn on mismatch to stderr; check rules (a) and (b). 14 new tests (RED 8 failing, then GREEN 41/41). Before: start recorded --branch only when given, no git detection. README and SKILL updated. Follow-up: none.
