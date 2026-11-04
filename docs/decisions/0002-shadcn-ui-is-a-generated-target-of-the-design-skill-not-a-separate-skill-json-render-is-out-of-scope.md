---
title: shadcn/ui is a generated target of the design skill, not a separate skill; json-render is out of scope
description: shadcn theme variables are generated from design/tokens.json by design build; check enforces the inventory; json-render is not adopted
read_when: Adding shadcn/ui, a component library or generative UI (json-render) to a project, or changing how the design skill emits Tailwind or theme CSS
id: decisions-0002
status: current
updated: 2026-10-30
tags: [design, shadcn, tailwind]
---

# shadcn/ui is a generated target of the design skill, not a separate skill; json-render is out of scope

## Decision

shadcn/ui is supported as an opt-in output of the `design` skill: `design build` generates the
shadcn theme variables (`:root` and one selector per theme) from `design/tokens.json` through a
mapping kept in one place, and `design check` enforces that UI code only uses the shadcn
components in the DESIGN.md inventory and no raw Tailwind palette or arbitrary values. There is
no separate shadcn skill. json-render is not adopted.

## Why

- The target harness is a coding agent writing source code. shadcn gives it a closed component
  set whose APIs the model already knows, so specs do not need to document them; that is where
  predictability and token savings come from. Accessibility comes from its primitives.
- shadcn's variables (`--X` / `--X-foreground`) map almost 1:1 to our `color.X` / `color.on-X`,
  so the existing contrast checks cover the shadcn pairs unchanged.
- A separate skill would create a second source of truth (`globals.css` edited by hand next to
  `tokens.json`). The tokens stay the only place a value is defined.
- shadcn only covers React + Tailwind; `design` also covers email, print, wallet passes and OG
  images. That makes shadcn one surface, not the core.
- Skills stay zero-dependency (decision 0001): `design` writes files for shadcn and never imports
  or runs it. Searching, viewing and installing components stays with shadcn's own CLI/MCP; we do
  not wrap them.
- Rejected, json-render: it renders model-generated JSON at runtime inside the product (ships
  `@json-render/*` and `zod`). That solves generative UI, not an agent writing code; for us it adds
  a runtime dependency and a DSL. Spec-to-code via `@json-render/codegen` only pays off when a
  harness produces many similar screens; revisit then.
- Rejected, leaving shadcn's default theme and documenting tokens in prose: the agent drifts to
  `bg-zinc-500` and `p-[13px]` and nothing catches it.

## Consequences

- Today `css.tailwind` emits `@theme { --color-*: initial; --color-primary: ... }`, which collides
  with shadcn's `@theme inline { --color-primary: var(--primary) }` depending on import order. With
  the shadcn target on, `design` must not emit its own color `@theme` entries.
- Every role shadcn needs (`background`, `card`, `popover`, `muted`, `accent`, `border`, `input`,
  `ring`, `chart-1..5`, `sidebar-*`, `radius`) must be mapped or `check` fails, so new projects
  have to name those roles up front.
- shadcn changes fast (styles, Radix vs Base UI, variable set): the mapping lives in one versioned
  file so an upgrade is a single edit plus a decision update.
- Components copied into `components/ui/` can drift when an agent edits them. They are exempt from
  the palette and arbitrary-value rules (stock shadcn code uses `bg-black/50` and `h-[calc(...)]`, so
  checking them would fail every fresh install); hex and primitive rules still apply. Drift there is
  reviewed by diffing after `shadcn add` (the `shadcn` target note records local changes).
- Implemented in ISS-0005 with these choices: the mapping lives in `design.json` (`shadcn.vars`),
  not in a Markdown note, so the CLI never parses prose; generated shadcn variables hold resolved
  values, not `var(--color-x)`, because shadcn's `--color-x: var(--x)` would make a cycle; `chart-*`
  and `sidebar-*` are optional (warning), the rest required (error).
