# backlog

A file-based project tracker for repos worked on by agents and humans. "Linear for agents":
every issue is a Markdown file with YAML frontmatter under `backlog/issues/`, a generated
`backlog/INDEX.md` gives the overview, and a zero-dependency Node CLI does the bookkeeping so an
agent can pick the next task, claim it, log progress and close it without spending LLM tokens on
tracker housekeeping.

It is built for long autonomous runs ("Ralph loop" style): an agent repeatedly asks
`backlog next --claim`, works the issue, runs the project's verify command, marks it done, commits,
and loops until the backlog is empty or it is blocked. Deterministic exit codes let the loop stop
cleanly. Humans read the same files and the same INDEX in any editor or on GitHub.

Why files and not a SaaS tracker:

- The backlog travels with the code: branches, PRs and history include it.
- Agents already have file and shell tools; no API keys, no network, no MCP server.
- Everything is reviewable in a diff: what was planned, what was logged, what shipped.

## Install

As a skill (works with Claude Code, Codex, Cursor and other agents that read `SKILL.md`):

```sh
npx skills add ultr4nerd/skills
```

Or copy the `backlog/` folder into `.claude/skills/` or `.agents/skills/` of your project.

Requirements: Node 20 or newer. No npm dependencies. macOS and Linux.

## Wiring

Add a script so both humans and agents can type `backlog <cmd>`:

```json
{
  "scripts": {
    "backlog": "node .claude/skills/backlog/scripts/backlog.mjs"
  }
}
```

Then `pnpm backlog next` / `npm run backlog -- next`. Without a package manager, run the script
directly or add an alias. The CLI finds the project root by walking up from the current directory
looking for `backlog.json`, then `.git`, falling back to the current directory, so it works from
subfolders.

Optional: set `BACKLOG_OWNER=<name>` in the agent's environment to make it the default owner for
`start`, `log` and `next --claim`.

## Config

`backlog.json` at the project root. Optional; defaults shown (see `backlog.example.json`):

```json
{
  "dir": "backlog",
  "prefix": "ISS",
  "statuses": ["backlog", "todo", "in-progress", "blocked", "review", "done", "cancelled"],
  "priorities": ["P0", "P1", "P2", "P3"],
  "kinds": ["epic", "feature", "bug", "chore", "spike", "decision"],
  "areas": [],
  "progressDir": "progress",
  "staleDays": 7,
  "verify": "pnpm verify"
}
```

- `dir`: where `issues/` and `INDEX.md` live.
- `prefix`: issue id prefix; ids are `PREFIX-0001`.
- `statuses`: must include `todo`, `in-progress`, `blocked`, `done`, `cancelled`. INDEX groups
  follow this order. `priorities` order is the sort order (first = highest).
- `areas`: empty means any string is allowed; otherwise values are validated.
- `progressDir`: scratch plans for in-flight issues (`progress/<ID>.md`).
- `staleDays`: `check` and `stale` warn about in-progress/blocked issues not updated in this many
  days.
- `verify`: printed as a reminder by `next`, `start` and `done`. The CLI never runs it.

Templates: `templates/issue.md` and `templates/progress.md` in the skill folder. Override per
project by placing files with the same names in `<dir>/templates/`.

## Files

```
backlog.json                      config (optional)
backlog/INDEX.md                  generated overview, grouped by status
backlog/issues/ISS-0001-slug.md   one file per issue
progress/ISS-0001.md              scratch plan while ISS-0001 is in progress (deleted on done)
```

Issue file:

```markdown
---
id: ISS-0001
title: Short imperative title
kind: feature
status: todo
priority: P1
area: core
parent: ISS-0000        # optional epic
depends_on: []          # ids that must be done first
created: 2026-10-17
updated: 2026-10-17
due:                    # optional YYYY-MM-DD
owner:                  # agent/human name while in-progress
branch:                 # optional
estimate:               # S | M | L | XL
tags: []
---

## Context
Why this exists. Links to docs.

## Scope
What is in and out.

## Acceptance criteria
- [ ] Verifiable statement
- [ ] Another

## Notes

## Log
- 2026-10-17 10:12 claude: started; plan in progress/ISS-0001.md

## Outcome
(filled on done: what shipped, how it was verified, learnings, follow-ups)
```

