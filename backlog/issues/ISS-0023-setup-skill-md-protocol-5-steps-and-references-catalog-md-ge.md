---
id: ISS-0023
title: "setup: SKILL.md protocol (5 steps) and references/catalog.md generated from catalog.json"
kind: feature
status: done
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
- [x] skills/setup/SKILL.md under 150 lines with 5 numbered steps: preflight, recommend, install, wire, AGENTS.md
- [x] preflight: target root is the git root; Node >= 20 and npx present; package.json present (else offer npm init -y with consent, or stop); existing backlog.json, docmap.json or package.json that is invalid JSON stops setup with no writes
- [x] recommend: from references/catalog.md, hard deps (requires) added to the selection; the user confirms the full list before anything is installed; refused or partial confirmation is honoured
- [x] install: npx skills add with the confirmed --skill list (source overridable, for local checkouts); a non-zero exit stops setup; after install, locate the installed scripts on disk and use those paths
- [x] wire: add only missing package.json scripts (never overwrite); docmap init only when docmap.json is absent and no hand-written docs/INDEX.md exists (else ask); backlog.json verify derived from existing scripts (test, lint, typecheck) and confirmed by the user
- [x] AGENTS.md written from a stub only if missing; crew offered as optional for multi-agent work
- [x] scripts/catalog.mjs --write also generates skills/setup/references/catalog.md; verify fails when stale
- [x] skills/setup/README.md documents requirements (Node >= 20, skills CLI version checked against) and what setup never does
- [x] setup is in catalog.json and the README catalog; npm run verify green


## Notes

## Log
- 2026-11-18 17:23 claude: started; plan in progress/ISS-0023.md
- 2026-11-18 17:23 claude: crew: base e1d2835
- 2026-11-18 17:27 claude: implementer (claudeAgent/sonnet) DONE 1cd1593; orchestrator checked: verify green 158 tests, catalog --check OK, SKILL.md 108 lines
- 2026-11-18 17:28 claude: review round 0 (pi/gpt-6-astra): Spec FAIL, Quality FAIL; 1 Critical (docmap init may overwrite hand-written INDEX.md below docs/), 5 Important (package.json created before JSON checks; alias collision runs unrelated script; symlink/nested node_modules discovery; partial selection not gating init; AGENTS.md rules for uninstalled skills), 1 Minor (overlap test masked by setup fixture). All accepted.
- 2026-11-18 17:30 claude: fix round 1: implementer e921b13; orchestrator checked verify green, SKILL.md 119 lines, discovery/docmap/alias rules present
- 2026-11-18 17:31 claude: review round 1 (pi/gpt-6-astra): Spec FAIL; F1,F3-F7 fixed; F2 open: AGENTS.md generation still emits npm run <name> for a preserved colliding alias. Accepted; round 2 of 2.
- 2026-11-18 17:32 claude: review round 2 (pi/gpt-6-astra): Spec PASS, Quality PASS; F2 fixed; nothing parked
- 2026-11-18 17:32 claude: verify passed: npm run verify
- 2026-11-18 17:32 claude: done: skills/setup shipped: tool guide (0003) for the skills CLI 1.9.0, SKILL.md 121 lines in 5 steps (read-only preflight ...

## Outcome
skills/setup shipped: tool guide (0003) for the skills CLI 1.9.0, SKILL.md 121 lines in 5 steps (read-only preflight then consented npm init; recommend from generated references/catalog.md with hard deps; npx skills add after confirmation, non-zero stops; wire gated per skill on confirmed+installed+discovered+resolving alias, find -L discovery, docmap init only when every docs INDEX.md is generated, backlog.json verify confirmed; AGENTS.md only if missing with resolved invocations). scripts/catalog.mjs also generates skills/setup/references/catalog.md; README Setup section. Built by crew: implementer claudeAgent/sonnet (1cd1593, e921b13, 5647288); reviewer pi/gpt-6-astra: round 0 FAIL (1 Critical, 5 Important, 1 Minor), round 1 FAIL (1 Important), round 2 PASS. Verified: verify green, 158 tests (run by done). End-to-end run is ISS-0024.
