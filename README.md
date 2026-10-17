# skills

Agent skills I use to run software projects with coding agents (Claude Code, Codex, Gemini CLI, humans). Each skill is a folder with a `SKILL.md` (agent-facing instructions) and, when it helps, a zero-dependency CLI so the agent spends tokens on the work, not on bookkeeping.

The common idea: **everything about a project lives in files inside the repo**, with generated indexes and small CLIs, so any agent can pick the project up cold without reading everything.

| Skill | What it does | When it triggers |
|---|---|---|
| [`docmap`](skills/docmap/) | Recursive, indexed documentation. Every folder gets a generated `INDEX.md` (what is here, when to read it); the CLI searches, outlines and extracts single sections so an agent never reads a whole doc blind. Templates for decisions and learnings. | Reading, searching or adding project docs; recording a decision or a learning |
| [`backlog`](skills/backlog/) | File-based issue tracker for agents ("Linear in a folder"). Markdown issues with priority, status, dependencies and a log; a CLI with `next --claim`, `start`, `log`, `block`, `done`, `board`, `check`. Built for long autonomous loops. | Planning work, "what's next", creating/closing issues, status reports, autonomous runs |

## Install

Into a project (any agent that reads `.claude/skills/` or `.agents/skills/`):

```sh
npx skills add ultr4nerd/skills            # interactive picker
# or copy the folders by hand
cp -R skills/docmap skills/backlog <project>/.claude/skills/
ln -s ../.claude/skills <project>/.agents/skills
```

Wire the CLIs so humans and agents call them the same way (`package.json` shown; a Makefile or shell aliases work too):

```json
{
  "scripts": {
    "docs": "node .claude/skills/docmap/scripts/docmap.mjs",
    "backlog": "node .claude/skills/backlog/scripts/backlog.mjs"
  }
}
```

Requirements: Node ≥ 20. No npm dependencies.

## The harness pattern

1. `AGENTS.md` at the repo root is the single entry point (`CLAUDE.md` just says "read AGENTS.md"). It has a map table (path → what → read when), hard rules, and the work loop.
2. `docs/` is indexed by `docmap`; `docs/decisions/` and `docs/learnings/` are numbered. A rule is a decision file, never a comment.
3. `backlog/` is driven by `backlog`; `progress/<id>.md` holds the live plan of in-flight work so another agent can resume.
4. A `verify` script defines "done": it runs `docmap check`, `backlog check`, the tests, and any project-specific lint. Green before starting, green before closing.

See each skill's `README.md` for details and `SKILL.md` for the agent protocol.

## License

MIT
