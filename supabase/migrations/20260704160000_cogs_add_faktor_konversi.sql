-- 20260704160000_cogs_add_faktor_konversi.sql
-- Menambah kolom konversi satuan-stok -> satuan-pakai (yang dipakai di resep_item.satuan).
-- Tujuan: trigger BOM (trg_process_bom_stok, saat ini SENGAJA belum aktif -- lihat
-- SS COGS SET/backup/deferred-migrations/) nanti bisa memotong ledger_stok dengan BENAR
-- meski satuan resep (gram/lembar/cm/pcs) beda dari satuan beli/stok (kg/pack/crt/kompan/pcs).
--
-- Definisi: faktor_konversi = berapa satuan-pakai (sesuai resep_item.satuan utk bahan
-- ybs) setara dengan 1 satuan_baku (bahan_baku.satuan). Contoh: AYAM satuan=kg,
-- dipakai di resep dalam gram -> faktor_konversi=1000 (1kg=1000gram).
--
-- Default 1 utk semua bahan lain (blm dipakai di resep saat ini / satuan sudah 1:1).
-- WAJIB diisi manual sebelum bahan baru dipakai di resep dgn satuan pakai berbeda.

ALTER TABLE bahan_baku
  ADD COLUMN IF NOT EXISTS faktor_konversi NUMERIC NOT NULL DEFAULT 1
  CHECK (faktor_konversi > 0);

COMMENT ON COLUMN bahan_baku.faktor_konversi IS
  'Berapa satuan-pakai (resep_item.satuan) setara 1 satuan_baku (bahan_baku.satuan). Contoh: AYAM kg->gram = 1000.';

-- Konversi metrik standar (kg->gram, dst) -- angka pasti, bukan asumsi:
UPDATE bahan_baku SET faktor_konversi = 1000 WHERE nama = 'AYAM';               -- 1 kg = 1000 gram
UPDATE bahan_baku SET faktor_konversi = 1000 WHERE nama = 'TUM';               -- 1 kg = 1000 gram
UPDATE bahan_baku SET faktor_konversi = 1000 WHERE nama = 'LETTUCE';           -- 1 kg = 1000 gram
UPDATE bahan_baku SET faktor_konversi = 1000 WHERE nama = 'TEPUNG';            -- 1 kg = 1000 gram
UPDATE bahan_baku SET faktor_konversi = 1000 WHERE nama = 'POWDER MIX';        -- 1 kg = 1000 gram
UPDATE bahan_baku SET faktor_konversi = 1000 WHERE nama = 'SAUS CABE/TOMAT';   -- 1 kg = 1000 gram
UPDATE bahan_baku SET faktor_konversi = 1000 WHERE nama = 'MAYONES';           -- 1 kg = 1000 gram (satuan diubah ke kg di migration sebelumnya)
UPDATE bahan_baku SET faktor_konversi = 1000 WHERE nama = 'KENTANG';           -- 1 kg = 1000 gram (satuan diubah ke kg)
UPDATE bahan_baku SET faktor_konversi = 1000 WHERE nama = 'SAOS SAMYANG';      -- 1 kg = 1000 gram (satuan diubah ke kg)

-- Konversi kemasan spesifik bahan -- dikonfirmasi owner (2026-07-04):
UPDATE bahan_baku SET faktor_konversi = 2000  WHERE nama = 'SAPI';            -- 1 pcs (blok) = 2 kg = 2000 gram
UPDATE bahan_baku SET faktor_konversi = 20    WHERE nama = 'KULIT 25';        -- 1 pack = 20 lembar
UPDATE bahan_baku SET faktor_konversi = 20    WHERE nama = 'KULIT 28';        -- 1 pack = 20 lembar
UPDATE bahan_baku SET faktor_konversi = 20    WHERE nama = 'KULIT 32';        -- 1 pack = 20 lembar
UPDATE bahan_baku SET faktor_konversi = 16000 WHERE nama = 'MINYAK SAYUR';    -- 1 kompan = 16 liter; asumsi densitas 1L~1kg (dikonfirmasi owner)
UPDATE bahan_baku SET faktor_konversi = 3000  WHERE nama = 'GAS 3Kg';         -- 1 pcs tabung = 3000 gram (dikonfirmasi owner)
UPDATE bahan_baku SET faktor_konversi = 240   WHERE nama = 'KEJU';            -- 1 karton = 24 pack x 10 slice = 240 lembar
UPDATE bahan_baku SET faktor_konversi = 760   WHERE nama = 'FOIL';            -- 1 pcs (roll) = 30cm x 7,6m = 760 cm (satuan diubah ke pcs/roll)

-- Sudah 1:1 (satuan_baku == satuan_pakai) -- faktor tetap default 1, ditulis eksplisit
-- di sini untuk dokumentasi/kejelasan (bukan perubahan nilai):
UPDATE bahan_baku SET faktor_konversi = 1 WHERE nama IN (
  'PAPER WRAP', 'PLASTIK MERAH', 'MIE', 'CUP + TUTUP', 'STIKER', 'ES BATU',
  'PLASTIK VACUM', 'DUS PACKING'
);
