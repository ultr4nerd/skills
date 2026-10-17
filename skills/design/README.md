# design

A project's design system as files: one W3C DTCG token file as the single source of truth,
generated outputs for every surface, a short `DESIGN.md` for agents, and a zero-dependency CLI that
keeps it all honest.

Agents building UI either ignore the design system (hard-coded hex values everywhere) or read all
of it (thousands of tokens per screen). This skill makes the cheap path the correct one:

- **One source.** `design/tokens.json` in [DTCG 2025.10](https://www.designtokens.org/tr/2025.10/format)
  format. Primitives (raw palette) feed semantic tokens (roles such as `color.surface`,
  `spacing.md`); code only ever names semantic tokens.
- **Small reads.** `design build` writes `TOKENS.md`, a one-line-per-token cheat sheet (name, value,
  what to use it for, checked contrast, theme values). `DESIGN.md` is capped at 150 lines. An agent
  building a screen reads DESIGN.md, one token group (`design show color`) and one component spec:
  a few hundred tokens, not the JSON.
- **Every surface.** CSS custom properties (optionally a Tailwind v4 `@theme`), a typed TS export
  with resolved values for places CSS cannot reach (email, OG images, wallet passes), JSON, and
  `targets/` specs for constrained surfaces with presets for wallet passes, email, print and OG images.
- **Checks instead of trust.** `design check` validates references and types, WCAG contrast for
  declared and implied foreground/background pairs (per theme, with a suggested fix), generated
  files being fresh, the DESIGN.md budget, token names mentioned in docs, and hard-coded colors or
  primitive tokens in source.

It is agent-agnostic (Claude Code, Codex, Gemini CLI, a human in a terminal). Runtime: Node >= 20.

## Install

```sh
npx skills add ultr4nerd/skills          # pick "design"
```

Or copy the `design/` folder into `.claude/skills/` (Claude Code) or `.agents/skills/`.

## Wiring

```jsonc
// package.json
{ "scripts": { "design": "node .claude/skills/design/scripts/design.mjs" } }
// then: pnpm design check   /   npm run design -- show color
```

```sh
alias design='node .claude/skills/design/scripts/design.mjs'   # fish: alias design 'node ...'
```

Add `design check` to the project's verify script. Point agents at the entry point from
`AGENTS.md`: `| design/DESIGN.md | design system | before any UI, email, print, pass or image work |`.

## Quick start

```sh
design init                       # design/DESIGN.md + a neutral, provisional design/tokens.json, then build
design new reference "Brand book v1" --source design/references/assets/brand-book.pdf
# ...extract palette, type and rules into the note, then into tokens.json...
design fmt && design build && design check
```

Then import the CSS once (`@import "../design/tokens.css";`, after `@import "tailwindcss";` when
Tailwind is on) and use `var(--color-surface)`, `class="type-body"` or `bg-surface`.

## Files it creates in a project

```
design.json                    optional config (project root)
design/
  DESIGN.md                    entry point (hand-written; the component inventory block is generated)
  TOKENS.md                    generated cheat sheet
  tokens.json                  source of truth (DTCG 2025.10)
  themes/dark.json             optional theme overrides
  tokens.css                   generated CSS custom properties (+ type-* classes or @utility)
  tokens.ts                    generated: tokens (resolved values), cssVars, themes, TokenName type
  components/<name>.md         component specs (only for components a real screen uses)
  targets/<surface>.md         wallet-pass, email, print, og-image, ...
  references/<source>.md       intake notes; originals in references/assets/
  templates/                   optional overrides for the skill's templates
```

Every Markdown file carries docmap frontmatter (`title`, `description`, `read_when`), so adding
`design` to docmap's `roots` indexes it with no extra work.

## Config

`design.json` at the project root. Every key is optional; defaults (also in `design.example.json`):

```json
{
  "dir": "design",
  "tokens": "design/tokens.json",
  "themes": {},
  "themeSelector": "[data-theme=\"{name}\"]",
  "outputs": { "css": "design/tokens.css", "ts": "design/tokens.ts", "json": null, "md": "design/TOKENS.md" },
  "css": { "prefix": "", "tailwind": false, "tailwindReset": ["color"] },
  "budgets": { "design": 150, "component": 80, "tokens": 300 },
  "scan": { "include": [], "exclude": [], "allow": [], "sizes": false, "severity": "error" }
}
```

| key | meaning |
|---|---|
| `dir` | where DESIGN.md, components/, targets/ and references/ live |
| `tokens` | token file, or a list of files deep-merged in order (a token defined twice is an error) |
| `themes` | `{ "<name>": "<file>" }`; each file overrides existing tokens (dark mode, sub-brands) |
| `themeSelector` | CSS selector for a theme block; `{name}` is replaced |
| `outputs.css` | CSS custom properties; `null` disables |
| `outputs.ts` | `.ts` (with `as const` and types) or `.js`/`.mjs` (plain ESM); `null` disables |
| `outputs.json` | `{ tokens, themes }` with resolved values, for non-JS consumers; off by default |
| `outputs.md` | the TOKENS.md cheat sheet |
| `css.prefix` | prefix every variable (`--ds-color-surface`); not allowed with `tailwind` |
| `css.tailwind` | emit a Tailwind v4 `@theme` block and `@utility type-*` instead of plain classes |
| `css.tailwindReset` | namespaces reset with `--<ns>-*: initial` so only your tokens exist (`bg-red-500` disappears) |
| `budgets.design` | max lines of DESIGN.md (error) |
| `budgets.component` | max lines of a component spec (warning) |
| `budgets.tokens` | max lines of TOKENS.md (warning) |
| `scan.include` / `exclude` | globs (`*`, `**`, `?`, `{a,b}`) of source files `check` scans; empty = no scan |
| `scan.allow` | literal values never reported (`"#000000"`) |
| `scan.sizes` | also report `px`/`rem` literals (0 and 1px are ignored) |
| `scan.severity` | `error` or `warn` for scan findings (use `warn` while migrating an existing codebase) |

The project root is the nearest directory with `design.json`, else `.git`, else the current
directory. Output paths are relative to it, with forward slashes.

## Commands

| command | what it does |
|---|---|
| `design init [--tailwind] [--name ".."]` | Create `design/DESIGN.md` and a neutral starter `design/tokens.json` (every token `provisional`), then build. Never overwrites. `--tailwind` also writes `design.json`. |
| `design build [--check]` | Write CSS, TS/JS, JSON, TOKENS.md and the DESIGN.md component inventory. Deterministic; unchanged files are not touched. Refuses to write when tokens have errors. `--check` writes nothing and exits 1 listing stale outputs. |
| `design check [--strict] [--json]` | Everything in "What check reports". Prints `design check: OK (N tokens, P provisional, ...)`. `--strict` turns shorthand values and non-standard units into errors. |
| `design show <token>` | Value (and `rgb()` for colors), alias chain, CSS and TS names, description, theme values, contrast pairs, print values, source note, reverse references ("used by"). |
| `design show <group>` | One line per token under a prefix (`color`, `primitive.color`). |
| `design show <component\|target\|reference>` | Print that spec by file name or title. |
| `design find <terms...> [--limit N] [--json]` | Ranked search over token names, descriptions and values, and over design docs (title, description, read_when, headings, body). Case- and diacritic-insensitive prefix match. A color (`#e5452d`, `rgb(...)`) finds tokens with that value. Exit 1 when nothing matches. |
| `design contrast <fg> <bg> [--theme t] [--min L] [--json]` | WCAG 2.x ratio of two tokens or CSS colors, pass/fail for AA, AA-large, AAA, AAA-large and ui (3:1), and the nearest passing foreground (same OKLCH hue and chroma, lightness adjusted). `--min` makes a failure exit 1. |
| `design scan [paths...] [--summary] [--json]` | Hard-coded hex/rgb/hsl/oklch colors (and sizes with `scan.sizes`), `--primitive-*` variables and `'primitive.*'` names in source, each with the token that has that value. `--summary` groups unique values with counts: the intake view of an existing stylesheet. |
| `design new <component\|target\|reference> "<name>"` | Scaffold from `templates/` (project overrides in `design/templates/`). Targets `wallet-pass`, `email`, `print` and `og-image` use presets with real platform limits. A new component refreshes the DESIGN.md inventory. Options: `--description`, `--read-when`, `--source`. |
| `design fmt [--check]` | Rewrite token files in canonical DTCG 2025.10 form: `"#e5452d"` becomes a color object with components and hex, `"16px"` becomes `{"value": 16, "unit": "px"}`, `"200ms"` likewise, inside composites too; stable 2-space formatting with short values inline. |
| `design help`, `<cmd> --help`, `--version` | Usage. Unknown commands and options exit 2. |

## Token format

Standard DTCG 2025.10 with a few conventions:

```jsonc
{
  "primitive": {                          // tier: raw values, never used in code
    "color": {
      "$type": "color",
      "$extensions": { "io.github.ultr4nerd.design": { "status": "provisional" } },  // covers the group
      "tomato": {
        "$value": { "colorSpace": "srgb", "components": [0.898, 0.2706, 0.1765], "hex": "#e5452d" },
        "$extensions": { "io.github.ultr4nerd.design": {
          "print": { "cmyk": [0, 85, 85, 0], "pantone": "..." },
          "source": "design/references/brand-book.md"
        } }
      }
    }
  },
  "color": {                              // tier: semantic (any group that is not primitive/component)
    "$type": "color",
    "primary": { "$value": "{primitive.color.tomato}", "$description": "Primary action fills" },
    "on-primary": { "$value": "{primitive.color.ink}", "$description": "Text on primary" },   // checked against color.primary
    "link": {
      "$value": "{primitive.color.tomato-dark}",
      "$description": "Inline links",
      "$extensions": { "io.github.ultr4nerd.design": { "on": ["color.surface"] } }        // declared pair, AA
    }
  },
  "component": { "card": { "$type": "color", "bg": { "$value": "{color.surface}" } } }   // optional tier
}
```

- **Tiers** come from the top-level group: `primitive`, `component`, anything else is semantic.
  References may only point down (component -> semantic -> primitive); `primitive.*` is not exported
  to TS/JSON and is reported when it shows up in source.
- **`$description` is the "use for" text** shown in TOKENS.md. Write it for the agent choosing a token.
- **Extensions** live under `io.github.ultr4nerd.design` (reverse-domain key, as the spec recommends):
  `status` (`provisional`; inherited from groups, including the root), `on` (contrast pairs: a list
  of backgrounds at AA, or `{ "<bg>": "AA" | "AA-large" | "AAA" | "AAA-large" | "ui" | <ratio> }`),
  `print` (`cmyk`, `pantone`, shown by `show`), `source` (the reference note it came from).
- **Implicit pairs**: a non-primitive color named `on-X` is checked against its sibling `X` at AA.
- **Themes**: a theme file has the same shape and only overrides existing tokens. CSS gets a
  `[data-theme="<name>"]` block with the overrides **and every token whose value depends on them**
  (custom properties resolve where they are declared, so a component token that aliases
  `color.surface` must be re-declared inside the theme scope too).
- **Supported types**: color (srgb, srgb-linear, hsl, hwb, oklab, oklch, display-p3, xyz-d65; other
  spaces need the `hex` fallback), dimension (px, rem; `em` accepted with a warning), duration,
  fontFamily, fontWeight (numbers and keywords), cubicBezier, number, strokeStyle, border,
  transition, shadow (single, layered, inset, aliased layers), gradient, typography. Aliases
  `{a.b}`, `$ref` JSON pointers (also inside values), group `$extends`, `$root`, `$deprecated`.
- **Shorthand** (`"#e5452d"`, `"16px"`, `"200ms"`) is accepted and resolved, reported as a warning,
  and converted by `design fmt`. It lets an agent write tokens quickly without computing color
  components by hand.

## Outputs

- **CSS**: `:root` with primitives, then semantic and component tokens; aliases stay references
  (`--color-primary: var(--primitive-color-tomato)`), like Style Dictionary's `outputReferences`.
  Typography expands to `--type-body-font-family|font-size|font-weight|line-height|letter-spacing`
  plus a `font` shorthand variable and a `.type-body` class.
- **Tailwind v4** (`css.tailwind: true`): semantic tokens whose name starts with a Tailwind namespace
  go inside `@theme` (so `bg-primary`, `text-on-surface`, `p-md`, `rounded-card`, `shadow-raised`,
  `ease-standard`, `font-body` exist); primitives and other tokens stay in `:root` (no utilities);
  `--color-*: initial` removes Tailwind's default palette; typography becomes `@utility type-body`.
  `@theme` is not `inline`, so theme blocks can override the variables at runtime.
- **TS/JS**: `tokens` (resolved values: CSS strings, numbers, typography objects), `cssVars`
  (`'var(--color-primary)'`), `themes` (resolved overrides per theme), `TokenName`, `ThemeName`.
  Keys are dot paths, the same names agents see in TOKENS.md.
- **JSON**: `{ tokens, themes }`, the same data for Swift, Kotlin, Python or a pass generator.
- **TOKENS.md**: grouped by top-level group (component tokens by component); status in the heading
  when the whole group shares it; typography shows its family token instead of the font stack;
  primitives summarized in one line per group.
- **DESIGN.md inventory**: the table between `<!-- design:components:start -->` and
  `<!-- design:components:end -->`, built from each spec's `title`, `status` and `read_when`.

## What `check` reports

Errors (exit 1):

- token files: invalid JSON, invalid names (`$` prefix, `{`, `}`, `.`), unknown `$type`, missing type,
  invalid values for the type, unknown or circular references, alias type mismatches, bad `$ref` or
  `$extends`, tokens defined in two files, theme overrides of unknown tokens
- references that point up a tier; two tokens mapping to the same CSS variable
- contrast pairs below their level, per theme, with the nearest passing foreground in the message
- generated outputs stale or missing (same comparison as `build --check`)
- DESIGN.md missing, over `budgets.design`, or without `title`/`description`/`read_when`; the same
  frontmatter for every component, target and reference note
- broken relative links in design docs; backticked token names (`color.primry`) or CSS variables
  (`--color-primry`) that do not exist, with a "did you mean"; HTML comments are skipped
- with `scan.include`: hard-coded colors (and sizes), primitive tokens in source (severity configurable)

Warnings: shorthand values, `em` units, a contrast background with transparency (assumed over white),
`srgb` colors whose `hex` disagrees with their components, component specs over budget, TOKENS.md
over budget, deprecated or primitive tokens named in specs, deprecated variables in source, targets not
linked from DESIGN.md, a DESIGN.md without inventory markers once specs exist.

A single source line opts out with a `design-allow` comment (`color: #000; /* design-allow: print */`).

## Target presets

`design new target <name>` copies a preset when one exists. Each lists the platform's limits (checked
against the vendors' docs in October 2026; re-check before shipping) and a token mapping table to fill:

- `wallet-pass`: Apple Wallet colors are `rgb(r, g, b)` strings (`design show` prints them), system font
  only, image sizes per pass style; Google Wallet `hexBackgroundColor`, circular logo mask, no text color.
- `email`: no CSS variables (inline resolved values from `tokens.ts`), unreliable web fonts, dark-mode
  inversion, table layout.
- `print`: CMYK/Pantone recorded per primitive in the `print` extension, bleed, 300 ppi, small-text rules,
  px to pt.
- `og-image`: 1200x630, Satori/`next/og` CSS subset and font formats, resolved values only.

## With docmap and backlog

- docmap: add `"design"` to `roots` and `"design/references/assets/**"` to `exclude`; every design doc is
  then indexed and searchable with `docmap find`. Token decisions go to `docs/decisions/` with
  `docmap new docs/decisions "<title>"`.
- backlog: a UI issue links the component spec it needs; its acceptance criteria include
  `design check` passing.

## Prior art and what was borrowed

- **W3C DTCG Format Module 2025.10** (stable, October 2025): the file format, types, aliases, `$ref`,
  `$extends`, `$root`, `$deprecated`, reverse-domain `$extensions`. The spec recommends a `.tokens.json`
  extension for tools that save files; the default here is `design/tokens.json` for readability, and
  any name works via `tokens`. The separate Resolver module for themes was not adopted; theme override
  files are simpler and cover dark mode and sub-brands.
- **Style Dictionary**: platforms/formats and `outputReferences`. Not used as a dependency: it is
  heavy for a skill and does not yet fully support 2025.10 color objects.
- **Google Labs DESIGN.md** (alpha, used by Stitch): a Markdown file agents read before designing, with a
  fixed section order (overview, colors, typography, layout, elevation, shapes, components, do's and
  don'ts). Borrowed the idea and roughly the section order; tokens stay in the DTCG file instead of
  DESIGN.md frontmatter so there is one source of truth and DESIGN.md stays small.
- **Anthropic's frontend-design skill**: commit to a direction, distinctive type, restraint ("spend
  your boldness in one place"), a quality floor (focus, reduced motion, contrast), microcopy rules (verbs
  on buttons, errors that explain the fix). Folded into the DESIGN.md template. Unlike that skill, an
  existing design system wins over fresh aesthetic choices.
- **Material Design** `on-*` color roles: the naming that makes contrast pairs implicit.
- **Tailwind v4 `@theme`**: namespaces, `--*: initial` resets, `@utility`.

## Limitations

- Colors are converted to sRGB for contrast and for the generated values; wide-gamut colors are
  clipped in CSS output (hex).
- Contrast is WCAG 2.x; APCA is not implemented.
- `scan` is regex-based: it can flag a hex-looking anchor (`#add`) and misses colors built at runtime.
  Use `scan.allow`, `scan.exclude` or `design-allow`.
- Runtime colors (for example colors chosen by a customer) are outside the build; validate them in app
  code with the same WCAG formula.

## Development

```sh
node --test skills/design/scripts/design.test.mjs    # unit and CLI tests on temp projects
```
