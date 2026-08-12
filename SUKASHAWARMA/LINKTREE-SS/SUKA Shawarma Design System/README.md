# SUKA Shawarma — Design System

A design system & UI kit for **SUKA Shawarma**, an Indonesian shawarma franchise
with 19 outlets. The customer surface is an online-pickup order flow
(`order.sukashawarma.com`), built as a vanilla HTML/CSS/JS PWA on top of
Supabase. The admin surface — orders, menu, outlets, reports — runs in the same
`.phone` mobile shell, used by outlet staff on their phones.

This system captures everything you need to design new screens, slides, and
marketing in the SUKA brand voice without re-deriving it from screenshots.

> **Source of truth** — visual style, copy voice and component DNA come from
> the production repo: **<https://github.com/irsyadtawakal-ssn/FormOrder_SS>**.
> If you're recreating something subtle, dig there first — the README is a
> faithful but lossy summary.

---

## Index

- `README.md` — this file: brand context, content & visual foundations, iconography
- `SKILL.md` — agent-skill entry-point; cross-compatible with Claude Code Skills
- `colors_and_type.css` — design tokens (palette, type scale, radii, shadows, spacing)
- `assets/` — logos, brand color plate, source mark
- `fonts/` — font references (Google Fonts; see Type section)
- `preview/` — small HTML cards rendered into the Design System tab
- `ui_kits/customer/` — the customer-facing pickup-order app
- `ui_kits/admin/` — the staff/owner admin panel
- `source/` — verbatim copies of selected source files for reference (CSS, key HTML)

---

## What is SUKA Shawarma?

SUKA Shawarma is a 19-outlet shawarma chain in Indonesia. The cartoon-chef logo
(beard, white toque, holding a wrap, thumbs-up) and the chunky brown wordmark
sit on an orange sun-disc. The brand voice is friendly, warm and unambiguously
Indonesian — Bahasa Indonesia throughout, lots of emoji, prices in Rupiah, time
copy like "30 menit lagi" or "jam 14:00."

**The product is one app with two faces:**

1. **Customer flow** (`order.sukashawarma.com`)
   `index.html` → `menu.html` (redirect) → item sheet → cart sheet → `checkout.html` → `order.html`
   Pickup-only — no delivery, no dine-in, no login. Customer enters name + WA
   number, pays at the till.

2. **Admin panel** (`admin/*`)
   Dashboard, Orders (realtime), Menu CRUD, Outlets CRUD, Users, Reports,
   Settings. Two roles: `super_admin` and `outlet_staff` (RLS-enforced).
   Designed for phone-first usage by outlet workers.

Both surfaces share the same 480px-wide `.phone` shell, the same warm palette,
the same emoji-forward iconography, and the same bottom-sheet interaction model.

---

## Content Fundamentals

### Language

- **Bahasa Indonesia** throughout. Even internal code comments are in
  Indonesian. Do not write Indonesian-with-English-keywords ("submit," "save")
  — use the Indonesian equivalent (`Simpan`, `Bayar`, `Pesan`).
- Lowercase casing for body and form copy, sentence-case for headings, ALL CAPS
  only for badges (`BEST SELLER`, `HABIS`).
- "Anda" is implicit, almost never written. The voice is direct without
  pronouns ("Lengkapi data yang diperlukan," not "Mohon Anda lengkapi…").

### Voice & tone

- **Warm, casual, helpful.** Like a friendly cashier, not a corporate UX writer.
- **Action-led.** Headlines on buttons are imperatives:
  `Bayar Sekarang`, `Tambah ke Keranjang`, `Pesan →`.
- **Reassuring on payment.** Pickup payment is the default flow, so copy
  repeatedly grounds the user:
  *"Pesanan langsung tercatat. Selesaikan pembayaran di kasir outlet saat
  pickup."*
- **Emoji punctuates almost every label.** They are not decorative — they ARE
  the iconography (see ICONOGRAPHY).
- **Specific, never vague.** Examples in form placeholders are real
  (`Contoh: Budi Santoso`, `Contoh: 30 menit lagi / jam 14:00`), never `Your
  name here`.

### Real copy examples (lifted verbatim from source)

