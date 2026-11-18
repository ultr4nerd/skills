---
id: ISS-0002
title: catalog.json is the single source for the README catalog table
kind: chore
status: done
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
- [x] catalog.json at the repo root lists every skill with name, category (software | tool-guide | orchestration | setup), summary, triggers, requires (hard deps) and optional (soft deps)
- [x] scripts/verify.mjs fails when a skill folder is missing from catalog.json, an entry names an unknown skill, a name is duplicated, a category is unknown, a requires/optional target does not exist, or the README table is stale
- [x] node scripts/catalog.mjs --write regenerates the README sections between markers; --check exits 1 when stale; missing or duplicated markers fail without touching the README
- [x] tests/catalog.test.mjs covers the validation errors and the marker handling
- [x] README documents the flow


## Notes

## Log
- 2026-11-04 13:11 ultr4nerd: parked: only needed by the setup skill (ISS-0003), not wanted yet
- 2026-11-18 17:02 claude: started; plan in progress/ISS-0002.md
- 2026-11-18 17:02 claude: crew: gate 1 approved by Mauricio (merged #24); base 560c11a
- 2026-11-18 17:04 claude: implementer (claudeAgent/sonnet) DONE da6c968; orchestrator checked: verify green 146 tests, catalog --check OK, README tables byte-identical
- 2026-11-18 17:06 claude: review round 0 (pi/gpt-6-astra): Spec FAIL, Quality FAIL; 1 Important (duplicate marker of a later category inside an earlier region slipped through and README was rewritten), 2 Minor (missing validation tests, Development text 4 lines). All accepted.
- 2026-11-18 17:06 claude: fix round 1: implementer cab231a; orchestrator reproduced the marker case: exit 1, README untouched; verify green 154 tests
- 2026-11-18 17:07 claude: review round 1 (pi/gpt-6-astra): Spec PASS, Quality PASS; 3/3 previous findings fixed; no new findings; nothing parked
- 2026-11-18 17:08 claude: verify passed: npm run verify
- 2026-11-18 17:08 claude: done: catalog.json lists every skill (name, category, summary, triggers, requires, optional); scripts/catalog.mjs --write/-...

## Outcome
catalog.json lists every skill (name, category, summary, triggers, requires, optional); scripts/catalog.mjs --write/--check regenerates the README tables between per-category markers, validating markers on the original text (missing, duplicated, overlapping -> exit 1, file untouched). verify fails on validation problems or a stale README. tests/catalog.test.mjs covers every validation error and marker case. Built by crew: implementer claudeAgent/sonnet (da6c968, cab231a), reviewer pi/gpt-6-astra: round 0 FAIL (1 Important, 2 Minor), round 1 PASS. Verified: verify green 154 tests (run by done); orchestrator reproduced the duplicate-marker case (exit 1, README untouched).
