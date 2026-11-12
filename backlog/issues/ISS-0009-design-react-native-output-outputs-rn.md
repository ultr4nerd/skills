---
id: ISS-0009
title: "design: React Native output (outputs.rn)"
kind: feature
status: backlog
priority: P2
area: design
parent:
depends_on: [ISS-0005]
created: 2026-11-11
updated: 2026-11-11
due:
owner:
branch:
estimate: L
tags: [memento]
---

## Context
The TS export emits '16px', CSS shadow strings, font stacks and unitless line heights; React Native accepts none of them. Memento SPEC-0002 U5, needed for its Phase 3.

## Scope

## Acceptance criteria
- [ ] outputs.rn writes a typed TS module importable by React Native
- [ ] dimensions are unitless numbers; shadows are {shadowColor, shadowOpacity, shadowOffset, shadowRadius, elevation}
- [ ] typography carries one fontFamily name (io.github.ultr4nerd.design rn.fontFamily extension, else the first family), absolute lineHeight and string fontWeight
- [ ] build --check covers the RN output; tests cover each conversion; README documents it; npm run verify is green

## Notes

## Log

## Outcome
<!-- filled by `backlog done`: what shipped, how it was verified, learnings, follow-ups -->
