-- Pemantau saldo vendor Gudang Pusat. Read-only murni -- tidak ada DML di file ini.
-- Jalankan lewat: supabase db query --linked -f supabase/verifikasi/saldo_vendor/pemantau.sql
--
-- CATATAN untuk siapa pun yang menjalankan: CLI proyek ini hanya mencetak hasil
-- QUERY TERAKHIR kalau file berisi banyak statement. Jalankan satu-satu (copy per
-- blok Q1/Q2/Q3), jangan andalkan output gabungan dari satu kali jalan file ini.

-- Q1: selisih Σ sisa vendor vs stok total gudang, per bahan multi-vendor aktif.
-- Normal: kecil (waste/penyesuaian gudang di antara opname/koreksi). Besar →
-- hitung ulang bahan itu (kemungkinan ada sumber tulis stok yang belum
-- terhubung ke stok_vendor_gudang_mutasi, atau koreksi manual yang salah bahan).
SELECT b.nama,
       round(sum(m.qty) / NULLIF(public.to_ledger_scale(public.gudang_pusat_id(), b.id, 1), 0), 2) AS sisa_vendor_besar,
       round(sb.saldo / NULLIF(public.to_ledger_scale(public.gudang_pusat_id(), b.id, 1), 0), 2) AS stok_total_besar
  FROM bahan_baku b
  JOIN stok_vendor_gudang_mutasi m ON m.bahan_baku_id = b.id
  LEFT JOIN stok_balance sb ON sb.bahan_baku_id = b.id AND sb.outlet_id = public.gudang_pusat_id()
 WHERE public.bahan_vendor_aktif(b.id)
 GROUP BY b.id, b.nama, sb.saldo
 ORDER BY abs(sum(m.qty) - COALESCE(sb.saldo, 0)) DESC;

-- Q2: surat jalan dikirim sejak go-live berbahan multi-vendor tapi tanpa vendor
-- terisi di baris itemnya. Normal: 0. Kalau muncul, berarti create_surat_jalan
-- (atau jalur lain yang menulis surat_jalan_item) berhasil dilewati tanpa
-- vendor untuk bahan yang seharusnya wajib pilih vendor.
SELECT s.id, b.nama
  FROM surat_jalan s
  JOIN surat_jalan_item i ON i.surat_jalan_id = s.id
  JOIN bahan_baku b ON b.id = i.bahan_baku_id
 WHERE s.status <> 'draft' AND i.vendor_id IS NULL AND public.bahan_multi_vendor(i.bahan_baku_id)
   AND s.created_at >= TIMESTAMPTZ '2026-09-12 00:00+07';

-- Q3: bahan multi-vendor yang BELUM punya titik awal (penjaga per-vendor belum
-- aktif -- vendor tetap dicatat, kiriman tidak diblokir, sengaja begitu sampai
-- ada hitung fisik). Target: 0 setelah sesi hitung fisik per-vendor di Gudang
-- Pusat selesai untuk semua bahan multi-vendor. Sampai itu terjadi, baris di
-- sini adalah backlog yang diketahui, bukan bug.
SELECT b.nama
  FROM bahan_baku b
 WHERE b.is_active AND public.bahan_multi_vendor(b.id) AND NOT public.bahan_vendor_aktif(b.id)
 ORDER BY 1;
