-- verifikasi-waterfall-2026-09-09.sql
-- READ-ONLY. Dijalankan SEBELUM dan SESUDAH 20260909170000.
--
-- Konteks: process_waterfall_deduction melimpahkan sisa potongan ke bahan
-- pengganti tanpa mengonversi satuan. SAOS TOMAT POUCH (12.000 g/Dus) ->
-- SAOS TOMAT KOMPAN (16.500 g/Dus) berasio 1,375.

-- Q1: rasio faktor tiap pasangan substitusi. Pasangan berasio <> 1 = terdampak.
SELECT u.nama AS utama,
       p.nama AS pengganti,
       u.faktor_tampilan AS faktor_utama,
       p.faktor_tampilan AS faktor_pengganti,
       ROUND(p.faktor_tampilan / u.faktor_tampilan, 6) AS rasio_salah_potong
  FROM public.bahan_baku_substitusi s
  JOIN public.bahan_baku u ON u.id = s.bahan_baku_utama_id
  JOIN public.bahan_baku p ON p.id = s.bahan_baku_pengganti_id
 ORDER BY 1, 2;

-- Q2: sidik jari limpahan. Baris pemakaian di bahan PENGGANTI yang nilainya
-- kelipatan rasio dari gram resep (30 -> 41,25 / 50 -> 68,75 / 60 -> 82,5).
-- Setelah perbaikan, baris BARU harus bernilai bulat sesuai resep (30/50/60).
--
-- Filter "NOT EXISTS resep_item aktif" (di bawah): sebuah bahan pengganti yang
-- JUGA punya resep aktif sendiri (mis. SAOS CABE, dipakai 16 resep) menghasilkan
-- baris `pemakaian` biasa dari konsumsi resep langsung -- tidak bisa dibedakan
-- dari limpahan waterfall pada query ini, dan volumenya menenggelamkan baris
-- limpahan yang sebenarnya (ditemukan Task 1: top-30-by-recency gabungan
-- kedua pasangan hanya menampilkan SAOS CABE, nol baris SAOS TOMAT KOMPAN).
-- SAOS TOMAT KOMPAN nol resep aktif, jadi SETIAP baris `pemakaian` di sana
-- pasti berasal dari waterfall -- itulah baseline pembanding yang valid.
-- Ini menggeneralisasi: kalau suatu bahan pengganti kelak diberi resepnya
-- sendiri, Q2 berhenti menampilkannya -- itu memang benar, bukan regresi.
SELECT l.created_at::date AS tanggal,
       o.name            AS outlet,
       b.nama            AS bahan_pengganti,
       l.qty,
       l.catatan
  FROM public.ledger_stok l
  JOIN public.bahan_baku b ON b.id = l.bahan_baku_id
  JOIN public.outlets   o ON o.id = l.outlet_id
 WHERE l.tipe = 'pemakaian'
   AND l.catatan LIKE 'Penjualan%'
   AND l.bahan_baku_id IN (SELECT bahan_baku_pengganti_id FROM public.bahan_baku_substitusi)
   AND l.created_at >= NOW() - INTERVAL '2 days'
   AND NOT EXISTS (
         SELECT 1
           FROM public.resep_item ri
           JOIN public.resep r ON r.id = ri.resep_id
          WHERE ri.bahan_baku_id = l.bahan_baku_id
            AND r.is_active
       )
 ORDER BY l.created_at DESC
 LIMIT 30;

-- Q3: total limpahan & besar kelebihannya, sepanjang riwayat.
-- Catatan paginasi (pelajaran Task 1): kalau query ini di-page lewat PostgREST
-- (.range() loop) karena melampaui batas 1000 baris, WAJIB pakai ORDER BY yang
-- deterministik (mis. `id ASC`) pada query dasarnya. ledger_stok menerima
-- INSERT bersamaan terus-menerus -- tanpa ORDER BY eksplisit, baris bisa
-- bergeser antar halaman dan lolos tak terhitung TANPA error. Kejadian nyata:
-- percobaan pertama Task 1 (tanpa ORDER BY) kehilangan 179 baris SAOS TOMAT
-- KOMPAN (2006 vs 2185 seharusnya) sementara jumlahnya nyaris tak bergeser --
-- justru itu petunjuknya (kehilangan 179 baris nyata semestinya mengubah SUM
-- ~7000, bukan ~6).
SELECT b.nama AS bahan_pengganti,
       COUNT(*)                                   AS baris,
       ROUND(SUM(l.qty), 2)                       AS total_dipotong,
       ROUND(SUM(l.qty) * (1 - u.faktor_tampilan / p.faktor_tampilan), 2) AS kelebihan
  FROM public.ledger_stok l
  JOIN public.bahan_baku_substitusi s ON s.bahan_baku_pengganti_id = l.bahan_baku_id
  JOIN public.bahan_baku u ON u.id = s.bahan_baku_utama_id
  JOIN public.bahan_baku p ON p.id = s.bahan_baku_pengganti_id
  JOIN public.bahan_baku b ON b.id = l.bahan_baku_id
 WHERE l.tipe = 'pemakaian'
   AND l.catatan LIKE 'Penjualan%'
 GROUP BY b.nama, u.faktor_tampilan, p.faktor_tampilan
 ORDER BY 1;

