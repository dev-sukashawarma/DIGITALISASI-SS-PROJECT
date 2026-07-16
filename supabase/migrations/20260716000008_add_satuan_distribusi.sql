-- 1. Add satuan_distribusi column to bahan_baku
ALTER TABLE bahan_baku ADD COLUMN IF NOT EXISTS satuan_distribusi text;

-- 2. Update MAYONAISE
UPDATE bahan_baku 
SET satuan_kecil = 'kg', faktor_tampilan = 12
WHERE nama = 'MAYONAISE';

-- 3. Update satuan_distribusi based on the provided list
UPDATE bahan_baku SET satuan_distribusi = 'kg' WHERE nama = 'SAOS CABE';
UPDATE bahan_baku SET satuan_distribusi = 'kg' WHERE nama = 'SAOS TOMAT';
UPDATE bahan_baku SET satuan_distribusi = 'kg' WHERE nama = 'SAOS SAMYANG';
UPDATE bahan_baku SET satuan_distribusi = 'kg' WHERE nama = 'MAYONAISE';
UPDATE bahan_baku SET satuan_distribusi = 'pack' WHERE nama = 'KULIT 25';
UPDATE bahan_baku SET satuan_distribusi = 'pack' WHERE nama = 'KULIT 28';
UPDATE bahan_baku SET satuan_distribusi = 'pack' WHERE nama = 'KULIT 32';
UPDATE bahan_baku SET satuan_distribusi = 'kg' WHERE nama = 'AYAM';
UPDATE bahan_baku SET satuan_distribusi = 'blok' WHERE nama = 'SAPI';
UPDATE bahan_baku SET satuan_distribusi = 'kg' WHERE nama = 'KENTANG';
UPDATE bahan_baku SET satuan_distribusi = 'pack' WHERE nama = 'KEJU';
UPDATE bahan_baku SET satuan_distribusi = 'kg' WHERE nama = 'TUM';
UPDATE bahan_baku SET satuan_distribusi = 'kg' WHERE nama = 'BAWANG';
UPDATE bahan_baku SET satuan_distribusi = 'kg' WHERE nama = 'TEPUNG';
UPDATE bahan_baku SET satuan_distribusi = 'kompan' WHERE nama = 'MINYAK SAYUR';
UPDATE bahan_baku SET satuan_distribusi = 'roll' WHERE nama = 'FOIL';
UPDATE bahan_baku SET satuan_distribusi = 'pack' WHERE nama = 'SARUNG TANGAN BENING';
UPDATE bahan_baku SET satuan_distribusi = 'roll' WHERE nama = 'KERTAS STRUK';
UPDATE bahan_baku SET satuan_distribusi = 'pack' WHERE nama = 'PLASTIK BESAR';
UPDATE bahan_baku SET satuan_distribusi = 'pack' WHERE nama = 'PLASTIK KECIL';
UPDATE bahan_baku SET satuan_distribusi = 'pack' WHERE nama = 'POLYBAG';
UPDATE bahan_baku SET satuan_distribusi = 'pack' WHERE nama = 'PLASTIK MERAH';
UPDATE bahan_baku SET satuan_distribusi = 'pack' WHERE nama = 'PAPER WRAP';
UPDATE bahan_baku SET satuan_distribusi = 'kg' WHERE nama = 'POWDER TEH';
UPDATE bahan_baku SET satuan_distribusi = 'kg' WHERE nama = 'POWDER JERUK';
UPDATE bahan_baku SET satuan_distribusi = 'pcs' WHERE nama = 'CUP + TUTUP';
UPDATE bahan_baku SET satuan_distribusi = 'pack' WHERE nama = 'SEDOTAN';
UPDATE bahan_baku SET satuan_distribusi = 'lembar' WHERE nama = 'STIKER';
UPDATE bahan_baku SET satuan_distribusi = 'bungkus' WHERE nama = 'MIE';
UPDATE bahan_baku SET satuan_distribusi = 'kg' WHERE nama = 'LETTUCE';
UPDATE bahan_baku SET satuan_distribusi = 'bal' WHERE nama = 'ES BATU';
