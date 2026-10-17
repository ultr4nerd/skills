---
title: Wallet pass
description: Apple Wallet and Google Wallet pass limits and how tokens map onto pass fields
read_when: Designing, generating or reviewing an Apple Wallet or Google Wallet pass
status: draft
updated: {{date}}
---

# Wallet pass

The platform draws the pass. We choose a few colors, images and the field text; there is no
CSS, no layout control beyond the pass style, and no brand typeface in the text fields. Design it
like a sticker, not a screen. Limits below were checked against the docs linked at the end;
re-check before shipping a new pass type.

## Constraints

**Apple Wallet (`pass.json`)**

- Colors: `backgroundColor`, `foregroundColor` (field values) and `labelColor` (field labels), as
  CSS-style `rgb(r, g, b)` strings. Use rgb: hex is not documented.
- Text uses the system font; there is no font key. Brand type only appears baked into images.
- Images are PNG at @1x, @2x and @3x, sized in points; they scale to fill and crop:
  icon 29x29 (required), logo up to 160x50, strip 375x123 (store card), 375x144 (coupon),
  375x98 (event ticket), thumbnail 90x90 (generic, event ticket).
- Store cards take logo, icon and strip; generic passes take logo, icon and thumbnail. The strip
  sits behind the primary fields: keep it quiet or the text becomes unreadable.

**Google Wallet (loyalty and generic classes)**

- Background: `hexBackgroundColor` as `#rrggbb`. Unset, Google uses the dominant color of the hero
  image or logo, so always set it.
- `programLogo` (required): square PNG, at least 660x660, full-bleed background. Google masks it to
  a circle: do not pre-mask, and keep the mark well inside the circle.
- Hero image: wide PNG shown at full width, no text baked in. Check the current size in the brand
  guidelines before producing it.
- You do not set text colors: pick backgrounds that clearly pass with one of white or black text.

## Token mapping

| surface field | token | format |
|---|---|---|
| Apple `backgroundColor` | <!-- color.<pass background role> --> | `rgb(r, g, b)` (`design show <token>` prints it) |
| Apple `foregroundColor` | <!-- color.on-<that role> --> | `rgb(r, g, b)` |
| Apple `labelColor` | <!-- a checked muted text role on that background --> | `rgb(r, g, b)` |
| Google `hexBackgroundColor` | same background token | `#rrggbb` |
| logo, strip, hero images | brand artwork; colors from the same tokens | PNG |

Labels are small text: hold `foregroundColor` and `labelColor` to AA (4.5:1) on the background.
If tenants pick their own pass colors at runtime, validate them with the same WCAG formula and fall
back to a checked token pair when they fail.

## Verify

- `design contrast <foreground token> <background token> --min AA` for value and label colors.
- Install the pass on a real iPhone and Android phone, in light and dark system appearance.
- Apple: PassKit programming guide, "Pass Design and Creation" (developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html).
- Google: Wallet REST reference `loyaltyclass` and the loyalty card brand guidelines (developers.google.com/wallet).
