---
id: ISS-0021
title: "crew v1: Markdown skill (roles, seats, gates) with harness references"
kind: feature
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
estimate: M
tags: []
---

## Context
Implements docs/specs/crew-v1-an-agent-team-with-roles-seats-and-human-gates.md under decision 0005. Found while starting: in T3 a model can be reachable through several runtimes (gpt-6-astra via Pi/github-copilot while Codex is unauthenticated), so a seat names vendor+model and the harness picks any route that serves it.

## Scope

## Acceptance criteria
- [x] skills/crew has SKILL.md (<20KB, valid frontmatter), README.md, crew.example.json, references/{t3,claude-code,codex,roles}.md and no scripts
- [x] verify parses crew.example.json and rejects command-like keys (run, cmd, command, exec, shell)
- [x] README catalog has an Orchestration section listing crew
- [x] npm run verify green

## Notes

## Log
- 2026-11-18 15:49 claude: started; plan in progress/ISS-0021.md
- 2026-11-18 15:55 claude: wrote skills/crew (SKILL.md 8.8KB, README, crew.example.json, references roles/t3/claude-code/codex); verify checks *.example.json parse and crew command-like keys (proved red with a planted run key); catalog Orchestration section; npx skills add --list shows crew
- 2026-11-18 15:55 claude: cross-provider review by github-copilot/gpt-6-astra via T3 delegate_task (Pi runtime): rework, 10 findings, all accepted and fixed: one branch+PR per child from main, done --outcome, spec FAIL after cap blocks instead of parking, read-only roles may write their output file, brief vs data distinction, Resuming section, implementer escalation contract, t3 native tool per provider, codex seat fallback order, short replies for explorers
- 2026-11-18 15:55 claude: verify passed: npm run verify
- 2026-11-18 15:55 claude: done: skills/crew v1 shipped as an orchestration skill (decision 0005): SKILL.md protocol (roles, seats with loud fallback,...

## Outcome
skills/crew v1 shipped as an orchestration skill (decision 0005): SKILL.md protocol (roles, seats with loud fallback, flow with Gate 1 plan approval and Gate 2 merge, fixed advisor triggers, fix loop capped and blocking on spec failure, resume from files), references for roles, T3, Claude Code and Codex, crew.example.json, README. verify now parses every *.example.json and rejects command-like keys in crew's. Catalog has an Orchestration section. Verified: verify green (run by done), planted run key turned it red, installer lists crew, SKILL.md 8.8KB. Reviewed by gpt-6-astra (Pi runtime in T3): 10 findings fixed. Manual checks and the success measure are ISS-0022.
