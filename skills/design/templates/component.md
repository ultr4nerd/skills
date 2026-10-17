---
title: {{title}}
description: {{description}}
read_when: {{read_when}}
status: draft
updated: {{date}}
---

# {{title}}

<!-- Budget: 80 lines. Write only what a screen that exists today needs. Name tokens in
     backticks (`design check` verifies every one). -->

## Purpose

One sentence: what it is for. When not to use it, and what to use instead.

## Anatomy

- Container
- Label
- <!-- optional parts: icon, badge, helper text -->

## Variants

| variant | use for |
|---|---|
| | |

## States

| state | what changes (tokens) |
|---|---|
| default | |
| hover | |
| focus-visible | focus ring |
| active / pressed | |
| disabled | |
| loading / error | <!-- only if it has them --> |

## Tokens

<!-- One line per property: background, text, border, radius, padding, gap, type style, shadow, motion.
     Prefer semantic tokens; add component.<name>.* tokens only when a value is unique to this component. -->

## Accessibility

- Element and role: <!-- native <button>, <a>, <input> before ARIA -->
- Keyboard: <!-- Tab, Enter/Space, Escape, arrows -->
- Name: <!-- visible label or aria-label for icon-only -->
- Target size at least 24x24 CSS px; contrast pairs checked in TOKENS.md.

## Content

<!-- Microcopy rules for this component: label length, verbs, casing, truncation. -->

## Do and don't

- Do
- Don't

## Code

<!-- Path to the implementation, e.g. src/components/{{name}}.tsx -->
