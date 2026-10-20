---
name: backlog
description: File-based issue tracker driven by a zero-dependency CLI (Markdown issues with frontmatter in backlog/, generated INDEX.md). Use in any project that has backlog/ or backlog.json: when planning work, asked "what's next", creating, updating or closing issues, tracking progress, running autonomous work loops ("work the backlog", "keep going"), producing status reports, or doing a retro of what went wrong.
---

# backlog

Issues live in `backlog/issues/<ID>-<slug>.md`; `backlog/INDEX.md` is generated. The CLI does
all bookkeeping so you spend tokens on the work, not on the tracker. Run it as `backlog <cmd>`
via the project's script, or `node .claude/skills/backlog/scripts/backlog.mjs <cmd>`.
`backlog <cmd> --help` has every flag; `README.md` next to this file has the full reference,
config keys and the issue file format.

## Lifecycle

`backlog` (parked) -> `todo` -> `in-progress` -> `review` (optional) -> `done`. Any status may go
to `blocked` (with a logged reason) or `cancelled`. `done` is reachable only through `backlog done`.
Epics (`kind: epic`) group children via `parent:` and are never picked by `next`.

## Hard rules

- One in-progress issue per owner. Finish, block or cancel before starting another.
- Nothing is done until the project verify (printed by `next`/`start`/`done`) is green and
  `## Outcome` says what shipped and how it was verified. `done` refuses unchecked criteria and
  an empty Outcome. `--force` exists for humans, not for loops.
- Never edit frontmatter by hand when a command exists (`set`, `start`, `block`, `done`, `log`,
  `tick`). Editing the body (Context, Scope, Notes, ticking criteria) by hand is fine.
- Log as you go (`backlog log`), not at the end. The Log is how a human audits the run, and how
  `retro` later finds the issues worth learning from.
- Blocked means stop: `backlog block <ID> "<reason>"` and end the turn. Do not work around a
  broken tool, a failing verify you did not cause, or a missing credential.
- `backlog check` red = fix the tracker state first, then continue.

## Work loop protocol

Run this when asked to "work the backlog", "keep going", or loop until done. `<me>` is your agent
name (for example `claude`); `BACKLOG_OWNER=<me>` makes it the default.

1. `backlog check`. Exit 1: fix the reported files (`check --fix` for a stale INDEX) first.
2. `backlog next --owner <me> --claim`
   - exit 0 `CLAIMED`/`RESUME`: continue with that issue.
   - exit 3 `NOTHING TO DO`: stop and report "backlog empty".
   - exit 4 `BLOCKED`: stop and report the blocked issue and its reason.
3. Read the claim output. If it lists `related:` docs, read them before planning: decisions
   constrain what you may do, learnings tell you what already failed here. Then read only the
   docs the issue links. Write a 3-5 bullet plan into `progress/<ID>.md` and
   `backlog log <ID> "plan: ..."`.
4. Implement in small steps. After each meaningful step: `backlog log <ID> "..."` and run the
   project verify command.
5. Blocked by something outside the issue: `backlog block <ID> "<reason>"` and stop. If the
   block taught you something non-obvious, add `--learning "<title>"`.
6. Tick criteria as each is proven (`backlog tick <ID> 1`). Fill `## Summary` in
   `progress/<ID>.md`, then `backlog done <ID>` (or `--outcome "..."`). If the task involved a
   revert, retry, workaround or a wrong assumption, add `--learning "<what we now know>"`; if you
   chose between real alternatives, `--decision "<what was chosen>"`. `done` prints a hint when
   the Log shows friction and no learning is linked.
7. Commit with the issue id in the message (`git commit -m "ISS-0012: add login endpoint"`).
   Loop to step 2 unless the user capped the number of iterations.

## Learning from the work (needs the docmap skill next to this one)

`learn`, `retro` and the `related:` lines connect the tracker to `docs/decisions` and
`docs/learnings`. Without docmap they are silent no-ops; the loop above still works.

- `backlog learn <ID> "<title>" [--decision] [--read-when "..."]` files a numbered doc tagged with
  the issue id and links it in the Log. Then write its sections and its `read_when`: the
  situation in which an agent must open it. `docmap check` fails until `read_when` is set.
- `backlog retro [--days 14]` lists closed issues whose Log shows friction (blocked, revert,
  retry, workaround, `--force`, cancelled) and that have no learning yet. Run it when asked for
  a retro or weekly; for each row, `show <ID> --brief`, then `learn` or consciously skip.

## Reporting and human review

Status report: `backlog board` (counts, in-progress with age, blocked with reasons, overdue, top
todo) and `backlog list --json` for details. A human reviews a run by opening `backlog/INDEX.md`,
running `backlog show <ID>` on anything surprising, and reading `## Log` and `## Outcome`.
Daily recipe: `backlog check`, `backlog board`, `backlog stale`. Weekly: `backlog retro`.

## Commands

```
backlog new "<title>" [--kind k] [--priority P0..P3] [--area a] [--parent ID] [--depends-on ID,ID]
            [--due YYYY-MM-DD] [--estimate S|M|L|XL] [--tags a,b] [--context ".."] [--criteria "a|b|c"]
backlog list [--status s,s] [--area a] [--owner o] [--all] [--json]     backlog show <ID> [--brief] [--json]
backlog next [--owner o] [--claim] [--json]      # exit 3 = empty, 4 = owner is blocked
backlog start <ID> --owner <me> | log <ID> "<msg>" | tick <ID> <n|all> | set <ID> key=value
backlog block <ID> "<reason>" [--learning t] | unblock <ID> | cancel <ID> "<reason>"
backlog done <ID> [--outcome ".."] [--learning t] [--decision t] [--force]
backlog learn <ID> "<title>" [--decision] [--read-when ".."]  | retro [--days N] [--json]
backlog board | stale | index | check [--fix] | help | --version
```

Ids accept short forms (`12`, `iss-12`, `ISS-0012`). `next` picks: status todo, not an epic,
all `depends_on` done; ordered by priority, earliest due, oldest created, lowest id.
Exit codes: 0 ok, 1 error, 2 usage, 3 nothing to do, 4 owner has a blocked issue.
