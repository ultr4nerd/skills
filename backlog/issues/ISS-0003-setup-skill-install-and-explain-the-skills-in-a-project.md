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
updated: 2026-11-04
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

## Log
- 2026-11-04 13:11 ultr4nerd: parked until the owner decides to build the setup skill

## Outcome
<!-- filled by `backlog done`: what shipped, how it was verified, learnings, follow-ups -->
