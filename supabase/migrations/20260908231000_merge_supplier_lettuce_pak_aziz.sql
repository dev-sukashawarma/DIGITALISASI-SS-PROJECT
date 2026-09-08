-- 20260908231000_merge_supplier_lettuce_pak_aziz.sql
-- Satu-satunya duplikat supplier tersisa per 8 Sep 2026. Tanpa ini, katalog
-- harga vendor pecah dua baris untuk vendor yang sama dan pembandingnya bohong.
--
-- Yang dipertahankan: c364abe8 (dibuat lebih dulu, punya 1 PO nyata).
-- Termin SENGAJA tidak diubah (30 vs 10 belum dikonfirmasi ke Pak Aziz).
-- Idempoten: tidak melakukan apa pun kalau baris kedua sudah tidak ada.

DO $$
DECLARE
  v_keep uuid := 'c364abe8-9b00-4b66-b7c1-15746c32b500';
  v_drop uuid := '6645d9b3-f3e9-45d6-a95b-a01de2941807';
  v_nama text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.supplier WHERE id = v_drop) THEN
    RAISE NOTICE 'Baris duplikat sudah tidak ada, lewati.';
    RETURN;
  END IF;

  SELECT nama INTO v_nama FROM public.supplier WHERE id = v_keep;
  IF v_nama IS NULL THEN
    RAISE EXCEPTION 'Baris yang dipertahankan (%) tidak ditemukan — hentikan.', v_keep;
  END IF;

  -- Pindahkan PO (jumlahnya 0 saat plan ditulis; tetap ditulis agar aman)
  UPDATE public.purchase_order
     SET supplier_id = v_keep, supplier_nama = v_nama
   WHERE supplier_id = v_drop;

  -- Satukan daftar bahan tanpa duplikat
  UPDATE public.supplier k
     SET bahan_baku_ids = (
           SELECT coalesce(array_agg(DISTINCT x), '{}'::uuid[])
             FROM unnest(coalesce(k.bahan_baku_ids, '{}'::uuid[])
                      || coalesce(d.bahan_baku_ids, '{}'::uuid[])) AS x
         )
    FROM public.supplier d
   WHERE k.id = v_keep AND d.id = v_drop;

  DELETE FROM public.supplier WHERE id = v_drop;
END $$;

-- DOWN: tidak ada. Penggabungan data tidak dibalik otomatis; pulihkan dari backup.