| Surface | Copy |
|---|---|
| Topbar logo | `🌯 SUKA Shawarma` |
| Outlet selector label | `Pickup di` |
| Outlet status | `● Buka` / `● Tutup`, `06:00–22:00` |
| Section heads | `⭐ Best Seller`, `Semua`, category names (Shawarma, Kebab…) |
| Form labels | `Nama Pemesan *`, `Nomor WhatsApp *`, `Waktu Ambil *`, `Catatan Tambahan` |
| Form hints | `Format: 08xxx atau 628xxx` |
| Hint banner | `💡 Pesanan langsung tercatat. Selesaikan pembayaran di kasir outlet saat pickup.` |
| Primary CTAs | `Bayar Sekarang`, `Tambah ke Keranjang`, `Pesan →` |
| Cart label | `0 item`, `Rp 45.000` |
| Validation toast | `Lengkapi data yang diperlukan` |
| Error states | `Outlet tidak ditemukan.` / `Gagal memuat menu. Coba lagi.` |
| Empty states | `Menu tidak ditemukan` + `Coba kata kunci lain.` |
| Quantity stepper | `−` / `+` (real minus, not hyphen) |
| Price | `Rp 25.000` — always `Rp ` prefix, `.` (Indonesian) thousands separator |
| Admin nav | `🏠 Dashboard`, `📋 Pesanan`, `🌯 Menu`, `📊 Laporan`, `📍 Outlet`, `⚙️ Pengaturan` |
| Status chips | `Pending`, `Dibayar`, `Disiapkan`, `Siap Ambil`, `Selesai`, `Dibatalkan` |

### Numbers, time, currency

- Currency: `Rp 25.000` — `Rp ` (with space) prefix, `.` as thousands
  separator (Indonesian convention).
- Service fee: shown as a separate line (`Biaya layanan (0.7%)`), never folded.
- Time: 24-hour (`14:00`), or relative phrasing (`30 menit lagi`).
- Discounts: red `-25%` chip + struck-through original price.

---

## Visual Foundations

### Palette

Use the tokens in `colors_and_type.css`. The brand palette is **warm**
— orange + deep-brown + cream — derived from the official color plate
(`assets/brand-palette.png`). It REPLACES the red `#ff4d4f` used in the source
CSS (which predates the brand plate).

| Token | Hex | Role |
|---|---|---|
| `--suka-orange` | `#f29744` | Primary CTAs, price text, brand fills |
| `--suka-orange-deep` | `#ee8a2c` | Hover / pressed on orange |
| `--suka-orange-soft` | `#fff1e0` | Tint backgrounds, chips, brand-soft buttons |
| `--suka-brown` | `#701604` | Secondary brand — "SHAWARMA" red-brown, dark CTAs |
| `--suka-ink` | `#400a07` | Primary text (body), "SUKA" wordmark color |
| `--suka-ink-2` | `#6b3a31` | Secondary text |
| `--suka-cream` | `#fff7ed` | App background (warm, not neutral grey) |
| `--suka-paper` | `#ffffff` | Card surface |
| `--suka-muted` | `#8a6b5e` | Muted text, addresses, meta |
| `--suka-green` | `#0a7d2c` | "Buka" (open), success |
| `--suka-yellow` | `#fff8e1` / `#7a5c00` | Hint banners |

**Rules**
- **Orange is for action** — buttons, "+" affordances, price.
- **Brown is for emphasis** — dark text on cream, secondary CTAs ("Ke Kasir"),
  the topbar logo wordmark on cream.
- **Cream, not grey** — the app background is `#fff7ed`, never neutral. This is
  load-bearing; pure white-on-grey makes the brand feel cold and unbranded.
- Never invent new colors. Tints come from existing tokens with low-opacity
  overlays or from the `-soft` variants.

### Typography

The source repo ships with the system stack only. For the design system we add
two Google Fonts to capture the cartoon-display energy of the logo and a
modern Indonesian-flavored body face:

| Family | Use | Notes |
|---|---|---|
| **Lilita One** | `--font-display` — hero headlines, big stats, splash | Substitute for the chunky condensed display in the logo (no source font shipped) — **FLAGGED, see below** |
| **Plus Jakarta Sans** | `--font-sans` — everything else | 400 / 500 / 600 / 700 / 800. Designed in Jakarta — feels native. Replaces the legacy `-apple-system` stack which still works as fallback |
| system mono | `--font-mono` | Order numbers, debug |

**Scale** (mobile-first; see `colors_and_type.css` for full vars):
`Display 32 · H1 22 · H2 18 · H3 16 · Body 14 · Body-sm 13 · Caption 12 · Overline 11 · Tiny 10`

