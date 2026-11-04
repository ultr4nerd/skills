# AGENTS.md

Entry point for any agent working in this repo. `CLAUDE.md` points here.

## Map

| Path | What | Read when |
|---|---|---|
| `README.md` | Catalog of skills, install, the harness pattern | First time here |
| `skills/<name>/SKILL.md` | Agent protocol of a skill | Using or changing that skill |
| `skills/<name>/README.md` | Full reference of a skill (CLI, config, formats) | Changing that skill's behaviour |
| `docs/INDEX.md` | Decisions and learnings about this repo | Before changing tooling or process |
| `backlog/INDEX.md` | Open work | Picking what to do |
| `progress/<ID>.md` | Live plan of an issue in progress | Resuming someone else's work |

## Hard rules

1. `npm run verify` green before starting and before closing. It runs every skill's tests, the
   packaging checks, `docmap check` and `backlog check`.
2. Changes to `skills/` or to the repo tooling go through an issue: `npm run backlog -- start <ID>`
   (or `next --claim`), log as you go, `done` with an Outcome. Small or exploratory tasks do not
   need one. Never push to `main`; one PR per issue.
3. A rule or a choice between alternatives is a decision in `docs/decisions/`, never a comment.
   Friction (revert, retry, workaround, wrong assumption) becomes a learning via
   `backlog done --learning` or `backlog learn`.
4. Skills stay runtime-agnostic: files and zero-dependency CLIs only. Nothing in `skills/` may
   assume CI, Vercel or a particular machine (see decision 0001).
5. Blocked means stop: `backlog block <ID> "<reason>"` and end the turn.

## Work loop

Follow `skills/backlog/SKILL.md` ("Work loop protocol") with `BACKLOG_OWNER` set to your agent
name. The verify command is `npm run verify`. Commit messages: gitmoji shortcode + issue id,
for example `:sparkles: ISS-0002 generate README catalog from catalog.json`.
