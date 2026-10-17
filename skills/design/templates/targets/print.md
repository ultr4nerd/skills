---
title: Print
description: Print production rules (CMYK and spot values, bleed, resolution, small text) and token mapping
read_when: Producing cards, stickers, posters, packaging or any file that goes to a printer
status: draft
updated: {{date}}
---

# Print

Screens mix light (RGB), presses mix ink (CMYK or spot colors). A hex value is not a print color:
the print value of every brand color is decided once, recorded next to the token, and approved on a
physical proof. Follow the printer's own template when it differs from the defaults below.

## Constraints

- Color: record CMYK (and a Pantone reference for critical brand colors) per primitive color in
  `"$extensions": {"io.github.ultr4nerd.design": {"print": {"cmyk": [0, 80, 85, 0], "pantone": "..."}}}`.
  `design show <token>` prints it. Vivid RGB blues, greens and oranges shift most when converted.
- Files: PDF (PDF/X if the printer asks), fonts embedded or outlined, images at 300 ppi at final size.
- Bleed 3 mm (0.125 in) on every edge; keep text and logos at least 3 mm inside the trim.
- Small text: ink spreads and paper lowers contrast. Hold text to at least AA (prefer AAA) and avoid
  type below about 6 pt; use 100% black, not rich black, for small text.
- Units: 1 pt = 1/72 in and 1 CSS px = 1/96 in, so a 16px token is 12 pt.

## Token mapping

| print element | token | print value |
|---|---|---|
| <!-- card background --> | <!-- color.<role> --> | CMYK from the primitive's `print` extension |
| <!-- body text --> | <!-- color.on-<role>, type.body --> | CMYK; size in pt |

## Verify

- `design contrast` for every text/background pair (on screen values, then judge the proof).
- Printer preflight report, then a physical proof under daylight before the full run.
