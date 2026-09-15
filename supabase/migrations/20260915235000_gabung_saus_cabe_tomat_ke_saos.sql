-- =============================================================================
-- 20260915235000_gabung_saus_cabe_tomat_ke_saos.sql
-- =============================================================================
-- Konfirmasi owner 2026-09-15 ("gramasi baru menggantikan yang lama").
--
-- Latar: 20260914130000_update_gramasi_racik_bom membuat bahan baru SAUS CABE &
-- SAUS TOMAT (satuan kg, tanpa harga, tanpa faktor konversi) dan menambahkannya
-- ke resep, tetapi hanya menghapus baris lama bernama "SAUS CABE/TOMAT" gabungan.
-- 14 resep offline (+14 salinan Voucher Pamulang) sebenarnya memakai SAOS CABE &
-- SAOS TOMAT POUCH — bahan yang benar-benar dikirim gudang — sehingga:
--   * 28 resep memotong saus DUA KALI (baris SAOS lama + baris SAUS hantu);
--   * baris SAUS dipotong dalam satuan kg per porsi (faktor 1) → dalam 2 hari
--     SAUS CABE −16.495 & SAUS TOMAT −36.685, 21 outlet minus semua;
--   * 11 resep Online hanya punya baris SAUS → saus sungguhan tak pernah dipotong;
--   * gramasi baru yang disetujui owner tidak pernah masuk HPP (harga SAUS = 0).
--   * trg_process_bom_stok TIDAK menyaring bahan_baku.is_active — menonaktifkan
--     SAUS TOMAT saja tidak menghentikan potongannya.
--
-- Tindakan (idempoten):
--   1. Resep yang punya baris SAOS dan SAUS sekaligus: qty SAOS ← qty SAUS
--      (gramasi baru menggantikan lama), lalu baris SAUS dihapus.
--   2. Resep yang hanya punya baris SAUS: bahan_baku_id dialihkan ke SAOS.
--   3. SAUS CABE & SAUS TOMAT dinonaktifkan + di-rename (BUKAN dihapus — ~2.000
--      baris ledger merujuknya, ON DELETE RESTRICT).
--   4. Baris ledger `pemakaian` hantu 14–15 Sep dibiarkan sebagai jejak audit;
--      tidak menyentuh saldo bahan lain.
-- =============================================================================
BEGIN;

DO $$
DECLARE
  v_saus_cabe  uuid; v_saus_tomat uuid;
  v_saos_cabe  uuid; v_saos_tomat uuid;
  v_n int; v_qty numeric;
BEGIN
  SELECT id INTO v_saus_cabe  FROM public.bahan_baku WHERE nama IN ('SAUS CABE',  'SAUS CABE (NONAKTIF, digabung ke SAOS CABE)');
  SELECT id INTO v_saus_tomat FROM public.bahan_baku WHERE nama IN ('SAUS TOMAT', 'SAUS TOMAT (NONAKTIF, digabung ke SAOS TOMAT POUCH)');
  SELECT id INTO v_saos_cabe  FROM public.bahan_baku WHERE nama = 'SAOS CABE';
  SELECT id INTO v_saos_tomat FROM public.bahan_baku WHERE nama = 'SAOS TOMAT POUCH';
  IF v_saus_cabe IS NULL OR v_saus_tomat IS NULL OR v_saos_cabe IS NULL OR v_saos_tomat IS NULL THEN
    RAISE EXCEPTION 'Fixture bahan tidak lengkap: saus_cabe=% saus_tomat=% saos_cabe=% saos_tomat=%',
      v_saus_cabe, v_saus_tomat, v_saos_cabe, v_saos_tomat;
  END IF;

  -- 1a. CABE: resep yang punya keduanya → qty SAOS ← qty SAUS, hapus SAUS
  UPDATE public.resep_item s SET qty_per_porsi = h.qty_per_porsi
    FROM public.resep_item h
   WHERE s.resep_id = h.resep_id AND s.bahan_baku_id = v_saos_cabe AND h.bahan_baku_id = v_saus_cabe
     AND s.qty_per_porsi IS DISTINCT FROM h.qty_per_porsi;
  DELETE FROM public.resep_item h
   WHERE h.bahan_baku_id = v_saus_cabe
     AND EXISTS (SELECT 1 FROM public.resep_item s WHERE s.resep_id = h.resep_id AND s.bahan_baku_id = v_saos_cabe);

  -- 1b. TOMAT: idem
  UPDATE public.resep_item s SET qty_per_porsi = h.qty_per_porsi
    FROM public.resep_item h
   WHERE s.resep_id = h.resep_id AND s.bahan_baku_id = v_saos_tomat AND h.bahan_baku_id = v_saus_tomat
     AND s.qty_per_porsi IS DISTINCT FROM h.qty_per_porsi;
  DELETE FROM public.resep_item h
   WHERE h.bahan_baku_id = v_saus_tomat
     AND EXISTS (SELECT 1 FROM public.resep_item s WHERE s.resep_id = h.resep_id AND s.bahan_baku_id = v_saos_tomat);

  -- 2. Resep yang hanya punya SAUS (11 resep Online) → alihkan bahannya
  UPDATE public.resep_item SET bahan_baku_id = v_saos_cabe  WHERE bahan_baku_id = v_saus_cabe;
  UPDATE public.resep_item SET bahan_baku_id = v_saos_tomat WHERE bahan_baku_id = v_saus_tomat;

  -- 3. Nonaktifkan + rename bahan hantu
  UPDATE public.bahan_baku SET is_active = false, nama = 'SAUS CABE (NONAKTIF, digabung ke SAOS CABE)'
   WHERE id = v_saus_cabe AND nama = 'SAUS CABE';
  UPDATE public.bahan_baku SET is_active = false, nama = 'SAUS TOMAT (NONAKTIF, digabung ke SAOS TOMAT POUCH)'
   WHERE id = v_saus_tomat AND nama = 'SAUS TOMAT';

  -- Asersi
  SELECT count(*) INTO v_n FROM public.resep_item WHERE bahan_baku_id IN (v_saus_cabe, v_saus_tomat);
  IF v_n <> 0 THEN RAISE EXCEPTION 'ASERSI GAGAL: masih % baris resep merujuk SAUS hantu', v_n; END IF;

  SELECT ri.qty_per_porsi INTO v_qty FROM public.resep_item ri JOIN public.resep r ON r.id = ri.resep_id
   WHERE r.nama = 'Shawarma Sapi Jumbo' AND r.scope = 'global' AND r.is_active AND ri.bahan_baku_id = v_saos_cabe;
  IF v_qty <> 35 THEN RAISE EXCEPTION 'ASERSI GAGAL: SAOS CABE Sapi Jumbo = % (harap 35)', v_qty; END IF;

  SELECT count(*) INTO v_n FROM public.resep r JOIN public.resep_item ri ON ri.resep_id = r.id
   WHERE r.nama LIKE '%Online%' AND r.is_active AND ri.bahan_baku_id = v_saos_cabe;
  IF v_n < 11 THEN RAISE EXCEPTION 'ASERSI GAGAL: resep Online ber-SAOS CABE = % (harap ≥ 11)', v_n; END IF;

  IF EXISTS (SELECT 1 FROM public.bahan_baku WHERE id IN (v_saus_cabe, v_saus_tomat) AND is_active) THEN
    RAISE EXCEPTION 'ASERSI GAGAL: bahan hantu masih aktif';
  END IF;
END $$;

COMMIT;
