---
title: Check the PR is still open before pushing more commits to its branch
description: A follow-up commit pushed to the branch of an already merged PR never reaches main; check the PR state first and open a new issue and PR if it merged
read_when: Adding commits to an issue branch after its PR was opened, especially when resuming work or reopening a closed issue
id: learnings-0001
status: current
updated: 2026-11-11
tags: [iss-0012, whatsapp, git, pr]
---

# Check the PR is still open before pushing more commits to its branch

## What happened

ISS-0011 was reopened to add the setup flow and the new commit was pushed to
`feat/iss-0011-whatsapp-skill`. PR #10 had already been squash-merged minutes earlier, so the
push succeeded but the commit stayed on a dead branch, and the PR description was edited to
describe changes main did not have. It was redone as ISS-0012 on a fresh branch from main.

## Lesson

Before pushing to an existing issue branch, run `gh pr view --json state` (or `gh pr status`).
If the PR is merged or closed, do not reopen the issue: create a new issue, branch from the
updated main, and open a new PR. Never edit the description of a merged PR to describe new work.

## Apply when

Any follow-up after a PR was opened: review feedback, "also add X", reopening a done issue, or
resuming work in a later session.
