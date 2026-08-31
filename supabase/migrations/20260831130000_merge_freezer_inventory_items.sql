-- Satukan tiga varian freezer menjadi satu poin inventaris.
-- Ukuran detail wajib ditulis AM pada catatan item freezer.

DO $$
DECLARE
  v_freezer_id UUID;
BEGIN
  INSERT INTO public.inventaris_master_items
    (section, subsection, name, mode, target_qty, target_min, target_max, unit, sort_order, is_active)
  VALUES
    ('interior', 'Penyimpanan & Peralatan Besar', 'FREEZER 300/600/750L', 'quantity', 1, NULL, NULL, 'unit', 10, true)
  ON CONFLICT (name) DO UPDATE SET
    section = EXCLUDED.section,
    subsection = EXCLUDED.subsection,
    mode = EXCLUDED.mode,
    target_qty = EXCLUDED.target_qty,
    target_min = EXCLUDED.target_min,
    target_max = EXCLUDED.target_max,
    unit = EXCLUDED.unit,
    sort_order = EXCLUDED.sort_order,
    is_active = true
  RETURNING id INTO v_freezer_id;

  -- Pindahkan data historis ke item gabungan jika outlet belum memiliki
  -- baris freezer gabungan pada submission tersebut.
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
      || 'Ukuran freezer dikonsolidasikan dari data lama; verifikasi ukuran 300L/600L/750L.' ,
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
