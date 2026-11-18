# crew on Claude Code

Claude Code reaches Anthropic models only. Seats for other providers fall back, and the fallback is
logged.

## Resolve the seats

- `{ "tier": ... }` and `{ "provider": "anthropic", ... }` seats map to the `Agent` tool's `model`
  option: `fast` -> `haiku`, `capable` -> `sonnet`, `max` -> `opus` (or `fable` when the session
  offers it and the role is the advisor or critic).
- A seat with any other `provider` cannot be filled here. Take the next seat and log:
  `seat: <role> wanted <provider>/<model>, ran <model>: Claude Code reaches Anthropic models only`.
- Do not shell out to another vendor's CLI (`codex exec`, `gemini -p`) to fill a seat, even if it
  is installed (decision 0005).

## Dispatch

- `Agent` with `subagent_type: "general-purpose"` and the mapped `model`. Use
  `run_in_background: false` when the next step needs the result (implementer, reviewer, advisor).
- Explorers can run together: send them in one message, each a separate `Agent` call.
- Implementer and reviewer run in this checkout; do not give the implementer worktree isolation,
  or the review package will not match the branch.
- To resume the same implementer for a fix round, use `SendMessage` with its agent id instead of a
  new `Agent` call, so it keeps its context.

## Record what ran

Log the model you passed. If the critic and the reviewer both fell back to Anthropic, the final
report must say the review was not independent.
