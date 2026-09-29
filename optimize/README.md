# Optimize — Pola Query Database Jangka Panjang

Kumpulan metode yang **terbukti di produksi** (app HR, September 2026) supaya query ke
Supabase/Postgres tetap cepat, hemat, dan aman walau datanya menumpuk bertahun-tahun.
Pakai ulang di app mana pun di monorepo ini.

> **Prinsip utama: biaya satu request harus sebanding UKURAN HALAMAN, bukan jumlah data.**
> Kalau sebuah halaman makin lambat setiap bulan, desainnya salah — bukan servernya kurang besar.

## Hasil nyata (bukti)

| Kasus (app HR) | Sebelum | Sesudah |
|---|---|---|
| Absensi 1–30 Sep | terpotong di 1.000 baris → data hanya dari ±tgl 18 | lengkap 1.326 baris, 27 halaman |
| Kiriman ke browser per request | 1.000 baris mentah tiap 10 detik | ±33 KB (50 baris) per halaman |
| 1 halaman, rentang 1 bulan, data ±150 ribu hari-absen | — | **7 ms** di database |
| 1 halaman, rentang 5 tahun | — | 59 ms |
| Denda telat payroll | acak, sebagian staf Rp 0 (terpotong) | tepat 15.621 menit = data mentah |
| Kebocoran RLS | crew/mitra baca 300 slip gaji semua orang | hanya milik sendiri |

## Isi folder

| File | Kapan dipakai |
|---|---|
| [01-pagination-rpc.md](01-pagination-rpc.md) | Daftar/tabel yang datanya terus bertambah (log, transaksi, pengajuan) |
| [02-tabel-rekap-trigger.md](02-tabel-rekap-trigger.md) | Data mentah harus dikelompokkan (per hari/per staf) sebelum ditampilkan |
| [03-status-otomatis-cron.md](03-status-otomatis-cron.md) | Status yang lahir dari *ketiadaan* data (alfa, belum setor, tidak opname) |
| [04-rls-keamanan.md](04-rls-keamanan.md) | Setiap tabel baru / setiap audit keamanan |
| [05-verifikasi.md](05-verifikasi.md) | Sebelum menerapkan migration apa pun ke produksi |
| [06-frontend-react-query.md](06-frontend-react-query.md) | Hook & komponen di sisi Next.js |
| [07-checklist.md](07-checklist.md) | Review cepat sebelum merge |
| `templates/` | SQL & TypeScript siap salin |
| `scripts/audit-query.sh` | Cari query berisiko di sebuah app |

## Aturan emas (ringkas)

1. **Jangan pernah `select` tanpa batas** pada tabel yang tumbuh. PostgREST memotong di
   1.000 baris **tanpa error** — data hilang diam-diam.
2. **Filter, agregasi, pencarian, pagination di database**, bukan di browser.
3. **Satu request = satu halaman + total + ringkasan** (RPC mengembalikan `jsonb`).
4. **Data yang harus dikelompokkan → tabel rekap yang diisi trigger**, bukan dihitung ulang tiap request.
5. **Daftar id panjang dikirim di body (RPC POST)**, bukan di URL (batas URL → HTTP 414).
6. **RPC baca = `SECURITY INVOKER`** supaya RLS tetap berlaku. `SECURITY DEFINER` hanya untuk
   fungsi internal/trigger, dan selalu `SET search_path = public` + `REVOKE` dari anon/authenticated.
7. **Policy `USING (true)` dilarang** pada data sensitif. Uji RLS dengan login sungguhan tiap role.
8. **Index mengikuti `WHERE` + `ORDER BY`**; buang index kembar (biaya tulis).
9. **Realtime → invalidate yang di-debounce & sadar filter**; polling cadangan ≥ 60 detik.
10. **Verifikasi dulu**: dry-run di transaksi yang di-rollback, bandingkan angka lama vs baru,
    uji beban sintetis, baru terapkan.

## Baseline audit seluruh database (2026-09-29)

Hasil `templates/audit_rls.sql` pada DB produksi — pekerjaan rumah lintas app (bukan
semuanya bug; tiap baris perlu ditinjau). Jalankan ulang berkala dan catat penurunannya.

| # | Pemeriksaan | Jumlah |
|---|---|---:|
| 1 | Policy SELECT/ALL `USING (true)` | 58 |
| 2 | Tabel dengan grant SELECT ke `anon` (RLS mungkin masih menahan) | 139 |
| 3 | Tabel public tanpa RLS | 3 |
| 4 | Fungsi `SECURITY DEFINER` tanpa `search_path` terkunci | 44 |
| 5 | Fungsi `SECURITY DEFINER` yang bisa dieksekusi `anon` | 190 |
| 6 | View tanpa `security_invoker` | 24 |
| 7 | Kelompok index kembar | 27 |
| 8 | Foreign key tanpa index di sisi anak | 131 |

Prioritas: #1 & #5 pada tabel/fungsi data pribadi & keuangan, lalu #6, #8 (tabel besar), #7.

## Referensi implementasi nyata

- Migration: `supabase/migrations/20260929120000` … `20260929150000` (HR)
- Hook: `apps/HR/src/hooks/useAttendance.ts`, `useLeaveRequests.ts`, `useCashAdvances.ts`, `useDiscipline.ts`, `useHrDirectory.ts`
- Util: `apps/HR/src/lib/paging.ts`, `apps/HR/src/components/ui/Pagination.tsx`
