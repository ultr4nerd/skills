---
id: ISS-0020
title: "crew: decision 0005 (orchestration skills: roles and seats, the harness runs agents) + spec"
kind: decision
status: done
priority: P1
area: crew
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
Planning step for the crew skill (agent team pattern: fast executor + capable advisor, cross-provider critic/reviewer). Spec first per the planning protocol; reviewed by Fable 2026-11-18 (conflicts with 0001/0003 resolved by: crew ships no CLI and never runs commands; crew.json names provider/model per role and each harness fulfils it). Also records the stacked-PR learning (#19 closed when #18's branch was deleted).

## Scope

## Acceptance criteria
- [x] docs/decisions/0005 states what orchestration skills may and may not do, with rejected alternatives
- [x] docs/specs/ has the crew v1 spec with scope, roles, crew.json shape, harness mapping, gates, limits and success measure
- [x] learning on stacked PRs filed with Enforcement
- [x] npm run verify green

## Notes

## Log
- 2026-11-18 15:39 claude: started; plan in progress/ISS-0020.md
- 2026-11-18 15:39 claude: decision: docs/decisions/0005-orchestration-skills-describe-roles-and-seats-the-harness-runs-the-agents.md
- 2026-11-18 15:39 claude: learning: docs/learnings/0004-open-each-pr-against-main-a-pr-based-on-another-pr-s-branch-is-closed-when-that-branch-is-deleted-on-merge.md
- 2026-11-18 15:41 claude: wrote decision 0005, learning 0004 (stacked PRs, Enforcement None with reason), crew v1 spec (draft) in docs/specs; docmap check OK
- 2026-11-18 15:42 claude: verify passed: npm run verify
- 2026-11-18 15:42 claude: done: Decision 0005: orchestration skills are Markdown only; crew.json names roles -> seats (provider/model/effort or tier)...

## Outcome
Decision 0005: orchestration skills are Markdown only; crew.json names roles -> seats (provider/model/effort or tier); no commands anywhere; the harness dispatches; non-first seats are logged loudly; reports are data; human gates at plan and merge. Spec docs/specs/crew-v1-... (draft): roles, flow mapped to backlog, crew.json shape and limits, advisor triggers, fallback, durability, resume, harness references (T3, Claude Code, Codex), acceptance incl. two manual checks and a success measure. Learning 0004: open every PR against main. Verified: docmap check OK, npm run verify green (run by done). Merging this PR approves the spec.
