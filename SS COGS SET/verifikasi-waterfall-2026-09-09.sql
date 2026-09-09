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
 ORDER BY l.created_at DESC
 LIMIT 30;

-- Q3: total limpahan & besar kelebihannya, sepanjang riwayat.
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
