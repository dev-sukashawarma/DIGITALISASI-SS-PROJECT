# Penguncian RLS, Optimasi `pemakaian_resep_harian`, dan Retensi `pg_cron` — Desain

**Tanggal:** 2026-11-08
**Lingkup:** Database Supabase (`supabase/migrations`, `supabase/verifikasi`) — nol perubahan kode aplikasi / nol redeploy
**Status:** Desain disetujui, siap perencanaan implementasi

## 1. Latar Belakang & Bukti Diagnostik Live

Hasil audit `pg_stat_statements` dan pemeriksaan skema pada database produksi (`khpkoreaaucvyqfhynfq`) menemukan tiga masalah utama yang dapat diselesaikan secara atomik di lapisan database tanpa mengubah kontrak aplikasi:

1. **Celah Keamanan RLS (`public.hermes_bot_registry`, `public._temp_sql_output`, `public._temp_timings`):**
   - Pada migrasi `20300254002200_hermes_bot_catalog_and_access.sql`, `hermes_bot_registry` dirancang menggunakan `ENABLE ROW LEVEL SECURITY` serta pencabutan hak akses dari `PUBLIC`, `anon`, dan `authenticated`. Namun di database produksi saat ini tercatat `relrowsecurity = false`, role `anon` dan `authenticated` memegang hak `SELECT`, dan terdapat **1 `bot_token` aktif** pada kolom `bot_token` (kolom tambahan yang belum tercatat di berkas migrasi).
   - Seluruh kode aplikasi yang mengakses `hermes_bot_registry` (`apps/admin-dashboard/src/app/dashboard/sistem/bot-telegram/`, `apps/admin-dashboard/src/app/api/hermes/telegram-access/route.ts`, `apps/bot/src/lib/server/telegram.ts`, serta fungsi pengirim alert di PostgreSQL) sudah memakai `service_role` atau `SECURITY DEFINER`.
   - Tabel `_temp_sql_output` (10 baris, terbaru `2026-09-16`) dan `_temp_timings` (10 baris) adalah tabel bantu sementara sisa sesi debug SQL yang terbuka penuh (`SELECT/INSERT/UPDATE/DELETE/TRUNCATE`) untuk `anon` dan `authenticated`, serta tidak dirujuk oleh kode maupun fungsi mana pun.

2. **Beban Baca RPC `public.pemakaian_resep_harian(uuid, date)` (340 MiB / 42 panggilan):**
   - Pengukuran `EXPLAIN (ANALYZE, BUFFERS)` pada `MITRA CILEUNGSI` menunjukkan waktu eksekusi **5.893,8 ms** saat cache dingin (`9.031` blok = ~70,5 MB) dan **98,4 ms** saat hangat (`7.968` blok).
   - Sebanyak **92% I/O (`7.308` blok)** berasal dari CTE `order_milik_hari_ini` pada migrasi `20261020100000_pemakaian_resep_harian.sql`: klausa `WHERE NOT EXISTS (SELECT 1 FROM ledger_stok e ...)` diratakan oleh planner menjadi `Hash Right Anti Join` dengan `Bitmap Heap Scan` atas seluruh histori `ledger_stok` outlet (~123.896 baris).

3. **Pembengkakan Tabel `cron.job_run_details` (148 MB / ~388.567 baris):**
   - Terdapat 7 job `pg_cron` berinterval tiap menit (`* * * * *`) yang menulis ~10.080 baris log per hari tanpa jadwal pembersihan. Saat proses `pg_cron` menyapu status lama pada waktu inisialisasi/restart, PostgreSQL harus memindai seluruh tabel historis.

## 2. Cakupan

### Masuk dalam paket ini
- Sinkronisasi kolom `bot_token`, pengaktifan RLS, dan pencabutan hak `PUBLIC`/`anon`/`authenticated` pada `public.hermes_bot_registry`.
- Penghapusan tabel sisa debug `public._temp_sql_output` dan `public._temp_timings`.
- Penulisan ulang body SQL `public.pemakaian_resep_harian(uuid, date)` (tetap `SECURITY INVOKER`, tanda tangan dan hasil identik, tanpa index baru).
- Pembersihan awal log selesai `cron.job_run_details` yang lebih tua dari 7 hari beserta pendaftaran jadwal `pg_cron` harian `cron-job-run-details-retensi-7-hari`.
- Skrip verifikasi otomatis pasca-migrasi.

