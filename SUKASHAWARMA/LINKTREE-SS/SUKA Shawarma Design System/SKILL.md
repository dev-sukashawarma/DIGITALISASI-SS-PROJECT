---
name: suka-shawarma-design
description: Use this skill to generate well-branded interfaces and assets for SUKA Shawarma, an Indonesian shawarma franchise with 19 outlets and an online pickup-order system. Contains essential design guidelines, colors, type, fonts, brand assets, and UI kit components for both production code and throwaway prototypes/mocks. The brand is warm — orange & deep-brown on cream — and copy is in Bahasa Indonesia.
user-invocable: true
---

# SUKA Shawarma — Design Skill

Read `README.md` in the root of this skill, and explore the other available
files. It documents:

- **Brand context** — what SUKA Shawarma is, what the product is (customer
  pickup-order app + admin panel), and where it lives.
- **Content fundamentals** — voice, tone, copy patterns, Indonesian
  conventions for currency, time and form labels, the emoji-as-icon system.
- **Visual foundations** — the warm orange + brown + cream palette, the
  480px-max phone shell, the soft-shadow card system, the bottom-sheet
  interaction model.
- **Iconography** — the emoji inventory used in production, when to fall back
  to Lucide.

Other files to know:

- `colors_and_type.css` — design tokens. Import this in any new HTML.
- `assets/logo.png` — primary brand mark (cartoon chef + wordmark).
- `assets/brand-palette.png` — the official color plate.
- `preview/*.html` — small specimen cards showing every component.
- `ui_kits/customer/` — full clickable recreation of the pickup-order app.
- `ui_kits/admin/` — full clickable recreation of the admin panel.
- `source/*.html` — verbatim copies of selected source files for reference.

## How to use this skill

If creating **visual artifacts** (slides, mocks, throwaway prototypes,
marketing pages): copy the assets you need out of `assets/`, import
`colors_and_type.css`, lift component markup from the UI kits, and produce
static HTML the user can view.

If working on **production code**: read the rules in `README.md` to become
fluent in the brand. Then make changes following the existing patterns in
the source repository (linked from the README) — small components, vanilla
JS, Supabase data, Bahasa Indonesia copy and comments.

If the user invokes this skill without any other guidance, ask them what
they want to build or design. Useful clarifying questions:

- Customer-facing or admin?
- Is this for the live product or for a one-off (deck, pitch, mock)?
- Mobile only (the default), or do they need a desktop view too?
- Any specific outlet / menu items / scenarios to feature?
- Should you use the Lilita One display font, or stick to the system stack?

Then act as an expert SUKA Shawarma designer who outputs HTML artifacts _or_
production code, depending on the need.

## Hard rules (don't break these)

1. **Use the warm palette.** Orange (#f29744), brown (#701604), ink
   (#400a07), cream (#fff7ed). The red `#ff4d4f` in the legacy source is
   superseded — replace it on sight.
2. **Bahasa Indonesia.** All UI copy, including comments in any code you
   write for the production app.
3. **Mobile-first, 480px max.** Even decks and marketing should respect the
   `.phone` column.
4. **Emoji is the icon system.** Don't draw stroke icons unless you must,
   and never draw the cartoon chef in SVG — it's a single asset.
5. **No filler.** The brand voice is direct and useful. Real example copy
   sits in `README.md` — use it as a tonal anchor, don't invent fluff.
