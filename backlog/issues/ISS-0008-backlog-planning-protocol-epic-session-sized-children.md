---
id: ISS-0008
title: "backlog: planning protocol (epic + session-sized children)"
kind: feature
status: done
priority: P1
area: backlog
parent:
depends_on: [ISS-0007]
created: 2026-11-11
updated: 2026-11-11
due:
owner:
branch:
estimate: S
tags: [memento]
---

## Context
Turning an idea into work is the step agents do worst. A short protocol in SKILL.md replaces per-project PRD skills. Memento SPEC-0002 U3.

## Scope

## Acceptance criteria
- [x] skills/backlog/SKILL.md has a Planning a feature section: clarifying questions first in one message with lettered options; an epic via new --kind epic; children with --parent, each describable in three sentences, one area, verifiable criteria, ordered with --depends-on
- [x] it says architectural changes get a spec (docmap new docs/specs --template spec) before any epic
- [x] SKILL.md stays under 130 lines and README mentions the protocol
- [x] npm run verify is green

## Notes

## Log
- 2026-11-11 18:39 claude: started; plan in progress/ISS-0008.md
- 2026-11-11 18:40 claude: plan: add Planning a feature section before Work loop; README paragraph in intro
- 2026-11-11 18:40 claude: wrote SKILL.md section and README paragraph
- 2026-11-11 18:40 claude: done: Added a "Planning a feature" 5-step protocol to skills/backlog/SKILL.md (116 lines) and a README intro paragraph; ver...

## Outcome
Added a "Planning a feature" 5-step protocol to skills/backlog/SKILL.md (116 lines) and a README intro paragraph; verified with npm run verify.
