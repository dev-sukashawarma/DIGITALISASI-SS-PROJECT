-- Inventaris aset tetap outlet berdasarkan SS_Inventaris_Konfirmasi.pdf.
-- Terpisah dari bahan_baku/inventory_items karena ini adalah checklist aset,
-- bukan stok konsumsi atau opname bahan baku.

CREATE TABLE IF NOT EXISTS public.inventaris_master_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL CHECK (section IN ('interior', 'exterior', 'kamar_mandi', 'utilitas')),
  subsection TEXT NOT NULL,
  name TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL CHECK (mode IN ('quantity', 'presence', 'range')),
  target_qty NUMERIC CHECK (target_qty IS NULL OR target_qty >= 0),
  target_min NUMERIC CHECK (target_min IS NULL OR target_min >= 0),
  target_max NUMERIC CHECK (target_max IS NULL OR target_max >= target_min),
  unit TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (mode = 'quantity' AND target_qty IS NOT NULL AND target_min IS NULL AND target_max IS NULL)
    OR (mode = 'range' AND target_qty IS NULL AND target_min IS NOT NULL AND target_max IS NOT NULL)
    OR (mode = 'presence' AND target_qty IS NULL AND target_min IS NULL AND target_max IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.inventaris_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  submitted_by UUID NOT NULL REFERENCES public.outlet_staff(id) ON DELETE RESTRICT,
  tanggal DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')::date,
  status TEXT NOT NULL DEFAULT 'final' CHECK (status = 'final'),
  area_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (outlet_id, tanggal)
);

CREATE TABLE IF NOT EXISTS public.inventaris_submission_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.inventaris_submissions(id) ON DELETE RESTRICT,
  master_item_id UUID NOT NULL REFERENCES public.inventaris_master_items(id) ON DELETE RESTRICT,
  observed_qty NUMERIC CHECK (observed_qty IS NULL OR observed_qty >= 0),
  is_present BOOLEAN,
  kondisi TEXT NOT NULL CHECK (kondisi IN ('baik', 'perlu_perbaikan', 'rusak', 'tidak_ada')),
  status_penilaian TEXT NOT NULL CHECK (status_penilaian IN ('sesuai', 'kurang', 'tidak_ada', 'di_luar_target')),
  catatan TEXT,
  photo_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (submission_id, master_item_id),
  CHECK (
    (observed_qty IS NOT NULL OR is_present IS NOT NULL)
    AND char_length(photo_path) > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_inventaris_submissions_outlet_date
  ON public.inventaris_submissions(outlet_id, tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_inventaris_submission_items_submission
  ON public.inventaris_submission_items(submission_id);
CREATE INDEX IF NOT EXISTS idx_inventaris_master_items_sort
  ON public.inventaris_master_items(section, sort_order);

ALTER TABLE public.inventaris_master_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventaris_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventaris_submission_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventaris_master_read ON public.inventaris_master_items;
CREATE POLICY inventaris_master_read ON public.inventaris_master_items
  FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS inventaris_submission_read ON public.inventaris_submissions;
CREATE POLICY inventaris_submission_read ON public.inventaris_submissions
  FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT public.accessible_outlet_ids()));

DROP POLICY IF EXISTS inventaris_submission_insert ON public.inventaris_submissions;
CREATE POLICY inventaris_submission_insert ON public.inventaris_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    outlet_id IN (SELECT public.accessible_outlet_ids())
    AND submitted_by = auth.uid()
    AND status = 'final'
  );

DROP POLICY IF EXISTS inventaris_submission_item_read ON public.inventaris_submission_items;
CREATE POLICY inventaris_submission_item_read ON public.inventaris_submission_items
  FOR SELECT TO authenticated
  USING (submission_id IN (
    SELECT id FROM public.inventaris_submissions
    WHERE outlet_id IN (SELECT public.accessible_outlet_ids())
  ));

