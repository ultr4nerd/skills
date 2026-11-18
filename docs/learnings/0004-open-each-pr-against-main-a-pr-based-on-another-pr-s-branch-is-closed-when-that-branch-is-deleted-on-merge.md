---
title: Open each PR against main; a PR based on another PR's branch is closed when that branch is deleted on merge
description: "#19 was based on #18's branch; merging #18 deleted that branch and GitHub closed #19 for good, so it had to be rebased and reopened as #20"
read_when: Opening a PR while another of your PRs is still open, or when one issue depends on unmerged work
id: learnings-0004
status: current
updated: 2026-11-18
tags: [iss-0020, repo, git, github]
---

# Open each PR against main; a PR based on another PR's branch is closed when that branch is deleted on merge

## What happened

ISS-0019 was branched from ISS-0018's branch so its diff would not repeat the test move, and its
PR (#19) targeted `iss-0018-no-dev-files`. The owner merged #18 with branch deletion on. GitHub
then closed #19, and a closed PR whose base branch is gone cannot be reopened. The commit was
rebased onto `main` (`git rebase --onto origin/main iss-0018-no-dev-files`) and opened again as #20.

## Lesson

Open every PR against `main`. If an issue needs unmerged work, wait for that PR to merge and
branch from the updated `main`. If waiting is not an option, say in the PR body that it must be
retargeted to `main` before the base PR merges.

## Apply when

Creating a branch while another of your PRs is open, or when `gh pr create` would use anything
other than `--base main`.

## Enforcement

None: the failure happens on GitHub at merge time, outside any repo check. `verify` cannot see
a PR's base. The rule lives in this learning and in the backlog work loop's one-PR-per-issue
habit; revisit if it happens again (a pre-push check on the tracking branch would be the next
step).
