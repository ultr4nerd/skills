---
id: ISS-0014
title: "whatsapp: accent-aware lookups, JSON field shapes, service lifecycle (reboot, pause vs disable)"
kind: bug
status: done
priority: P2
area: whatsapp
parent:
depends_on: [ISS-0013]
created: 2026-11-11
updated: 2026-11-11
due:
owner:
branch:
estimate: S
tags: []
---

## Context
First real use (2026-11-11): contacts search 'Cesar' missed 'César Chávez Ruiz' (contacts search and chats list --query are accent-sensitive; messages search is not: 'tio' and 'tío' gave the same 34 hits). Parsing failed because messages use PascalCase fields (FromMe, DisplayText, MediaType, MsgID, Timestamp) while chats and contacts use snake_case; the skill says neither. setup.md presents 'launchctl bootout' as stop or remove, but bootout only lasts until the next login because the plist stays in LaunchAgents; reboot, sleep and the macOS Login Items toggle are not explained.

## Scope

## Acceptance criteria
- [x] SKILL.md: name lookups retry with and without accents (contacts search, chats list --query); messages search is accent-insensitive
- [x] SKILL.md documents the JSON shapes: chats/contacts snake_case lists, messages PascalCase under data.messages with page/source; (message) rows are content-free system events
- [x] setup.md: service lifecycle covers reboot/login, sleep and offline backlog, pause (bootout) vs disable (launchctl disable or delete the plist), Login Items toggle, and that a long-inactive phone can unlink the device
- [x] npm run verify is green

## Notes

## Log
- 2026-11-11 23:00 claude: started; plan in progress/ISS-0014.md
- 2026-11-11 23:01 claude: checked on the live store: contacts search/chats query accent-sensitive, messages search not (tio = tío = 34 hits); chats/contacts snake_case lists, messages PascalCase under data.messages (FromMe omitted when false); service lifecycle documented (reboot, sleep, Login Items, phone inactivity, pause vs disable vs remove, kickstart after upgrade)
- 2026-11-11 23:01 claude: done: SKILL.md: name lookups retry with and without accents and with fewer words, because contacts search and chats list --...

## Outcome
SKILL.md: name lookups retry with and without accents and with fewer words, because contacts search and chats list --query are accent-sensitive (messages search is not: 'tio' and 'tío' return the same hits); a JSON shapes table (chats and contacts are snake_case lists; messages are PascalCase objects under data.messages with page and source; FromMe is omitted when false; '(message)' rows are content-free system events; timestamps are UTC). setup.md: launchd behaviour on reboot/login, sleep and offline backlog, the Login Items toggle, phone inactivity logging out the device, and a control table (status, kickstart after upgrade, pause with bootout until next login, disable across reboots, remove); systemd equivalents; Undo now removes the plist, since bootout alone comes back at the next login. Checked against the live store and launchd on this Mac. npm run verify: OK.
