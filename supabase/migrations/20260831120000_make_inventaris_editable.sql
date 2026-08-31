-- Inventaris aset adalah data master per outlet, bukan checklist harian.
-- Submission terakhir untuk outlet yang sama diperbarui oleh RPC yang sama.

ALTER TABLE public.inventaris_submissions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.inventaris_submissions
SET updated_at = created_at
WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventaris_submissions_outlet_updated
  ON public.inventaris_submissions(outlet_id, updated_at DESC, created_at DESC);

CREATE OR REPLACE FUNCTION public.submit_inventaris(
  p_submission_id UUID,
  p_outlet_id UUID,
  p_tanggal DATE,
  p_area_scores JSONB,
  p_notes TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_result UUID;
  v_existing_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sesi login tidak ditemukan';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.accessible_outlet_ids() AS allowed(id)
    WHERE allowed.id = p_outlet_id
  ) THEN
    RAISE EXCEPTION 'Outlet di luar scope akses Anda';
  END IF;
  IF jsonb_array_length(COALESCE(p_items, '[]'::jsonb)) <> (
    SELECT count(*) FROM public.inventaris_master_items WHERE is_active
  ) THEN
    RAISE EXCEPTION 'Detail inventaris belum lengkap';
  END IF;

  -- Gunakan record terbaru sebagai data aktif outlet. Ini membuat submit
  -- berikutnya menjadi update, bukan duplikasi data harian.
  SELECT id
  INTO v_existing_id
  FROM public.inventaris_submissions
  WHERE outlet_id = p_outlet_id
  ORDER BY updated_at DESC, created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb)) AS row(
      photo_path TEXT
    )
    WHERE row.photo_path IS NULL
      OR (
        row.photo_path NOT LIKE v_user::text || '/%'
        AND (
          v_existing_id IS NULL
          OR NOT EXISTS (
            SELECT 1
            FROM public.inventaris_submission_items old_item
            WHERE old_item.submission_id = v_existing_id
              AND old_item.photo_path = row.photo_path
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Path foto inventaris tidak valid';
  END IF;

  IF v_existing_id IS NULL THEN
    v_result := COALESCE(p_submission_id, gen_random_uuid());
    INSERT INTO public.inventaris_submissions
      (id, outlet_id, submitted_by, tanggal, status, area_scores, notes, updated_at)
    VALUES
      (v_result, p_outlet_id, v_user, COALESCE(p_tanggal, CURRENT_DATE), 'final',
       COALESCE(p_area_scores, '{}'::jsonb), p_notes, NOW());
  ELSE
    v_result := v_existing_id;
    UPDATE public.inventaris_submissions
    SET submitted_by = v_user,
        tanggal = COALESCE(p_tanggal, tanggal),
        status = 'final',
        area_scores = COALESCE(p_area_scores, '{}'::jsonb),
        notes = p_notes,
        updated_at = NOW()
    WHERE id = v_existing_id;

    DELETE FROM public.inventaris_submission_items
    WHERE submission_id = v_existing_id;
  END IF;

  INSERT INTO public.inventaris_submission_items
    (submission_id, master_item_id, observed_qty, is_present, kondisi,
     status_penilaian, catatan, photo_path)
  SELECT
    v_result,
    row.master_item_id,
    row.observed_qty,
    row.is_present,
    row.kondisi,
    row.status_penilaian,
    row.catatan,
    row.photo_path
  FROM jsonb_to_recordset(p_items) AS row(
    master_item_id UUID,
    observed_qty NUMERIC,
    is_present BOOLEAN,
    kondisi TEXT,
    status_penilaian TEXT,
    catatan TEXT,
    photo_path TEXT
  );

  RETURN v_result;
END;
$$;