### Di luar cakupan sesi ini (tindak lanjut terpisah)
- Pengecekan repositori APK Android native (`sukashawarma-native`) terkait sisa 12 panggilan ke view `ledger_transaksi_ringkas` (seluruh aplikasi web di monorepo ini sudah memakai RPC `ledger_transaksi_page` sejak `20260922160000`).
- Audit dan penghapusan index duplikat/tak terpakai pada `ledger_stok`, `orders`, dan `order_items` (memerlukan verifikasi rentang observasi `pg_stat_user_indexes` tersendiri).
- Rotasi nilai rahasia `bot_token` Bot CEO melalui `@BotFather` (tindakan operasional manual oleh owner/admin setelah celah akses `anon` ditutup oleh migrasi ini).

## 3. Rancangan Teknis

### 3.1 Penguncian `hermes_bot_registry` & Pembersihan Tabel `_temp_*`

1. Pastikan kolom `bot_token` tercatat resmi di skema migrasi:
   ```sql
   ALTER TABLE public.hermes_bot_registry
     ADD COLUMN IF NOT EXISTS bot_token text;
   ```
2. Aktifkan RLS tanpa policy untuk `anon`/`authenticated` (default-deny), cabut seluruh privilege publik, dan berikan akses hanya ke `service_role`:
   ```sql
   ALTER TABLE public.hermes_bot_registry ENABLE ROW LEVEL SECURITY;
   REVOKE ALL ON TABLE public.hermes_bot_registry FROM PUBLIC, anon, authenticated;
   GRANT ALL ON TABLE public.hermes_bot_registry TO service_role;
   ```
3. Hapus kedua tabel debug sementara:
   ```sql
   DROP TABLE IF EXISTS public._temp_sql_output;
   DROP TABLE IF EXISTS public._temp_timings;
   ```

### 3.2 Optimasi `public.pemakaian_resep_harian(p_outlet_id uuid, p_tanggal date)`

Kontrak fungsi dipertahankan 100%:
- Signature: `(p_outlet_id uuid, p_tanggal date) RETURNS TABLE (bahan_baku_id uuid, qty numeric)`
- Properti: `LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public`
- Privilege: `REVOKE ALL FROM PUBLIC, anon`; `GRANT EXECUTE TO authenticated, service_role`

**Perubahan struktur query:**
Alih-alih menjalankan anti-join ke tabel `ledger_stok` untuk mencari order yang sudah pernah memiliki baris `pemakaian` sebelum awal tanggal WIB (`j.mulai`), query hanya menyentuh `ledger_stok` dalam **dua pembacaan berindeks satu putaran (`loops = 1`)**:

1. `hari_ini AS MATERIALIZED`: mengambil baris `pemakaian` pada jendela `[mulai, akhir)` lewat `idx_ledger_stok_outlet_created_at`.
2. `baris_kandidat AS MATERIALIZED`: mengambil seluruh baris `pemakaian` dan `adjustment` milik himpunan `ref_order_id` pada `hari_ini` sekaligus lewat satu `Index Scan` pada `idx_ledger_stok_ref_order_id`:
   ```sql
   WHERE l.ref_order_id = ANY (
     ARRAY(SELECT DISTINCT h.ref_order_id FROM hari_ini h WHERE h.ref_order_id IS NOT NULL)
   )
     AND l.outlet_id = p_outlet_id
     AND l.tipe IN ('pemakaian', 'adjustment')
   ```
3. `order_lama`: menyaring `ref_order_id` dari `baris_kandidat` di memori yang memiliki `tipe = 'pemakaian' AND created_at < j.mulai` (aturan atribusi ke tanggal pemakaian pertama tetap identik, termasuk bila komposisi bahan resep berubah lintas hari).
4. `per_order`: menghitung `GREATEST(-SUM(b.qty), 0)` per `(ref_order_id, bahan_baku_id)` untuk order yang tidak ada di `order_lama` (`LEFT JOIN order_lama ... WHERE ol.ref_order_id IS NULL`), lalu digabung (`UNION ALL`) dengan `tanpa_order` (`ref_order_id IS NULL`).

