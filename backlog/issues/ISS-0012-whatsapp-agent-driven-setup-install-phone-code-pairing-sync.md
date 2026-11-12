---
id: ISS-0012
title: "whatsapp: agent-driven setup (install, phone-code pairing, sync service)"
kind: feature
status: done
priority: P2
area: whatsapp
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
ISS-0011 shipped the whatsapp guide with setup left to the user (never install, never run auth). The agent can do almost all of it: install through the official channel, pair by phone-number code (wacli emits a pair_code event; the user only types the code on the phone), and run sync --follow as a user service. These changes were pushed to the ISS-0011 branch after PR #10 merged, so they never reached main.

## Scope

## Acceptance criteria
- [x] decision 0003 allows installing and configuring the tool through its official channel after the user agrees to each step
- [x] skills/whatsapp/references/setup.md covers install (brew or checksum-verified release), phone-code pairing via the pair_code event, a launchd/systemd user service that restarts only on failure, verify and undo
- [x] SKILL.md first-use checks and error table route to the setup flow; README and catalog mention it
- [x] npm run verify is green

## Notes

## Log
- 2026-11-11 22:28 claude: started; plan in progress/ISS-0012.md
- 2026-11-11 22:28 claude: changes cherry-picked from ff123d4, which was pushed to feat/iss-0011-whatsapp-skill after PR #10 merged; checked on wacli 0.26.0 (pair_code envelope, invalid --phone error) and plutil -lint on the plist
- 2026-11-11 22:28 claude: done: Setup is now agent-driven. Decision 0003 allows a tool guide to install and configure its tool only through the offic...
- 2026-11-11 22:28 claude: learning: docs/learnings/0001-check-the-pr-is-still-open-before-pushing-more-commits-to-its-branch.md

## Outcome
Setup is now agent-driven. Decision 0003 allows a tool guide to install and configure its tool only through the official channel and after the user agrees to each step. skills/whatsapp/references/setup.md: install (brew, or checksum-verified release archive), pairing by phone code (the agent runs wacli --events auth --phone in the background and reads the pair_code NDJSON event; the user types the code on the phone), sync --follow as a launchd or systemd user service that restarts only on failure (a clean logged_out exit does not loop), verification and undo. SKILL.md first-use checks and error table route to it; README and the catalog row mention it. Checked against wacli 0.26.0 and plutil -lint; pairing not exercised (no phone linked). npm run verify: OK.
