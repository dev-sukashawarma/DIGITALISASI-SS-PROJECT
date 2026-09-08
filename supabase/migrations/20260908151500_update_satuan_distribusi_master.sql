-- 20260908151500_update_satuan_distribusi_master.sql
-- Pembaruan satuan_distribusi bahan baku aktif berdasarkan catatan fisik pengiriman operasional (8 September 2026)

-- 1. Bumbu & Bahan Dasar
UPDATE public.bahan_baku SET satuan_distribusi = 'kg' WHERE nama = 'CENGKEH' AND satuan_distribusi IS NULL;
UPDATE public.bahan_baku SET satuan_distribusi = 'pack' WHERE nama = 'GARAM' AND satuan_distribusi IS NULL;     -- 1 Bal = 20 Pack
UPDATE public.bahan_baku SET satuan_distribusi = 'kg' WHERE nama = 'JINTEN' AND satuan_distribusi IS NULL;
UPDATE public.bahan_baku SET satuan_distribusi = 'kg' WHERE nama = 'KAYU MANIS' AND satuan_distribusi IS NULL;
UPDATE public.bahan_baku SET satuan_distribusi = 'kg' WHERE nama = 'KETUMBAR' AND satuan_distribusi IS NULL;   -- 1 Karung = 25 Kg
UPDATE public.bahan_baku SET satuan_distribusi = 'pack' WHERE nama = 'KUNYIT' AND satuan_distribusi IS NULL;    -- 1 Dus = 18 Pack
UPDATE public.bahan_baku SET satuan_distribusi = 'kg' WHERE nama = 'MERICA' AND satuan_distribusi IS NULL;     -- Sesuai master Kg
UPDATE public.bahan_baku SET satuan_distribusi = 'kg' WHERE nama = 'SASA' AND satuan_distribusi IS NULL;       -- 1 Dus = 12 Kg

-- 2. Operasional
UPDATE public.bahan_baku SET satuan_distribusi = 'roll' WHERE nama = 'Cling Wrap' AND satuan_distribusi IS NULL; -- 1 Dus = 24 Roll
UPDATE public.bahan_baku SET satuan_distribusi = 'box' WHERE nama = 'HAND GLOVE' AND satuan_distribusi IS NULL;
UPDATE public.bahan_baku SET satuan_distribusi = 'pack' WHERE nama = 'DUS PACKING' AND satuan_distribusi IS NULL;
UPDATE public.bahan_baku SET satuan_distribusi = 'pack' WHERE nama = 'PLASTIK 24' AND satuan_distribusi IS NULL;

-- 3. Gas & Galon
UPDATE public.bahan_baku SET satuan_distribusi = 'tabung' WHERE nama = 'GAS 3Kg' AND satuan_distribusi IS NULL;
UPDATE public.bahan_baku SET satuan_distribusi = 'tube' WHERE nama = 'GALON AIR' AND satuan_distribusi IS NULL;

-- 4. Bawang Putih Bubuk
UPDATE public.bahan_baku SET satuan_distribusi = 'bungkus' WHERE nama = 'BAWANG PUTIH BUBUK' AND satuan_distribusi IS NULL; -- 1 Dus = 6 Bungkus
