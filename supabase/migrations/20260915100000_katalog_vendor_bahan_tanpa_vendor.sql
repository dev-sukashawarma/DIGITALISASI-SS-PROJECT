-- 20260915100000_katalog_vendor_bahan_tanpa_vendor.sql
--
-- Vendor untuk bahan yang tampil "Belum tercatat" di laporan Kiriman per Vendor
-- (spec 2026-09-14). Data dari owner 2026-09-15:
--   HAND GLOVE    -> Shopee - SMA_ACC            (supplier baru)
--   KERTAS STRUK  -> Shopee - Kertas Thermal 99  (supplier baru)
--   PAPER WRAP    -> Seven Pack                  (supplier baru)
--   SAOS CABE     -> Indoboga Utama              (sudah ada)
--   TUTUP PACK    -> MR OFFICIAL ID              (sudah ada; "pack" = CUP, sudah tercatat)
--   TUM           -> diracik sendiri, TANPA vendor (sengaja tidak ditambahkan)
--
-- satuan_beli / isi_satuan_kecil = satuan_po / faktor_po master, supaya penjaga
-- isi kemasan saat terima PO (trg_cek_isi_kemasan_vendor) tidak menolak.
-- Harga belum diketahui -> 0 + perlu_ditinjau (aturan katalog: jangan mengarang
-- harga; layar tidak boleh merender 0 sebagai harga).
-- Setelah ini tiap bahan tepat SATU vendor -> bukan multi-vendor, penjaga saldo
-- vendor Gudang Pusat tidak ikut aktif (diasersikan di bawah).

SET lock_timeout = '5s';

DO $$
DECLARE r record; v_bahan uuid; v_sup uuid; v_po text; v_faktor numeric;
BEGIN
  -- Supplier baru (idempoten per nama)
  INSERT INTO public.supplier (nama)
  SELECT n FROM unnest(ARRAY['Shopee - SMA_ACC', 'Shopee - Kertas Thermal 99', 'Seven Pack']) AS n
   WHERE NOT EXISTS (SELECT 1 FROM public.supplier s WHERE s.nama = n);

  FOR r IN SELECT * FROM (VALUES
    ('HAND GLOVE',   'Shopee - SMA_ACC'),
    ('KERTAS STRUK', 'Shopee - Kertas Thermal 99'),
    ('PAPER WRAP',   'Seven Pack'),
    ('SAOS CABE',    'Indoboga Utama'),
    ('TUTUP PACK',   'MR OFFICIAL ID')
  ) AS t(bahan, vendor)
  LOOP
    SELECT id, lower(satuan_po), faktor_po INTO v_bahan, v_po, v_faktor
      FROM public.bahan_baku WHERE nama = r.bahan AND is_active;
    SELECT id INTO v_sup FROM public.supplier WHERE nama = r.vendor AND COALESCE(is_active, true);
    IF v_bahan IS NULL OR v_sup IS NULL THEN
      RAISE EXCEPTION 'Bahan % atau vendor % tidak ditemukan', r.bahan, r.vendor;
    END IF;
    IF v_po IS NULL OR COALESCE(v_faktor, 0) <= 0 THEN
      RAISE EXCEPTION 'satuan_po/faktor_po % kosong', r.bahan;
    END IF;

    INSERT INTO public.bahan_baku_supplier
      (bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga, perlu_ditinjau, sumber)
    VALUES (v_bahan, v_sup, v_po, v_faktor, 0, true, 'manual')
    ON CONFLICT (bahan_baku_id, supplier_id) DO UPDATE SET is_active = true;

    -- Daftar lama supplier.bahan_baku_ids tetap diselaraskan (masih dibaca form PO).
    UPDATE public.supplier SET bahan_baku_ids = array_append(COALESCE(bahan_baku_ids, '{}'), v_bahan)
     WHERE id = v_sup AND NOT (v_bahan = ANY (COALESCE(bahan_baku_ids, '{}')));

    IF (SELECT count(*) FROM public.vendor_bahan(v_bahan)) <> 1 THEN
      RAISE EXCEPTION '% kini punya % vendor induk, bukan 1 -- akan mengaktifkan penjaga multi-vendor',
        r.bahan, (SELECT count(*) FROM public.vendor_bahan(v_bahan));
    END IF;
  END LOOP;
END $$;

-- DOWN:
-- DELETE FROM public.bahan_baku_supplier bs USING public.bahan_baku b, public.supplier s
--  WHERE bs.bahan_baku_id=b.id AND bs.supplier_id=s.id AND bs.sumber='manual' AND bs.harga=0
--    AND (b.nama, s.nama) IN (('HAND GLOVE','Shopee - SMA_ACC'),('KERTAS STRUK','Shopee - Kertas Thermal 99'),
--        ('PAPER WRAP','Seven Pack'),('SAOS CABE','Indoboga Utama'),('TUTUP PACK','MR OFFICIAL ID'));