> ⚠️ **Font substitution flagged.** The display font in the logo (chunky
> rounded condensed sans, slight italic) is custom or extracted from a
> commercial pack — we don't have the source file. **Lilita One** is the
> closest free match (same chunky condensed feel) but it isn't pixel-identical.
> If you have the original font, drop it into `fonts/` and update the
> `--font-display` token.

### Spacing & rhythm

- 4-point scale: `4 8 12 16 20 24 32 40`.
- 16px gutter on all phone-shell content.
- Cards: 12–14px internal padding.
- Sections of menu items have a `11px` uppercase overline header with
  `padding: 14px 16px 4px`.

### Radii

- `8px` — small inputs, badges
- `10px` — buttons, inputs, image thumbs
- `14px` — cards (default — almost everything)
- `20px` — bottom-sheets (top corners only)
- `999px` — chips, pills, the floating cart bar's count badge

### Shadows

A two-stop soft shadow tuned to the warm palette (no cool grey):
```
--shadow:    0 1px 2px rgba(64,10,7,.04), 0 4px 16px rgba(64,10,7,.07);
--shadow-lg: 0 8px 30px rgba(64,10,7,.18);   /* used on the cart bar */
```
The brand orange has its own glow shadow `--shadow-brand` for sticky CTAs.

### Layout shell — "the phone"

The entire product lives inside a **480px-max `.phone` container** centered on
the page. On desktop the column has subtle outer shadow + 1px border and sits
on a warm grey (`#e8e8e8`) backdrop. Treat this as inviolable: SUKA designs
are mobile-first, even when viewed on desktop. Never design a wide-screen
layout.

### Backgrounds & imagery

- **No full-bleed hero images.** The home page uses a flat warm gradient
  (`--brand` → `#ff8c42`) only on the optional `home-hero` block; current
  production has dropped even that in favor of a flat outlet selector.
- **Product photos are squared / rounded** thumbs (`108×80` in deal cards,
  `88×88` in older `.item` cards). When absent, fall back to a soft
  cream-to-peach gradient (`linear-gradient(135deg, #fde2c4, #ffb088)`) with
  a centered 🌯 emoji at 36–70px — this is in production and is part of the
  brand.
- No grain, no textures, no hand-drawn illustrations.
- The character mascot (chef-with-shawarma) is reserved for the logo, splash
  and marketing — do not paste it into product UI.

### Animation

Restrained and short — this is a phone app for people standing in line, not a
marketing site.

- Sheet enter/exit: `transform .26s cubic-bezier(.4, 0, .2, 1)` translateY 100% → 0.
- Card press: `transform: scale(.99)` on `:active`, ~80ms.
- Scrim fade-in: `.2s` linear.
- Toast: `.2s` opacity + 4px lift.
- Realtime live indicator: a 1s `pulse` opacity loop on a 8px dot.
- Loading skeleton: 1.4s shimmer (light → mid → light gradient sweep).
- No spring physics, no bounces, no parallax.

### Interaction states

- **Hover** — desktop-only; dropdown items shift to `--bg`. Most components
  rely on `:active` (touch).
- **Active / press** — `transform: scale(.99)` for cards; `.92` for the
  small round `+` add button; background shift to `--brand-deep` for orange
  buttons.
- **Disabled / unavailable** — `opacity: .45` on the card, button greyed to
  `--line-2` background + muted text.
- **Focus on inputs** — border color → `--brand`, no glow, no inset.

### Borders

- `1.5px solid var(--line-2)` for inputs and chips by default (heavier than
  the typical 1px to feel tactile on mobile).
- `1px solid var(--line)` for dividers, card edges.
- `1.5px dashed --brand-edge` for the QRIS payment box (the only dashed border
  in the system — semantic).

### Cards

- Background `--surface` (white).
- `--radius` (14px) corners.
- `--shadow` (soft 2-stop).
- 12–14px padding.
- No coloured left-border stripe. No glowing borders. No glass/blur.

### Transparency & blur

Effectively unused. The only translucency is:
- `rgba(0,0,0,.5)` scrim behind bottom sheets.
- `rgba(0,0,0,.6)` on the loading overlay.
There is no `backdrop-filter: blur(…)` anywhere. Don't add one.

### Layout rules

- **Sticky topbar** at the phone-shell top, `z-index: 20`, white background,
  1px bottom border. Always visible.