**Keunggulan arsitektur ini dibanding lateral per-order:**
- Tidak ada perulangan lateral (`loops = N_order`) terhadap tabel `ledger_stok`, sehingga policy RLS `ledger_read` (`outlet_id IN (SELECT public.accessible_outlet_ids())`) hanya dievaluasi satu kali per CTE (`loops = 1`), bukan ratusan kali per panggilan.
- Hasil uji baca-saja pada `MITRA CILEUNGSI` (`2026-11-06`): selisih hasil `0` dari `22` bahan terhadap fungsi lama, pembacaan turun dari `7.968` blok menjadi `666` blok (**−91,6%**), dan waktu eksekusi turun ke **~15 ms**.

### 3.3 Retensi Harian `cron.job_run_details` (7 Hari)

1. Saat migrasi dijalankan (bila ekstensi `pg_cron` aktif), hapus histori eksekusi yang sudah selesai dan berumur lebih dari 7 hari:
   ```sql
   DELETE FROM cron.job_run_details
   WHERE end_time IS NOT NULL
     AND end_time < now() - interval '7 days';
   ```
   Filter `end_time IS NOT NULL` memastikan baris job yang sedang berjalan (`status = 'running'` / `'starting'`) tidak ikut tersentuh lock.
2. Jadwalkan job pembersihan harian secara idempoten pada pukul **03:45 WIB (`45 20 * * *` UTC)**, sejajar dengan jendela pemeliharaan dini hari yang sudah dipakai oleh `suka-bot-retensi-90-hari` (`30 20 * * *`) dan `driver-retensi-jejak` (`40 20 * * *`):
   - Nama job: `cron-job-run-details-retensi-7-hari`
   - Command: `DELETE FROM cron.job_run_details WHERE end_time IS NOT NULL AND end_time < now() - interval '7 days';`

## 4. Struktur Berkas & Penomoran Migrasi

- **Buat migrasi:** `supabase/migrations/20300254011600_kunci_rls_optimasi_resep_retensi_cron.sql`
  - Menggunakan versi `20300254011600` (tepat setelah versi tertinggi saat ini `20300254011500`) karena `hermes_bot_registry` didefinisikan pada seri `20300254002200`; penomoran ini menjaga urutan eksekusi tetap valid baik pada `supabase db reset` dari nol maupun pada `supabase_migrations.schema_migrations` produksi.
- **Buat skrip verifikasi:** `supabase/verifikasi/keamanan_dan_performa/t1_rls_resep_cron.sql`
- **Gunakan ulang skrip regresi:** `supabase/verifikasi/pemakaian_resep/t1_pemakaian_resep_harian.sql`

## 5. Penanganan Galat & Pengujian Verifikasi

Seluruh perubahan dianggap selesai hanya bila kedua skrip verifikasi berikut lulus tanpa error:

1. **Regresi Fungsional & RLS `pemakaian_resep_harian` (`t1_pemakaian_resep_harian.sql`):**
   - Paritas angka terhadap rumus independen pada tanggal pemakaian (D1) dan tanggal pembatalan lintas hari (D2).
   - Kontrol negatif 1 & 2 (order batal memengaruhi D1 dan tidak mengurangi D2).
   - `anon` ditolak `EXECUTE`, `authenticated` diizinkan `EXECUTE`.
   - `crew` outlet lain menerima `0` baris; `crew` outlet sendiri menerima baris pemakaian yang benar.

2. **Verifikasi Keamanan, Performa Plan, & Cron (`t1_rls_resep_cron.sql`):**
   - `hermes_bot_registry` memiliki kolom `bot_token`, `relrowsecurity = true`, `has_table_privilege('anon', ..., 'SELECT') = false`, `has_table_privilege('authenticated', ..., 'SELECT') = false`, dan `has_table_privilege('service_role', ..., 'SELECT') = true`.
   - `to_regclass('public._temp_sql_output') IS NULL` dan `to_regclass('public._temp_timings') IS NULL`.
   - Job `cron-job-run-details-retensi-7-hari` aktif di `cron.job` dengan jadwal `45 20 * * *`, serta jumlah baris `cron.job_run_details` dengan `end_time < now() - interval '7 days'` sama dengan `0`.
   - Output `EXPLAIN` dari `pemakaian_resep_harian` menggunakan `idx_ledger_stok_ref_order_id` dan `idx_ledger_stok_outlet_created_at` tanpa `Bitmap Heap Scan` atas histori penuh outlet.
