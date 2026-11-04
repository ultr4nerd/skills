---
id: ISS-0005
title: "design: shadcn/ui target (generated theme vars + inventory checks)"
kind: feature
status: todo
priority: P2
area: design
parent:
depends_on: []
created: 2026-10-30
updated: 2026-10-30
due:
owner:
branch:
estimate: L
tags: [design, shadcn, tailwind]
---

## Context
Decision 0002 (docs/decisions/0002-shadcn-ui-is-a-generated-target-of-the-design-skill-not-a-separate-skill-json-render-is-out-of-scope.md). design build generates shadcn theme variables from design/tokens.json via one mapping file; with the target on, design stops emitting its own color @theme entries (today css.tailwind emits --color-*: initial and --color-primary, which collides with shadcn's @theme inline). design check enforces the DESIGN.md inventory for components/ui imports and rejects raw Tailwind palette classes and arbitrary values. Zero dependencies: design writes files, never imports or runs shadcn; install/search stays with shadcn's CLI/MCP.

## Scope

## Acceptance criteria
- [ ] design.json opt-in (e.g. css.shadcn) documented in skills/design/README.md; design build emits :root and per-theme shadcn vars (background, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, chart-1..5, sidebar-*, radius) from a single mapping in design/targets/shadcn.md
- [ ] with the target on, no color @theme entry collides with shadcn's @theme inline names; test covers it
- [ ] check errors when a role shadcn needs is unmapped and when a X/X-foreground pair fails contrast
- [ ] check reports raw Tailwind palette classes (bg-zinc-500), arbitrary values (p-[13px]) and imports of components/ui/* not in the DESIGN.md inventory; design-allow opts out per line
- [ ] SKILL.md mentions the shadcn target in under 10 lines; npm run verify green

## Notes

## Log

## Outcome
<!-- filled by `backlog done`: what shipped, how it was verified, learnings, follow-ups -->
