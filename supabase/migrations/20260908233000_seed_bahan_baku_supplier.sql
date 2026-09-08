-- 20260908233000_seed_bahan_baku_supplier.sql
-- Seed katalog dari dua sumber. Idempoten (ON CONFLICT DO NOTHING).
--
-- PENTING: harga_terima PO tersimpan dalam SATUAN BESAR, bukan satuan_po.
-- Jadi seed memakai satuan besar + faktor_tampilan. Memakai satuan_po di sini
-- akan menyalahkan harga FOIL 48x.

-- Sumber 1: riwayat PO (44 pasangan). Ambil PO terverifikasi TERAKHIR per pasangan.
WITH terakhir AS (
  SELECT DISTINCT ON (poi.bahan_baku_id, po.supplier_id)
         poi.bahan_baku_id,
         po.supplier_id,
         po.id                AS po_id,
         po.diverifikasi_at,
         COALESCE(poi.harga_terima, poi.harga_pesan, 0) AS harga
    FROM public.purchase_order_item poi
    JOIN public.purchase_order po ON po.id = poi.purchase_order_id
   WHERE po.supplier_id IS NOT NULL
   ORDER BY poi.bahan_baku_id, po.supplier_id,
            po.diverifikasi_at DESC NULLS LAST, po.tanggal_po DESC
)
INSERT INTO public.bahan_baku_supplier (
  bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil,
  harga, sumber, perlu_ditinjau, ref_po_id, harga_updated_at
)
SELECT t.bahan_baku_id,
       t.supplier_id,
       COALESCE(NULLIF(btrim(b.satuan), ''), 'Unit'),
       CASE WHEN NULLIF(btrim(COALESCE(b.satuan_kecil, '')), '') IS NULL
                 OR btrim(COALESCE(b.satuan_kecil, '')) = '-'
            THEN 1
            ELSE COALESCE(NULLIF(b.faktor_tampilan, 0), 1)
       END,
       -- Harga hanya disimpan bila PO-nya diverifikasi SETELAH guard salah-satuan.
       -- Sebelum itu basis satuannya campur, DAN definisi satuan besar bahan bisa
       -- sudah berubah sejak PO tsb (FOIL Roll->Dus, 8 Sep 2026) sehingga angkanya
       -- salah skala. Angka aslinya tidak hilang: ref_po_id menunjuk ke PO-nya.
       CASE WHEN t.diverifikasi_at IS NOT NULL
                 AND t.diverifikasi_at >= TIMESTAMPTZ '2026-09-04 00:00:00+07'
            THEN t.harga ELSE 0 END,
       'po',
       -- Hanya PO yang diverifikasi SETELAH guard salah-satuan yang dipercaya
       (t.diverifikasi_at IS NULL OR t.diverifikasi_at < TIMESTAMPTZ '2026-09-04 00:00:00+07'),
       t.po_id,
       t.diverifikasi_at
  FROM terakhir t
  JOIN public.bahan_baku b ON b.id = t.bahan_baku_id
 WHERE b.is_active
ON CONFLICT (bahan_baku_id, supplier_id) DO NOTHING;

-- Sumber 2: supplier.bahan_baku_ids yang belum punya jejak PO.
-- Tidak ada harga yang bisa dipercaya -> harga 0, wajib ditinjau.
INSERT INTO public.bahan_baku_supplier (
  bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil,
  harga, sumber, perlu_ditinjau
)
SELECT b.id,
       s.id,
       COALESCE(NULLIF(btrim(b.satuan), ''), 'Unit'),
       CASE WHEN NULLIF(btrim(COALESCE(b.satuan_kecil, '')), '') IS NULL
                 OR btrim(COALESCE(b.satuan_kecil, '')) = '-'
            THEN 1
            ELSE COALESCE(NULLIF(b.faktor_tampilan, 0), 1)
       END,
       0,
       'manual',
       true
  FROM public.supplier s
  CROSS JOIN LATERAL unnest(COALESCE(s.bahan_baku_ids, '{}'::uuid[])) AS bb(id)
  JOIN public.bahan_baku b ON b.id = bb.id
 WHERE b.is_active
ON CONFLICT (bahan_baku_id, supplier_id) DO NOTHING;

-- DOWN:
-- DELETE FROM public.bahan_baku_supplier_history;
-- DELETE FROM public.bahan_baku_supplier;
