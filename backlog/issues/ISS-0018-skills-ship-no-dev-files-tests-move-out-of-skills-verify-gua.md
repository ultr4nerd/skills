---
id: ISS-0018
title: "skills ship no dev files: tests move out of skills/, verify guards layout and SKILL.md size"
kind: chore
status: done
priority: P1
area: repo
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
npx skills add copies skills/<name>/scripts/<name>.test.mjs into the user's project (checked 2026-11-18 with skills@latest into a scratch repo). Tests are dev files; they belong outside skills/. Also guard SKILL.md under 20000 bytes (Claude Code truncates invoked skills to 20k chars after compaction; idea from obra/superpowers tests/skill-size).

## Scope

## Acceptance criteria
- [x] every skills/*/scripts/*.test.mjs lives under tests/ and npm test runs them
- [x] verify fails when any file matching *.test.* or a tests dir exists under skills/
- [x] verify fails when a SKILL.md is 20000 bytes or more
- [x] npm run verify green

## Notes

## Log
- 2026-11-18 15:16 claude: started; plan in progress/ISS-0018.md
- 2026-11-18 15:18 claude: moved 3 test files to tests/, verify walks skills/ for dev files and checks SKILL.md < 20000 bytes; both guards proven red with a planted file, then green (120 tests)
- 2026-11-18 15:18 claude: done: Tests moved from skills/*/scripts/ to tests/ (npm test and verify read tests/*.test.mjs; READMEs and AGENTS.md map up...

## Outcome
Tests moved from skills/*/scripts/ to tests/ (npm test and verify read tests/*.test.mjs; READMEs and AGENTS.md map updated). verify now fails on *.test.*/*.spec.* files or tests/fixtures dirs under skills/ and on a SKILL.md of 20000+ bytes. Verified: planted skills/backlog/scripts/x.test.mjs -> verify red with the message; padded docmap SKILL.md to 20k -> red; clean tree -> verify OK, 120/120 tests.
