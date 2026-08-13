-- 20260813120000_rename_minyak_sayur_to_minyak.sql
--
-- Konteks: ada 2 bahan_baku "minyak" — 'MINYAK' (id 3746f878-...) dan
-- 'MINYAK SAYUR' (id 99483bfb-...). Dicek ke resep_item (BOM aktif): SEMUA
-- 19 resep global pakai 'MINYAK SAYUR', nol yang pakai 'MINYAK'. 'MINYAK'
-- juga punya bug konfigurasi (faktor_konversi=1, seharusnya 1000 seperti
-- MINYAK SAYUR) yang bikin opname manual salah hitung kalau dipakai.
--
-- Keputusan owner (2026-08-13): supaya tidak ambigu, nama "MINYAK" dipakai
-- untuk item yang benar-benar dipakai BOM (bekas MINYAK SAYUR). Item lama
-- 'MINYAK' TIDAK di-DELETE — punya 156 baris ledger_stok + 183 baris
-- opname_item + 25 baris stok_balance + 13 permintaan + 5 surat_jalan_item,
-- semuanya di-RESTRICT oleh FK (hapus riwayat = kehilangan audit trail).
-- Dinonaktifkan (is_active=false) saja, konsisten dgn pola existing
-- (lihat migration 20260708120001_hide_inactive_bahan_baku.sql — form/
-- monitoring sudah filter is_active=true).
--
-- Urutan WAJIB: nama punya UNIQUE constraint (bahan_baku_nama_key), jadi
-- item lama harus di-rename dulu sebelum "MINYAK" bisa dipakai ulang.

UPDATE bahan_baku
SET nama = 'MINYAK (NONAKTIF)', is_active = false
WHERE id = '3746f878-da01-47de-9ff5-76215371188f' AND nama = 'MINYAK';

UPDATE bahan_baku
SET nama = 'MINYAK'
WHERE id = '99483bfb-4ab0-4828-90ae-349b65999950' AND nama = 'MINYAK SAYUR';
