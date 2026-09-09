-- 20260909160000_katalog_harga_foil_dua_vendor.sql
-- Isi harga FOIL untuk kedua vendor. Dikonfirmasi owner 9 September 2026:
--
--   Ekadharma  30cm x 7,6m = 760 cm  @ Rp 11.554 / roll  -> 15,2026 /cm
--   Altindo    30cm x 5m   = 500 cm  @ Rp  8.791 / roll  -> 17,5820 /cm
--
-- Lebar keduanya 30 cm, jadi barangnya sama -- satu bahan, dua baris katalog
-- dengan `isi_satuan_kecil` BERBEDA. Ini persis kasus yang membuat kolom itu
-- disimpan per (bahan, vendor) dan bukan diturunkan dari master.
--
-- Yang dibuktikan angka ini: harga per ROLL Altindo lebih murah (8.791 <
-- 11.554), tapi per CM ia 15,7% LEBIH MAHAL. Membandingkan per roll akan
-- memilih vendor yang salah. Itu alasan spec mewajibkan perbandingan per
-- satuan kecil.
--
-- Panjang roll Ekadharma dikuatkan ledger: PO/KITCHEN/20260831/0002,
-- 1.000 roll -> +760.000 cm (= 1.000 x 760).
--
-- perlu_ditinjau dilepas karena angkanya datang dari owner, bukan dari seed.
-- Idempoten.

UPDATE public.bahan_baku_supplier bs
   SET satuan_beli      = 'roll',
       isi_satuan_kecil = 760,
       harga            = 11554,
       perlu_ditinjau   = false,
       sumber           = 'manual',
       harga_updated_at = now()
  FROM public.bahan_baku b, public.supplier s
 WHERE b.id = bs.bahan_baku_id AND s.id = bs.supplier_id
   AND b.nama = 'FOIL' AND s.nama = 'Ekadharma International'
   AND (bs.harga IS DISTINCT FROM 11554 OR bs.isi_satuan_kecil IS DISTINCT FROM 760);

UPDATE public.bahan_baku_supplier bs
   SET satuan_beli      = 'roll',
       isi_satuan_kecil = 500,
       harga            = 8791,
       perlu_ditinjau   = false,
       sumber           = 'manual',
       harga_updated_at = now()
  FROM public.bahan_baku b, public.supplier s
 WHERE b.id = bs.bahan_baku_id AND s.id = bs.supplier_id
   AND b.nama = 'FOIL' AND s.nama = 'PT Altindo Mulia'
   AND (bs.harga IS DISTINCT FROM 8791 OR bs.isi_satuan_kecil IS DISTINCT FROM 500);

-- DOWN:
-- UPDATE public.bahan_baku_supplier bs SET harga = 0, perlu_ditinjau = true, sumber = 'po'
--   FROM public.bahan_baku b WHERE b.id = bs.bahan_baku_id AND b.nama = 'FOIL';
