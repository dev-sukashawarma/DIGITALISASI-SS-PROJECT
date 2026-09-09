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
