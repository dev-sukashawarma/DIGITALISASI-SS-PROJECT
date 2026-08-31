-- Standarkan freezer menjadi satu poin dengan opsi ukuran berbentuk teks.
-- Migrasi ini aman dijalankan setelah migrasi penggabungan freezer maupun
-- langsung pada database yang masih memiliki tiga item freezer lama.

DO $$
DECLARE
  v_freezer_id UUID;
BEGIN
  SELECT id INTO v_freezer_id
  FROM public.inventaris_master_items
  WHERE name = 'FREEZER 400L/600L/750L'
  LIMIT 1;

  IF v_freezer_id IS NULL THEN
    UPDATE public.inventaris_master_items
    SET name = 'FREEZER 400L/600L/750L',
        sort_order = 10,
        is_active = true
    WHERE name = 'FREEZER 300/600/750L'
    RETURNING id INTO v_freezer_id;
  END IF;

  IF v_freezer_id IS NULL THEN
    INSERT INTO public.inventaris_master_items
      (section, subsection, name, mode, target_qty, target_min, target_max, unit, sort_order, is_active)
    VALUES
      ('interior', 'Penyimpanan & Peralatan Besar', 'FREEZER 400L/600L/750L', 'quantity', 1, NULL, NULL, 'unit', 10, true)
    RETURNING id INTO v_freezer_id;
  END IF;

  -- Fallback untuk database yang belum menjalankan migrasi penggabungan.
  INSERT INTO public.inventaris_submission_items
    (submission_id, master_item_id, observed_qty, is_present, kondisi,
     status_penilaian, catatan, photo_path)
  SELECT
    old_items.submission_id,
    v_freezer_id,
    COALESCE(SUM(old_items.observed_qty), 0),
    NULL,
    CASE
      WHEN BOOL_OR(old_items.kondisi = 'rusak') THEN 'rusak'
      WHEN BOOL_OR(old_items.kondisi = 'perlu_perbaikan') THEN 'perlu_perbaikan'
      WHEN BOOL_OR(old_items.kondisi = 'tidak_ada') THEN 'tidak_ada'
      ELSE 'baik'
    END,
    CASE WHEN COALESCE(SUM(old_items.observed_qty), 0) >= 1 THEN 'sesuai' ELSE 'kurang' END,
    COALESCE(STRING_AGG(NULLIF(BTRIM(old_items.catatan), ''), ' | ' ORDER BY old_items.created_at), '')
      || CASE WHEN STRING_AGG(NULLIF(BTRIM(old_items.catatan), ''), ' | ' ORDER BY old_items.created_at) IS NOT NULL
        THEN ' | ' ELSE '' END
      || 'Ukuran freezer dikonsolidasikan; verifikasi ukuran 400L/600L/750L.',
    (ARRAY_AGG(old_items.photo_path ORDER BY old_items.created_at DESC))[1]
  FROM public.inventaris_submission_items old_items
  JOIN public.inventaris_master_items old_master ON old_master.id = old_items.master_item_id
  WHERE old_master.name IN ('FREEZER 300L', 'FREEZER 600L', 'FREEZER 750L')
    AND NOT EXISTS (
      SELECT 1
      FROM public.inventaris_submission_items existing
      WHERE existing.submission_id = old_items.submission_id
        AND existing.master_item_id = v_freezer_id
    )
  GROUP BY old_items.submission_id;

  DELETE FROM public.inventaris_submission_items old_items
  USING public.inventaris_master_items old_master
  WHERE old_items.master_item_id = old_master.id
    AND old_master.name IN ('FREEZER 300L', 'FREEZER 600L', 'FREEZER 750L');

  UPDATE public.inventaris_master_items
  SET is_active = false
  WHERE name IN ('FREEZER 300L', 'FREEZER 600L', 'FREEZER 750L');
END $$;
