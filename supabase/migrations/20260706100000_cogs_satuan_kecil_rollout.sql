-- 20260706100000_cogs_satuan_kecil_rollout.sql
-- Rollout satuan_kecil/faktor_tampilan (lihat 20260704210000) ke bahan lain yang
-- berbasis kemasan/kontainer diskrit -- KULIT 25/28/32, KEJU, SAPI, GAS 3Kg.
-- Semua nilai faktor_tampilan sudah dikonfirmasi owner (lihat migration
-- 20260704160000_cogs_add_faktor_konversi.sql / VERIFIKASI-FAKTOR-KONVERSI.md
-- di sesi COGS 2026-07-04) -- di sini dipakai ulang sebagai faktor tampilan
-- karena satuan pakai resep KULIT/KEJU (lembar) kebetulan SAMA dgn satuan
-- fisik yang ingin ditampilkan (beda dari MINYAK SAYUR yang resepnya pakai
-- gram tapi tampilan pakai liter).
--
-- Bahan yang SENGAJA TIDAK dimasukkan (dibahas & diputuskan bareng user):
-- AYAM/TEPUNG/TUM/LETTUCE/POWDER MIX/SAUS CABE/MAYONES/KENTANG/SAOS SAMYANG
-- (kg->gram) -- ini cuma pergeseran desimal metrik, bukan pembagian
-- kontainer fisik, jadi "N kg + M gram" tidak menambah akurasi dibanding
-- "N.M kg" langsung.

-- SAPI perlu satuan_kecil 'kg' (blok->sisa kg) -- belum ada di CHECK constraint,
-- perluas dulu. Nama constraint dicari dinamis (bukan ditebak) supaya aman
-- walau Postgres memberi nama auto-generated yang berbeda dari asumsi.
DO $$
DECLARE
  c_name text;
BEGIN
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'bahan_baku'::regclass
    AND pg_get_constraintdef(oid) LIKE '%satuan_kecil%'
    AND contype = 'c';

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE bahan_baku DROP CONSTRAINT %I', c_name);
  END IF;
END $$;

ALTER TABLE bahan_baku ADD CONSTRAINT bahan_baku_satuan_kecil_check
  CHECK (satuan_kecil IS NULL OR satuan_kecil IN ('liter','ml','gram','kg','cm','lembar'));

UPDATE bahan_baku SET satuan_kecil = 'lembar', faktor_tampilan = 20  WHERE nama = 'KULIT 25';
UPDATE bahan_baku SET satuan_kecil = 'lembar', faktor_tampilan = 20  WHERE nama = 'KULIT 28';
UPDATE bahan_baku SET satuan_kecil = 'lembar', faktor_tampilan = 20  WHERE nama = 'KULIT 32';
UPDATE bahan_baku SET satuan_kecil = 'lembar', faktor_tampilan = 240 WHERE nama = 'KEJU';
UPDATE bahan_baku SET satuan_kecil = 'kg',     faktor_tampilan = 2   WHERE nama = 'SAPI';       -- 1 pcs (blok) = 2 kg
UPDATE bahan_baku SET satuan_kecil = 'kg',     faktor_tampilan = 3   WHERE nama = 'GAS 3Kg';     -- 1 tabung = 3 kg
