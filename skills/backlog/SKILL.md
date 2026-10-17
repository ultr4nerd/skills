---
name: backlog
description: File-based issue tracker driven by a zero-dependency CLI (Markdown issues with frontmatter in backlog/, generated INDEX.md). Use when planning work, asked "what's next", creating/updating/closing issues, tracking progress, running autonomous work loops, or producing status reports.
---

# backlog

Issues live in `backlog/issues/<ID>-<slug>.md`; `backlog/INDEX.md` is generated. The CLI does all
bookkeeping so you spend tokens on the work, not on the tracker. Run it as `backlog <cmd>` via the
project's `package.json` script, or directly: `node .claude/skills/backlog/scripts/backlog.mjs <cmd>`.
Config is `backlog.json` at the project root (optional; see README for keys and defaults).

## Lifecycle

`backlog` (parked) -> `todo` -> `in-progress` -> `review` (optional) -> `done`. Any status may go to
`blocked` (with a logged reason) or `cancelled`. `done` is reachable only through `backlog done`.
Epics (`kind: epic`) group children via `parent:` and are never picked by `next`.

## Hard rules

- One in-progress issue per owner. Finish, block or cancel before starting another.
- Nothing is done until the project verify (printed by `next`/`start`/`done`) is green and
  `## Outcome` says what shipped and how it was verified. `done` refuses unchecked criteria and an
  empty Outcome. `--force` exists for humans, not for loops.
- Never edit frontmatter by hand when a command exists (`set`, `start`, `block`, `done`, `log`,
  `tick`). Editing the body (Context, Scope, Notes, ticking criteria) by hand is fine.
- Log as you go (`backlog log`), not at the end. The Log is how a human audits the run.
- Blocked means stop: `backlog block <ID> "<reason>"` and end the turn. Do not work around a broken
  tool, a failing verify you did not cause, or a missing credential.
- `backlog check` red = fix the tracker state first, then continue.

## Work loop protocol

Run this when asked to "work the backlog", "keep going", or loop until done. `<me>` is your agent
name (for example `claude`); set `BACKLOG_OWNER=<me>` once to make it the default.

1. `backlog check` - if it exits 1, fix the reported files (or `backlog check --fix` for a stale
   INDEX) before anything else.
2. `backlog next --owner <me> --claim`
   - exit 0 `CLAIMED`/`RESUME`: continue with that issue.
   - exit 3 `NOTHING TO DO`: stop and report "backlog empty".
   - exit 4 `BLOCKED`: stop and report the blocked issue and its reason.
3. `backlog show <ID>`; read only the docs the issue links. Write a 3-5 bullet plan into
   `progress/<ID>.md` (created by the claim) and `backlog log <ID> "plan: ..."`.
4. Implement in small steps. After each meaningful step: `backlog log <ID> "..."` and run the
   project verify command.
5. Blocked by something outside the issue: `backlog block <ID> "<reason>"` and stop.
6. Tick acceptance criteria as each is proven (`backlog tick <ID> 1` or edit the checkbox).
   Fill `## Summary` in `progress/<ID>.md`, then `backlog done <ID>` (or `--outcome "..."`).
   `done` deletes the progress file and regenerates INDEX.
7. Commit with the issue id in the message (`git commit -m "ISS-0012: add login endpoint"`).
   Loop to step 2 unless the user capped the number of iterations.

## CLI reference

```
backlog new "<title>" [--kind k] [--priority P] [--area a] [--parent ID] [--depends-on ID,ID]
            [--due YYYY-MM-DD] [--estimate S|M|L|XL] [--tags a,b] [--status s]
            [--context "..."] [--criteria "a|b|c"]
backlog list [--status s,s] [--priority p] [--area a] [--kind k] [--parent ID] [--owner o]
             [--tag t] [--due-before D] [--sort priority|created|updated|due] [--all] [--json]
backlog show <ID> [--brief] [--json]
backlog set <ID> key=value ... [--owner o] [--force]     # tags+=x  tags-=x  depends_on=A,B
backlog start <ID> --owner <me> [--branch b]
backlog log <ID> "<message>" [--owner o]
backlog tick <ID> <n|all> [n...]
backlog block <ID> "<reason>"      backlog unblock <ID>
backlog done <ID> [--outcome "..."] [--force]
backlog cancel <ID> "<reason>"
backlog next [--area a] [--owner o] [--claim] [--json]   # exit 3 = empty, 4 = owner blocked
backlog board | stale | index | check [--fix] | help
```

Ids accept short forms (`12` or `iss-12` mean `ISS-0012`). Default `new`: kind feature, P2, todo.
`next` picks: status todo, not an epic, all `depends_on` done; ordered by priority, then earliest
due, then oldest created, then lowest id. Exit codes: 0 ok, 1 error, 2 usage, 3 nothing to do,
4 owner has a blocked issue. Errors go to stderr as `backlog: <message>`.

## Issue file

```
---
id: ISS-0001            # required, matches filename prefix
title: Short imperative title
kind: feature           # epic | feature | bug | chore | spike | decision
status: todo            # backlog | todo | in-progress | blocked | review | done | cancelled
priority: P1            # P0 (highest) .. P3
area: core              # free text, or one of backlog.json "areas" when set
parent: ISS-0000        # optional epic
depends_on: []          # ids that must be done before this can start
created: 2026-10-17
updated: 2026-10-17     # bumped by every command
due:                    # optional YYYY-MM-DD
owner:                  # required while in-progress; kept while blocked
branch:                 # optional
estimate:               # S | M | L | XL
tags: []
---
## Context        why, links to docs
## Scope          in / out
## Acceptance criteria   - [ ] verifiable statements (done refuses unchecked ones)
## Notes
## Log            - YYYY-MM-DD HH:MM owner: message   (appended by the CLI)
## Outcome        filled on done: what shipped, how verified, learnings, follow-ups
```

Unknown frontmatter keys and key order are preserved; the body is never reflowed.
`progress/<ID>.md` is the owner's scratch plan while the issue is in progress or blocked; its
`## Summary` becomes the Outcome. `check` flags it as an orphan once the issue is closed.

## Reporting and human review

For a status report: `backlog board` (counts, in-progress with age, blocked with reasons, overdue,
top todo) and `backlog list --json` for details. A human reviews a run by opening
`backlog/INDEX.md`, running `backlog show <ID>` on anything surprising, and reading the `## Log`
and `## Outcome` sections. Daily recipe: `backlog check`, `backlog board`, `backlog stale`.
