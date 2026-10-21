-- =============================================================================
-- 20261021120000_resep_reguler_ikut_kartu.sql
-- =============================================================================
-- Sumber: kartu HPP "AYAM REGULAR" dan "SAPI REGULAR" (dikirim owner 2026-10-21).
-- Keputusan owner 2026-10-21:
--   1. Resep Original Ayam Reguler & Original Sapi Reguler ikut kartu:
--      tambah sayur (lettuce) 20 g (Ayam) / 25 g (Sapi); kemasan diganti dari
--      FOIL 5M 35 cm + PLASTIK MERAH 1 + PAPER WRAP 1 menjadi PLASTIK VACUM
--      1 lembar + DUS PACKING 1 pcs. Isi lain (daging, kentang, saos cabe,
--      saos tomat, mayonaise, TUM, kulit 25) sudah sama dengan kartu.
--   2. Gas di kartu (50 g) TIDAK dimasukkan: gas sudah dikeluarkan dari BOM
--      (20261021100000).
--   3. Plastik vacuum = PLASTIK VACUM 1 lembar. Kartu menulis Rp 1.287, harga
--      master sekarang Rp 440/lembar; HPP menu tidak dihitung dari resep.
--      Dus box = DUS PACKING 1 pcs (Rp 1.085, sama dengan kartu).
--   4. Menu BOGO (Original Ayam/Sapi Reguler (BOGO)) ikut sama persis dengan
--      menu Reguler pasangannya.
--   5. Original Mix Reguler (tidak ada kartunya): kemasan ikut, sayur 25 g.
--
-- Catatan stok: per 2026-10-21 DUS PACKING belum pernah dikirim ke outlet, dan
-- PLASTIK VACUM hanya ada di BNR. Potongan tipe 'pemakaian' boleh membuat saldo
-- minus (lihat ledger_stamp_saldo), jadi order tidak gagal, tetapi saldo outlet
-- akan minus sampai Gudang Pusat mengirim kedua bahan itu.
--
-- Setiap baris memeriksa nilai lama: kalau resep sudah berubah sejak dicek,
-- migration gagal dan tidak ada yang tertulis. Berlaku ke depan saja, ledger
-- historis tidak disentuh.
-- =============================================================================
BEGIN;

CREATE TEMP TABLE _resep_reg (resep_id uuid, menu text, sayur numeric) ON COMMIT DROP;
INSERT INTO _resep_reg VALUES
  ('f283a2f2-4346-4593-a095-e2b852f513a9', 'Original Ayam Reguler',        20),
  ('e6b92d8b-a30c-4c0e-866f-85152da0b566', 'Original Ayam Reguler (BOGO)', 20),
  ('678d9326-2c91-491e-964b-c4b96b9ba0c1', 'Original Sapi Reguler',        25),
  ('2af377c7-0b60-4825-a966-87932d322261', 'Original Sapi Reguler (BOGO)', 25),
  ('828f4938-1221-4138-921b-ea68e1b9d7eb', 'Original Mix Reguler',         25);

DO $$
DECLARE v_n int;
BEGIN
  -- Resep yang dirujuk harus resep global aktif milik menu yang namanya cocok.
  SELECT count(*) INTO v_n
    FROM _resep_reg g
    JOIN public.resep r ON r.id = g.resep_id AND r.is_active AND r.scope = 'global'
    JOIN public.menu_items m ON m.id::text = r.menu_item_ref AND m.name = g.menu;
  IF v_n <> 5 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: resep global yang cocok = % (harap 5)', v_n;
  END IF;

  -- Kemasan lama keluar: FOIL 5M 35 cm, PLASTIK MERAH 1, PAPER WRAP 1 di tiap resep.
  DELETE FROM public.resep_item ri
   USING public.bahan_baku b, _resep_reg g
   WHERE ri.bahan_baku_id = b.id
     AND ri.resep_id = g.resep_id
     AND ((b.nama = 'FOIL 5M' AND ri.qty_per_porsi = 35)
       OR (b.nama IN ('PLASTIK MERAH', 'PAPER WRAP') AND ri.qty_per_porsi = 1));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 15 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: baris kemasan lama yang dibuang = % (harap 15)', v_n;
  END IF;

  -- Bahan baru: sayur, PLASTIK VACUM, DUS PACKING (belum ada di resep mana pun dari kelima ini).
  IF EXISTS (SELECT 1 FROM public.resep_item ri
               JOIN public.bahan_baku b ON b.id = ri.bahan_baku_id
               JOIN _resep_reg g ON g.resep_id = ri.resep_id
              WHERE b.nama IN ('Sayur (lettuce)', 'PLASTIK VACUM', 'DUS PACKING')) THEN
    RAISE EXCEPTION 'ASERSI GAGAL: resep Reguler sudah punya sayur/plastik vacum/dus packing';
  END IF;
  INSERT INTO public.resep_item (resep_id, bahan_baku_id, qty_per_porsi, satuan)
  SELECT g.resep_id, b.id, x.qty, x.satuan
    FROM _resep_reg g
   CROSS JOIN LATERAL (VALUES ('Sayur (lettuce)', g.sayur, 'gram'),
                              ('PLASTIK VACUM',   1::numeric, 'lembar'),
                              ('DUS PACKING',     1::numeric, 'pcs')) x(bahan, qty, satuan)
    JOIN public.bahan_baku b ON b.nama = x.bahan AND b.is_active;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 15 THEN
    RAISE EXCEPTION 'ASERSI GAGAL: baris bahan baru yang ditambah = % (harap 15)', v_n;
  END IF;

  -- BOGO identik dengan menu Reguler pasangannya.
  IF EXISTS (
    SELECT 1
      FROM (VALUES ('e6b92d8b-a30c-4c0e-866f-85152da0b566'::uuid, 'f283a2f2-4346-4593-a095-e2b852f513a9'::uuid),
                   ('2af377c7-0b60-4825-a966-87932d322261'::uuid, '678d9326-2c91-491e-964b-c4b96b9ba0c1'::uuid)) p(bogo, reg)
     CROSS JOIN LATERAL (
       (SELECT bahan_baku_id, qty_per_porsi FROM public.resep_item WHERE resep_id = p.bogo
        EXCEPT SELECT bahan_baku_id, qty_per_porsi FROM public.resep_item WHERE resep_id = p.reg)
       UNION ALL
       (SELECT bahan_baku_id, qty_per_porsi FROM public.resep_item WHERE resep_id = p.reg
        EXCEPT SELECT bahan_baku_id, qty_per_porsi FROM public.resep_item WHERE resep_id = p.bogo)
     ) beda
  ) THEN
    RAISE EXCEPTION 'ASERSI GAGAL: resep BOGO belum identik dengan menu Reguler pasangannya';
  END IF;
END $$;

COMMIT;
