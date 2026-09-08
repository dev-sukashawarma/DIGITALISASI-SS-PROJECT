-- 20260908155000_update_satuan_master_dan_po.sql
-- Penyesuaian hierarki satuan master, penambahan satuan_po vendor, dan rekalkulasi harga beli

-- 1. Tambah kolom satuan_po jika belum ada
ALTER TABLE public.bahan_baku ADD COLUMN IF NOT EXISTS satuan_po text;

-- 2. Pembaruan 13 Bahan Baku Spesifik (Satuan Besar, Tengah, Kecil, Faktor, Satuan Distribusi, Satuan PO)

-- 1. MERICA
UPDATE public.bahan_baku 
SET satuan = 'Kg', satuan_tengah = NULL, faktor_tengah = NULL, satuan_kecil = 'Gram', faktor_tampilan = 1000, satuan_distribusi = 'kg', satuan_po = 'kg'
WHERE nama = 'MERICA';

-- 2. HAND GLOVE (1 Dus = 75 Box, 1 Box = 100 Lembar)
UPDATE public.bahan_baku 
SET satuan = 'Dus', satuan_tengah = 'Box', faktor_tengah = 75, satuan_kecil = 'Lembar', faktor_tampilan = 7500, satuan_distribusi = 'box', satuan_po = 'dus'
WHERE nama = 'HAND GLOVE';

UPDATE public.bahan_baku_harga 
SET kemasan_qty = 75, kemasan_satuan = 'Box', harga_beli_display = 448125, harga_beli = 59.75
WHERE bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama = 'HAND GLOVE');

-- 3. KERTAS STRUK (1 Dus = 10 Pack, 1 Pack = 10 Roll)
UPDATE public.bahan_baku 
SET satuan = 'Dus', satuan_tengah = 'Pack', faktor_tengah = 10, satuan_kecil = 'Roll', faktor_tampilan = 100, satuan_distribusi = 'roll', satuan_po = 'dus'
WHERE nama = 'KERTAS STRUK';

UPDATE public.bahan_baku_harga 
SET kemasan_qty = 10, kemasan_satuan = 'Pack', harga_beli_display = 160000, harga_beli = 1600
WHERE bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama = 'KERTAS STRUK');

-- 4. STIKER SHAWARMA (1 Lembar = 70 Pcs)
UPDATE public.bahan_baku 
SET satuan = 'Lembar', satuan_tengah = NULL, faktor_tengah = NULL, satuan_kecil = 'Pcs', faktor_tampilan = 70, satuan_distribusi = 'lembar', satuan_po = 'lembar'
WHERE nama = 'STIKER';

UPDATE public.bahan_baku_harga 
SET kemasan_qty = 70, kemasan_satuan = 'Pcs', harga_beli_display = 5300, harga_beli = 75.71
WHERE bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama = 'STIKER');

-- 5. KETUMBAR (1 Bal = 25 Kg = 25.000 Gram)
UPDATE public.bahan_baku 
SET satuan = 'Bal', satuan_tengah = 'Kg', faktor_tengah = 25, satuan_kecil = 'gram', faktor_tampilan = 25000, satuan_distribusi = 'kg', satuan_po = 'bal'
WHERE nama = 'KETUMBAR';

-- 6. GALON AIR (1 Galon = 19 Liter = 19.000 Ml)
UPDATE public.bahan_baku 
SET satuan = 'Galon', satuan_tengah = 'Liter', faktor_tengah = 19, satuan_kecil = 'Ml', faktor_tampilan = 19000, satuan_distribusi = 'galon', satuan_po = 'galon'
WHERE nama = 'GALON AIR';

UPDATE public.bahan_baku_harga 
SET kemasan_qty = 1, kemasan_satuan = 'Galon', harga_beli_display = 7000
WHERE bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama = 'GALON AIR');

-- 7. PLASTIK KECIL (1 Pack = 100 Pcs)
UPDATE public.bahan_baku 
SET satuan = 'Pack', satuan_tengah = NULL, faktor_tengah = NULL, satuan_kecil = 'Pcs', faktor_tampilan = 100, satuan_distribusi = 'pack', satuan_po = 'pack'
WHERE nama = 'PLASTIK KECIL';

UPDATE public.bahan_baku_harga 
SET kemasan_qty = 100, kemasan_satuan = 'Pcs', harga_beli_display = 6996, harga_beli = 69.96
WHERE bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama = 'PLASTIK KECIL');

-- 8. PLASTIK MERAH (1 Pack = 20 Lembar)
UPDATE public.bahan_baku 
SET satuan = 'Pack', satuan_tengah = NULL, faktor_tengah = NULL, satuan_kecil = 'Lembar', faktor_tampilan = 20, satuan_distribusi = 'pack', satuan_po = 'pack'
WHERE nama = 'PLASTIK MERAH';

UPDATE public.bahan_baku_harga 
SET kemasan_qty = 20, kemasan_satuan = 'Lembar', harga_beli_display = 18000, harga_beli = 900
WHERE bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama = 'PLASTIK MERAH');

-- 9. PLASTIK SUKA DRINK (1 Pack = 200 Lembar)
UPDATE public.bahan_baku 
SET satuan = 'Pack', satuan_tengah = NULL, faktor_tengah = NULL, satuan_kecil = 'Lembar', faktor_tampilan = 200, satuan_distribusi = 'pack', satuan_po = 'pack'
WHERE nama = 'PLASTIK SUKA DRINK';

