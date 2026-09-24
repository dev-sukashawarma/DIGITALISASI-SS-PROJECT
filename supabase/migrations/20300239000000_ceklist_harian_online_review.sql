-- =============================================================================
-- Ceklist Harian: kategori opsional "Online Review"
-- =============================================================================
--
-- Menambah kategori `online_review` dengan sub-item `google_maps` (mis. "belum ada
-- ulasan terbaru"). Berbeda dengan lima kategori lain, kategori ini OPSIONAL:
--   - penilaiannya boleh tidak dikirim sama sekali;
--   - fotonya 0..3 (lima kategori wajib tetap 1..3).
--
-- Struktur sub-item dibiarkan terbuka supaya ulasan platform lain (GoFood,
-- GrabFood, ShopeeFood) cukup ditambah ke daftar di constraint & RPC ini.
-- Idempoten.
-- =============================================================================

set local lock_timeout = '5s';

ALTER TABLE public.ceklist_harian_item DROP CONSTRAINT IF EXISTS ceklist_harian_item_kategori_check;
ALTER TABLE public.ceklist_harian_item ADD CONSTRAINT ceklist_harian_item_kategori_check
  CHECK (kategori IN ('kebersihan', 'stok', 'seragam_crew', 'rasa', 'peralatan', 'online_review'));

ALTER TABLE public.ceklist_harian_item DROP CONSTRAINT IF EXISTS ceklist_harian_item_check;
ALTER TABLE public.ceklist_harian_item ADD CONSTRAINT ceklist_harian_item_check
  CHECK (
    (kategori = 'rasa' AND sub_item IN ('sapi', 'ayam', 'kentang', 'tum', 'sayur'))
    OR (kategori = 'online_review' AND sub_item IN ('google_maps'))
    OR (kategori NOT IN ('rasa', 'online_review') AND sub_item = '')
  );

ALTER TABLE public.ceklist_harian_foto DROP CONSTRAINT IF EXISTS ceklist_harian_foto_kategori_check;
ALTER TABLE public.ceklist_harian_foto ADD CONSTRAINT ceklist_harian_foto_kategori_check
  CHECK (kategori IN ('kebersihan', 'stok', 'seragam_crew', 'rasa', 'peralatan', 'online_review'));

-- -----------------------------------------------------------------------------
-- submit_ceklist_harian: sembilan penilaian wajib + penilaian opsional.
-- Tanda tangan fungsi TIDAK berubah, jadi klien lama tetap jalan.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_ceklist_harian(
  p_outlet_id UUID,
  p_items JSONB,
  p_foto JSONB,
  p_temuan TEXT[],
  p_perbaikan TEXT[],
  p_catatan TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_role TEXT;
  v_nama TEXT;
  v_tanggal DATE := (NOW() AT TIME ZONE 'Asia/Jakarta')::date;
  v_id UUID;
  v_pemilik UUID;
  v_nama_pemilik TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sesi login tidak ditemukan';
  END IF;

  SELECT role, COALESCE(NULLIF(display_name, ''), name, '')
    INTO v_role, v_nama
    FROM public.outlet_staff WHERE id = v_user;
  IF v_role IS DISTINCT FROM 'area_manager' THEN
    RAISE EXCEPTION 'Hanya area manager yang boleh mengisi ceklist harian';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.accessible_outlet_ids() AS a(id) WHERE a.id = p_outlet_id) THEN
    RAISE EXCEPTION 'Outlet di luar scope akses Anda';
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Penilaian ceklist belum lengkap';
  END IF;

  -- Setiap baris harus pasangan yang dikenal, bernilai sah, dan tidak kembar.
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_items) AS r(kategori TEXT, sub_item TEXT, nilai TEXT)
    WHERE r.nilai IS NULL OR r.nilai NOT IN ('baik', 'perhatian', 'buruk')
      OR (r.kategori, COALESCE(r.sub_item, '')) NOT IN (
        ('kebersihan', ''), ('stok', ''), ('seragam_crew', ''), ('peralatan', ''),
        ('rasa', 'sapi'), ('rasa', 'ayam'), ('rasa', 'kentang'), ('rasa', 'tum'), ('rasa', 'sayur'),
        ('online_review', 'google_maps')
      )
  ) OR (
    SELECT count(*) <> count(DISTINCT (r.kategori, COALESCE(r.sub_item, '')))
    FROM jsonb_to_recordset(p_items) AS r(kategori TEXT, sub_item TEXT)
  ) THEN
    RAISE EXCEPTION 'Penilaian ceklist belum lengkap';
  END IF;

  -- Sembilan penilaian wajib semuanya ada.
  IF (
    SELECT count(DISTINCT (r.kategori, COALESCE(r.sub_item, '')))
    FROM jsonb_to_recordset(p_items) AS r(kategori TEXT, sub_item TEXT)
    WHERE r.kategori <> 'online_review'
  ) <> 9 THEN
    RAISE EXCEPTION 'Penilaian ceklist belum lengkap';
  END IF;

  IF jsonb_typeof(p_foto) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Foto ceklist belum lengkap';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_foto) AS f(kategori TEXT, path TEXT)
    WHERE f.path IS NULL OR f.path NOT LIKE v_user::text || '/%'
  ) THEN
    RAISE EXCEPTION 'Path foto ceklist tidak valid';
  END IF;
  -- Kategori wajib: 1..3 foto. Online review: 0..3 foto.
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY['kebersihan', 'stok', 'seragam_crew', 'rasa', 'peralatan', 'online_review']) AS k(kategori)
    LEFT JOIN jsonb_to_recordset(p_foto) AS f(kategori TEXT, path TEXT) ON f.kategori = k.kategori
    GROUP BY k.kategori
    HAVING count(f.path) > 3
        OR (k.kategori <> 'online_review' AND count(f.path) < 1)
  ) THEN
    RAISE EXCEPTION 'Foto ceklist belum lengkap';
  END IF;

  SELECT c.id, c.submitted_by, c.nama_am
    INTO v_id, v_pemilik, v_nama_pemilik
    FROM public.ceklist_harian c
    WHERE c.outlet_id = p_outlet_id AND c.tanggal = v_tanggal
    FOR UPDATE;

  IF v_id IS NOT NULL AND v_pemilik <> v_user THEN
    RAISE EXCEPTION 'Ceklist outlet ini hari ini sudah diisi oleh %', v_nama_pemilik;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.ceklist_harian (outlet_id, submitted_by, nama_am, tanggal, temuan, perbaikan, catatan)
    VALUES (
      p_outlet_id, v_user, v_nama, v_tanggal,
      COALESCE((SELECT array_agg(btrim(t)) FROM unnest(p_temuan) t WHERE btrim(t) <> ''), '{}'),
      COALESCE((SELECT array_agg(btrim(t)) FROM unnest(p_perbaikan) t WHERE btrim(t) <> ''), '{}'),
      NULLIF(btrim(p_catatan), '')
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.ceklist_harian SET
      nama_am = v_nama,
      temuan = COALESCE((SELECT array_agg(btrim(t)) FROM unnest(p_temuan) t WHERE btrim(t) <> ''), '{}'),
      perbaikan = COALESCE((SELECT array_agg(btrim(t)) FROM unnest(p_perbaikan) t WHERE btrim(t) <> ''), '{}'),
      catatan = NULLIF(btrim(p_catatan), ''),
      ditinjau_oleh = NULL,
      nama_peninjau = NULL,
      ditinjau_pada = NULL,
      tanggapan_rm = NULL,
      updated_at = NOW()
    WHERE id = v_id;
    DELETE FROM public.ceklist_harian_item WHERE ceklist_id = v_id;
    DELETE FROM public.ceklist_harian_foto WHERE ceklist_id = v_id;
  END IF;

  INSERT INTO public.ceklist_harian_item (ceklist_id, kategori, sub_item, nilai, keterangan)
  SELECT v_id, r.kategori, COALESCE(r.sub_item, ''), r.nilai, NULLIF(btrim(r.keterangan), '')
  FROM jsonb_to_recordset(p_items) AS r(kategori TEXT, sub_item TEXT, nilai TEXT, keterangan TEXT);

  INSERT INTO public.ceklist_harian_foto (ceklist_id, kategori, path, urutan)
  SELECT v_id, f.kategori, f.path, (row_number() OVER (PARTITION BY f.kategori))::int
  FROM jsonb_to_recordset(p_foto) AS f(kategori TEXT, path TEXT);

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_ceklist_harian(UUID, JSONB, JSONB, TEXT[], TEXT[], TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_ceklist_harian(UUID, JSONB, JSONB, TEXT[], TEXT[], TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_ceklist_harian(UUID, JSONB, JSONB, TEXT[], TEXT[], TEXT) TO authenticated;