DROP POLICY IF EXISTS inventaris_submission_item_insert ON public.inventaris_submission_items;
CREATE POLICY inventaris_submission_item_insert ON public.inventaris_submission_items
  FOR INSERT TO authenticated
  WITH CHECK (submission_id IN (
    SELECT id FROM public.inventaris_submissions
    WHERE outlet_id IN (SELECT public.accessible_outlet_ids())
      AND submitted_by = auth.uid()
      AND status = 'final'
  ));

-- Satu transaksi untuk header + seluruh detail agar submission final tidak
-- pernah tersimpan setengah jika salah satu detail gagal.
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
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sesi login tidak ditemukan';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accessible_outlet_ids() AS allowed(id) WHERE allowed.id = p_outlet_id) THEN
    RAISE EXCEPTION 'Outlet di luar scope akses Anda';
  END IF;
  IF jsonb_array_length(COALESCE(p_items, '[]'::jsonb)) <> (SELECT count(*) FROM public.inventaris_master_items WHERE is_active) THEN
    RAISE EXCEPTION 'Detail inventaris belum lengkap';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb)) AS row(photo_path TEXT)
    WHERE row.photo_path IS NULL OR row.photo_path NOT LIKE v_user::text || '/%'
  ) THEN
    RAISE EXCEPTION 'Path foto inventaris tidak valid';
  END IF;

  INSERT INTO public.inventaris_submissions (id, outlet_id, submitted_by, tanggal, status, area_scores, notes)
  VALUES (p_submission_id, p_outlet_id, v_user, p_tanggal, 'final', COALESCE(p_area_scores, '{}'::jsonb), p_notes)
  RETURNING id INTO v_result;

  INSERT INTO public.inventaris_submission_items
    (submission_id, master_item_id, observed_qty, is_present, kondisi, status_penilaian, catatan, photo_path)
  SELECT
    p_submission_id,
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

