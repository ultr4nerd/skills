---
id: ISS-0017
title: "learnings record their enforcement: the check that stops a repeat"
kind: feature
status: done
priority: P1
area: docmap
parent:
depends_on: []
created: 2026-11-18
updated: 2026-11-18
due:
owner:
branch:
estimate: M
tags: [docmap, backlog, learnings]
---

## Context
Lauren Tan's talk 'All Code Is Slop (Except Mine)' (AI Engineer, 2026-11): every correction to an agent should become a deterministic check (API, lint, type, test, verify), with prose as the last layer. Today a learning ends as prose (## Lesson, ## Apply when) and nothing asks whether it could be a check. learnings-0003 is the one that became a verify check, by accident.

## Scope

## Acceptance criteria
- [x] docmap learning template has an ## Enforcement section (the check, or 'None: <why>')
- [x] docmap check warns when a learning lacks ## Enforcement
- [x] backlog retro also lists learnings whose Enforcement is missing, empty or still the template placeholder
- [x] backlog and docmap SKILL.md tell the agent to try a check before writing a learning; READMEs updated
- [x] existing learnings 0001-0003 get an Enforcement section
- [x] tests cover the new check and retro behaviour; npm run verify green

## Notes

## Log
- 2026-11-18 14:42 claude: started; plan in progress/ISS-0017.md
- 2026-11-18 14:45 claude: decision: docs/decisions/0004-learnings-end-in-a-deterministic-check-when-one-is-possible-prose-is-the-last-layer.md
- 2026-11-18 14:46 claude: implemented docmap Enforcement section + check, retro listing, docs, decision 0004; side fix: learn dedupes tags (area repeated in tags)
- 2026-11-18 14:46 claude: done: Learnings now end with `## Enforcement`: the deterministic check that stops a repeat, or

## Outcome
Learnings now end with `## Enforcement`: the deterministic check that stops a repeat, or
`None: <why>`. docmap: template section, `check` warns when it is missing, empty or still the
template text. backlog: `retro` also lists open learnings of any age (plain `--json` keeps its
array; `--json --learnings` returns `{ issues, learnings }`); `learn` names the section; SKILL.md
work loop says "try a check first". Decision 0004 records the rule (source: Lauren Tan, "All Code
Is Slop (Except Mine)"); AGENTS.md rule 3 points to it; learnings 0001-0003 have Enforcement
(only 0003 is a real check). Side fix: `learn` deduplicated tags when the area is also a tag.
Verified: new docmap and backlog tests, `npm run verify` green (docmap 22, backlog 43 tests),
`backlog retro` on this repo shows no open learnings.
Follow-up candidate: pre-push guard for learning 0001 (not filed).
