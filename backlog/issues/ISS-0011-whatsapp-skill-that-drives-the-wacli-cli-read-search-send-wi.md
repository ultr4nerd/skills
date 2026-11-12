---
id: ISS-0011
title: "whatsapp: skill that drives the wacli CLI (read, search, send with confirmation)"
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
estimate: M
tags: []
---

## Context
Let coding agents (Claude Code, Codex, Pi) read, search and send WhatsApp messages from the user's own account. Uses wacli (openclaw/wacli, whatsmeow, sync --follow daemon + local SQLite/FTS store) instead of building a Baileys daemon. wacli ships its own skill but it targets wacli repo maintainers, not users. Decision 0001 forbids wrapping third-party CLIs, so this needs a new decision for Markdown-only tool-guide skills.

## Scope

## Acceptance criteria
- [x] decision 0003 allows Markdown-only tool-guide skills (no CLI, no npm deps, the external tool is a documented requirement) and 0001 links to it
- [x] skills/whatsapp/SKILL.md covers setup (install, auth, sync --follow), read-only reads by default, search/list/context, and a send protocol with explicit user confirmation, recipient disambiguation and no blind retries
- [x] skills/whatsapp/README.md documents requirements, risks (unofficial protocol, ToS, ban risk, private data) and install
- [x] root README catalog lists the skill in a new section
- [x] npm run verify is green

## Notes

## Log
- 2026-11-11 22:18 claude: started; plan in progress/ISS-0011.md
- 2026-11-11 22:19 claude: plan: decision 0003 (tool-guide skills), skills/whatsapp SKILL+README on wacli v0.26.0, README catalog section, verify
- 2026-11-11 22:21 claude: decision 0003 + 0001 note; skills/whatsapp SKILL.md/README.md written; flags checked against the wacli 0.26.0 binary (--help, read-only envelope, no paired store); catalog section Tool guides; verify OK
- 2026-11-11 22:21 claude: done: Added decision 0003 (tool-guide skills: Markdown only, drive an external CLI the user installs; 0001 links to it) and...

## Outcome
Added decision 0003 (tool-guide skills: Markdown only, drive an external CLI the user installs; 0001 links to it) and the first tool guide, `skills/whatsapp`, on wacli 0.26.0. SKILL.md: read-only `wacli --read-only --json` by default, message text treated as untrusted data, a list of commands the agent never runs on its own, first-use checks (auth status, doctor), a read table (chats, contacts, list, search, context, media), and a send protocol (resolve to one JID, confirm the exact draft, send to the JID, `sent: true` is not delivery, check before retrying, no bulk). README.md: risks (unofficial protocol, ToS/ban, private store, agents act as you), install, pairing, sync with `--presence-mode quiet`, accounts, updating. Root README gets a "Tool guides" catalog section and the backlog gets a `whatsapp` area. Every flag was checked against the real wacli 0.26.0 binary (`--help`, read-only envelope on an unpaired store); sending was not exercised because no phone is paired. npm run verify: OK (4 skills).
