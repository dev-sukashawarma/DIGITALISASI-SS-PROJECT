# Allow Rp 0 Menu Price Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow menu items in POS Admin to have price = 0 (Gratis) with real-time visual badges and confirmation dialog, backed by updated PostgreSQL database constraints.

**Architecture:** 
1. Database layer: PostgreSQL constraint `menu_items_price_check` updated from `CHECK (price > 0)` to `CHECK (price >= 0)`.
2. Frontend layer: `MenuView.tsx` updated to allow `price >= 0`, show `[GRATIS / Rp 0]` badge, preserve 0 in channel prices, and prompt confirmation before saving a Rp 0 item.

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, Supabase / PostgreSQL.

---

### Task 1: Database Migration to Allow Price >= 0

**Files:**
- Create: `supabase/migrations/20260912140000_allow_zero_price_menu_items.sql`
- Test: `scratch/test_insert_zero.mjs`

**Step 1: Create the SQL migration file**

```sql
-- Migration: Allow price = 0 for menu_items
ALTER TABLE public.menu_items DROP CONSTRAINT IF EXISTS menu_items_price_check;
ALTER TABLE public.menu_items ADD CONSTRAINT menu_items_price_check CHECK (price >= 0);
```

**Step 2: Apply migration to live Supabase DB**

Execute via `scratch/alter_constraint.mjs` or `supabase.rpc('exec_sql')`.

**Step 3: Run test to verify price = 0 is accepted by Postgres**

Run: `node scratch/test_insert_zero.mjs`
Expected: "Insert succeeded!"

---

### Task 2: Frontend Form Validation, Safety Confirmation & Visual Badge

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/pos-admin/menu/MenuView.tsx`

**Step 1: Update validation & confirmation in `handleSave`**

In `MenuView.tsx`:
1. Check `price < 0` instead of `price <= 0`:
```ts
if (isNaN(price) || price < 0) { setError('Harga tidak boleh negatif'); return }
```
2. Add confirmation dialog if `price === 0`:
```ts
if (price === 0) {
  const confirmZero = await showConfirm(`Menu "${form.name.trim()}" diatur dengan harga Rp 0 (Gratis). Apakah Anda yakin ingin menyimpan menu ini?`)
  if (!confirmZero) return
}
```
3. Update `parsedChannelPrices` to preserve 0 (`p >= 0`).
4. Update online channel fallback to check `undefined` instead of falsy.

**Step 2: Add Real-Time Badge `[GRATIS / Rp 0]`**

Next to label "Harga Offline":
```tsx
<div className="flex items-center justify-between mb-1.5">
  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
    Harga Offline <span className="text-red-500">*</span>
  </label>
  {Number(form.price) === 0 && form.price !== '' && (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-fade-in">
      GRATIS / Rp 0
    </span>
  )}
</div>
```

**Step 3: Verify TypeScript build & Lint**

Run Next.js build or typecheck in `apps/admin-dashboard`.

---

### Task 3: Verification & Cleanup

1. Test editing a menu item to Rp 0 in Admin Dashboard.
2. Confirm confirmation dialog triggers on save.
3. Clean up scratch scripts.
