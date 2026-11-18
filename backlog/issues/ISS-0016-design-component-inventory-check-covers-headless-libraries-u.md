---
id: ISS-0016
title: "design: component inventory check covers headless libraries (ui-sdk), not only shadcn.import"
kind: feature
status: todo
priority: P3
area: design
parent:
depends_on: [ISS-0005]
created: 2026-11-18
updated: 2026-11-18
due:
owner:
branch:
estimate: M
tags: [ui-sdk]
---

## Context
ui-sdk (vercel-labs/ui, @ui-sdk/react) is a headless behavior library at the Radix/Base UI layer, not a shadcn replacement: no theme vars, you bring markup and styles. Reviewed 2026-11-18 at 0.1.0-beta.10 (released 2026-11-12, APIs may change, React 19+). A ui-sdk target would be near-empty: tokens.css and the Tailwind @theme already style headless parts, and a tool guide would duplicate the skill Vercel ships inside @ui-sdk/core (decision 0003). The one gap: design check only flags imports of components without a spec under shadcn.import. Generalize it to a list of component sources (e.g. @/components/ui, @ui-sdk/react/*) so a project on ui-sdk, alone or with shadcn, keeps the spec discipline. Wait until ui-sdk leaves beta or a real project uses it.

## Scope

## Acceptance criteria
- [ ] design.json accepts a list of component import sources; shadcn.import keeps working as one of them
- [ ] check flags imports from any listed source with no spec in design/components/ (spec name = last path segment, e.g. @ui-sdk/react/select -> select.md)
- [ ] README documents the key and a ui-sdk example; tests cover shadcn-only, ui-sdk-only and mixed
- [ ] npm run verify is green

## Notes

## Log

## Outcome
<!-- filled by `backlog done`: what shipped, how it was verified, learnings, follow-ups -->
