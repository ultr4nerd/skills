# crew on Codex

Codex runs OpenAI models. Seats for other providers fall back, and the fallback is logged.

## Resolve the seats

- `{ "provider": "openai", ... }` seats: use that model if your Codex build lets a subagent pick
  one. If it cannot, the seat is not filled: try the next seat, as for any other seat.
- `{ "tier": ... }` seats: `fast` -> the smallest coding model available, `capable` -> the default
  model, `max` -> the strongest model with the highest reasoning effort.
- Any other `provider` cannot be filled here. Take the next seat and log:
  `seat: <role> wanted <provider>/<model>, ran <model>: Codex reaches OpenAI models only`.
- Do not shell out to another vendor's CLI (`claude -p`, `gemini -p`) to fill a seat
  (decision 0005).

## Dispatch

- Use `spawn_agent` with the role's dispatch text, then wait for it before the step that needs
  its result. Explorers can be spawned together.
- The implementer works in the current checkout so the review package matches the branch.
- Codex sandboxes may be read-only by default. The implementer needs write access to the
  workspace; if the session cannot grant it, stop and tell the human instead of working around it.

## Record what ran

Log the model each subagent used. If the critic and the reviewer are OpenAI models and so is the
implementer, the final report must say the review was not independent.
