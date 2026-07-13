# Stok App Performance Optimization — Fase 1 (Quick Wins)

**Status:** Design approved, belum diimplementasi
**Scope:** `apps/stok`
**Tanggal:** 2026-07-13

## Latar Belakang

User melaporkan seluruh halaman `apps/stok` (Dashboard/Monitoring, Monitoring-Live, Ledger & Opname, Permintaan Bahan/Waste) terasa lambat secara umum — bukan satu halaman spesifik. Survei kode menunjukkan ini bersifat sistemik: campuran data-fetching pattern yang tidak konsisten, tidak ada perceived-loading feedback per-route, dan beberapa query menarik lebih banyak data dari yang dibutuhkan.

Area yang **sudah baik** dan sengaja tidak disentuh di fase ini:
- QueryClient global config (`staleTime`/`gcTime`/`refetchOnWindowFocus`) di `Providers.tsx` sudah tepat.
- Supabase browser client sudah singleton (`@suka/auth` `createSupabaseBrowserClient()`).
- Tidak ada N+1 query — batching `.in()` sudah konsisten dipakai.
- Tidak ada bug SSG-on-dynamic-route (`generateStaticParams`).
- Dependencies ringan, tidak ada bundle bloat yang jelas.

Fase 2 (di luar scope spec ini, didokumentasikan sebagai next step): konversi halaman kunci (Dashboard, Monitoring-Live) ke Server Component dengan SSR-first data prefetch untuk memperbaiki first-paint / "layar putih dulu". Ditunda sampai fase 1 selesai dan dievaluasi apakah masih kurang cepat.

## Desain

### Bagian 1 — Migrasi hook manual `useEffect`/`useState` ke React Query

**Target:**
- `src/hooks/useStokBalance.ts` — full manual fetch + realtime subscription → `useQuery`, realtime event men-trigger `invalidateQueries` (bukan `setState` manual).
- `src/hooks/usePermintaan.ts`:
  - `useSaranItem` (manual fetch `monitoring_view_crew`) → `useQuery`
  - `usePermintaanList` (manual fetch + realtime terpisah) → `useQuery` + `invalidateQueries` on realtime event
  - `useApprovalList` (manual fetch, realtime channel unfiltered lintas-outlet) → `useQuery` + `invalidateQueries`. **Catatan:** channel tetap unfiltered (semua perubahan `permintaan_bahan`) karena approval list memang perlu tahu perubahan lintas outlet — hanya cara update state yang berubah, bukan scope subscription.
- `src/app/stok/waste-approval/page.tsx` — pindahkan `fetchPendingWasteReports` ke hook baru `useWasteApprovalList` (`useQuery`).
- `src/app/stok/waste-history/page.tsx` — pindahkan `fetchMyWasteReports` ke hook baru `useMyWasteHistory` (`useQuery`).

**Pola referensi:** ikuti struktur hook yang sudah benar di `MonitoringDashboard.tsx`/`MonitoringPage` — `useQuery` dengan `queryKey` yang mencakup filter relevan (outletId, dsb), `staleTime` disesuaikan volatilitas data (25s untuk near-real-time, lebih lama untuk data referensi).

**Hasil yang diharapkan:** navigasi berulang ke halaman yang sama dalam window `staleTime` menampilkan data dari cache secara instan, refetch terjadi di background.

### Bagian 2 — Loading states per-route

**Target:** tambah `loading.tsx` (skeleton, bukan spinner generik) untuk route:
- `/stok/ledger`, `/stok/ledger/[id]`
- `/stok/opname`, `/stok/opname/[id]`, `/stok/opname/new`
- `/stok/monitoring`
- `/stok/monitoring-live`, `/stok/monitoring-live/[outlet-id]`
- `/stok/permintaan`
- `/stok/waste-approval`
- `/stok/waste-history`

**Pola referensi:** `src/app/dashboard/loading.tsx` (skeleton kartu, bukan spinner polos) — replikasi gaya visual serupa, disesuaikan bentuk konten tiap halaman (list vs detail vs grid kartu).

**Catatan:** karena semua halaman ini `'use client'` tanpa Suspense boundary internal, `loading.tsx` di level route tetap berfungsi untuk transisi navigasi App Router (server merender fallback ini saat route berpindah). Ini murni perbaikan perceived-speed, tidak mengubah kecepatan data aktual.

### Bagian 3 — Narrow `select('*')` di query panas

**Target (query yang sering di-poll atau sering dibuka):**
- `src/lib/queries/monitoring.ts` — 8 titik `select('*')`: `monitoring_view_spv`, `monitoring_view_scoped`, `monitoring_view_crew`, `ledger_feed_spv`, `stockout_forecast_spv`
- `src/hooks/useLedger.ts:17` — `ledger_transaksi_ringkas`
- `src/hooks/useStokBalance.ts:14` — `stok_balance`
- `src/components/stok/OpnameDetail.tsx:34` — `opname_item`

**Di luar scope:** `src/hooks/useBahanBaku.ts:10` (`select('*')` tapi `staleTime` 5 menit — dampak rendah, sengaja diskip).

**Proses per titik:** baca consumer component untuk menentukan kolom yang benar-benar dipakai, ganti `select('*')` dengan daftar kolom eksplisit, verifikasi tidak ada field yang kelewat (field hilang akan muncul sebagai `undefined` di runtime, bukan error saat build — perlu cross-check manual, bukan sekadar type-check).

### Bagian 4 — Hapus komponen mati `MonitoringDashboard.tsx`

**Temuan:** `src/components/stok/MonitoringDashboard.tsx` (dashboard `/stok` versi lama, fetch raw `bahan_baku` + `stok_balance` lalu join manual di browser) sudah **tidak di-import di mana pun** — sudah digantikan `MonitoringPage` yang memakai view `monitoring_view_crew`. Grep konfirmasi 0 referensi selain file itu sendiri.

**Tindakan:** hapus file. Tidak ada migration DB atau view baru yang diperlukan untuk bagian ini — cukup pembersihan kode mati yang kebetulan juga mengandung logic threshold terduplikasi (`stokStatus` computed client-side yang berpotensi drift dari logic view).

## Testing

- Type-check (`yarn type-check`) setelah tiap bagian.
- Smoke test manual di browser per halaman yang diubah: pastikan data tampil sama seperti sebelumnya, realtime update masih bekerja (approval list, stok balance), loading skeleton muncul saat navigasi.
- Verifikasi tidak ada `undefined` di field yang sebelumnya datang dari `select('*')` (khususnya field yang jarang dipakai tapi ada di UI — badge, tooltip, dsb).
- Tidak ada migration DB di fase ini → tidak perlu `supabase db push`.

## Error Handling

Tidak ada perubahan strategi error handling — pola existing (React Query `error` state + toast/UI fallback) dipertahankan. Untuk hook yang dimigrasi dari manual fetch, pastikan error state yang sebelumnya di-set manual (`setError(...)`) sekarang benar-benar tercermin lewat `useQuery`'s `error`/`isError`.

## Out of Scope (Fase 2, didokumentasikan untuk referensi)

Konversi halaman Dashboard/Monitoring dan Monitoring-Live ke Server Component dengan SSR-first prefetch (React Query hydration dari server) — untuk memperbaiki first-paint. Ditunda karena lebih invasif (ubah struktur routing/component boundary), dievaluasi ulang setelah fase 1 live dan diukur dampaknya.
