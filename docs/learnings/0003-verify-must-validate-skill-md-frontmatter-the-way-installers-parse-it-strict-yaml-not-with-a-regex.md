---
title: verify must validate SKILL.md frontmatter the way installers parse it (strict YAML), not with a regex
description: "npx skills add skipped backlog and docmap for months because an unquoted ': ' broke strict YAML while verify, reading frontmatter with a regex, stayed green"
read_when: Editing a SKILL.md frontmatter, or changing how verify checks skill packaging
id: learnings-0003
status: current
updated: 2026-11-11
tags: [iss-0015, repo, packaging, yaml]
---

# verify must validate SKILL.md frontmatter the way installers parse it (strict YAML), not with a regex

## What happened

Reinstalling the whatsapp skill with `npx skills add ultr4nerd/skills` printed
`SKILLS_SKILL_SKIPPED ... YAML parse error: Nested mappings are not allowed in compact mappings`
for backlog and docmap. Their descriptions were plain scalars containing `backlog.json: when ...`.
verify read the frontmatter with `^description:\s*(.+)$`, so it never saw the problem, and the
README install command silently installed only two of the four skills.

## Lesson

A check is only as good as its parser. Packaging checks must apply the consumer's rules: verify
now rejects an unquoted frontmatter value with `': '` or `' #'` and unquotes values before using
them. Descriptions with punctuation are written as double-quoted strings.

## Apply when

Writing or editing any SKILL.md description (they are long and full of colons), adding a field to
the frontmatter, or after changing verify's packaging checks: run `npx skills add . --list` and
confirm every skill is listed with no SKIPPED line.
