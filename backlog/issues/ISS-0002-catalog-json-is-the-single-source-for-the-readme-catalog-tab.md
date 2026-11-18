---
id: ISS-0002
title: catalog.json is the single source for the README catalog table
kind: chore
status: todo
priority: P1
area: repo
parent: ISS-0003
depends_on: []
created: 2026-10-23
updated: 2026-11-18
due:
owner:
branch:
estimate: M
tags: [setup]
---

## Context
The README table and the setup skill both need the list of skills with category, one-line summary and triggers. Keep it once in catalog.json and generate the README section from it.

Interfaces: produces `catalog.json` at the repo root, shape `{ "skills": [{ "name", "category" (software | tool-guide | orchestration | setup), "summary", "triggers", "requires": [skill names] }] }`, and `scripts/catalog.mjs` with `--write` (regenerate) and `--check` (exit 1 when stale). ISS-0023 adds `skills/setup/references/catalog.md` as a second generated output.

## Scope

## Acceptance criteria
- [ ] catalog.json at the repo root lists every skill with name, category (software | tool-guide | orchestration | setup), summary, triggers, requires (hard deps) and optional (soft deps)
- [ ] scripts/verify.mjs fails when a skill folder is missing from catalog.json, an entry names an unknown skill, a name is duplicated, a category is unknown, a requires/optional target does not exist, or the README table is stale
- [ ] node scripts/catalog.mjs --write regenerates the README sections between markers; --check exits 1 when stale; missing or duplicated markers fail without touching the README
- [ ] tests/catalog.test.mjs covers the validation errors and the marker handling
- [ ] README documents the flow


## Notes

## Log
- 2026-11-04 13:11 ultr4nerd: parked: only needed by the setup skill (ISS-0003), not wanted yet

## Outcome
<!-- filled by `backlog done`: what shipped, how it was verified, learnings, follow-ups -->
