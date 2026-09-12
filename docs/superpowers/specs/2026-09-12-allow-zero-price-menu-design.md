# Design Spec: Allow Rp 0 Menu Price (Menu Gratis)

**Date**: 2026-09-12
**Status**: Approved
**Target**: `apps/admin-dashboard` & `supabase` database

## Problem Statement
Currently, setting menu price to Rp 0 (for free complimentary items, bonus bundles, testers/samples, or promos) is blocked at two levels:
1. **Frontend Validation (`MenuView.tsx`)**:
   - `price <= 0` triggers error: `"Harga harus angka positif"`.
   - `parsedChannelPrices` filters with `p > 0`, which drops `0` on specific food app channels.
   - Channel fallback overwrites `0` with base price.
2. **Database Constraint (`public.menu_items`)**:
   - Postgres table `menu_items` has constraint `menu_items_price_check CHECK (price > 0)` which rejects rows with price = 0 (`code 23514`).

## Requirements
- Allow menu items to have price = 0 (Gratis) across offline kasir and online channels.
- Reject negative prices (`price < 0`).
- Display a visual indicator badge `[GRATIS / Rp 0]` real-time when the price input is 0.
- Show a safety confirmation dialog when submitting if the menu price is Rp 0:
  *"Menu '[Nama Menu]' diatur dengan harga Rp 0 (Gratis). Apakah Anda yakin ingin menyimpan?"*
- Prevent accidental loss of 0 values in `channel_prices`.
- Update Supabase database constraint on `menu_items.price` from `> 0` to `>= 0`.

## Architecture & Changes

### 1. Database Migration (PostgreSQL / Supabase)
File: `supabase/migrations/20260912140000_allow_zero_price_menu_items.sql`
- Drop existing constraint `menu_items_price_check`.
- Add new constraint `CHECK (price >= 0)`.
- Apply to database via script / migration.

### 2. Frontend Validation & Safety Guard (`apps/admin-dashboard/src/app/dashboard/pos-admin/menu/MenuView.tsx`)
- Update `handleSave`:
  - Change `if (isNaN(price) || price <= 0)` to `if (isNaN(price) || price < 0) { setError('Harga tidak boleh negatif'); return }`.
  - Add confirmation dialog when `price === 0`:
    ```ts
    if (price === 0) {
      const confirmZero = await showConfirm(`Menu "${form.name.trim()}" diatur dengan harga Rp 0 (Gratis). Simpan menu ini?`)
      if (!confirmZero) return
    }
    ```
  - Parse channel prices preserving 0:
    ```ts
    Object.entries(form.channel_prices).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        const p = parseFloat(v)
        if (!isNaN(p) && p >= 0) parsedChannelPrices[k] = p
      }
    })
    ```
  - Online channel fallback condition check:
    ```ts
    if (parsedChannelPrices[slug] === undefined || parsedChannelPrices[slug] < 0) {
      parsedChannelPrices[slug] = finalBasePrice
    }
    ```
- Add visual indicator badge in JSX:
  - Next to "Harga Offline" label:
    ```tsx
    {Number(form.price) === 0 && form.price !== '' && (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
        GRATIS / Rp 0
      </span>
    )}
    ```

## Verification Plan
1. Test database insert/update with `price = 0` to confirm Postgres check constraint permits it.
2. Test frontend validation logic to confirm negative prices are rejected and 0 is accepted.
3. Verify confirmation modal appears when saving an item with price 0.
4. Verify badge `GRATIS / Rp 0` appears in the UI.
