---
id: ISS-0003
title: "setup skill: install and explain the skills in a project"
kind: feature
status: backlog
priority: P2
area: setup
parent:
depends_on: [ISS-0002]
created: 2026-10-23
updated: 2026-11-11
due:
owner:
branch:
estimate: L
tags: [setup]
---

## Context
A skill that an agent runs in a fresh project: asks the project type (software, content, mixed), recommends skills from catalog.json, runs npx skills add ultr4nerd/skills --skill ... -y, wires package.json scripts, runs docmap init, writes an AGENTS.md stub. Never reimplements npx skills add.

## Scope

## Acceptance criteria
- [ ] skills/setup/SKILL.md under 150 lines, protocol in 5 steps
- [ ] references/catalog.md generated from catalog.json
- [ ] smoke test: fresh temp dir ends with .claude/skills, package.json scripts, docs/INDEX.md, AGENTS.md
- [ ] listed in README and verify is green

## Notes
- Also install the roles a project needs for long unsupervised runs: a generic review protocol
  (criterion-by-criterion verdict written to `progress/<ID>/review.md`, needs ISS-0006) and
  leader / implementer / reviewer role texts with thin per-harness wrappers (`.claude/agents/`,
  `.opencode/agents/`, `.codex/agents/*.toml`). Reference implementation: Memento's
  `.agents/roles/` and wrappers (SPEC-0001); requested by Memento SPEC-0002 U4.

## Log
- 2026-11-04 13:11 ultr4nerd: parked until the owner decides to build the setup skill
- 2026-11-11 18:28 ultr4nerd: scope note: include review protocol and role wrappers (Memento SPEC-0002 U4)

## Outcome
<!-- filled by `backlog done`: what shipped, how it was verified, learnings, follow-ups -->
