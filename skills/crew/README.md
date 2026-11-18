# crew

An orchestration skill (decision 0005): it teaches the agent running your session to build one
feature with a small team of agents. A fast model implements, a capable model advises on hard
decisions, and a model from another provider critiques the plan and reviews each diff. You approve
the plan and you merge. Everything is kept in `backlog` issues and `progress/` files, so a new
session can resume where the last one stopped.

The skill is Markdown only. It ships no CLI and never runs commands to reach a model: your harness
dispatches the subagents with its own tools (T3 `delegate_task`, Claude Code `Agent`, Codex
`spawn_agent`).

Requires the [`backlog`](../backlog/) skill. [`docmap`](../docmap/) is optional.

## How a feature runs

```
explore (optional, fast, read-only)
  -> plan: epic + children (backlog planning protocol)
  -> critique (critic, other provider)          -> GATE 1: you approve the plan
  -> for each child, one at a time:
       implement (fast) --hard decision--> advisor (max) -> ruling in the Log
       review (reviewer, other provider) -> fix loop (max 2 rounds)
       backlog done (runs verify), commit, PR against main
  -> GATE 2: you review and merge
```

The advisor is called only on fixed triggers: verify red twice in a row, a change needed outside
the child's files, a change to another child's interface, or criteria that cannot be met as
written. "This feels hard" is not a trigger.

## Configuration: `crew.json`

Optional, at the project root. Without it every role uses its default tier. Copy
[`crew.example.json`](crew.example.json) to start.

```json
{
  "roles": {
    "critic":   [{ "provider": "openai", "model": "gpt-6-astra", "effort": "high" }, { "tier": "max" }],
    "reviewer": [{ "provider": "openai", "model": "gpt-6-astra" }, { "tier": "capable" }]
  },
  "limits": { "explorers": 3, "reviewRounds": 2, "advisorCallsPerIssue": 3 }
}
```

- **Roles**: `orchestrator`, `explorer`, `critic`, `implementer`, `advisor`, `reviewer`.
- **Seat**: `{ "provider", "model", "effort" }` or `{ "tier": "fast" | "capable" | "max" }`.
  `provider` is the company that makes the model (openai, anthropic, xai, google), not the app
  that runs it. The agent takes the first seat its harness can serve.
- **Fallback**: when a seat other than the first runs, the agent logs it in the issue and repeats
  it in the final report. If the reviewer ends up from the same provider as the implementer, the
  report says the review was not independent.
- **No commands.** No field holds a shell command; `verify` rejects keys like `run` or `cmd` in
  the example, and the agent refuses them in your `crew.json`.
- **Adding a provider** is adding a seat. If your harness cannot reach it, the seat falls back
  and the log says why.

## Harness support

| Harness | Reaches | Reference |
|---|---|---|
| T3 Code | Any model in its catalog, through whichever runtime serves it | [`references/t3.md`](references/t3.md) |
| Claude Code | Anthropic models only; other seats fall back | [`references/claude-code.md`](references/claude-code.md) |
| Codex | OpenAI models only; other seats fall back | [`references/codex.md`](references/codex.md) |
| Other | Whatever its subagent tool offers; the generic rule in `SKILL.md` | none |

Role contracts (what each dispatch holds and returns): [`references/roles.md`](references/roles.md).

## Limits and risks

- **Cost.** Each child costs one implementer run, one review per round and maybe an advisor call.
  Use crew for an epic with 2+ children or an M-sized issue; smaller work goes through the plain
  backlog loop.
- **Sequential.** v1 runs children one after another. Parallel lanes clash with one in-progress
  issue per owner, one PR per issue and `backlog/INDEX.md` conflicts; they need their own design.
- **Your code goes to other providers.** Briefs and diffs are sent to every model in a seat. Do
  not put another provider in a seat if the code must not leave your usual one.
- **Not autonomous.** Both gates stop for you. An unattended mode needs evals and its own decision.
- **Untested protocol.** Whether agents follow it is checked manually for now (spec acceptance
  criteria); skill evals come later.

Spec: `docs/specs/crew-v1-an-agent-team-with-roles-seats-and-human-gates.md` in the skills repo.
