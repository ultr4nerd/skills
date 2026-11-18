---
title: Learnings end in a deterministic check when one is possible; prose is the last layer
description: "Each learning names under ## Enforcement the check that stops a repeat, or None: <why>; docmap check and backlog retro surface open ones"
read_when: Recording a learning, changing the learning template, or deciding how to stop an agent from repeating a mistake
id: decisions-0004
status: current
updated: 2026-11-18
tags: [iss-0017, docmap, backlog, learnings]
---

# Learnings end in a deterministic check when one is possible; prose is the last layer

## Decision

A learning is the record of a mistake, not the guard against it. Before writing one, try to make
the mistake impossible or loud with a deterministic check: an API or architecture that removes the
option, a lint rule, a type, a test, a `verify` step. Every learning has a `## Enforcement` section
naming that check and where it lives, or `None: <why no check can catch it>`. `docmap check` warns
when the section is missing, empty or still the template text; `backlog retro` lists the open ones.

## Why

- Agents copy what they read. Prose (comments, rules, learnings, AGENTS.md) works only if the next
  agent finds it and chooses to obey it; a check works every time and its error message can say
  how to fix the root cause. Source: Lauren Tan, "All Code Is Slop (Except Mine)" (AI Engineer,
  2026-11): code, then static checks, then verification, and prose as the last layer.
- Here, learnings 0001 and 0002 were prose only; 0003 became a verify check, and that one is the
  only learning that can no longer be repeated.
- Rejected: a separate "guard" skill with banned patterns and a baseline (overlaps ESLint/Biome
  where they exist; revisit if the section shows that many lessons need one); making a missing
  `## Enforcement` an error (older learnings in other projects would turn `docmap check` red);
  requiring a check always (some lessons, like what a harness shows the user, cannot be observed).

## Consequences

- Closing an issue with friction costs a little more: the check is part of the fix, in the same
  issue when it is small, or a follow-up issue named in `## Enforcement`.
- Existing learnings get a warning until they gain the section; this repo's 0001-0003 have it.
- `docmap` and `backlog` share the placeholder prefix "The check that stops a repeat"; changing
  the template text means changing both constants.
