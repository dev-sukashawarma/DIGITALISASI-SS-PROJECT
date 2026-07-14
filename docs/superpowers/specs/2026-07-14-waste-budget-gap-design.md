# Design: Budget Loss (BOM) vs Waste Aktual — Gap %

**Tanggal:** 2026-07-14
**App:** `apps/admin-dashboard`
**Status:** Approved, siap masuk fase planning
**Depends on:** `docs/superpowers/specs/2026-07-14-waste-cogs-integration-design.md` (fitur waste-COGS dasar, sudah selesai diimplementasikan di halaman `/dashboard/owner/waste`)

## Latar Belakang

Tiap resep/BOM sudah punya kolom `resep.buffer_amount` (migration `20260707140000_cogs_card_display.sql`) — alokasi Rupiah "Loss" per porsi yang ditambahkan ke HPP standar (`computeResepHpp` di `apps/admin-dashboard/src/lib/hpp.ts`, ditampilkan sebagai baris "Loss" di `ResepEditor.tsx`). Ini adalah **loss yang SUDAH dianggarkan** saat resep dibuat.

Setelah fitur waste-COGS (nilai waste APPROVED aktual, lihat spec terkait di atas), owner/admin bisa lihat berapa Rupiah waste yang benar-benar terjadi — tapi belum ada pembanding apakah itu wajar (sesuai alokasi BOM) atau sudah kebablasan. Fitur ini menutup gap tersebut.

## Keputusan Desain

1. **Budget Loss dihitung sebagai `buffer_amount × qty terjual`** per resep yang laku pada periode filter — bukan flat per resep. Ini membuatnya sepadan dengan nilai waste aktual (yang juga terakumulasi per periode), dan mengikuti pola perhitungan `get_hpp_periode` yang sudah ada (join `orders`/`order_items` completed → resep terpilih per outlet).
2. **Gap % = (Actual − Budget) / Budget × 100%.** Positif = waste aktual melebihi alokasi BOM (perlu perhatian). Negatif = di bawah alokasi (efisien).
3. **Budget = 0 → Gap ditampilkan "N/A"**, bukan 0% atau ∞ — karena secara matematis tidak bermakna (resep belum diisi alokasi Loss, atau tidak ada penjualan pada periode itu). Nilai Rupiah waste aktual tetap ditampilkan apa adanya di kasus ini.
4. **Scope tampilan: hanya di halaman `/dashboard/owner/waste` yang sudah ada** — headline (total) dan tabel "Ranking per Outlet" (per outlet). Tidak menyentuh halaman Resep/BOM atau Profit/Expenses.
5. **Tidak mengubah `get_hpp_periode` atau HPP resep** — budget loss ditampilkan sebagai metrik pembanding terpisah, bukan pengurangan tambahan (buffer sudah termasuk di HPP, menampilkannya di sini tidak boleh dihitung dua kali di P&L manapun).
6. **Akses: sama seperti data waste yang sudah ada di halaman ini** — `get_budget_loss_periode` tidak dibatasi role (semua authenticated, scoped `accessible_outlet_ids()`) sama seperti `get_waste_periode`, karena headline "Gap %" total sejalan dengan Laba Bersih yang mitra juga lihat secara implisit; breakdown per-outlet di tabel tetap hanya terlihat oleh owner/admin karena seluruh tabel itu bagian dari `get_waste_breakdown` yang sudah dibatasi.

## Data Layer

### RPC baru: `get_budget_loss_periode(p_from date, p_to date)`

Mengikuti pola persis `get_hpp_periode` (migration `20260708225000_hpp_teoritis_periode.sql`) untuk CTE `terjual`/`resep_terpilih`, tapi mengalikan `total_qty × r.buffer_amount` alih-alih biaya bahan:

```sql
CREATE OR REPLACE FUNCTION get_budget_loss_periode(p_from date, p_to date)
RETURNS TABLE(outlet_id uuid, budget_loss numeric)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH terjual AS (
    SELECT
      o.outlet_id,
      oi.menu_item_id::text AS menu_item_ref,
      SUM(oi.quantity) as total_qty
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.status = 'completed'
      AND (o.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
      AND oi.menu_item_id IS NOT NULL
    GROUP BY o.outlet_id, oi.menu_item_id
  ),
  resep_terpilih AS (
    SELECT DISTINCT ON (t.outlet_id, t.menu_item_ref)
      t.outlet_id,
      t.menu_item_ref,
      t.total_qty,
      r.id AS resep_id,
      r.buffer_amount
    FROM terjual t
    JOIN resep r ON r.menu_item_ref = t.menu_item_ref
    WHERE r.is_active = true
      AND ( (r.scope = 'outlet' AND r.outlet_id = t.outlet_id) OR (r.scope = 'global') )
    ORDER BY t.outlet_id, t.menu_item_ref,
      CASE WHEN r.scope = 'outlet' THEN 1 ELSE 2 END
  ),
  budget_per_outlet AS (
    SELECT outlet_id, SUM(total_qty * buffer_amount) AS total_budget
    FROM resep_terpilih
    GROUP BY outlet_id
  )
  SELECT
    o.id AS outlet_id,
    COALESCE(bp.total_budget, 0) AS budget_loss
  FROM outlets o
  LEFT JOIN budget_per_outlet bp ON bp.outlet_id = o.id
  WHERE o.id IN (SELECT public.accessible_outlet_ids());
$$;

GRANT EXECUTE ON FUNCTION get_budget_loss_periode(date, date) TO authenticated;
```

