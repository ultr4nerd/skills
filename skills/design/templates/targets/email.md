---
title: Email
description: HTML email limits (no CSS variables, unreliable web fonts, dark-mode inversion) and token mapping
read_when: Building or reviewing a transactional or marketing email template
status: draft
updated: {{date}}
---

# Email

Email clients are old browsers with opinions. Inline resolved values, design for the fallback font,
and assume some clients will recolor your email in dark mode. Support data: caniemail.com.

## Constraints

- No CSS custom properties: Gmail drops variable declarations. Inline the resolved values from the
  generated TS/JSON output (`tokens['color.surface']`) at build time; never `var(--...)`.
- Web fonts reach a minority of clients (Gmail webmail renders only its own fonts; classic Outlook on
  Windows falls back to Times New Roman unless `mso-font-alt` is set). Always ship the full fallback
  stack from the `font.*` tokens and make the email look right in it.
- Dark mode: some clients invert colors fully (classic Outlook on Windows, Gmail on iOS) or partially;
  `prefers-color-scheme` works in roughly four in ten clients. Avoid logos that disappear on dark
  backgrounds (use a transparent PNG with an outline or a padded light plate).
- Layout: single column, table-based structure for Outlook, a fixed max width (600px is the common
  convention), body text at least 16px, buttons as padded table cells (Outlook ignores border-radius).

## Token mapping

| email part | token | format |
|---|---|---|
| page background | <!-- color.surface or a dedicated email background --> | hex, inline `bgcolor` and `style` |
| body text | <!-- color.on-surface, type.body --> | hex; font stack; px |
| button | <!-- color.primary, color.on-primary, radius.control, spacing.md --> | inline styles on the cell |
| secondary text | <!-- color.on-surface-muted --> | hex |

## Verify

- `design contrast` for every text/background pair used.
- Test sends to Gmail web, Gmail iOS, classic Outlook on Windows and Apple Mail, light and dark.
- Check any CSS beyond basic inline styles on caniemail.com before using it.
