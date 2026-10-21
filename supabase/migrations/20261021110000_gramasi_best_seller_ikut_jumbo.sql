-- =============================================================================
-- 20261021110000_gramasi_best_seller_ikut_jumbo.sql
-- =============================================================================
-- Keputusan owner 2026-10-21: Best Seller 2 dan Best Seller (Mix Jumbo) ikut
-- gramasi menu Jumbo dari "HPP GRAND NEW (Sedang-Besar-Jumbo).xlsx" tab GRAMASI
-- CREW, mulai 21 Okt. Isi kedua menu sama persis dengan Original Sapi Jumbo dan
-- Original Mix Jumbo; gramasi menu Jumbo sudah diubah 20261021100000.
--
-- Per resep: lettuce 80 -> 90 g, TUM 20 -> 30 g, mayonaise 60 -> 35 g.
-- Daging, kentang, saos tetap (sudah sama dengan Jumbo). GAS sudah dibuang
-- 20261021100000.
--
-- Setiap baris memeriksa nilai lama; kalau resep sudah berubah, migration gagal
-- dan tidak ada yang tertulis. Berlaku ke depan saja, ledger historis tak
-- disentuh.
-- =============================================================================
BEGIN;

DO $$
DECLARE v_n int;
BEGIN
  UPDATE public.resep_item ri
     SET qty_per_porsi = g.qty_baru
    FROM (VALUES
      ('f1cd9839-713a-4838-9e85-7684888e45dd'::uuid, 'Sayur (lettuce)', 80, 90),
      ('f1cd9839-713a-4838-9e85-7684888e45dd'::uuid, 'TUM',             20, 30),
      ('f1cd9839-713a-4838-9e85-7684888e45dd'::uuid, 'MAYONAISE',       60, 35),
      ('0c4b66dd-9d2d-4608-be85-7a1c1c3a7121'::uuid, 'Sayur (lettuce)', 80, 90),
      ('0c4b66dd-9d2d-4608-be85-7a1c1c3a7121'::uuid, 'TUM',             20, 30),
      ('0c4b66dd-9d2d-4608-be85-7a1c1c3a7121'::uuid, 'MAYONAISE',       60, 35)
    ) AS g(resep_id, bahan, qty_lama, qty_baru)
    JOIN public.bahan_baku b ON b.nama = g.bahan AND b.is_active
    JOIN public.resep r ON r.id = g.resep_id AND r.is_active AND r.scope = 'global'
   WHERE ri.resep_id = g.resep_id
     AND ri.bahan_baku_id = b.id
     AND ri.qty_per_porsi = g.qty_lama;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 6 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: baris resep Best Seller yang diubah = % (harap 6)', v_n;
  END IF;

  -- Isi makanan Best Seller kini identik dengan menu Jumbo pasangannya.
  IF EXISTS (
    SELECT 1
      FROM (VALUES ('f1cd9839-713a-4838-9e85-7684888e45dd'::uuid, 'e3dca54f-36df-47b1-a321-28f465f12534'::uuid),
                   ('0c4b66dd-9d2d-4608-be85-7a1c1c3a7121'::uuid, '60d1dc68-d010-4435-8417-07c36ea5a248'::uuid)) p(bs, jumbo)
     CROSS JOIN LATERAL (
       (SELECT bahan_baku_id, qty_per_porsi FROM public.resep_item WHERE resep_id = p.bs
        EXCEPT SELECT bahan_baku_id, qty_per_porsi FROM public.resep_item WHERE resep_id = p.jumbo)
       UNION ALL
       (SELECT bahan_baku_id, qty_per_porsi FROM public.resep_item WHERE resep_id = p.jumbo
        EXCEPT SELECT bahan_baku_id, qty_per_porsi FROM public.resep_item WHERE resep_id = p.bs)
     ) beda
  ) THEN
    RAISE EXCEPTION 'ASERSI GAGAL: resep Best Seller belum identik dengan menu Jumbo pasangannya';
  END IF;
END $$;

COMMIT;
