# Product Detail Page + Smart "Frequently Bought Together" Recommendations

**Date:** 2026-06-06
**Status:** Approved (design)

## Goal

Two related features for the customer-facing kiosk menu:

1. **Product detail page** — clicking a menu card opens a full detail page (`/menu/[id]`).
2. **Smart recommendations** — a "frequently bought together" cross-sell strip, driven by real
   order history, shown on both the product detail page and the cart/checkout.

## Context

- Current behavior: clicking a `MenuItem` card instantly adds the item to the cart. There is no
  detail view. There are no recommendations anywhere.
- Real menu (from DB): categories are `ayam`, `Beef`, `Mie`, `Mix`, `Toping`. There are **no
  beverages**. `Toping` holds cheap add-ons (Kentang Rp10.000, Keju Rp1.000) — natural cross-sell
  targets.
- Stack: Next.js 14 App Router, Supabase (RLS on), Zustand cart store with localStorage persistence.
- Order data lives in `orders` + `order_items`. `order_items` has a public SELECT policy; writes
  happen only via the service-role checkout API.

## Non-goals (YAGNI)

- No per-item notes on the detail page (checkout already has a global notes field).
- No SQL/RPC functions in Supabase for this iteration (kept as a future optimization).
- No AI/LLM-based recommendations.
- No admin UI for manually configuring recommendations.

## Architecture

### 1. Menu card click behavior — `components/MenuItem.tsx`

- The card body becomes a link/navigation to `/menu/[id]` instead of an instant add-to-cart.
- The corner **"+" quick-add button stays** (already uses `stopPropagation`) so users in a hurry
  can add without opening the detail page.
- The in-cart quantity badge/controls behavior is unchanged.

### 2. Product detail page — `app/menu/[id]/page.tsx`

A full page (user chose full page over modal). Contents:

- Back button → returns to `/`.
- Large product image (with the same Sandwich placeholder fallback used in `MenuItem`).
- Name, category badge, description, price.
- Quantity selector + **"Tambah ke Keranjang"** button (adds the chosen quantity via the cart
  store, then navigates back to `/`).
- **"Sering dibeli bersama"** strip below: 3–4 recommended products rendered as compact cards,
  each with quick-add.

Edge cases:
- Item id not found → friendly "produk tidak ditemukan" with a link back to the menu.
- Item `is_available === false` → show as habis, disable add-to-cart.

### 3. Recommendation engine — `app/api/recommendations/route.ts`

Single GET endpoint, two modes (Approach A: on-the-fly aggregation in JS using the service client).

**Inputs (query params):**
- `productId=<uuid>` — detail-page mode (single seed product).
- `cart=<uuid,uuid,...>` — cart mode (multiple seed products).
- `limit=<n>` — optional, default 4.

**Algorithm:**
1. Resolve the seed set (the productId, or the list of cart ids).
2. Find `order_id`s whose `order_items` contain any seed product.
3. Pull all `order_items` rows for those orders; tally `menu_item_id` frequency, **excluding** the
   seed ids and (for cart mode) any id already in the cart.
4. Join the tally against `menu_items` keeping only `is_available = true`; rank by tally desc;
   take top `limit`.
5. **Fallback** (when fewer than `limit` co-purchase results, including the cold-start case of no
   orders): fill the remainder with best-selling available items **from categories other than the
   seed's category**, ranked by overall sales count from `order_items` (ties broken by
   `sort_order`). For this menu that naturally surfaces Toping (Keju/Kentang) and other mains.
6. De-duplicate, respect `limit`, return.

**Output:** JSON array of `MenuItem` objects (public menu fields only — no order data leaks to the
client).

**Performance note:** filtering `order_items` by seed product first keeps the working set small.
Adequate for a small/medium menu. If transactions reach the thousands, this can be replaced by a
Postgres RPC (Approach B) without changing the client contract.

### 4. Cart/checkout recommendations — `components/Cart.tsx`

- A **"Lengkapi pesananmu"** strip inside the cart that calls `/api/recommendations?cart=...` with
  the current cart item ids.
- Each recommended item has a quick-add button.
- Hidden entirely when the cart is empty or when every recommendation is already in the cart.

## Data flow

```
Menu (/)  --click card-->  /menu/[id]
   |                           |-- fetch item by id (Supabase client)
   |                           |-- GET /api/recommendations?productId=id  --> strip
   |
   +-- "+" quick-add --------> cart store (unchanged)

Cart (component)  -- GET /api/recommendations?cart=ids -->  "Lengkapi pesananmu" strip
```

## Components / files touched

| File | Change |
|------|--------|
| `components/MenuItem.tsx` | Card body navigates to `/menu/[id]`; keep quick-add button |
| `app/menu/[id]/page.tsx` | **New** — product detail page |
| `app/api/recommendations/route.ts` | **New** — recommendation engine (Approach A) |
| `components/RecommendationStrip.tsx` | **New** — shared strip used by detail page & cart |
| `components/Cart.tsx` | Add "Lengkapi pesananmu" strip |
| `lib/recommendations.ts` (optional) | **New** — shared aggregation helper if logic is reused |

## Error handling

- Recommendation API failure or empty result → the strip renders nothing (no error shown to the
  customer); the rest of the page is unaffected.
- Detail page fetch failure → "produk tidak ditemukan" fallback view.
- All recommendation items unavailable/in-cart → strip hidden.

## Testing

- Recommendation aggregation logic (tally + fallback) tested with seeded order data:
  cold-start (no orders) → fallback only; partial data → mix; rich data → co-purchase ranked.
- Exclusion rules: seed product and cart items never appear in their own recommendations.
- Availability: `is_available = false` items never recommended.
- Detail page: not-found and habis states render correctly.
