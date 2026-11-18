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
- [ ] T3 run: both gates stop, critic and reviewer ran on an OpenAI model (Log shows the seat lines), PRs against main
- [ ] Claude Code run: seat fallbacks appear in the Log and final report, report says review not independent
- [ ] measure recorded: wall time, findings fixed before merge, defects after merge, for plain loop vs crew
- [ ] decision on keeping progress/<ID>/ (open question in the spec) recorded

## Notes

## Log
- 2026-11-18 17:38 claude: crew run on ISS-0003 (T3, 2026-11-18): 16:29 -> 17:39 wall (~70 min incl. 2 merge waits); seats: critic/reviewer pi/gpt-6-astra, implementer claudeAgent/sonnet, orchestrator opus; advisor never triggered. Found before merge: critique 7 points; ISS-0002 1 Important + 2 Minor; ISS-0023 1 Critical + 6 Important + 1 Minor over 3 rounds; smoke run 1 Critical (install syntax, from the orchestrator's own brief) + 9 minor. crew/backlog frictions found: epic progress dir orphan (fixed #23), epic dir blocks closing the epic (crew SKILL.md fix), per-branch issue ids collide, INDEX.md conflicts between parallel PRs.

## Outcome
<!-- filled by `backlog done`: what shipped, how it was verified, learnings, follow-ups -->
