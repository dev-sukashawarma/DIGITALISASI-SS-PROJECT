-- 20300123000000_kategori_aset_perlengkapan.sql
-- Pisahkan kategori barang non-bahan baku (Aset Hardware & Perlengkapan Kantor)
-- agar dapat dibeli via PO Purchasing tetapi tidak tercampur ke alur Permintaan Bahan / Opname outlet.

UPDATE public.bahan_baku
SET kategori = 'ASET'
WHERE nama = 'PRINTER THERMAL';

UPDATE public.bahan_baku
SET kategori = 'PERLENGKAPAN'
WHERE nama = 'ID CARD';
