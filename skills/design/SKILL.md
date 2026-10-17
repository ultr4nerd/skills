---
name: design
description: Create, evolve and use a project's design system kept in files (W3C DTCG tokens that generate CSS, TS and a token cheat sheet; a short DESIGN.md; component specs; surface targets), with a zero-dependency CLI that checks contrast, drift and hard-coded values. Use before building or changing any UI, email, printed piece, wallet pass or OG image; when turning a brand book, screenshots, URLs or existing CSS into a design system; and when adding or changing colors, fonts, spacing or components.
---

# design

The design system lives in `design/`. `design/tokens.json` (W3C DTCG 2025.10) is the only place a
value is defined; everything else is generated from it or points at it. Budget: building a screen
costs a few hundred tokens of design context (DESIGN.md, one token group, one spec), never the JSON.

CLI (zero deps, Node >= 20): `node .claude/skills/design/scripts/design.mjs <cmd>`, or the project's
`design` script/alias. Project root: nearest `design.json`, else `.git`. Paths are relative to it.

## Files

```
design/DESIGN.md         entry point, <= 150 lines: principles, voice, foundations, surfaces, component inventory
design/TOKENS.md         generated: one line per semantic token (name, value, use for, contrast, themes)
design/tokens.json       source of truth; themes/<name>.json hold theme overrides only
design/tokens.css, .ts   generated (paths set in design.json)
design/components/*.md   one short spec per component a real screen uses
design/targets/*.md      constrained surfaces: wallet-pass, email, print, og-image, ...
design/references/*.md   intake notes: what each source says, where, how sure, open questions
```

Never edit generated files (TOKENS.md, tokens.css/.ts, the inventory block in DESIGN.md) by hand.

## Using it while coding (every UI task)

1. Read `design/DESIGN.md` once per session (under ~1k tokens); later tasks skip to step 2.
2. Look up values in `design/TOKENS.md`, or cheaper: `design show color` (one group),
   `design find danger text`, `design show color.primary` (value, contrast, who uses it).
3. Read only the spec you are building (`design show button`) and, for email, print, passes or OG
   images, the target (`design show email`).
4. Code names semantic tokens: `var(--color-primary)`, `tokens['color.primary']`, `class="type-body"`,
   or Tailwind utilities when enabled. Never a hex, a raw px size, a shadow literal or `primitive.*`.
   If no token fits, add one (below); do not hard-code.
5. Run `design check`; it must print `design check: OK`.

DESIGN.md and the tokens win over generic taste and other design skills. An explicit user instruction
wins over DESIGN.md; then update the system and record the decision.

## Creating or evolving the system

1. **Intake.** One note per source: `design new reference "<name>" --source <path|url>`. Extract, do not
   invent: each value with where it came from and a confidence (high = stated as final; medium = stated
   but provisional, or measured from vector or CSS; low = eyedropped from a raster, or inferred). For
   existing CSS run `design scan <dir> --summary` (every hard-coded value, counted). Gaps and
   contradictions go under Open questions, not into tokens.
2. **Primitives** (`primitive.*`): palette, font families, scales. Anything below high confidence gets
   `"$extensions": {"io.github.ultr4nerd.design": {"status": "provisional"}}` (on a group, it covers all children).
3. **Semantic tokens**: roles that alias primitives, each with a `$description` saying what to use it
   for (TOKENS.md shows it). Cover color, type, space, radius, elevation and motion:
   - Color: every text-bearing color has a checked background. `color.on-X` is checked against
     `color.X` automatically; declare others with `"on": ["color.surface"]` or
     `"on": {"color.primary": "AA-large"}` (levels AA, AA-large, AAA, AAA-large, ui). When a brand color
     fails as text, keep it for fills and add a text variant: `design contrast <fg> <bg>` prints the
     nearest passing color with the same hue.
   - Type: real fonts with a known license (or free/system fonts) and full fallback stacks; composite
     `type.*` tokens carry family, size, weight, line height.
4. **Components** only when a real screen needs them: `design new component <name>` (fills the DESIGN.md
   inventory); `component.<name>.*` tokens only for values unique to that component.
5. **Targets** for surfaces with hard limits: `design new target wallet-pass|email|print|og-image|<name>`,
   map tokens to the surface's formats, link it from the Surfaces table in DESIGN.md.
6. `design fmt` (canonical 2025.10 objects, so you may type `"#e5452d"` or `"16px"`), `design build`,
   `design check`.
7. **Record it.** Changing a value, renaming or removing a token, or making a provisional token stable is a
   decision: `docmap new docs/decisions "<title>"` when docmap is installed, else a dated entry in
   `design/decisions.md`. Deprecate before removing: `"$deprecated": "use {color.x}"`.

## Token rules

- Tiers by top-level group: `primitive.*` (raw values, never in code), `component.*` (optional), all
  other groups are semantic. References point down only: component -> semantic -> primitive.
- CSS variable = path with dots as dashes (`color.on-primary` -> `--color-on-primary`); camelCase becomes
  kebab-case. With `css.tailwind`, name semantic groups after Tailwind namespaces (`color`, `font`,
  `spacing`, `radius`, `shadow`, `ease`, `text`, `leading`, `tracking`, `breakpoint`) to get utilities
  (`bg-primary`, `p-md`, `rounded-card`); keep typography in `type.*` (utilities `type-body`).
- Themes (dark mode, sub-brands): `design.json` `"themes": {"dark": "design/themes/dark.json"}`. A theme
  file overrides existing tokens only; dependent tokens are re-emitted; contrast is checked per theme.
- Values follow DTCG 2025.10: color objects, `{value, unit}` dimensions (px, rem) and durations,
  fontFamily, fontWeight, cubicBezier, number, strokeStyle, border, transition, shadow, gradient,
  typography; aliases `{a.b}`, `$ref`, `$extends`, `$root`, `$deprecated`.

## What `check` reports

Errors (exit 1): bad JSON or values, unknown types, unresolved or circular references, references that
point up a tier, CSS name collisions, failing contrast pairs (with a suggested fix), stale generated
files, DESIGN.md over budget or without `title`/`description`/`read_when`, broken links, unknown token
names in backticks in design docs, and, when `scan.include` is set, hard-coded colors or `primitive.*` in
source. Warnings: shorthand values (`design fmt`), non-standard units, oversized specs or TOKENS.md,
deprecated tokens in use, targets not linked from DESIGN.md. One source line can opt out with a
`design-allow` comment.

## Commands

```
design init [--tailwind] [--name ".."]          scaffold design/ (never overwrites), then build
design build [--check]                           CSS, TS/JSON, TOKENS.md, DESIGN.md inventory
design check [--strict] [--json]                 all checks; exit 1 on errors
design show <token|group|component|target> [--json]
design find <terms...> [--limit N] [--json]      tokens and docs; a hex finds tokens with that value
design contrast <fg> <bg> [--theme t] [--min AA] [--json]
design scan [paths...] [--summary] [--json]      hard-coded values and primitive use in source
design new <component|target|reference> "<name>" [--description ..] [--read-when ..] [--source ..]
design fmt [--check]                             rewrite token files in canonical DTCG 2025.10 form
```

Exit codes: 0 ok, 1 errors or nothing found, 2 usage. Config keys and defaults: see README.md.
