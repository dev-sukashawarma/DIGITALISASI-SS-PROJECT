-- =============================================================================
-- Ceklist Harian: Online Review jadi isian bebas + foto Temuan & Perbaikan
-- =============================================================================
--
-- Permintaan pemilik produk (24 Sep 2026):
--   1. Online Review tidak lagi dinilai baik/perhatian/buruk. Isinya baris teks
--      bebas seperti Perbaikan, mis. "Google Maps : belum ada ulasan terbaru".
--      Disimpan di kolom baru ceklist_harian.online_review (TEXT[]).
--   2. Temuan dan Perbaikan boleh dilampiri foto, 0..3 masing-masing.
--   3. Online Review juga boleh berfoto 0..3 (tangkapan layar ulasan).
--
-- Penilaian item `online_review` dari migrasi 20300239000000 tetap DITERIMA
-- constraint-nya supaya baris lama tidak rusak, tetapi RPC tidak lagi menerima
-- item baru untuk kategori itu.
--
-- Tanda tangan RPC berubah (parameter p_online_review ditambahkan), jadi fungsi
-- lama DI-DROP dulu — membiarkan dua versi berdampingan membuat PostgREST
-- bingung memilih overload. Parameter baru ber-DEFAULT, jadi pemanggil yang
-- belum mengirimnya tetap jalan.
-- Idempoten.
-- =============================================================================

set local lock_timeout = '5s';

ALTER TABLE public.ceklist_harian
  ADD COLUMN IF NOT EXISTS online_review TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.ceklist_harian_foto DROP CONSTRAINT IF EXISTS ceklist_harian_foto_kategori_check;
ALTER TABLE public.ceklist_harian_foto ADD CONSTRAINT ceklist_harian_foto_kategori_check
  CHECK (kategori IN (
    'kebersihan', 'stok', 'seragam_crew', 'rasa', 'peralatan',
    'online_review', 'temuan', 'perbaikan'
  ));

DROP FUNCTION IF EXISTS public.submit_ceklist_harian(UUID, JSONB, JSONB, TEXT[], TEXT[], TEXT);

CREATE OR REPLACE FUNCTION public.submit_ceklist_harian(
  p_outlet_id UUID,
  p_items JSONB,
  p_foto JSONB,
  p_temuan TEXT[],
  p_perbaikan TEXT[],
  p_catatan TEXT,
  p_online_review TEXT[] DEFAULT '{}'
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

  -- Tepat sembilan penilaian wajib, tidak kembar, bernilai sah.
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Penilaian ceklist belum lengkap';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_items) AS r(kategori TEXT, sub_item TEXT, nilai TEXT)
    WHERE r.nilai IS NULL OR r.nilai NOT IN ('baik', 'perhatian', 'buruk')
      OR (r.kategori, COALESCE(r.sub_item, '')) NOT IN (
        ('kebersihan', ''), ('stok', ''), ('seragam_crew', ''), ('peralatan', ''),
        ('rasa', 'sapi'), ('rasa', 'ayam'), ('rasa', 'kentang'), ('rasa', 'tum'), ('rasa', 'sayur')
      )
  ) OR (
    SELECT count(*) <> 9 OR count(DISTINCT (r.kategori, COALESCE(r.sub_item, ''))) <> 9
    FROM jsonb_to_recordset(p_items) AS r(kategori TEXT, sub_item TEXT)
  ) THEN
    RAISE EXCEPTION 'Penilaian ceklist belum lengkap';
  END IF;

  -- Foto: lima kategori penilaian 1..3; Online Review, Temuan, Perbaikan 0..3.
  IF jsonb_typeof(p_foto) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Foto ceklist belum lengkap';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_foto) AS f(kategori TEXT, path TEXT)
    WHERE f.path IS NULL OR f.path NOT LIKE v_user::text || '/%'
  ) THEN
    RAISE EXCEPTION 'Path foto ceklist tidak valid';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'kebersihan', 'stok', 'seragam_crew', 'rasa', 'peralatan',
      'online_review', 'temuan', 'perbaikan'
    ]) AS k(kategori)
    LEFT JOIN jsonb_to_recordset(p_foto) AS f(kategori TEXT, path TEXT) ON f.kategori = k.kategori
    GROUP BY k.kategori
    HAVING count(f.path) > 3
        OR (k.kategori NOT IN ('online_review', 'temuan', 'perbaikan') AND count(f.path) < 1)
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
    INSERT INTO public.ceklist_harian
      (outlet_id, submitted_by, nama_am, tanggal, temuan, perbaikan, online_review, catatan)
    VALUES (
      p_outlet_id, v_user, v_nama, v_tanggal,
      COALESCE((SELECT array_agg(btrim(t)) FROM unnest(p_temuan) t WHERE btrim(t) <> ''), '{}'),
      COALESCE((SELECT array_agg(btrim(t)) FROM unnest(p_perbaikan) t WHERE btrim(t) <> ''), '{}'),
      COALESCE((SELECT array_agg(btrim(t)) FROM unnest(p_online_review) t WHERE btrim(t) <> ''), '{}'),
      NULLIF(btrim(p_catatan), '')
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.ceklist_harian SET
      nama_am = v_nama,
      temuan = COALESCE((SELECT array_agg(btrim(t)) FROM unnest(p_temuan) t WHERE btrim(t) <> ''), '{}'),
      perbaikan = COALESCE((SELECT array_agg(btrim(t)) FROM unnest(p_perbaikan) t WHERE btrim(t) <> ''), '{}'),
      online_review = COALESCE((SELECT array_agg(btrim(t)) FROM unnest(p_online_review) t WHERE btrim(t) <> ''), '{}'),
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

REVOKE ALL ON FUNCTION public.submit_ceklist_harian(UUID, JSONB, JSONB, TEXT[], TEXT[], TEXT, TEXT[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_ceklist_harian(UUID, JSONB, JSONB, TEXT[], TEXT[], TEXT, TEXT[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_ceklist_harian(UUID, JSONB, JSONB, TEXT[], TEXT[], TEXT, TEXT[]) TO authenticated;

-- PostgREST perlu memuat ulang cache skemanya untuk melihat tanda tangan baru.
NOTIFY pgrst, 'reload schema';
