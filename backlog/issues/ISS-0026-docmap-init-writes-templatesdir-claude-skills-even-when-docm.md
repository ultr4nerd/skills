---
id: ISS-0026
title: docmap init writes templatesDir .claude/skills/... even when docmap is installed elsewhere
kind: bug
status: done
priority: P2
area: docmap
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
Found by the ISS-0024 smoke run: installed with --agent codex into .agents/skills/docmap, docmap init still wrote templatesDir .claude/skills/docmap/templates (DEFAULT at docmap.mjs:34); it only works through the fallback in templatesDir() (docmap.mjs:1056). Derive the default from the script's own location (path relative to the project root).

## Scope

## Acceptance criteria
- [x] docmap init writes templatesDir relative to where docmap.mjs actually lives
- [x] existing docmap.json is never rewritten
- [x] test covers an install under .agents/skills
- [x] npm run verify green

## Notes

## Log
- 2026-11-18 17:57 claude: started; plan in progress/ISS-0026.md
- 2026-11-18 17:58 claude: plain loop (no crew, no subagents, no review): init derives templatesDir from the script's own location when inside the project; test proven red on old code, green now (docmap 23 tests)
- 2026-11-18 17:58 claude: verify passed: npm run verify
- 2026-11-18 17:58 claude: done: docmap init now writes templatesDir as the installed copy's path relative to the project (e.g. .agents/skills/docmap/...

## Outcome
docmap init now writes templatesDir as the installed copy's path relative to the project (e.g. .agents/skills/docmap/templates) when the script lives inside it, and keeps the default otherwise; an existing docmap.json is never rewritten. Test copies the skill under .agents/skills and checks both runs and the outside-project default; red on the old code, green now. README config row updated. Verify green (run by done). Built with the plain loop as the control for ISS-0022: 17:57 -> 17:58 (about 2 min of work), no review.