Tidak ada guard owner/admin di RPC ini (sama seperti `get_waste_periode`) — hanya scoping outlet standar.

## Hook

`apps/admin-dashboard/src/hooks/useBudgetLoss.ts` — pola identik `useHpp.ts`/`useWaste.ts`, RPC `get_budget_loss_periode`, return `{ rows: {outlet_id, budget_loss}[], loading, error }`.

## Perhitungan Gap (pure function, TDD)

File baru `apps/admin-dashboard/src/lib/wasteGap.ts` (dipisah dari `wasteBreakdown.ts` karena input-nya gabungan dua sumber angka berbeda — actual waste dan budget loss — bukan agregasi dari `WasteBreakdownRow`):

```ts
export interface WasteGap { actual: number; budget: number; gapPct: number | null }

export function computeWasteGap(actual: number, budget: number): WasteGap {
  return { actual, budget, gapPct: budget > 0 ? ((actual - budget) / budget) * 100 : null }
}
```

`gapPct === null` → UI render "N/A".

## UI — `apps/admin-dashboard/src/app/dashboard/owner/waste/page.tsx`

1. Tambah `const budgetLoss = useBudgetLoss(filter)` dan fold ke `loading`/`error` gabungan halaman.
2. `totalBudget = useMemo(() => budgetLoss.rows.reduce((s,r) => s + r.budget_loss, 0), [budgetLoss.rows])`.
3. `gap = computeWasteGap(totalNilai, totalBudget)`.
4. Headline grid StatTile diperluas dari 3 kolom (`grid-cols-1 sm:grid-cols-3`) jadi 4 kolom (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`, sesuaikan biar tetap rapi di layar sempit): tambah 2 tile baru "Budget Loss (BOM)" (Rp, netral/brown) dan "Gap %" (hijau kalau `gapPct < 0`, merah kalau `> 0`, abu-abu/teks "N/A" kalau `null`).
5. Tabel "Ranking per Outlet" (`byOutlet` dari `get_waste_breakdown`, sudah ada) tambah 2 kolom: "Budget Loss" (dari `budgetLoss.rows` di-join per `outlet_id`, fallback 0) dan "Gap %" (via `computeWasteGap` per baris, badge warna sama konvensi seperti headline, "N/A" kalau budget 0).

## Edge Cases

- Menu terjual tanpa resep aktif yang cocok → tidak berkontribusi ke budget (skip via INNER JOIN, konsisten dengan `get_hpp_periode`).
- `buffer_amount` default 0 (banyak resep belum diisi Loss) → budget 0 valid, Gap tampil "N/A", bukan bug.
- Outlet dengan waste aktual tapi budget 0 (tak ada resep dgn buffer/tak ada penjualan matching di periode itu) → Rupiah aktual tetap tampil, Gap "N/A".
- Outlet dengan budget > 0 tapi waste aktual 0 → Gap = -100% (baik, tidak ada waste sama sekali dari alokasi yang ada).

## Testing

- Unit test `computeWasteGap`: budget > 0 dengan actual > budget (gap positif), actual < budget (gap negatif), actual == budget (gap 0), budget == 0 (gap null terlepas dari nilai actual).
- Manual smoke test: pilih resep dengan `buffer_amount` terisi di halaman Manajemen Resep, pastikan ada penjualan menu itu pada periode filter → Budget Loss > 0 muncul di halaman waste, Gap % numerik dan konsisten dengan formula.

## Out of Scope

- Tidak menyentuh `get_hpp_periode`, `computeResepHpp`, atau tampilan HPP di halaman Resep/manapun.
- Tidak menambah UI di halaman Resep/BOM (breakdown per-resep individual) — hanya agregat per outlet & total di halaman Waste, sesuai keputusan brainstorming.
- Tidak mengubah alur approval waste maupun cara `buffer_amount` diisi di ResepEditor.
