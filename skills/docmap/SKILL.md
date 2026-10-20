---
name: docmap
description: Navigate, search and extend a project's Markdown docs (decisions, learnings, specs) without reading whole files. Use in any project that has docs/INDEX.md or docmap.json: when asked "where is X documented", when reading or searching project docs, when adding a doc, recording a decision or a learning, and before opening any doc under docs/ longer than ~150 lines. Also use to set up docs/ in a new project ("docmap init").
---

# docmap

Docs are a tree of Markdown files with frontmatter (`title`, `description`, `read_when`). Every
directory has a generated `INDEX.md`: what is here, when to open it. Drill down by reading
indexes, then extract only the section you need. Budget: ~100 tokens per hop, not thousands.

CLI (zero deps, Node >= 20): `node .claude/skills/docmap/scripts/docmap.mjs <cmd>`, or the
project's alias (`npm run docs -- <cmd>`, `docmap <cmd>`). `docmap <cmd> --help` has every flag;
`README.md` next to this file has the full reference, config and frontmatter schema.

## Reading protocol

1. Start at `docs/INDEX.md`. Never `ls` or `cat` a docs directory blind. Descend into a
   subdirectory only when its `read when` column matches your task.
2. Locate: `docmap find <terms...>` (`--in docs/specs`, `--tag x`, `--status current`, `--json`).
   Ranked `path:line  score  title — snippet`; case- and diacritic-insensitive prefix match.
3. Before opening a hit: `docmap show <file>` (frontmatter + outline, ~20 lines).
4. Read only what you need: `docmap section <file> <heading-or-slug>` or `--lines 40-80`.
5. `cat` a whole doc only when the outline shows it is short or you truly need all of it.

## Decisions and learnings: how the project remembers

The point of `docs/decisions/` and `docs/learnings/` is that the next agent does not repeat a
closed debate or a known mistake. They only work if they are written with a trigger and read
at the right moment, so:

- Before proposing an architectural, tooling or process change: `docmap find <topic> --in docs/decisions`.
  Respect a `current` decision or write a superseding one (`supersedes: <old id>`, set the old
  one to `status: superseded`). Never edit a decision's history.
- Before starting work in an area where something went wrong before: `docmap find <topic> --in docs/learnings`.
  If the backlog skill is installed, `backlog next --claim` prints these as `related:`.
- Record a learning whenever a task revealed a non-obvious failure, a wrong assumption, or a
  trick that saved real time. Record a decision whenever you chose between real alternatives.
  The `read_when` line is what makes either findable later: write the situation, not the topic
  ("Touching session cookies behind the ingress", not "cookies").
- Templates enforce the shape: decision = `## Decision`, `## Why`, `## Consequences`;
  learning = `## What happened`, `## Lesson`, `## Apply when`. `check` warns when a section is missing.

## Adding or changing docs

- New project: `docmap init` creates `docs/`, `decisions/`, `learnings/` with routing READMEs,
  `docmap.json` and indexes. Then edit the READMEs so their `read_when` routes correctly.
- New doc: `docmap new <dir> "<title>" --description "..." --read-when "..." [--tags a,b] [--template doc|decision|learning|spec|readme]`.
  Template is inferred from the directory; numbered dirs get `NNNN-slug.md`. Write the body
  afterwards and make `description` and `read_when` precise: every future agent reads only those
  two lines to decide whether to open the file.
- New directory: `docmap new <dir> "<title>" --template readme`; its `description`/`read_when`
  become the directory's row in the parent index.
- After editing frontmatter, adding, renaming or deleting any doc: `docmap index`.
  Never edit `INDEX.md` by hand.

## Before finishing a task

Run `docmap check` (or `check --fix` to regenerate indexes first). It must print
`docmap check: OK (...)`. Errors fail: bad or missing frontmatter, long description, bad status,
duplicate ids, unknown `supersedes`, broken relative links, stale indexes, bad numbering.
Warnings do not fail but deserve a note: old drafts, docs over 400 lines, decisions without
`## Why`, learnings without `## Apply when`.

## Commands

```
docmap init [--root docs]                     scaffold docs tree, config and indexes
docmap index [--check]                        regenerate every INDEX.md
docmap find <terms...> [--in d] [--tag t] [--status s] [--limit N] [--json]
docmap show <file> | outline <file>           frontmatter + headings with word counts
docmap section <file> <heading> [--no-children] | --lines A-B
docmap new <dir> "<title>" [--template t] [--tags a,b] [--description ".."] [--read-when ".."]
docmap check [--fix] | stats | help | <cmd> --help | --version
```
