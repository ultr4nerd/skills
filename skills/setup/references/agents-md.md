<!-- Stub for AGENTS.md. Strip this comment and every "[skill]" tag. Keep only lines whose skill was wired; drop the verify rule if no command was confirmed. Fill the project name. Renumber the rules. -->
# AGENTS.md

Entry point for any agent working in <project name>. `CLAUDE.md` points here.

## Map

| Path | What | Read when |
|---|---|---|
| `docs/INDEX.md` [docmap] | Indexed docs: decisions and learnings (`npm run docmap -- find <terms>`) | Before changing architecture, tooling or process |
| `backlog/INDEX.md` [backlog] | Open work (`npm run backlog -- next`) | Picking what to do |
| `progress/<ID>.md` [backlog] | Live plan of an issue in progress | Resuming someone else's work |
| `design/DESIGN.md` [design] | Design system entry point | Any UI work |

## Hard rules

1. [verify] `<confirmed verify command>` green before starting and before closing.
2. [backlog] Work goes through an issue: `npm run backlog -- start <ID>` (or `next --claim`), log
   as you go, `done` with an Outcome. Small or exploratory tasks do not need one.
3. [docmap] A rule or a choice between alternatives is a decision in `docs/decisions/`, never a
   comment; a mistake worth avoiding becomes a check when one can catch it, and a learning in
   `docs/learnings/`.
4. [backlog] Blocked means stop: `npm run backlog -- block <ID> "<reason>"` and end the turn.
