---
name: setup
description: "Install and wire this repo's skills (docmap, backlog, design, crew, whatsapp) in a Node project with the skills CLI, asking before each step. Use when the user asks to set up, install or bootstrap these skills in a project, \"set up docmap and backlog\", \"install the skills\", or wants the AGENTS.md / docs / backlog harness in a new repo. Also in Spanish (\"instala los skills\", \"configura el proyecto\")."
---

# setup

Tool guide for the [`skills`](https://www.npmjs.com/package/skills) CLI, checked against skills
1.9.0 (`npx skills --version`). Markdown only: you run `npx skills add`, then wire what it
installed. Software projects with Node only. Everything that changes the project is confirmed with
the user first; a refusal or a partial yes is honoured and never retried.

Report at the end (last thing in your turn): what was installed, what was written, what was
skipped and why, and the next command to try (for example `<run backlog> board`, using the invocation resolved in step 4).

## 1. Preflight

Read-only first; any failure stops setup with nothing written.

1. Target root = `git rev-parse --show-toplevel`. Not a git repo: stop and say so (offer `git init`
   only if the user asks). Work from that root.
2. `node --version` >= 20 and `npx --version` present. Otherwise stop.
3. Each of `package.json`, `backlog.json`, `docmap.json` that exists must parse as JSON
   (`node -e "JSON.parse(require('fs').readFileSync('<f>','utf8'))"`). One that does not: stop,
   name the file and the parse error, write nothing.
4. Only after 1-3 pass: `package.json` missing: offer `npm init -y`; run it only with consent,
   else stop. Then parse the new file.
5. `git status --short`: tell the user about uncommitted changes; setup adds files next to them.

## 2. Recommend

Read `references/catalog.md` (generated from `catalog.json`; never edit it). It lists each skill
with summary, triggers, `Requires` (hard dependencies) and `Optional`.

1. Ask what the project needs, or propose from what you see (docs/, backlog/, UI code, team of
   agents). Skip `setup` itself and `whatsapp` unless the user asks for it.
2. Add the `Requires` of every selected skill and say so ("crew needs backlog, adding it").
   Mention `Optional` ones as suggestions only; docmap is the usual one.
3. Offer `crew` as optional, for multi-agent work only; never include it unasked.
4. Show the full final list and wait for a yes. "No" ends setup (report it as skipped). A trimmed
   list replaces yours; if the trim drops a hard dependency, say what will not work and ask again.

Install nothing before this confirmation.

## 3. Install

```sh
npx skills add <source> --skill <a,b,...> -y
```

- `<source>` defaults to `ultr4nerd/skills`. The user may give another (a fork, or a local
  checkout path); use it as given.
- `--skill` is exactly the confirmed list. No `--agent` by default: the installer detects the
  agent and picks the directory. Only when the user names an agent, add `--agent <name>`.
- Non-zero exit: stop, show the error, wire nothing. Do not retry with other flags unasked.
- A skill reported as skipped (for example a YAML parse error) is not installed: say so and do
  not wire it.

Then find each installed CLI. A skill has a CLI when its installed folder contains
`scripts/<name>.mjs` (today docmap, backlog, design). From the git root:

```sh
find -L . -name node_modules -prune -o -path '*/<name>/scripts/<name>.mjs' -print
```

The installer may use `.claude/skills/`, `.agents/skills/` or another directory, possibly
symlinked, so one file can match twice: deduplicate by resolved real path. Several different
matches: prefer the location the installer reported; else ask. Zero matches for a skill that has
a CLI: stop wiring that skill and tell the user. Quote the found path in every command.

## 4. Wire

Add only what is missing; never overwrite or edit an existing entry. Every action below runs only
when the skill was confirmed in step 2, installed in step 3, its CLI was found, and its alias
resolves (item 1). A declined or skipped action also skips whatever depends on it.

1. **Aliases.** For each such CLI, in `package.json` `scripts`: `"<name>"` absent: add
   `"<name>": "node <found path>"`. Already equal to that: fine. Present with another value:
   keep it, run no `npm run <name>` command for that skill, ask, and (if the user agrees) run the
   CLI directly as `node "<found path>" <args>`; say so in the report. Edit with `node` (parse,
   add keys, write 2-space indent and a trailing newline). Never name the docmap script `docs`
   (`npm docs` is a built-in). Record one resolved invocation per wired skill: `npm run <name> --` when the alias
   resolves, else `node "<found path>"`. Below, `<run docmap>` etc. mean that invocation.
2. **docmap.** `init` regenerates every `INDEX.md` under `docs/` (and deletes orphan ones), so
   generated indexes are replaced by design and hand-written ones must never be touched. Run
   `<run docmap> init` only when `docmap.json` is absent AND (`docs/` does not exist OR every
   `INDEX.md` under `docs/` contains ``Generated by `docmap index` ``; check with
   `find docs -name INDEX.md`). Any other state (docmap.json exists, or a hand-written index): ask,
   and on doubt skip and report it.
3. **backlog.** There is no init command.
   - `backlog.json` absent: write `{ "verify": "<confirmed command>" }`, then
     `<run backlog> index`.
   - Present and valid: add `verify` only if missing, with confirmation; change no other key.
   - Derive the verify command from `package.json` scripts: `npm run verify` if a `verify` script
     exists; else join those present of `lint`, `typecheck`, `test` as
     `npm run lint && npm run typecheck && npm test`; if none exist, propose none and ask what
     "done" means here. Always show the command and get a yes before writing.
4. **design.** If wired, run nothing; tell the user `<run design> --help` is the start (it needs
   their brand input).
5. Run `<run docmap> check` and `<run backlog> check` for the skills wired and report failures
   as they are; do not fix them unasked.

## 5. AGENTS.md

- `AGENTS.md` exists: do not touch it. Suggest the lines worth adding (map rows for `docs/` and
  `backlog/`, the verify rule) and let the user decide.
- Missing: copy `references/agents-md.md` (strip its leading HTML comment). Keep only the map
  rows and hard rules of skills actually wired (rows follow custom paths from `docmap.json` /
  `backlog.json`); the stub marks each block with its skill. Verify rule: use the command
  confirmed in step 4, else ask once; if the user defers, omit the rule and say so. Never leave a
  placeholder. Replace every `<docmap>`, `<backlog>`, `<design>` in the stub with that skill's
  resolved invocation (never `npm run <name>` for a preserved unrelated alias). Show it, write it after a yes. If `CLAUDE.md` is also missing, offer a one-line
  `CLAUDE.md` that says to read `AGENTS.md`.
- crew: if installed, mention it is for multi-agent work and needs a `crew.json` (see its
  README). If not installed and the project is multi-agent, offer it once.

## Never

Overwrite a file or script, install without the confirmed list, run `npx skills add` for a skill
the user did not confirm, touch a non-Node project, or push or commit on the user's behalf.
Requirements and the full reference: this skill's `README.md`.
