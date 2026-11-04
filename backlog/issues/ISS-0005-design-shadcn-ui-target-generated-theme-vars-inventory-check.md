---
id: ISS-0005
title: "design: shadcn/ui target (generated theme vars + inventory checks)"
kind: feature
status: done
priority: P2
area: design
parent:
depends_on: []
created: 2026-10-30
updated: 2026-11-04
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
- [x] design.json opt-in (e.g. css.shadcn) documented in skills/design/README.md; design build emits :root and per-theme shadcn vars (background, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, chart-1..5, sidebar-*, radius) from a single mapping in design.json (`shadcn.vars`); design/targets/shadcn.md documents the wiring only
- [x] with the target on, no color @theme entry collides with shadcn's @theme inline names; test covers it
- [x] check errors when a role shadcn needs is unmapped and when a X/X-foreground pair fails contrast
- [x] check reports raw Tailwind palette classes (bg-zinc-500), arbitrary values (p-[13px]) and imports of components/ui/* not in the DESIGN.md inventory; design-allow opts out per line
- [x] SKILL.md mentions the shadcn target in under 10 lines; npm run verify green

## Notes

## Log
- 2026-11-04 13:59 claude: started; plan in progress/ISS-0005.md
- 2026-11-04 14:01 claude: plan: shadcn config in design.json; colors leave @theme, resolved shadcn vars per theme; check roles/contrast/radius collisions; scan palette/arbitrary/ui imports with ui dir exempt; docs + amend decision 0002
- 2026-11-04 14:04 claude: implemented config, build (colors out of @theme, resolved shadcn vars per theme), check (roles, contrast, radius collisions) and scan rules; 7 tests; verify green
- 2026-11-04 14:06 claude: done: Shipped the shadcn/ui target in the design skill. `shadcn` in design.json (`vars` role -> token, `import`, `dir`) mak...

## Outcome
Shipped the shadcn/ui target in the design skill. `shadcn` in design.json (`vars` role -> token, `import`, `dir`) makes `design build` emit resolved shadcn variables in `:root` plus one block per theme, keeps color tokens out of `@theme` and skips the `color` reset so shadcn's `@theme inline` owns color utilities. `design check` reports unknown, unmapped (required = error, chart/sidebar = warning), primitive and mistyped variables, X-foreground on X below AA per theme (skipping pairs the tokens already check) and Tailwind radius tokens that collide with shadcn's `--radius-sm..4xl`. `scan` reports palette classes, arbitrary values and ui imports without a spec; the copied ui dir is exempt from the class rules. Docs: README "shadcn/ui", 5 lines in SKILL.md, `templates/targets/shadcn.md`, TOKENS.md roles section; decision 0002 amended.

Verified: 7 new tests (build, unchanged Tailwind output without shadcn, role errors, per-theme contrast, radius collision, scan, config errors); `npm run verify` green; compiled the generated tokens.css with shadcn's `@theme inline` through Tailwind 4.1.11: `bg-primary` -> `var(--primary)` = `#2856d9` (no cycle), `rounded-lg` -> `var(--radius)`, no `bg-surface` utility.

Follow-ups: none required. Possible later: `design init --shadcn` to scaffold the mapping.
