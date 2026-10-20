# skills

Agent skills I use across my projects with coding agents (Claude Code, Codex, Gemini CLI, humans).
Each skill is a folder with a `SKILL.md` (agent-facing instructions) and, when it helps, a
zero-dependency CLI so the agent spends tokens on the work, not on bookkeeping.

The common idea: **everything about a project lives in files inside the repo**, with generated
indexes and small CLIs, so any agent can pick the project up cold without reading everything,
and the project keeps its own memory of what was decided and what went wrong.

## Catalog

### Running software projects

| Skill | What it does | When it triggers |
|---|---|---|
| [`docmap`](skills/docmap/) | Recursive, indexed documentation. Every folder gets a generated `INDEX.md` (what is here, when to read it); the CLI searches, outlines and extracts single sections so an agent never reads a whole doc blind. Numbered decisions and learnings with templates; `init` scaffolds a new project. | Reading, searching or adding project docs; recording a decision or a learning |
| [`backlog`](skills/backlog/) | File-based issue tracker for agents ("Linear in a folder"). Markdown issues with priority, status, dependencies and a log; a CLI with `next --claim`, `start`, `log`, `block`, `done`, `board`, `check`, `retro`. Built for long autonomous loops. With docmap installed it surfaces related decisions and learnings at claim time and files new ones at close time. | Planning work, "what's next", creating/closing issues, status reports, autonomous runs, retros |
| [`design`](skills/design/) | Design system in files. W3C DTCG tokens are the single source; `build` generates CSS (optionally a Tailwind v4 `@theme`), a typed TS export and a one-line-per-token `TOKENS.md`; a 150-line `DESIGN.md` is the agent entry point, with component specs, surface targets (wallet pass, email, print, OG) and reference intake notes. `check` covers references, WCAG contrast per theme, stale outputs and hard-coded values in source. | Building or changing UI, email, print, passes or OG images; turning a brand book, screenshots or CSS into tokens; adding colors, fonts or components |

More categories (content creation, setup) are coming; each will have its own section here.

## Install

Into a project (any agent that reads `.claude/skills/` or `.agents/skills/`):

```sh
npx skills add ultr4nerd/skills            # interactive picker; --skill docmap,backlog to skip it
# or copy the folders by hand
cp -R skills/docmap skills/backlog skills/design <project>/.claude/skills/
ln -s ../.claude/skills <project>/.agents/skills
```

Wire the CLIs so humans and agents call them the same way (`package.json` shown; a Makefile or
shell aliases work too):

```json
{
  "scripts": {
    "docs": "node .claude/skills/docmap/scripts/docmap.mjs",
    "backlog": "node .claude/skills/backlog/scripts/backlog.mjs",
    "design": "node .claude/skills/design/scripts/design.mjs"
  }
}
```

Requirements: Node >= 20. No npm dependencies.

## The harness pattern (software projects)

1. `AGENTS.md` at the repo root is the single entry point (`CLAUDE.md` just says "read AGENTS.md").
   It has a map table (path, what, read when), hard rules, and the work loop.
2. `docs/` is indexed by `docmap` (`docmap init` to start); `docs/decisions/` and
   `docs/learnings/` are numbered. A rule is a decision file, never a comment.
3. `backlog/` is driven by `backlog`; `progress/<id>.md` holds the live plan of in-flight work
   so another agent can resume.
4. `design/` is driven by `design`: `DESIGN.md` is the entry point for any UI work, `tokens.json`
   is the only place a color or size is defined, and everything else is generated from it.
5. A `verify` script defines "done": it runs `docmap check`, `backlog check`, `design check`, the
   tests, and any project-specific lint. Green before starting, green before closing.
6. The project learns: `backlog next --claim` shows the decisions and learnings relevant to the
   issue; `backlog done --learning` and `backlog retro` make sure friction turns into a learning
   with a `read_when` trigger, so the next agent sees it before repeating the mistake.

See each skill's `README.md` for details and `SKILL.md` for the agent protocol.

## Development

```sh
npm run verify     # every skill's tests + packaging checks (SKILL.md frontmatter, catalog, --version)
npm test           # tests only
```

`verify` is what CI runs (`.github/workflows/verify.yml`, Node 20 and 22 on Linux and macOS).
Versions: every CLI answers `--version` with the `version` of `package.json`; tag releases as
`v<version>`.

## License

MIT
