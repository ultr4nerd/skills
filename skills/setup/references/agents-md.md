<!-- Stub for AGENTS.md. Strip this comment, fill <...>, delete rows of skills that were not installed. -->
# AGENTS.md

Entry point for any agent working in this repo. `CLAUDE.md` points here.

## Map

| Path | What | Read when |
|---|---|---|
| `docs/INDEX.md` | Indexed docs: decisions and learnings (`npm run docmap -- find <terms>`) | Before changing architecture, tooling or process |
| `backlog/INDEX.md` | Open work (`npm run backlog -- next`) | Picking what to do |
| `progress/<ID>.md` | Live plan of an issue in progress | Resuming someone else's work |
| `design/DESIGN.md` | Design system entry point | Any UI work |

## Hard rules

1. `<verify command>` green before starting and before closing.
2. Work goes through an issue: `npm run backlog -- start <ID>` (or `next --claim`), log as you go,
   `done` with an Outcome. Small or exploratory tasks do not need one.
3. A rule or a choice between alternatives is a decision in `docs/decisions/`, never a comment.
   A mistake worth avoiding becomes a check when one can catch it, and a learning in
   `docs/learnings/`.
4. Blocked means stop: `npm run backlog -- block <ID> "<reason>"` and end the turn.
