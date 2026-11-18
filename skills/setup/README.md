# setup

A tool guide (decision 0003) that lets a coding agent install this repo's skills in your project
and wire them up, asking before each step. It is Markdown only and ships no CLI: the install
itself is [`npx skills add`](https://www.npmjs.com/package/skills), which picks the right
directory for your agent; setup never reimplements it.

Software projects only (Node + git). Ask your agent "set up these skills in this project".

## Requirements

- Node >= 20 and `npx`.
- The `skills` CLI, checked against **1.9.0** (`npx skills --version`, 2026-11-18). Other versions
  may work; the install flags used are `add <source> --skill <list> -y` and optionally `--agent`.
- A git repository with a `package.json` (setup offers `npm init -y`, with your consent).

## The five steps

1. **Preflight.** Git root, Node and npx versions, `package.json`. An invalid `package.json`,
   `backlog.json` or `docmap.json` stops setup before anything is written.
2. **Recommend.** From [`references/catalog.md`](references/catalog.md): hard dependencies
   (`requires`) are added to your selection and announced; you confirm the full list. A refusal
   or a trimmed list is honoured. `crew` is offered as optional, for multi-agent work only.
3. **Install.** `npx skills add <source> --skill <list> -y`. The source defaults to
   `ultr4nerd/skills` and can be a fork or a local checkout. No `--agent` unless you name one. A
   non-zero exit stops setup. Installed CLIs are then located on disk and those paths are used.
4. **Wire.** Missing `package.json` scripts only; `docmap init` only when there is no
   `docmap.json` and no hand-written `docs/INDEX.md` (otherwise it asks); `backlog.json`
   with a `verify` command derived from your `test`, `lint`, `typecheck` scripts and confirmed by you.
5. **AGENTS.md.** Written from [`references/agents-md.md`](references/agents-md.md) only if
   missing; an existing file is never edited.

It ends with a report: installed, written, skipped and why, and the next command to try.

## Never does

- Overwrite a file or a `package.json` script.
- Install anything without your confirmation of the full list.
- Run `npx skills add` for a skill you did not confirm.
- Touch a non-Node project.
- Commit, push, or change `CLAUDE.md`/`AGENTS.md` content you already have.

## Maintenance

`references/catalog.md` is generated: `node scripts/catalog.mjs --write` in the skills repo after
editing `catalog.json`; `npm run verify` fails when it is stale. Bumping the `skills` CLI means
re-checking the flags above and updating the version here and in `SKILL.md`.
