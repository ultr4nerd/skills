---
title: Skills stay runtime-agnostic, files and zero-dependency CLIs
description: A skill is Markdown plus a Node CLI with no npm dependencies; nothing in skills/ assumes CI, a hosting platform or a particular machine
read_when: Adding a dependency, a build step or runtime-specific code (CI, Vercel, a local path) to a skill, or wrapping a third-party tool inside one
id: decisions-0001
status: current
updated: 2026-11-11
tags: [skills, dependencies, harness]
---

# Skills stay runtime-agnostic, files and zero-dependency CLIs

## Decision

Every skill (`docmap`, `backlog`, `design`, ...) is files plus a Node >= 20 CLI that uses only the
standard library. Nothing in `skills/` assumes CI, a hosting platform, a harness or a particular
machine. A skill may generate files for a third-party tool; it never imports or runs that tool.

## Why

- Skills are installed into arbitrary projects with `npx skills add`; a dependency or a runtime
  assumption breaks the ones that do not match.
- Any agent (interactive, headless, another vendor) can drive a CLI and read files; nothing else
  is common to all of them.
- Rejected: npm dependencies in skill CLIs (install step, supply-chain surface, version drift);
  wrapping third-party CLIs (their own CLI/MCP already does it and changes faster than we do).

## Consequences

- Validation that would be one line with a library (JSON Schema, Zod) is written by hand or left
  to a script in the target project.
- An unsupervised runner was drafted and dropped (2026-10-30): no repo-level runner exists; if one
  is added later it is a separate decision and must not change the skills.
- Markdown-only skills that teach an agent to drive an external CLI are allowed as "tool guides"
  (decision 0003, 2026-11-11); everything above still applies to skills that ship a CLI.
