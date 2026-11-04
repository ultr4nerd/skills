---
id: ISS-0002
title: catalog.json is the single source for the README catalog table
kind: chore
status: backlog
priority: P2
area: repo
parent:
depends_on: []
created: 2026-10-23
updated: 2026-11-04
due:
owner:
branch:
estimate: M
tags: [setup]
---

## Context
The README table and the setup skill both need the list of skills with category, one-line summary and triggers. Keep it once in catalog.json and generate the README section from it.

## Scope

## Acceptance criteria
- [ ] catalog.json at the repo root lists every skill with name, category, summary, triggers
- [ ] scripts/verify.mjs fails when a skill folder is missing from catalog.json or the README table is stale
- [ ] node scripts/catalog.mjs --write regenerates the README table between markers
- [ ] README documents the flow

## Notes

## Log
- 2026-11-04 13:11 ultr4nerd: parked: only needed by the setup skill (ISS-0003), not wanted yet

## Outcome
<!-- filled by `backlog done`: what shipped, how it was verified, learnings, follow-ups -->
