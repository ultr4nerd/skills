---
id: ISS-0024
title: "setup: smoke run in a fresh project by an agent following the skill"
kind: chore
status: done
priority: P1
area: setup
parent: ISS-0003
depends_on: [ISS-0023]
created: 2026-11-18
updated: 2026-11-18
due:
owner:
branch:
estimate: S
tags: []
---

## Context
Manual check of the setup protocol: a subagent with only skills/setup (installed from this repo's local path) runs it in an empty temp git repo with a package.json. Interfaces: consumes the skill from the previous child.

## Scope

## Acceptance criteria
- [x] run 1 (Claude Code agent dir): empty temp git repo with package.json (test script); every skill installed from the local checkout path; ends with package.json scripts docmap and backlog, docs/INDEX.md, backlog.json verify, AGENTS.md; the configured verify runs and exits 0
- [x] run 2 (non-Claude agent dir): wired script paths point to where the installer put the skills, and both CLIs run
- [x] rerun in the run 1 dir changes nothing (git status clean)
- [x] skills CLI version and source commit recorded; every behaviour contradicting a criterion is fixed in skills/setup, never ruled away
- [x] transcript summary logged in this issue


## Notes

## Log
- 2026-11-18 17:32 claude: started; plan in progress/ISS-0024.md
- 2026-11-18 17:32 claude: crew: base 5fd8290; same branch as ISS-0023 per epic ruling
- 2026-11-18 17:36 claude: smoke run 0 (claudeAgent/sonnet, skills 1.9.0): FAIL as written: --skill a,b,c exits 1 (SKILLS_NO_MATCHING_SKILLS); orchestrator reproduced (comma exit 1, space exit 0). Root cause: the comma form came from the orchestrator's ISS-0023 brief and both reviews took it as given. Also 9 smaller deviations (skills-lock.json unmentioned, installer summary names another dir, rerun reinstalls, design row for missing DESIGN.md, ...). Fixed in skills/setup and root README; docmap init templatesDir default is a separate docmap bug.
- 2026-11-18 17:37 claude: smoke run 1 (claudeAgent/sonnet, skills 1.9.0, source = local checkout at this branch): run1 Claude Code PASS (.claude/skills, copies), rerun PASS (git status empty), run2 Codex PASS (.agents/skills); docmap/backlog check exit 0, verify npm test exit 0, AGENTS.md uses resolved invocations. Orchestrator re-inspected both dirs. Remaining: rerun with nothing to install (fixed in SKILL.md), docmap templatesDir (ISS-0026).
- 2026-11-18 17:37 claude: verify passed: npm run verify
- 2026-11-18 17:37 claude: done: setup verified end to end by an agent following it literally in two fresh Node projects (skills 1.9.0, local source)....

## Outcome
setup verified end to end by an agent following it literally in two fresh Node projects (skills 1.9.0, local source). Run 0 failed as written: --skill comma list exits 1 (the form came from the orchestrator's brief; both reviews missed it); fixed to space-separated, plus skills-lock.json noted, rerun skips installed skills, find prunes .git, verify example for test only, AGENTS.md design row and tags; root README install example had the same comma bug. Run 1: Claude Code and Codex runs pass, rerun leaves git status empty. docmap templatesDir default filed as ISS-0026.
