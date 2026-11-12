---
title: "Harnesses may surface only the final message of a turn: put anything the user must act on last"
description: Text written before another tool call in the same turn can be invisible to the user; codes, links and questions go in the final message and the turn ends there
read_when: Writing a skill step where the user must read and act on something the agent produced (a pairing code, an OTP, a URL, a question) while work continues in the background
id: learnings-0002
status: current
updated: 2026-11-11
tags: [iss-0013, whatsapp, harness, skills]
---

# Harnesses may surface only the final message of a turn: put anything the user must act on last

## What happened

During the first real WhatsApp setup the agent wrote the pairing code, then started a monitor and
wrote one more line in the same turn. The user only saw the last line and asked "which code?".
The code was still valid because it lasts about 160 s, but by then a good part of it was gone.

## Lesson

Anything the user must read and act on (a code, a deadline, a link, a question) is the last thing
in the turn, and the turn ends right after it. Background work started before it keeps running;
the harness reports when it exits, so watching it in the same turn adds nothing.

## Apply when

A skill step that hands the user something time-sensitive or blocking while a background command
waits on them: pairing codes, OTPs, device-login URLs, confirmation prompts.
