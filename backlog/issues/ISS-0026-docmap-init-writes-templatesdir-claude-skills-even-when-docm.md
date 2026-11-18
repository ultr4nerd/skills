---
id: ISS-0026
title: docmap init writes templatesDir .claude/skills/... even when docmap is installed elsewhere
kind: bug
status: todo
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
- [ ] docmap init writes templatesDir relative to where docmap.mjs actually lives
- [ ] existing docmap.json is never rewritten
- [ ] test covers an install under .agents/skills
- [ ] npm run verify green

## Notes

## Log

## Outcome
<!-- filled by `backlog done`: what shipped, how it was verified, learnings, follow-ups -->
