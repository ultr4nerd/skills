---
title: "Tool-guide skills: Markdown-only skills that teach an agent to drive an external CLI"
description: A skill may be Markdown only and teach an agent to use an installed third-party CLI; it ships no CLI of its own and never installs or bundles the tool
read_when: Adding a skill whose job is to use an external tool (wacli, gh, a vendor CLI) rather than manage files in the project
id: decisions-0003
status: current
updated: 2026-11-11
tags: [skills, dependencies, harness]
---

# Tool-guide skills: Markdown-only skills that teach an agent to drive an external CLI

## Decision

A second kind of skill is allowed next to the file-managing ones of decision 0001: a **tool guide**.
A tool guide is Markdown only (`SKILL.md` plus `README.md`, optional `references/`). It teaches an
agent to drive a third-party CLI that the user installs separately. It ships no CLI of its own, has
no npm dependencies, never bundles the tool, and states the tool and the version it was written
against as a requirement. A guide may tell the agent how to install and configure the tool, but
only through the tool's official channel (package manager or checksum-verified release) and only
after the user agrees to each step that changes the machine. Tool guides get their own section in the catalog.

## Why

- Some jobs are not about files in the project (reading and sending WhatsApp messages with `wacli`
  is the first one). Decision 0001 rejected wrapping third-party CLIs because "their own CLI/MCP
  already does it"; that holds when the vendor ships a user-facing skill, but `wacli` only ships one
  for maintainers of its own repo.
- The value of a tool guide is the protocol, not code: what is safe to run unattended, what needs
  the user's explicit confirmation, how to disambiguate, when not to retry. That fits in Markdown
  and stays runtime-agnostic.
- Rejected: a wrapper CLI in the skill (duplicates the tool, drifts with every release, adds a
  supply-chain surface); amending 0001 in place (it stays true for docmap, backlog and design);
  keeping such skills outside the repo (not versioned, not shareable).

## Consequences

- If the vendor later ships a good user-facing skill, prefer it and retire the guide.
- A guide pins the tool version it was checked against; bumping the tool means re-reading its
  docs and updating the guide in the same issue.
- `verify` treats tool guides like any skill (SKILL.md frontmatter, README, catalog entry); there
  is no CLI to version-check.
- Guides that can act on the user's behalf (send, delete, pay) must default to read-only and
  require explicit per-action confirmation for writes.