-- =====  HASIL PENERAPAN  =====
-- Migration 20260909170000_fix_waterfall_konversi_satuan.sql diterapkan ke DB
-- live via RPC exec_sql (Node script sekali-pakai dari root repo, dihapus
-- setelah dipakai; pola proyek ini -- CLI Supabase tanpa kredensial).
--
-- Waktu penerapan (momen exec_sql kembali sukses):
--   UTC : 2026-09-09T07:32:37.096Z
--   WIB : 2026-09-09 14:32:37.096 (+07:00)
--
-- --- Step 2: verifikasi ground-truth definisi fungsi ---
-- Dibaca lewat DO $$ ... RAISE EXCEPTION ... $$ via exec_sql (PostgREST tak
-- bisa menjangkau pg_proc). Asersi POSITIF (fungsi mengandung 'v_sisa_kecil'
-- DAN prosecdef=true) kembali TANPA error -- LOLOS.
-- Kontrol NEGATIF (asersi disengaja dibuat mustahil benar, mencari string
-- yang tak ada) kembali DENGAN error P0001 seperti diharapkan, membuktikan
-- kanal verifikasi ini benar-benar bisa gagal:
--   {"code":"P0001","message":"VERIFIKASI GAGAL (EXPECTED): kontrol negatif
--    berhasil menangkap ketidakcocokan"}
-- HASIL: LOLOS (positif tanpa error, negatif dengan error seperti diharapkan).
--
-- --- Step 3: stempel supabase_migrations.schema_migrations ---
-- INSERT ... ON CONFLICT DO NOTHING via exec_sql, lalu diverifikasi lewat
-- DO block terpisah (RAISE EXCEPTION bila baris tak ditemukan) -- kembali
-- tanpa error.
-- HASIL: BERHASIL, baris version='20260909170000' terkonfirmasi ada.
--
-- --- Step 4: verifikasi perilaku pada order nyata (Q2, SAOS TOMAT KOMPAN) ---
-- Dicek sekali, ~4 menit setelah penerapan (07:36:35 UTC), jendela 2 hari:
-- 159 baris SAOS TOMAT KOMPAN pada jendela ini, SELURUHNYA (159/159) sebelum
-- waktu penerapan. NOL baris baru sesudahnya pada saat pengecekan.
-- HASIL: TERTUNDA. Depok Sukmajaya & Paledang biasanya memicu limpahan dalam
-- hitungan jam (bukan menit) -- 4 menit tidak cukup untuk order nyata baru
-- terjadi secara alami. TIDAK diklaim terverifikasi; dicatat sebagai
-- verifikasi tertunda sesuai instruksi brief. Perlu dicek ulang nanti dengan
-- query Q2 di atas, memfilter created_at > '2026-09-09T07:32:37.096Z'.
--
-- --- Step 5: verifikasi tidak ada regresi (FOIL, bahan tanpa pengganti) ---
-- Jendela 2 hari, 2113 baris FOIL. Himpunan qty SESUDAH penerapan: {-45}
-- (2 baris). Himpunan qty SEBELUM penerapan mencakup -45 (403 baris) beserta
-- nilai bulat lain (-35 s/d -495) dan sisa pecahan floating-point historis
-- tak terkait (~1e-3, riwayat lama tak relevan dengan fix ini).
-- TIDAK ADA nilai qty baru yang muncul HANYA sesudah penerapan.
-- HASIL: LOLOS -- tidak ada regresi terdeteksi pada jalur mayoritas (bahan
-- tanpa pengganti).
--
-- Rincian lengkap & skrip verifikasi:
--   .superpowers/sdd/2026-09-09-waterfall-konversi-satuan/task-3-report.md
