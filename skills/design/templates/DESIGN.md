---
title: {{title}}
description: "Entry point: principles, voice, foundations, surfaces and component inventory"
read_when: Before building or changing any UI, email, printed piece, wallet pass or generated image
status: draft
updated: {{date}}
---

# {{title}}

Read this first, then `design/TOKENS.md` (or `design show <group>`), then only the component
spec or target you need. Use token names, never raw values. `design check` must pass.

<!-- Budget: 150 lines. Replace every comment with content taken from design/references/.
     Anything a reference does not confirm is marked provisional, here and in tokens.json. -->

## Overview

<!-- Two or three sentences: what the product is, who uses it, the feeling in three words.
     Link the source note in references/ that this comes from. -->

## Principles

<!-- Three to five one-line rules, each a trade-off you would defend in review,
     e.g. "Clarity over decoration", "The customer's brand first, ours second". -->

1.

## Voice and microcopy

- Tone: <!-- e.g. warm, brief, second person; never cute in errors -->
- Buttons and links are verbs that name the result ("Save changes", not "Submit"). Same action, same word everywhere.
- Errors say what happened and how to fix it. No blame, no apology, never a bare error code.
- Empty states say what will appear here and offer the first action.
- <!-- capitalization (sentence case?), numbers, dates, currency, languages -->

## Color

- Build with roles (`color.surface`, `color.on-surface`, `color.primary`), never with primitives.
- Text sits only on backgrounds it is checked against: the "on:" list in TOKENS.md. `color.on-<role>` is for content on `color.<role>`.
- <!-- where the brand color goes and where it never goes (large fills? body text?) -->

## Typography

- Use the `type.*` styles (classes `type-body`, `type-title`, ...); never set size, weight or line height by hand.
- <!-- display and body families, license, fallback stack; provisional until licensed -->

## Layout and spacing

- Spacing comes from `spacing.*` only.
- <!-- grid, max content width, breakpoints, density, safe areas on mobile -->

## Shape, elevation and motion

- Radius: `radius.control` for controls, `radius.card` for containers. <!-- borders or shadows? -->
- Motion confirms an action; it never decorates. Durations from `motion.duration.*`, easing from `ease.*`.
- Respect `prefers-reduced-motion`: replace movement with an opacity change or nothing.

## Imagery and icons

<!-- illustration or photo style, icon set and stroke weight, what never to use -->

## Accessibility floor

- WCAG 2.2 AA: text 4.5:1 (3:1 at 24px, or 18.66px bold), UI parts and focus indicators 3:1.
- Every interactive element shows `color.focus` on keyboard focus; targets are at least 24x24 CSS px (44x44 on touch-first screens).
- Never carry meaning with color alone; pair it with text or an icon.

## Surfaces

Where the system is used and what changes there. Constrained surfaces get a spec in `targets/`
(`design new target wallet-pass|email|print|og-image|<name>`), linked from this table.

| surface | what matters there | spec |
|---|---|---|
| Web app | CSS variables from the generated tokens.css | this file |

## Components

Specs exist only for components a real screen uses. Add one with `design new component <name>`.

<!-- design:components:start -->
<!-- design:components:end -->

## Do and don't

- Do <!-- the three to six rules reviewers enforce most -->
- Don't

## Open decisions

<!-- What is not decided, who decides, and which tokens stay provisional until then. -->

- [ ]
