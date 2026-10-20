# docmap

Make a Markdown docs tree navigable without an LLM.

Agents waste tokens reading whole documentation trees. docmap gives every directory a
generated `INDEX.md` (a table of what is there and when to open it) and a zero-dependency
CLI that searches, outlines and extracts only the section an agent needs. The root index
points to subdirectory indexes, which point to docs: an agent descends only where the
description says to, paying ~100 tokens per hop instead of thousands per file.

It is agent-agnostic: it works for Claude Code, Codex, Cursor, Gemini CLI or a human in a
terminal. The only runtime is Node >= 20.

## Install

```sh
npx skills add ultr4nerd/skills          # installs skills/docmap into your agent's skills dir
```

Or copy the `docmap/` folder into `.claude/skills/` (Claude Code) or `.agents/skills/`
(other agents). Nothing to build, nothing to `npm install`.

## Wiring

Pick one so `docmap <cmd>` is cheap to type and to put in instructions:

```jsonc
// package.json
{ "scripts": { "docs": "node .claude/skills/docmap/scripts/docmap.mjs" } }
// then: npm run docs -- find refunds
```

```sh
# shell alias (fish: alias docmap 'node .claude/skills/docmap/scripts/docmap.mjs')
alias docmap='node .claude/skills/docmap/scripts/docmap.mjs'
```

Add to CI: `node .claude/skills/docmap/scripts/docmap.mjs check` fails when indexes are
stale or frontmatter is wrong.

## Quick start

```sh
docmap init            # docs/, docs/decisions, docs/learnings with routing READMEs, docmap.json, indexes
docmap new docs/decisions "Use SQLite for local storage" \
  --description "Todos live in SQLite via better-sqlite3, not Postgres" \
  --read-when "Touching persistence or considering another database"
docmap check
```

`init` never overwrites. Edit the three READMEs it created: their `description` and `read_when`
are the rows of the root `INDEX.md`, the first (and often only) thing an agent reads, so they
must route ("Before proposing a change to architecture...") rather than describe ("ADRs").

## Decisions and learnings as project memory

A decision records a choice that constrains future work (`## Decision`, `## Why`,
`## Consequences`); a learning records a surprise worth not repeating (`## What happened`,
`## Lesson`, `## Apply when`). Both are numbered and immutable: supersede, never rewrite.

Memory only works if it is written at the moment of friction and read at the moment of risk.
docmap gives the storage and the search; the [backlog](../backlog/) skill, when installed next to
it, closes the loop programmatically: `backlog next --claim` prints the decisions and learnings
whose frontmatter matches the issue, `backlog done --learning` / `backlog learn` file one tagged
with the issue id, and `backlog retro` lists closed issues with friction and no learning yet.
`docmap check` warns when a decision lacks `## Why` or a learning lacks `## Apply when`.

## Config

`docmap.json` at the project root. Every key is optional; these are the defaults:

```json
{
  "roots": ["docs"],
  "indexName": "INDEX.md",
  "exclude": ["**/assets/**", "**/node_modules/**"],
  "numbered": ["docs/decisions", "docs/learnings"],
  "maxDescription": 160,
  "templatesDir": ".claude/skills/docmap/templates"
}
```

| key | meaning |
|---|---|
| `roots` | directories (relative to project root) that hold docs; each gets indexed recursively |
| `indexName` | filename of the generated index |
| `exclude` | glob patterns (`*`, `**`, `?`) matched against root-relative paths; matching dirs and files are ignored |
| `numbered` | dirs whose files must be `NNNN-slug.md`; `new` picks the next free number |
| `maxDescription` | max characters of `description` |
| `templatesDir` | where `new` looks for templates; falls back to the templates shipped next to the script |

The project root is found by walking up from the current directory looking for
`docmap.json`, then `.git`, else the current directory. All output paths are relative to it,
with forward slashes.

## Commands

