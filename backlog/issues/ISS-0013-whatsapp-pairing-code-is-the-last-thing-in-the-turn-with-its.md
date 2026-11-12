---
id: ISS-0013
title: "whatsapp: pairing code is the last thing in the turn, with its deadline and expiry handling"
kind: bug
status: done
priority: P1
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
First real setup (2026-11-11): the agent showed the pairing code in text, then started a monitor in the same turn; the harness only surfaced the final message, so the user never saw the code. setup.md also says nothing about how long the code lasts: wacli requests it on whatsmeow's first QR event and the QR channel holds 6 refs (60 s + 5 x 20 s = about 160 s), then wacli exits with 'QR code timed out'. The user paired at about 155 s.

## Scope

## Acceptance criteria
- [x] setup.md step 2: the code and phone steps are the final message of the turn; no tool calls after showing it
- [x] the agent tells the user the deadline (pair_code ts + 160 s, as a clock time and as about 2.5 minutes)
- [x] expiry is detected from the background auth command exiting with 'QR code timed out' (or an error event) and the agent offers a new code; success is confirmed with auth status
- [x] npm run verify is green

## Notes

## Log
- 2026-11-11 22:54 claude: started; plan in progress/ISS-0013.md
- 2026-11-11 22:55 claude: setup.md step 2 rewritten: code as final message with deadline (ts+160 s, from whatsmeow qrchan.go: 6 refs, 60 s + 5x20 s; wacli auth requests the code on the first ref), expiry = background auth exits with 'QR code timed out', retry only after it exits; history-days note; SKILL.md mentions the rule
- 2026-11-11 22:55 claude: done: references/setup.md step 2 now ends the turn on the pairing code: the final message has the code, its deadline (pair_...
- 2026-11-11 22:55 claude: learning: docs/learnings/0002-harnesses-may-surface-only-the-final-message-of-a-turn-put-anything-the-user-must-act-on-last.md

## Outcome
references/setup.md step 2 now ends the turn on the pairing code: the final message has the code, its deadline (pair_code ts + 160 s as a clock time and as about 2.5 minutes) and the phone steps, with no tool calls after it. The 160 s comes from whatsmeow's QR channel (6 refs: 60 s + 5 x 20 s; wacli requests the phone code on the first ref) and matches the first real pairing (entered at about 155 s). Expiry is detected when the background auth command exits with 'QR code timed out' or an error event; the agent then offers a new code and never starts a second pairing while the first runs. Success is confirmed with auth status. Also notes that the phone may send more history than --history-days asks (61k messages arrived for 30 days). npm run verify: OK.
