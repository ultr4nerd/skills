---
id: ISS-0024
title: "setup: smoke run in a fresh project by an agent following the skill"
kind: chore
status: todo
priority: P1
area: setup
parent: ISS-0003
depends_on: [ISS-0023]
created: 2026-11-18
updated: 2026-11-18
due:
owner:
branch:
estimate: S
tags: []
---

## Context
Manual check of the setup protocol: a subagent with only skills/setup (installed from this repo's local path) runs it in an empty temp git repo with a package.json. Interfaces: consumes the skill from the previous child.

## Scope

## Acceptance criteria
- [ ] run 1 (Claude Code agent dir): empty temp git repo with package.json (test script); every skill installed from the local checkout path; ends with package.json scripts docmap and backlog, docs/INDEX.md, backlog.json verify, AGENTS.md; the configured verify runs and exits 0
- [ ] run 2 (non-Claude agent dir): wired script paths point to where the installer put the skills, and both CLIs run
- [ ] rerun in the run 1 dir changes nothing (git status clean)
- [ ] skills CLI version and source commit recorded; every behaviour contradicting a criterion is fixed in skills/setup, never ruled away
- [ ] transcript summary logged in this issue


## Notes

## Log

## Outcome
<!-- filled by `backlog done`: what shipped, how it was verified, learnings, follow-ups -->