REVOKE ALL ON FUNCTION public.submit_inventaris(UUID, UUID, DATE, JSONB, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_inventaris(UUID, UUID, DATE, JSONB, TEXT, JSONB) TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('inventaris-foto', 'inventaris-foto', false, 2097152, ARRAY['image/jpeg', 'image/jpg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS inventaris_photo_upload ON storage.objects;
CREATE POLICY inventaris_photo_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'inventaris-foto'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS inventaris_photo_read ON storage.objects;
CREATE POLICY inventaris_photo_read ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'inventaris-foto');

DROP POLICY IF EXISTS inventaris_photo_delete ON storage.objects;
CREATE POLICY inventaris_photo_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'inventaris-foto'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

-- Master checklist dari PDF. Item tanpa angka dicatat sebagai presence.
INSERT INTO public.inventaris_master_items
  (section, subsection, name, mode, target_qty, target_min, target_max, unit, sort_order)
VALUES
  ('interior', 'Penyimpanan & Peralatan Besar', 'FREEZER 300L', 'quantity', 1, NULL, NULL, 'unit', 10),
  ('interior', 'Penyimpanan & Peralatan Besar', 'FREEZER 600L', 'quantity', 1, NULL, NULL, 'unit', 11),
  ('interior', 'Penyimpanan & Peralatan Besar', 'FREEZER 750L', 'quantity', 1, NULL, NULL, 'unit', 12),
  ('interior', 'Penyimpanan & Peralatan Besar', 'BOX CONTAINER', 'quantity', 1, NULL, NULL, 'unit', 13),
  ('interior', 'Penyimpanan & Peralatan Besar', 'BLENDER', 'quantity', 1, NULL, NULL, 'unit', 14),
  ('interior', 'Penyimpanan & Peralatan Besar', 'TABUNG GAS', 'quantity', 10, NULL, NULL, 'tabung', 15),
  ('interior', 'Penyimpanan & Peralatan Besar', 'TEMPAT SAMPAH', 'quantity', 3, NULL, NULL, 'pcs', 16),
  ('interior', 'Penyimpanan & Peralatan Besar', 'JENGKOK (KURSI JONGKOK)', 'quantity', 2, NULL, NULL, 'pcs', 17),
  ('interior', 'Penyimpanan & Peralatan Besar', 'BILL HOLDER', 'quantity', 1, NULL, NULL, 'pcs', 18),
  ('interior', 'Penyimpanan & Peralatan Besar', 'CCTV INTERIOR', 'quantity', 2, NULL, NULL, 'unit', 19),
  ('interior', 'Penyimpanan & Peralatan Besar', 'LAMPU INTERIOR', 'quantity', 4, NULL, NULL, 'pcs', 20),
  ('interior', 'Penyimpanan & Peralatan Besar', 'EXHAUST FAN', 'quantity', 2, NULL, NULL, 'unit', 21),
  ('interior', 'Penyimpanan & Peralatan Besar', 'KIPAS ANGIN', 'quantity', 2, NULL, NULL, 'unit', 22),
  ('interior', 'Peralatan Digital & Kasir', 'HANDPHONE', 'quantity', 1, NULL, NULL, 'unit', 30),
  ('interior', 'Peralatan Digital & Kasir', 'TABLET', 'quantity', 1, NULL, NULL, 'unit', 31),
  ('interior', 'Peralatan Digital & Kasir', 'STAND TAB', 'quantity', 1, NULL, NULL, 'unit', 32),
  ('interior', 'Peralatan Digital & Kasir', 'PRINTER STRUK', 'quantity', 2, NULL, NULL, 'unit', 33),
  ('interior', 'Peralatan Digital & Kasir', 'CASH DRAWER', 'quantity', 1, NULL, NULL, 'unit', 34),
  ('interior', 'Peralatan Digital & Kasir', 'MESIN EDC', 'quantity', 1, NULL, NULL, 'unit', 35),
  ('interior', 'Peralatan Digital & Kasir', 'SOUND BOX PAWOON', 'quantity', 1, NULL, NULL, 'unit', 36),
  ('interior', 'Peralatan Masak & Wadah', 'STAINLESS TRAY FULL', 'quantity', 2, NULL, NULL, 'pcs', 40),
  ('interior', 'Peralatan Masak & Wadah', 'STAINLESS TRAY ½', 'quantity', 4, NULL, NULL, 'pcs', 41),
  ('interior', 'Peralatan Masak & Wadah', 'STAINLESS TRAY 1/4', 'quantity', 4, NULL, NULL, 'pcs', 42),
  ('interior', 'Peralatan Masak & Wadah', 'ALUMUNIUM TRAY', 'quantity', 2, NULL, NULL, 'pcs', 43),
  ('interior', 'Peralatan Masak & Wadah', 'STAINLESS BOWL', 'quantity', 1, NULL, NULL, 'pcs', 44),
  ('interior', 'Peralatan Masak & Wadah', 'TOPLES TUM', 'quantity', 3, NULL, NULL, 'pcs', 45),
  ('interior', 'Peralatan Masak & Wadah', 'TRAY PLASTIK ABU', 'quantity', 1, NULL, NULL, 'pcs', 46),
  ('interior', 'Peralatan Masak & Wadah', 'TRAY PLASTIK SARINGAN', 'quantity', 1, NULL, NULL, 'pcs', 47),
  ('interior', 'Peralatan Masak & Wadah', 'BOTOL SAUS', 'quantity', 6, NULL, NULL, 'pcs', 48),
  ('interior', 'Peralatan Masak & Wadah', 'BOTOL MAYO', 'quantity', 6, NULL, NULL, 'pcs', 49),
  ('interior', 'Peralatan Masak & Wadah', 'BOTOL TOMAT', 'quantity', 4, NULL, NULL, 'pcs', 50),
  ('interior', 'Peralatan Masak & Wadah', 'BOTOL SAMYANG', 'quantity', 1, NULL, NULL, 'pcs', 51),
  ('interior', 'Peralatan Masak & Wadah', 'SPATULA BAKAR', 'quantity', 4, NULL, NULL, 'pcs', 52),
  ('interior', 'Peralatan Masak & Wadah', 'SPATULA KULIT', 'quantity', 2, NULL, NULL, 'pcs', 53),
  ('interior', 'Peralatan Masak & Wadah', 'SERVICE TONG (JEPITAN)', 'quantity', 2, NULL, NULL, 'pcs', 54),
  ('interior', 'Peralatan Masak & Wadah', 'LADLE (SENDOK SAYUR)', 'quantity', 3, NULL, NULL, 'pcs', 55),
  ('interior', 'Peralatan Masak & Wadah', 'SARINGAN MINYAK', 'quantity', 2, NULL, NULL, 'pcs', 56),
  ('interior', 'Peralatan Masak & Wadah', 'PISAU', 'quantity', 4, NULL, NULL, 'pcs', 57),
  ('interior', 'Peralatan Masak & Wadah', 'STOCKPOT STAINLESS BESAR', 'quantity', 1, NULL, NULL, 'pcs', 58),
  ('interior', 'Peralatan Masak & Wadah', 'STOCKPOT STAINLESS KECIL', 'quantity', 1, NULL, NULL, 'pcs', 59),
  ('interior', 'Peralatan Masak & Wadah', 'GRILL STOVE (KOMPOR BAKAR)', 'quantity', 2, NULL, NULL, 'unit', 60),
  ('interior', 'Peralatan Masak & Wadah', 'SINGLE FRYER', 'quantity', 1, NULL, NULL, 'unit', 61),
  ('interior', 'Peralatan Masak & Wadah', 'DOUBLE FRYER', 'quantity', 1, NULL, NULL, 'unit', 62),
  ('interior', 'Peralatan Masak & Wadah', 'MUG ELEKTRIK', 'quantity', 1, NULL, NULL, 'unit', 63),
  ('interior', 'Peralatan Masak & Wadah', 'TIMBANGAN DIGITAL', 'quantity', 2, NULL, NULL, 'unit', 64),
  ('interior', 'Peralatan Masak & Wadah', 'REGULATOR SET', 'quantity', 4, NULL, NULL, 'set', 65),
  ('interior', 'Peralatan Masak & Wadah', 'KERANJANG SAYUR', 'quantity', 1, NULL, NULL, 'unit', 66),
  ('interior', 'Peralatan Masak & Wadah', 'CUTTING BOARD (TALENAN)', 'quantity', 2, NULL, NULL, 'pcs', 67),
  ('interior', 'ATK & Administrasi', 'BUKU PETTY CASH', 'quantity', 1, NULL, NULL, 'pcs', 70),
  ('interior', 'ATK & Administrasi', 'PULPEN', 'quantity', 6, NULL, NULL, 'pcs', 71),
  ('interior', 'ATK & Administrasi', 'STAPLER', 'quantity', 1, NULL, NULL, 'pcs', 72),
  ('interior', 'ATK & Administrasi', 'LAKBAN', 'quantity', 2, NULL, NULL, 'pcs', 73),
  ('interior', 'ATK & Administrasi', 'GUNTING', 'quantity', 2, NULL, NULL, 'pcs', 74),
  ('interior', 'ATK & Administrasi', 'KERTAS LAPORAN', 'quantity', 100, NULL, NULL, 'lbr', 75),
  ('interior', 'ATK & Administrasi', 'SPIDOL', 'quantity', 2, NULL, NULL, 'pcs', 76),
  ('interior', 'ATK & Administrasi', 'AMPLOP OMSET', 'quantity', 100, NULL, NULL, 'lbr', 77),
  ('interior', 'Signage & Identitas Outlet', 'SIGN LOGO HALAL', 'presence', NULL, NULL, NULL, NULL, 80),
  ('interior', 'Signage & Identitas Outlet', 'SIGN QRIS', 'presence', NULL, NULL, NULL, NULL, 81),
  ('interior', 'Signage & Identitas Outlet', 'SIGN JAM OPERASIONAL', 'presence', NULL, NULL, NULL, NULL, 82),
  ('interior', 'Signage & Identitas Outlet', 'SIGN AREA DIAWASI CCTV', 'presence', NULL, NULL, NULL, NULL, 83),
  ('interior', 'Signage & Identitas Outlet', 'SIGN FREE TANPA STRUK', 'presence', NULL, NULL, NULL, NULL, 84),
  ('interior', 'Signage & Identitas Outlet', 'SIGN SELAIN CREW DILARANG MASUK', 'presence', NULL, NULL, NULL, NULL, 85),
  ('interior', 'Signage & Identitas Outlet', 'SIGN CREW SEDANG SHALAT', 'presence', NULL, NULL, NULL, NULL, 86),
  ('interior', 'Signage & Identitas Outlet', 'SIGN PICK UP HERE & ORDER HERE', 'presence', NULL, NULL, NULL, NULL, 87),
  ('interior', 'Signage & Identitas Outlet', 'SIGN PRICE LIST', 'presence', NULL, NULL, NULL, NULL, 88),
  ('interior', 'Signage & Identitas Outlet', 'SIGN BUKU MENU', 'presence', NULL, NULL, NULL, NULL, 89),
  ('interior', 'Alat Shalat', 'SAJADAH', 'presence', NULL, NULL, NULL, NULL, 90),
  ('interior', 'Alat Shalat', 'PECI', 'presence', NULL, NULL, NULL, NULL, 91),
  ('interior', 'Alat Shalat', 'AL-QURAN', 'presence', NULL, NULL, NULL, NULL, 92),
  ('interior', 'Cleaning Kit', 'SAPU', 'quantity', 2, NULL, NULL, 'pcs', 100),
  ('interior', 'Cleaning Kit', 'KAIN PEL', 'quantity', 2, NULL, NULL, 'pcs', 101),
  ('interior', 'Cleaning Kit', 'KAIN LAP', 'quantity', 6, NULL, NULL, 'pcs', 102),
  ('interior', 'Cleaning Kit', 'WIPER', 'quantity', 1, NULL, NULL, 'pcs', 103),
  ('interior', 'Cleaning Kit', 'SIKAT WC', 'quantity', 1, NULL, NULL, 'pcs', 104),
  ('exterior', 'Exterior', 'NEON BOX', 'quantity', 1, NULL, NULL, 'unit', 110),
  ('exterior', 'Exterior', 'BANNER BESAR', 'quantity', 1, NULL, NULL, 'lbr', 111),
  ('exterior', 'Exterior', 'BANNER KECIL', 'quantity', 3, NULL, NULL, 'lbr', 112),
  ('exterior', 'Exterior', 'LAMPU TEMBAK', 'quantity', 4, NULL, NULL, 'unit', 113),
  ('exterior', 'Exterior', 'CCTV EXTERIOR', 'quantity', 1, NULL, NULL, 'unit', 114),
  ('exterior', 'Exterior', 'GEMBOK', 'quantity', 2, NULL, NULL, 'pcs', 115),
  ('exterior', 'Exterior', 'KURSI PLASTIK', 'quantity', 6, NULL, NULL, 'unit', 116),
  ('exterior', 'Exterior', 'LED STRIP', 'range', NULL, 10, 20, 'm', 117),
  ('exterior', 'Exterior', 'LAMPU EXTERIOR', 'quantity', 2, NULL, NULL, 'pcs', 118),
  ('kamar_mandi', 'Kamar Mandi', 'KERAN', 'presence', NULL, NULL, NULL, NULL, 120),
  ('kamar_mandi', 'Kamar Mandi', 'LAMPU KAMAR MANDI', 'quantity', 1, NULL, NULL, 'pcs', 121),
  ('kamar_mandi', 'Kamar Mandi', 'CLOSET', 'presence', NULL, NULL, NULL, NULL, 122),
  ('utilitas', 'Utilitas', 'PLN / METERAN LISTRIK', 'presence', NULL, NULL, NULL, NULL, 130),
  ('utilitas', 'Utilitas', 'PDAM / AIR', 'presence', NULL, NULL, NULL, NULL, 131),
  ('utilitas', 'Utilitas', 'INTERNET', 'presence', NULL, NULL, NULL, NULL, 132)
ON CONFLICT (name) DO UPDATE SET
  section = EXCLUDED.section,
  subsection = EXCLUDED.subsection,
  mode = EXCLUDED.mode,
  target_qty = EXCLUDED.target_qty,
  target_min = EXCLUDED.target_min,
  target_max = EXCLUDED.target_max,
  unit = EXCLUDED.unit,
  sort_order = EXCLUDED.sort_order,
  is_active = true;