UPDATE public.bahan_baku_harga 
SET kemasan_qty = 200, kemasan_satuan = 'Lembar', harga_beli_display = 40000, harga_beli = 200
WHERE bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama = 'PLASTIK SUKA DRINK');

-- 10. PLASTIK VACUM (1 Pack = 100 Lembar)
UPDATE public.bahan_baku 
SET satuan = 'Pack', satuan_tengah = NULL, faktor_tengah = NULL, satuan_kecil = 'Lembar', faktor_tampilan = 100, satuan_distribusi = 'pack', satuan_po = 'pack'
WHERE nama = 'PLASTIK VACUM';

UPDATE public.bahan_baku_harga 
SET kemasan_qty = 100, kemasan_satuan = 'Lembar', harga_beli_display = 44000, harga_beli = 440
WHERE bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama = 'PLASTIK VACUM');

-- 11. SASA (1 Pack = 1 Kg = 1.000 Gram)
UPDATE public.bahan_baku 
SET satuan = 'Pack', satuan_tengah = NULL, faktor_tengah = NULL, satuan_kecil = 'Gram', faktor_tampilan = 1000, satuan_distribusi = 'pack', satuan_po = 'pack'
WHERE nama = 'SASA';

UPDATE public.bahan_baku_harga 
SET kemasan_qty = 1000, kemasan_satuan = 'Gram', harga_beli_display = 51000, harga_beli = 51
WHERE bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama = 'SASA');

-- 12. CLING WRAP (1 Roll = 30 cm x 3 meter = 300 cm)
UPDATE public.bahan_baku 
SET satuan = 'Roll', satuan_tengah = NULL, faktor_tengah = NULL, satuan_kecil = 'cm', faktor_tampilan = 300, faktor_konversi = 300, satuan_distribusi = 'roll', satuan_po = 'roll'
WHERE nama = 'Cling Wrap';

UPDATE public.bahan_baku_harga 
SET kemasan_qty = 300, kemasan_satuan = 'cm', harga_beli_display = 10135, harga_beli = 33.78
WHERE bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama = 'Cling Wrap');

-- 13. PAPER WRAP (1 Pack = 500 Lembar)
UPDATE public.bahan_baku 
SET satuan = 'Pack', satuan_tengah = NULL, faktor_tengah = NULL, satuan_kecil = 'Lembar', faktor_tampilan = 500, satuan_distribusi = 'pack', satuan_po = 'pack'
WHERE nama = 'PAPER WRAP';

UPDATE public.bahan_baku_harga 
SET kemasan_qty = 500, kemasan_satuan = 'Lembar', harga_beli_display = 92500, harga_beli = 185
WHERE bahan_baku_id = (SELECT id FROM public.bahan_baku WHERE nama = 'PAPER WRAP');

-- 3. Isi Satuan PO Vendor untuk Seluruh Sisa Bahan Baku Aktif
UPDATE public.bahan_baku SET satuan_po = 'kg' WHERE nama = 'AYAM' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'bal' WHERE nama = 'BAWANG' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'dus' WHERE nama = 'BAWANG PUTIH BUBUK' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'kg' WHERE nama = 'CENGKEH' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'pack' WHERE nama = 'CUP' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'pack' WHERE nama = 'TUTUP PACK' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'pack' WHERE nama = 'DUS PACKING' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'roll' WHERE nama = 'FOIL' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'bal' WHERE nama = 'GARAM' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'tabung' WHERE nama = 'GAS 3Kg' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'kg' WHERE nama = 'JINTEN' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'kg' WHERE nama = 'KAYU MANIS' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'dus' WHERE nama = 'KEJU' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'dus' WHERE nama = 'KENTANG' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'pack' WHERE nama = 'KULIT 25' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'pack' WHERE nama = 'KULIT 28' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'pack' WHERE nama = 'KULIT 32' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'dus' WHERE nama = 'KUNYIT' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'dus' WHERE nama = 'MAYONAISE' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'bungkus' WHERE nama = 'MIE' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'kompan' WHERE nama = 'MINYAK' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'pack' WHERE nama = 'PLASTIK 24' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'pack' WHERE nama = 'PLASTIK BESAR' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'roll' WHERE nama = 'PLASTIK VACUUM JUMBO' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'pack' WHERE nama = 'POLYBAG' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'kg' WHERE nama = 'POWDER JERUK' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'kg' WHERE nama = 'POWDER TEH' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'dus' WHERE nama = 'SAOS CABE' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'dus' WHERE nama = 'SAOS CABE POUCH' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'dus' WHERE nama = 'SAOS SAMYANG' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'dus' WHERE nama = 'SAOS TOMAT KOMPAN' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'dus' WHERE nama = 'SAOS TOMAT POUCH' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'blok' WHERE nama = 'SAPI' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'kg' WHERE nama = 'Sayur (lettuce)' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'kg' WHERE nama = 'TEPUNG' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'kg' WHERE nama = 'TUM' AND satuan_po IS NULL;
UPDATE public.bahan_baku SET satuan_po = 'bal' WHERE nama = 'ES BATU' AND satuan_po IS NULL;
