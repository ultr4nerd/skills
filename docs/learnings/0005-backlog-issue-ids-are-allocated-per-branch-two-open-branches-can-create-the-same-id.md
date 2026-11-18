---
title: "Backlog issue ids are allocated per branch: two open branches can create the same id"
description: "ISS-0025 was first created as ISS-0023 on main while an unmerged branch already held ISS-0023/0024; backlog new only sees the issues on the current branch"
read_when: Creating a backlog issue while another branch with new issues is still unmerged
id: learnings-0005
status: current
updated: 2026-11-18
tags: [iss-0022, crew]
---

# Backlog issue ids are allocated per branch: two open branches can create the same id

## What happened

During the first crew run (2026-11-18) the plan branch created ISS-0023 and ISS-0024. A bug fix
was then started on a fresh branch from `main`, where those files did not exist yet, and
`backlog new` handed out ISS-0023 again. It was renamed to ISS-0025 by hand (frontmatter id and
filename) before anything was pushed.

## Lesson

`backlog new` picks the next free id from the files on the current branch. With several open
branches that add issues, ids can collide and the second merge would carry two different issues
with the same id. Create new issues on one branch at a time, or check the open PRs' highest id
first and continue from there.

## Apply when

Running `backlog new` while another branch or PR that adds issues is not merged yet.

## Enforcement

Partial: `backlog check` already fails on duplicate ids once both branches meet on `main`, so
the collision is loud at merge time. Nothing catches it earlier: a branch cannot see another
branch's files. Revisit if it happens again (a `--from-remote` id allocation would be the next
step).
