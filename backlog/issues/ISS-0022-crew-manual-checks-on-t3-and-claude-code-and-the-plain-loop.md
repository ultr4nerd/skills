---
id: ISS-0022
title: "crew: manual checks on T3 and Claude Code, and the plain-loop vs crew measure"
kind: chore
status: todo
priority: P1
area: crew
parent:
depends_on: [ISS-0021]
created: 2026-11-18
updated: 2026-11-18
due:
owner:
branch:
estimate: M
tags: []
---

## Context
Acceptance from docs/specs/crew-v1-...: run a real M-sized issue through crew on T3 (critic/reviewer on OpenAI via a runtime that serves it; note Codex is unauthenticated in T3 as of 2026-11-18, Pi serves github-copilot/gpt-6-astra) and on Claude Code (critic/reviewer fall back, logged). Then the success measure: same kind of feature with the plain backlog loop vs crew.

## Scope

## Acceptance criteria
- [x] T3 run: both gates stop, critic and reviewer ran on an OpenAI model (Log shows the seat lines), PRs against main
- [ ] Claude Code run: seat fallbacks appear in the Log and final report, report says review not independent
- [x] measure recorded: wall time, findings fixed before merge, defects after merge, for plain loop vs crew
- [x] decision on keeping progress/<ID>/ (open question in the spec) recorded

## Notes

## Log
- 2026-11-18 17:38 claude: crew run on ISS-0003 (T3, 2026-11-18): 16:29 -> 17:39 wall (~70 min incl. 2 merge waits); seats: critic/reviewer pi/gpt-6-astra, implementer claudeAgent/sonnet, orchestrator opus; advisor never triggered. Found before merge: critique 7 points; ISS-0002 1 Important + 2 Minor; ISS-0023 1 Critical + 6 Important + 1 Minor over 3 rounds; smoke run 1 Critical (install syntax, from the orchestrator's own brief) + 9 minor. crew/backlog frictions found: epic progress dir orphan (fixed #23), epic dir blocks closing the epic (crew SKILL.md fix), per-branch issue ids collide, INDEX.md conflicts between parallel PRs.
- 2026-11-18 17:58 claude: control (plain loop) on ISS-0026: S bug, 17:57 -> 17:58, 0 findings before merge (no review run). Not comparable in size to the crew epic (L); the useful comparison is per-stage yield: on ISS-0003, crew's reviews found 1 Critical + 7 Important before merge that the implementer's own tests passed, and the agent smoke run found 1 Critical that reviews missed.
- 2026-11-18 17:58 claude: decision on progress/<ID>/: keep backlog done deleting it; copying verdicts, rulings and seat lines into the Log before done worked in all 3 children and the epic (no backlog change).
- 2026-11-18 17:58 claude: verdict: keep crew. Cost ~70 min wall for an L epic incl. merge waits; it caught bugs the plain loop would have shipped. Changes for crew v1.1: add an agent smoke run step for skills/protocols (it found what reviews could not, because reviewers accept the brief as given); reviewers should be told to question the brief's own facts.
- 2026-11-18 17:58 claude: learning: docs/learnings/0005-backlog-issue-ids-are-allocated-per-branch-two-open-branches-can-create-the-same-id.md

## Outcome
<!-- filled by `backlog done`: what shipped, how it was verified, learnings, follow-ups -->
