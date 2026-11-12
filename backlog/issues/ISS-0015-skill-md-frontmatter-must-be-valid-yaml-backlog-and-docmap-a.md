---
id: ISS-0015
title: "SKILL.md frontmatter must be valid YAML: backlog and docmap are skipped by npx skills add"
kind: bug
status: done
priority: P1
area: repo
parent:
depends_on: []
created: 2026-11-11
updated: 2026-11-11
due:
owner:
branch:
estimate: S
tags: []
---

## Context
npx skills add ultr4nerd/skills (and add . --list) skips backlog and docmap with 'YAML parse error: Nested mappings are not allowed in compact mappings': their description is an unquoted scalar containing ': ' (backlog.json: when..., docmap.json: when...). verify reads frontmatter with a regex, so it stays green. Found 2026-11-11 while reinstalling the whatsapp skill.

## Scope

## Acceptance criteria
- [x] backlog and docmap descriptions are quoted so the frontmatter parses as YAML; npx skills add . --list lists all four skills with no SKIPPED warning
- [x] verify rejects an unquoted frontmatter value containing ': ' or ' #', and strips quotes before the description length check
- [x] npm run verify is green

## Notes

## Log
- 2026-11-11 23:10 claude: started; plan in progress/ISS-0015.md
- 2026-11-11 23:11 claude: quoted backlog/docmap descriptions (JSON-style double quotes); verify now rejects unquoted values with ': ' or ' #' and unquotes before the length check; proved by restoring main's backlog SKILL.md (verify fails) and by npx skills add . --list (4 skills, 0 SKIPPED)
- 2026-11-11 23:11 claude: done: backlog and docmap SKILL.md descriptions are now double-quoted YAML strings, so npx skills add parses them: 'npx skil...
- 2026-11-11 23:11 claude: learning: docs/learnings/0003-verify-must-validate-skill-md-frontmatter-the-way-installers-parse-it-strict-yaml-not-with-a-regex.md

## Outcome
backlog and docmap SKILL.md descriptions are now double-quoted YAML strings, so npx skills add parses them: 'npx skills add . --list' lists backlog, design, docmap and whatsapp with no SKIPPED warning (before: backlog and docmap skipped with 'Nested mappings are not allowed in compact mappings'). scripts/verify.mjs rejects any unquoted frontmatter value containing ': ' or ' #' and unquotes values before the name and description checks; restoring main's backlog SKILL.md makes verify fail with that message. npm run verify: OK.
