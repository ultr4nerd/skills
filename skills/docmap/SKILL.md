---
name: docmap
description: Navigate, search and extend a project's Markdown docs (decisions, learnings, specs) without reading whole files. Use when asked "where is X documented", when reading or searching project docs, when adding a doc, decision or learning, and before opening any doc longer than ~150 lines.
---

# docmap

Docs are a tree of Markdown files with frontmatter. Every directory has a generated
`INDEX.md` listing what is there and when to open it. Drill down by reading indexes,
then extract only the section you need. Budget: ~100 tokens per hop, not thousands.

CLI (zero deps, Node >= 20): `node .claude/skills/docmap/scripts/docmap.mjs <cmd>`.
If the project defines it, `npm run docs -- <cmd>` or the `docmap` alias is the same.
Paths are relative to the project root (nearest `docmap.json`, else `.git`).

## Reading protocol (token-saving)

1. Start at `docs/INDEX.md` (read it; never `ls` or `cat` a docs dir blind).
   Descend into a subdirectory only when its `read when` column matches your task.
2. To locate something: `docmap find <terms...>` (optionally `--in docs/specs --tag x --status current`).
   It returns `path:line  score  title — snippet`, ranked. Use `--json` when parsing.
3. Before opening a hit: `docmap show <file>` (frontmatter + outline, ~20 lines).
4. Read only what you need: `docmap section <file> <heading-or-slug>` or `docmap section <file> --lines 40-80`.
   Add `--no-children` to skip subsections.
5. `cat` a whole doc only when `outline` shows it is short (< ~150 lines) or you truly need all of it.
6. `docmap stats` estimates total reading cost when planning a large review.

## Adding or changing docs

- New doc: `docmap new <dir> "<title>" [--template doc|decision|learning|spec] [--tags a,b] [--description "..."] [--read-when "..."]`.
  It copies the template, fills title/date/id, slugifies the filename (numbered dirs get `NNNN-slug.md`),
  reindexes and prints the path. Then write the body and make `description` and `read_when` precise:
  they are what every future agent reads to decide whether to open the file.
- Manual alternative: copy `templates/<kind>.md`, fill the frontmatter, run `docmap index`.
- New directory: add a `README.md` (template `templates/README.md`); its `description`/`read_when`
  become the directory's row in the parent index.
- After editing frontmatter, adding, renaming or deleting any doc: run `docmap index`.
- Never edit `INDEX.md` by hand; it is regenerated.

## Decisions and learnings

- A decision (`docs/decisions/`, numbered) records a choice that constrains future work:
  `## Decision`, `## Why`, `## Consequences`. Supersede instead of editing history: create a new
  decision with `supersedes: <old id>` and set the old one to `status: superseded`.
- A learning (`docs/learnings/`, numbered) records a surprise worth remembering:
  `## What happened`, `## Lesson`, `## Apply when`. Record one whenever a task revealed a non-obvious
  failure mode, a wrong assumption, or a trick that saved real time.
- Check `docmap find <topic> --in docs/decisions` before proposing an architectural change; respect
  current decisions or write a superseding one.

## Before finishing a task

Run `docmap check` (or `docmap check --fix` to regenerate indexes first). It must print
`docmap check: OK (...)`. Errors: missing/invalid frontmatter, description over the limit, bad status,
duplicate ids, unknown `supersedes`, broken relative links, stale or missing indexes, bad numbering.
Warnings (drafts older than 30 days, docs over 400 lines) do not fail but deserve a note.

## Commands

```
docmap index [--check]                       regenerate every INDEX.md (--check: exit 1 if stale)
docmap find <terms...> [--in d] [--tag t] [--status s] [--limit N] [--json]
docmap outline <file>                        headings: line, level, text, section word count
docmap section <file> <heading> [--no-children] | --lines A-B
docmap show <file>                           frontmatter + outline
docmap check [--fix]                         lint; exit 1 on errors
docmap new <dir> "<title>" [--template t] [--tags a,b] [--description ".."] [--read-when ".."]
docmap stats                                 docs, dirs, words, largest docs
docmap help | <cmd> --help
```

Heading lookup for `section`: exact text (case-insensitive), slug (`criterios-de-aceptacion`),
or a unique prefix. Search is case- and diacritic-insensitive prefix matching on words.

## Frontmatter schema

Required on every `.md` under the docs roots except `INDEX.md`:

```yaml
---
title: Short title
description: One line, <= 160 chars: what is in this doc
read_when: One line: the situation in which an agent should open it
id: decisions-0003          # optional; unique across all docs; used by supersedes
status: current             # draft | current | deprecated | superseded (default current)
updated: 2026-10-17         # YYYY-MM-DD
tags: [payments, refunds]   # inline or block list
supersedes: decisions-0001  # optional, an existing id
area: billing               # optional free text
---
```

Unknown keys are kept and ignored. Values containing `: ` must be quoted. Config lives in
`docmap.json` at the project root (`roots`, `indexName`, `exclude`, `numbered`, `maxDescription`,
`templatesDir`); defaults cover a plain `docs/` tree with `docs/decisions` and `docs/learnings` numbered.