| command | what it does |
|---|---|
| `docmap init [--root <dir>]` | Create `docmap.json` (if missing), `<root>/README.md`, `<root>/decisions/README.md`, `<root>/learnings/README.md` from the README template with routing text, then index. Never overwrites; prints `created`/`exists` per file. `--root` only applies when there is no `docmap.json` yet. |
| `docmap index [--check]` | Regenerate every `INDEX.md` under the roots (every directory that holds a doc or a subdirectory with docs). Orphan indexes are removed. `--check` writes nothing and exits 1 listing stale, missing or orphan indexes. |
| `docmap find <terms...> [--in <dir>] [--tag <t>] [--status <s>] [--limit N] [--json]` | Ranked search. Case- and diacritic-insensitive prefix match on words (`garantia` finds `Garantía`). Weights: title 10, tags 8, description 6, read_when 6, heading 4 (max 3 headings per term), body 1 per hit (max 10 per term), +10 when every term matches. Prints `path:line  score=N  title — snippet`; line is 1 for frontmatter hits. Default limit 15. Exit 1 when nothing matches. |
| `docmap outline <file>` | Frontmatter title and description, then one line per heading: line number, `#` level, text, and the word count of that section including subsections. |
| `docmap section <file> <heading> [--no-children]` | Print one section. `<heading>` is exact text (case-insensitive), a slug (`criterios-de-aceptacion`) or a unique prefix. Subsections are included until the next heading of the same or higher level; `--no-children` stops at the next heading of any level. |
| `docmap section <file> --lines 40-80` | Print a line range (1-based, inclusive). |
| `docmap show <file>` | Frontmatter as `key: value`, line and word counts, then the outline. |
| `docmap check [--fix]` | Lint; exit 1 on errors. `--fix` regenerates indexes first. Prints `docmap check: OK (N docs, M dirs)` on success. |
| `docmap new <dir> "<title>" [--template doc\|decision\|learning\|spec\|readme] [--tags a,b] [--description "..."] [--read-when "..."]` | Scaffold from a template, fill title, date, id and tags, slugify the filename (ASCII, lowercase, hyphens), reindex, print the path. Never overwrites. Template defaults to `decision`, `learning` or `spec` when the directory path contains `decisions/`, `learnings/` or `specs/`. `--template readme` writes `<dir>/README.md` (the directory's row in the parent index) instead of a slugged file. |
| `docmap stats` | Docs, dirs, total words (with a rough token estimate), words per directory, five largest docs. |
| `docmap help`, `docmap <cmd> --help` | Usage. Unknown commands exit 2. |

### What `check` reports

Errors (exit 1):

- missing or unparsable frontmatter; missing `title`, `description` or `read_when`
- `description` longer than `maxDescription`; `status` not in `draft|current|deprecated|superseded`
- `updated` not `YYYY-MM-DD`; `tags` not a list
- duplicate `id`; `supersedes` pointing to an unknown id
- broken relative Markdown links (`[x](path.md#anchor)`); `http(s)`, `mailto:` and `#anchor`-only links are skipped, as are links inside code
- stale, missing or orphan `INDEX.md`
- files in a numbered dir not named `NNNN-slug.md`; two files sharing a number

Warnings (exit 0): `status: draft` older than 30 days (by `updated`, else mtime); docs over 400 lines;
a doc under a `decisions/` directory without `## Decision` or `## Why`; a doc under `learnings/`
without `## Lesson` or `## Apply when` (a learning without a trigger is never recovered).

## INDEX.md format

Generated, deterministic (byte-identical on re-run), never hand-edited:

```markdown
# Decisions

_Generated by `docmap index`. Do not edit by hand._

Architecture decision records, one per file.

## Directories

| dir | description | read when |
|---|---|---|
| [archive/](archive/INDEX.md) | Superseded decisions | Digging into history |

## Documents

| doc | description | read when | status | updated |
|---|---|---|---|---|
| [0001-use-sqlite.md](0001-use-sqlite.md) | Todos live in SQLite | Touching persistence | current | 2026-09-01 |
```

The title and paragraph come from the directory's `README.md` (`title`, `description`); without
one the directory name is used. Subdirectory rows use the subdirectory's `README.md`
`description` and `read_when`. Empty sections are omitted. Directories sort alphabetically,
documents by filename, so numbered dirs read chronologically. `README.md` is never listed as a
document.

## Frontmatter schema

Required on every `.md` under the roots except `INDEX.md`:

| key | required | meaning |
|---|---|---|
| `title` | yes | short title |
| `description` | yes | one line, <= `maxDescription` chars: what is in the doc |
| `read_when` | yes | one line: the situation in which an agent should open it |
| `id` | no | unique across all roots; referenced by `supersedes` |
| `status` | no | `draft`, `current` (default), `deprecated`, `superseded` |
| `updated` | no | `YYYY-MM-DD` |
| `tags` | no | `[a, b]` inline or a `- a` block list |
| `supersedes` | no | id of the doc this one replaces |
| `area` | no | free-text grouping |

Unknown keys are preserved and ignored. The parser is a YAML subset: `key: value`, double- and
single-quoted strings (`''` escapes a quote), inline arrays, block arrays, `#` comments. Values
containing `: ` or ` #` must be quoted. Multi-line scalars (`>`/`|`) are not supported.

## Templates

`templates/` holds `doc.md`, `decision.md`, `learning.md`, `spec.md` and `README.md` (the
directory description template). Placeholders: `{{title}}`, `{{description}}`, `{{read_when}}`,
`{{id}}`, `{{status}}`, `{{date}}`, `{{tags}}`, `{{slug}}`. Point `templatesDir` at your own copy
to change the skeletons; keep the frontmatter keys.

## Versioning

The script carries a `VERSION` constant and answers `docmap --version`; it matches the
`version` in the repo's `package.json`, and the repo's `verify` script fails if they drift.
Upgrading is re-running `npx skills add ultr4nerd/skills` or copying the folder again; indexes are
regenerated by `docmap index`, so a format change in a new version shows up as a single `index`
diff. Breaking changes to the frontmatter schema or the index format bump the major version.

## Development

```sh
node --test skills/docmap/scripts/docmap.test.mjs    # unit and CLI tests on temp fixture trees
npm run verify                                        # from the repo root: every skill's tests + packaging checks
```