- **Fixed cart bar** at the bottom (`bottom: 12px`, `z-index: 30`), 24px-inset
  from container edges, dark ink color (`--suka-ink`) with orange CTA.
- **Bottom sheets** for any non-page-level action: item detail, cart, admin
  edit modals. They cover 92vh max, slide up from the bottom, have a 36×4
  drag handle.
- **Admin bottom-nav** (fixed) replaces the cart bar on `admin/*` pages.

---

## Iconography

### Approach: emoji + a tiny set of bespoke SVG

SUKA Shawarma uses **emoji as iconography**. This is intentional and
load-bearing — emoji render natively, ship at zero bytes, work in
notifications and WA messages, and feel friendly. There is **no icon font**
and **no Lucide/Heroicons usage** in the source.

The full inventory of emoji used in production:

| Emoji | Role |
|---|---|
| 🌯 | Logo glyph in topbar, fallback for missing product photos, admin Menu tab |
| 🛒 | Cart icon (topbar) |
| 📍 | Outlet selector, Outlet admin tab |
| 📋 | Pesanan (Orders) admin tab |
| 🏠 | Dashboard admin tab |
| 📊 | Laporan (Reports) admin tab |
| ⚙️ | Pengaturan (Settings) admin tab |
| 🛍️ | Order-count dashboard stat |
| 💰 | Revenue dashboard stat |
| ⏳ | Pending stat |
| ⭐ | Best Seller filter chip |
| 💡 | Hint banner |
| 🍽️ | Empty-menu state |
| 📝 | Customer note marker on order items |
| 👍 | Generic positive ack |
| ✓ | "Added to cart" toast prefix |
| ▾ / ▴ | Dropdown arrows (real glyphs, not emoji) |
| ‹ | Back button (real glyph) |

### Bespoke SVG

There is one small inline SVG in production: the search-input magnifier,
encoded as `data:image/svg+xml` background-image, stroke `#999`, 16×16. We
keep it.

For installable-PWA, the source ships a single `assets/img/icon.svg`
(see `assets/icon-source.svg`). It's brand orange filled, used for the
manifest only.

### When adding new icons

1. **First** try an emoji that already appears in the inventory above.
2. **If not present** but expressive in emoji → add it and document here.
3. **Only** if emoji can't carry it (e.g. a stroke-icon for a button that
   needs alignment with text) reach for **Lucide** (`stroke=1.5`, no fill) via
   CDN: `https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.min.js`.
   Flag any such addition to the team — it's a substitution.
4. Never draw mascot variations in SVG. The chef logo is a single asset
   (`assets/logo.png`).

---

## Components at a glance

For the full set with markup, see `ui_kits/`.  Highlights:

- **Topbar** — sticky, white, logo on left, optional action on right.
- **Outlet selector** — collapsible dropdown with searchable 19-outlet list,
  open/closed status with green/grey bullet.
- **Category tabs** — pill chips, active = ink fill.
- **Deal cards** — TikTok-Food style: 108×80 image left, body right, big
  orange price, small `+` round button, optional discount/best-seller badge
  overlay.
- **Bottom sheets** — item detail + cart/checkout, draggable handle,
  sticky header & footer.
- **Cart bar** — fixed dark capsule at the bottom: count badge + label/total +
  orange CTA.
- **Forms** — labelled inputs, 1.5px borders, focus → orange. Error banner
  via `.field.has-error` class, error text in brown not red.
- **Status chips** — Pending / Dibayar / Disiapkan / Siap / Selesai /
  Dibatalkan, each tinted (orange/blue/yellow/green/grey/brown).
- **Admin order row** — white card, big customer name, status pill, swipe-free
  1-tap action buttons (`Konfirmasi → Siap → Selesai`).
- **Admin bottom-nav** — 4–6 emoji+label tabs, fixed bottom, active = orange.

---

## Working with this system

- Tokens come **first**. If a value isn't in `colors_and_type.css`, derive it
  from one that is — don't invent.
- When in doubt, **open the source file** in `source/` and read the markup.
  Pixel fidelity to the production app matters more than novel ideas.
- All copy stays in **Bahasa Indonesia**. If you need English (eg. internal
  docs), keep it out of UI.
- The product is **mobile-first, 480px max** — even when designing a slide or
  marketing page, anchor the product surface to that width.

If you want to dig deeper into how the live product is built (data model, RLS
policies, payment webhook flow), explore the source repository directly:
**<https://github.com/irsyadtawakal-ssn/FormOrder_SS>**.
