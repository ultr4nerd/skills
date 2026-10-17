---
title: OG image
description: Social preview image limits (1200x630, Satori/next/og CSS subset and fonts) and token mapping
read_when: Building or changing Open Graph or social share images
status: draft
updated: {{date}}
---

# OG image

Generated preview images are rendered by a small layout engine, not a browser. Keep the layout
simple, pass fonts and colors in explicitly, and keep the message readable at thumbnail size.

## Constraints

- Size 1200x630 px. Platforms crop differently: keep the title and logo inside a centered safe area.
- `next/og` / Satori: flexbox layout only (no grid), a subset of CSS, `@font-face` ignored. Fonts are
  passed as files in code; use TTF or OTF (WOFF works, avoid WOFF2). On Vercel the bundle,
  including fonts and images, must stay under 500 KB.
- Use resolved values from the generated TS output (`tokens['color.surface']`, typography objects);
  do not rely on CSS variables.
- Text is read small: title at least about 48px, two lines at most, high contrast (AAA if you can).

## Token mapping

| image part | token | format |
|---|---|---|
| background | <!-- color.<role> --> | hex |
| title | <!-- color.on-<role>, type.display --> | hex; family, px, weight |
| logo | brand artwork | PNG or SVG |

## Verify

- `design contrast` for title and secondary text on the background.
- Render the route locally, then check it in a social preview debugger before release.