The frontmatter parser is a deliberate YAML subset: `key: value`, quoted strings, inline
`[a, b]` and block `- item` lists, empty values and `#` comments. Writing preserves key order and
unknown keys (comments are dropped) and never reflows the body: commands only touch the sections
they own (`## Log`, `## Outcome`, checkboxes under `## Acceptance criteria`).

## Commands

Ids accept short forms: `12`, `iss-12` and `ISS-0012` are the same issue. All paths in output are
forward-slash, relative to the project root. Errors are printed as `backlog: <message>` on stderr.
Exit codes: 0 ok, 1 error, 2 usage error or unknown command, 3 nothing to do (`next`),
4 the owner has a blocked issue (`next`).

| Command | What it does |
| --- | --- |
| `new "<title>" [--kind k] [--priority P] [--area a] [--parent ID] [--depends-on ID,ID] [--due D] [--estimate S] [--tags a,b] [--status s] [--owner o] [--context "..."] [--criteria "a\|b\|c"]` | Create an issue with the next free id and a slugified filename (ASCII, diacritics stripped), validate every field, regenerate INDEX, print `created <id> <path>`. Defaults: kind feature, P2, todo. |
| `list [--status s,s] [--priority p] [--area a] [--kind k] [--parent ID] [--owner o] [--tag t] [--due-before D] [--sort priority\|created\|updated\|due] [--all] [--json]` | Table of id, pri, status, kind, area, owner, due, title. Done and cancelled are hidden unless `--all` or a status filter is given. |
| `show <ID> [--brief] [--json]` | Print the file. `--brief`: one-line header, deps with their status, acceptance criteria, last 3 log lines. |
| `set <ID> key=value ... [--owner o] [--force]` | Validated frontmatter edits. Lists: `depends_on=A,B`, `tags+=x`, `tags-=x`. Always bumps `updated`. See transitions below. |
| `start <ID> --owner <name> [--branch b]` | `set status=in-progress owner=<name>`, create `progress/<ID>.md` from the template if missing, append a Log line, print the brief and the verify reminder. |
| `log <ID> "<message>" [--owner o]` | Append `- YYYY-MM-DD HH:MM owner: message` to `## Log` (section is created if missing). Bumps `updated`. |
| `tick <ID> <n\|all> [n...]` | Mark acceptance criteria (1-based) as `[x]`. |
| `block <ID> "<reason>"` | `status=blocked`, log `blocked: <reason>`. The owner and progress file are kept so the work can resume. |
| `unblock <ID>` | Back to `in-progress` if an owner is set, else `todo`. The usual transition checks apply. |
| `done <ID> [--outcome "..."] [--force]` | Refuses if any `- [ ]` remains under Acceptance criteria (unless `--force`, which is logged). Outcome comes from `--outcome`, else `## Summary` of the progress file, else an existing non-empty `## Outcome`; refuses if it would be empty. Sets done, clears owner, deletes the progress file, regenerates INDEX, prints the open-children count of the parent epic and a reminder to verify and commit. |
| `cancel <ID> "<reason>"` | `status=cancelled`, log the reason, clear owner, delete the progress file. |
| `next [--area a] [--owner o] [--claim] [--branch b] [--json]` | Pick the best issue: `todo`, not an epic, all `depends_on` done; ordered by priority, earliest due, oldest created, lowest id. With `--owner`: if that owner already has an in-progress issue, print it as `RESUME` (exit 0); if they have a blocked one, print it as `BLOCKED` with the reason (exit 4). `--claim` runs `start`. Nothing available prints `NOTHING TO DO` (exit 3). |
| `board` | Counts per status, in-progress with owner and days since last update, blocked with reasons, overdue, top 5 ready todo. |
| `stale` | In-progress or blocked issues not updated within `staleDays`. |
| `index` | Regenerate `backlog/INDEX.md`. Deterministic: same issues, same bytes. |
| `check [--fix]` | Validate the tracker (see below). `--fix` regenerates INDEX first. Prints `backlog check: OK (N issues)` on success. |
| `help`, `<cmd> --help` | Usage. |

