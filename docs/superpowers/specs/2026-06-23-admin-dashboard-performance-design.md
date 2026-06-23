# Admin-Dashboard Performance — Design Spec

**Date:** 2026-06-23
**App:** `apps/admin-dashboard`
**Pemicu:** (1) halaman terasa lambat, (3) beban database tinggi
**Cakupan:** Standarisasi penuh data-fetching + caching + query layer DB. SSR/bundle ditunda (Fase 4 opsional).

---

## 1. Konteks & Masalah

Admin-dashboard punya **dua pola data-fetching yang bersaing** dan **caching React Query yang mati total**.

### Masalah → Pengaruh

| # | Masalah | Lokasi | Pengaruh | Pemicu |
|---|---------|--------|----------|--------|
| 1 | `QueryClient` tanpa `staleTime` (default 0) | `src/app/Providers.tsx:19` | Refetch tiap mount/focus; pindah tab/halaman = query baru | #1, #3 |
| 2 | 4 hook pakai `useEffect`+`useState` manual, tanpa cache | `useSalesSummary`, `useMenuSales`, `useSalesHourly`, `useExpenses` | Tak ada dedup/cache/retry; fetch ulang penuh tiap mount & ganti filter | #1, #3 |
| 3 | `useSalesHourly` tarik RAW `orders` ke browser, agregasi di client | `src/hooks/useSalesHourly.ts` | Sumber beban DB terbesar; ribuan baris ditransfer; DB scan tabel transaksi terbesar tanpa pre-agregasi | #3 |
| 4 | Query `outlets` duplikat (di-fetch ulang manual) | `src/app/dashboard/owner/profit/page.tsx:21` | Query identik jalan berkali-kali padahal jarang berubah | #1, #3 |
| 5 | `select('*')` & nested select besar tanpa paginasi | `useSalesSummary`/`useMenuSales` (`*`), `useStaff` (join dalam semua staf) | Over-fetch kolom; `useStaff` makin berat seiring jumlah staf | #3 |
| 6 | Dua factory client Supabase tercampur | `createClient()` vs `createSupabaseBrowserClient()` langsung | Risiko korektitas auth/RLS; cache/dedup React Query tak berbagi satu klien | korektitas |

**Ringkas:**
- **#1 (lambat)** ← masalah 1, 2, 4
- **#3 (beban DB)** ← masalah 1, 2, 3, 5

---

## 2. Arsitektur Target

**Satu pola data-fetching:** semua server-state lewat **React Query**. Hapus pola `useEffect`+`useState` manual.

**Satu sumber client Supabase:** semua hook pakai `createClient()` dari `@/lib/supabase` (delegate ke `@suka/auth` singleton). Tidak ada pemanggilan `createSupabaseBrowserClient()` langsung di hook/page admin-dashboard.

**Caching policy berjenjang:**

| Jenis data | staleTime | Catatan |
|---|---|---|
| Master (outlets, staff) | 5 mnt | jarang berubah |
| Sales/expense agregat per periode | 2 mnt | queryKey termasuk filter periode/outlet/source |
| System health | 30 dtk (sudah) | refetchInterval existing dipertahankan |

Default `QueryClient`: `staleTime: 60_000`, `gcTime: 5 * 60_000`, `refetchOnWindowFocus: false`.

**Prinsip query DB:** agregasi di DB (view/RPC), bukan tarik raw rows ke browser. Hanya ambil kolom yang dipakai.

---

## 3. Aturan Isolasi (WAJIB — tidak mengganggu app lain)

1. **Jangan ubah `@suka/auth`** (shared package). Hanya konsumsi. Konsolidasi factory di dalam admin-dashboard saja.
2. **DB hanya ADITIF.** Buat view BARU `sales_hourly_spv`. **Tidak** `ALTER`/drop view/RPC existing (`sales_summary_spv`, `menu_sales_spv`, dll. mungkin dipakai app lain). Migration ikut prosedur migration-history-drift (repair dulu jika drift, jangan `db push` polos).
3. **Caching config app-local.** Hanya `Providers.tsx` admin-dashboard; tidak menyentuh app lain.
4. **Verifikasi lintas-app:** `yarn type-check` + `yarn build` di **root** sebelum klaim selesai, plus smoke test admin-dashboard.

---

## 4. Rencana per-Fase

Tiap fase bisa di-review/merge sendiri.

### Fase 0 — Konsolidasi klien (prasyarat, risiko nol-app-lain)
Semua hook/page pakai `createClient()` dari `@/lib/supabase`. Hapus `createSupabaseBrowserClient()` langsung.

### Fase 1 — Caching policy (quick-win #1 & #3)
Set default `QueryClient` (staleTime/gcTime/refetchOnWindowFocus). Override per-hook sesuai tabel jenjang.

### Fase 2 — Migrasi 4 raw-hook ke React Query
`useSalesSummary`, `useMenuSales`, `useSalesHourly`, `useExpenses` → `useQuery` dengan `queryKey` berisi filter. Hilangkan fetch `outlets` duplikat di `owner/profit` → pakai `useOutlets`.

### Fase 3 — Query layer DB (#3)
- Buat view `sales_hourly_spv` (agregasi per-jam di DB, pola mirip `sales_summary_spv`), ganti raw-`orders` di `useSalesHourly`.
- Ganti `select('*')` → kolom eksplisit di hook agregat.
- Pertimbangkan limit/paginasi `useStaff` jika jumlah staf besar.

### Fase 4 — (Opsional, DITUNDA) SSR prefetch & audit bundle
Tidak masuk plan inti.

---

## 5. Testing & Verifikasi

- Unit test hook yang dimigrasi (mock client) tetap hijau; sesuaikan test yang mengasumsikan bentuk `{ rows, loading, error }` jika berubah jadi React Query return shape.
- `yarn type-check` (root) clean.
- `yarn build` (root) sukses — bukti tak ada konsumen lain patah.
- Smoke test manual: dashboard owner/hr/profit/expenses/system-health load & ganti filter periode tanpa error & tanpa loading berulang yang tak perlu.
- View `sales_hourly_spv`: bandingkan output dengan agregasi client lama untuk memastikan angka sama sebelum cutover.

---

## 6. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Migrasi mengubah return shape hook → page rusak | Migrasi per-hook + sesuaikan consumer di fase yang sama; type-check menangkap |
| View baru beda angka dgn agregasi lama | Validasi paralel sebelum cutover (lihat §5) |
| Migration drift saat push view baru | `migration repair` dulu; lihat [[supabase-migration-history-drift]] |
| staleTime bikin data terasa basi | Mutation (staff/outlet) sudah invalidate queryKey terkait; pertahankan |
