---
id: ISS-0023
title: "setup: SKILL.md protocol (5 steps) and references/catalog.md generated from catalog.json"
kind: feature
status: todo
priority: P1
area: setup
parent: ISS-0003
depends_on: [ISS-0002]
created: 2026-11-18
updated: 2026-11-18
due:
owner:
branch:
estimate: M
tags: []
---

## Context
Interfaces: consumes catalog.json from ISS-0002 (skills[].name, category, summary, triggers, requires) and scripts/catalog.mjs; produces skills/setup/SKILL.md and skills/setup/references/catalog.md (generated, never hand-edited). Decisions from planning (2026-11-18): software projects only; recommends crew for multi-agent work instead of shipping role wrappers; installation via npx skills add letting it pick the agent's directory (never reimplemented); AGENTS.md written only if missing.

## Scope

## Acceptance criteria
- [ ] skills/setup/SKILL.md under 150 lines with 5 numbered steps: preflight, recommend, install, wire, AGENTS.md
- [ ] preflight: target root is the git root; Node >= 20 and npx present; package.json present (else offer npm init -y with consent, or stop); existing backlog.json, docmap.json or package.json that is invalid JSON stops setup with no writes
- [ ] recommend: from references/catalog.md, hard deps (requires) added to the selection; the user confirms the full list before anything is installed; refused or partial confirmation is honoured
- [ ] install: npx skills add with the confirmed --skill list (source overridable, for local checkouts); a non-zero exit stops setup; after install, locate the installed scripts on disk and use those paths
- [ ] wire: add only missing package.json scripts (never overwrite); docmap init only when docmap.json is absent and no hand-written docs/INDEX.md exists (else ask); backlog.json verify derived from existing scripts (test, lint, typecheck) and confirmed by the user
- [ ] AGENTS.md written from a stub only if missing; crew offered as optional for multi-agent work
- [ ] scripts/catalog.mjs --write also generates skills/setup/references/catalog.md; verify fails when stale
- [ ] skills/setup/README.md documents requirements (Node >= 20, skills CLI version checked against) and what setup never does
- [ ] setup is in catalog.json and the README catalog; npm run verify green


## Notes

## Log

## Outcome
<!-- filled by `backlog done`: what shipped, how it was verified, learnings, follow-ups -->