### Transition rules (`set`, `start`, `unblock`)

- Anything can go to `cancelled`.
- `done` only through `backlog done` (or `set status=done --force`).
- `in-progress` requires an owner; refuses if that owner already has another in-progress issue, or
  if any `depends_on` is not done. `--force` overrides both.
- `depends_on` and `parent` must reference existing issues and must not create a cycle.
- `priority`, `kind`, `status`, `estimate` and (when configured) `area` must be in the config lists;
  `due` must be a real `YYYY-MM-DD` date.

### What `check` reports

Errors (exit 1): missing or unparsable frontmatter, missing required keys, id/filename mismatch,
duplicate ids, unknown `depends_on` or `parent`, dependency or parent cycles, invalid
status/priority/kind/area/estimate/date, in-progress without owner, done with an empty Outcome,
stale or missing INDEX, orphan `progress/*.md` whose issue is not in progress or blocked.

Warnings (exit 0): done with unchecked criteria, todo or in-progress whose parent epic is still `backlog`, in-progress not updated for more than `staleDays`,
overdue issues, todo (non-epic) with no acceptance criteria.

## The work loop

The agent-facing protocol lives in `SKILL.md`; this is the same loop from the outside.

```
backlog check                              # 1. tracker healthy? fix first if not
backlog next --owner claude --claim        # 2. exit 3 -> backlog empty, exit 4 -> blocked: stop
backlog show ISS-0012                      # 3. read the issue and only the docs it links
backlog log ISS-0012 "plan: a, b, c"       #    plan goes into progress/ISS-0012.md too
...implement...                            # 4. small steps, `backlog log` after each, run verify
backlog block ISS-0012 "reason"            # 5. only when blocked by something outside the issue
backlog tick ISS-0012 all                  # 6. criteria proven, Summary written in progress file
backlog done ISS-0012
git commit -am "ISS-0012: add login endpoint"   # 7. loop to 2
```

Hard rules the loop depends on: one in-progress issue per owner; nothing is done without a green
verify and a filled Outcome; log as you go; a blocked issue gets a reason and the agent stops
instead of working around broken tooling.

A minimal shell driver:

```sh
while :; do
  backlog next --owner claude --claim --json > /dev/null
  code=$?
  [ $code -eq 3 ] && { echo "backlog empty"; break; }
  [ $code -eq 4 ] && { echo "blocked, stopping"; break; }
  my-agent "Work the claimed backlog issue following SKILL.md, then stop." || break
done
```

## A day of use

```sh
# morning: plan
backlog new "Auth epic" --kind epic --priority P1 --area core
backlog new "Add login endpoint" --parent 1 --priority P1 --area core \
  --criteria "POST /login returns 200|Bad password returns 401" --context "See docs/auth.md"
backlog new "Add session cookie" --parent 1 --depends-on 2 --priority P0 --criteria "Cookie is HttpOnly"
backlog new "Write auth docs" --parent 1 --depends-on 2,3 --due 2026-10-24 --tags docs

# agent run (repeats until exit 3 or 4)
backlog next --owner claude --claim        # CLAIMED: ISS-0002 (ISS-0003 waits on it despite P0)
backlog log 2 "plan: handler, validation, tests"
backlog log 2 "handler + tests green"
backlog tick 2 all
backlog done 2 --outcome "POST /login with validation and tests; pnpm verify green"
git commit -am "ISS-0002: add login endpoint"
backlog next --owner claude --claim        # CLAIMED: ISS-0003
backlog block 3 "session store credentials missing in .env"   # stops here, exit 4 next time

# evening: review
backlog board          # 1 blocked (reason shown), 1 done, what is next
backlog check          # OK (4 issues, 1 warning)
backlog show 3 --brief # read the Log, provide the credential, then: backlog unblock 3
```

## Development

```sh
node --test scripts/backlog.test.mjs
```

Tests run the CLI against temporary fixtures with a fixed clock (`BACKLOG_NOW`), covering every
command, transition validation, cycle detection, `next` ordering, `done` refusals, and `check`.
