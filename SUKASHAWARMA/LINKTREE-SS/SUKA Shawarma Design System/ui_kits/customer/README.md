# SUKA Shawarma — Customer UI Kit

Pickup-order flow for `order.sukashawarma.com`. Mirrors the production app's
shape, retuned to the warm brand palette.

## Screens

1. **Home** — sticky topbar, outlet selector dropdown (19 outlets), category
   tabs, vertical list of "deal cards" (TikTok-Food style).
2. **Item sheet** — bottom sheet with hero image fallback, required/optional
   variants (radio + checkbox), kitchen note, quantity stepper, big add-to-cart
   CTA showing the line total.
3. **Cart sheet** — bottom sheet with line items (with selection summary +
   note), customer form (name, WhatsApp, pickup time, notes), inline validation
   errors, hint banner about pickup payment, sticky pay CTA.
4. **Status** — order confirmation with order number, customer info, "Disiapkan"
   chip and a "bayar di kasir" reminder.

Tap any product to open the item sheet; the floating dark cart bar appears
once you've added something. Tap it to open the cart sheet, fill in the form
and tap "Bayar Sekarang" to land on the status screen.

## Files

| File | Purpose |
|---|---|
| `index.html` | App shell + script loaders |
| `style.css` | Customer-app component CSS (imports `colors_and_type.css`) |
| `data.jsx` | Mock outlets / categories / menu + helpers (`formatRupiah`, `calcUnitPrice`) |
| `Shell.jsx` | Topbar, OutletSelector, CategoryTabs, HintBanner, EmptyState, Toast |
| `DealCard.jsx` | Menu item row + floating CartBar |
| `Sheets.jsx` | BottomSheet + ItemSheet + CartSheet + StatusScreen |
| `App.jsx` | Root — state, routing between home / status |

## Notes

- All copy is in Bahasa Indonesia and lifted verbatim from the source app.
- The mascot/character is intentionally absent from product UI — see the brand
  rules in the root README.
- Photos fall back to a soft cream-to-peach gradient with a centered emoji —
  this is in production and is part of the visual system.
