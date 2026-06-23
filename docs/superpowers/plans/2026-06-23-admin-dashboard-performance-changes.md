# Admin-Dashboard Performance — Ringkasan Perubahan

**Tanggal:** 2026-06-23
**App:** `apps/admin-dashboard`
**Dokumen terkait:** [spec](../specs/2026-06-23-admin-dashboard-performance-design.md) · [plan](2026-06-23-admin-dashboard-performance.md)

Dokumen ini menjelaskan **apa yang diubah, masalah apa yang dihadapi, solusinya, dan efeknya** — per perubahan.

---

## 1. Caching React Query diaktifkan

- **Masalah:** `QueryClient` dibuat tanpa pengaturan (`staleTime` = 0). Akibatnya setiap kali komponen muncul kembali atau window di-fokus, data di-ambil ulang dari Supabase walau baru saja diambil. Pindah-pindah halaman = query baru terus-menerus.
- **Solusi:** Set default caching (`staleTime` 60 dtk, `gcTime` 5 mnt, matikan `refetchOnWindowFocus`) di `Providers.tsx`. Data master (outlets, staff) di-cache 5 menit, data agregat sales/expense 2 menit.
- **Efek:** Refetch berlebihan hilang. Kembali ke halaman yang sama tidak memicu loading penuh. Beban query ke DB turun signifikan. *(Mengatasi pemicu #1 lambat & #3 beban DB.)*

## 2. Hook data-fetching disatukan ke React Query

- **Masalah:** Empat hook (`useSalesSummary`, `useMenuSales`, `useExpenses`, `useSalesHourly`) memakai `useEffect`+`useState` manual — tanpa cache, tanpa dedup, tanpa retry. Tiap mount/ganti filter = fetch ulang penuh, tidak berbagi hasil antar halaman.
- **Solusi:** Migrasikan keempatnya ke `useQuery` dengan `queryKey` berisi filter (periode/outlet/source). Return shape `{ rows, loading, error }` dipertahankan supaya halaman pemakai tidak perlu diubah.
- **Efek:** Hasil query yang sama otomatis di-cache & dibagi antar halaman. Ganti filter bolak-balik memakai cache. Lebih sedikit round-trip & UI lebih responsif.

## 3. Agregasi per-jam dipindah dari browser ke DB

- **Masalah:** `useSalesHourly` menarik **baris mentah tabel `orders`** lalu menghitung omzet per-jam di browser. Untuk rentang lebar/banyak outlet, ribuan baris ditransfer tiap render — sumber beban DB & payload terbesar.
- **Solusi:** Buat **view baru** `sales_hourly_spv` yang melakukan agregasi per-jam di Postgres. Hook hanya mengambil hasil ringkas (≤24 baris/periode). Migration bersifat aditif — tidak mengubah view/RPC lama.
- **Efek:** Transfer data turun drastis, DB tidak lagi scan tabel transaksi terbesar tanpa pre-agregasi, parsing di browser nyaris nol. *(Penyumbang terbesar pengurangan beban DB #3.)*

## 4. Query `outlets` duplikat dihapus

- **Masalah:** Beberapa halaman owner meng-fetch daftar `outlets` sendiri secara manual, padahal sudah ada hook `useOutlets` yang ter-cache.
- **Solusi:** Halaman memakai `useOutlets()` (cache 5 menit) ganti fetch manual.
- **Efek:** Daftar outlet diambil sekali dan dipakai bersama; tidak ada query identik berulang.

## 5. `select('*')` → kolom eksplisit

- **Masalah:** Hook agregat memakai `select('*')`, mengambil kolom yang tidak dipakai (payload & I/O DB lebih besar dari perlu).
- **Solusi:** Sebut kolom yang benar-benar dipakai pada setiap query.
- **Efek:** Payload lebih kecil, transfer & parsing lebih cepat.

## 6. Satu factory client Supabase

- **Masalah:** Hook/page mencampur `createClient()` (`@/lib/supabase`) dan `createSupabaseBrowserClient()` langsung. Berisiko ke korektitas auth/RLS dan membuat cache/dedup tidak berbagi satu klien.
- **Solusi:** Semua hook & page admin-dashboard memakai `createClient()` dari `@/lib/supabase`. `Providers.tsx` & `lib/supabase.ts` tetap (konsumen sah `@suka/auth`).
- **Efek:** Konsisten, mengurangi risiko bug auth lintas-subdomain, dan caching React Query benar-benar berbagi satu klien.

---

## Jaminan: tidak mengganggu app lain

- **`@suka/auth` (paket bersama) tidak diubah** — hanya dikonsumsi.
- **Perubahan DB hanya aditif** — membuat view baru `sales_hourly_spv`, **tidak** meng-`ALTER`/drop view/RPC yang dipakai app lain.
- **Konfigurasi caching bersifat app-local** — hanya di `Providers.tsx` admin-dashboard.
- **Diverifikasi `yarn type-check` + `yarn build` di root** sebelum dianggap selesai, sebagai bukti tak ada konsumen lain (stok, distribusi, absensi, portal) yang patah.
