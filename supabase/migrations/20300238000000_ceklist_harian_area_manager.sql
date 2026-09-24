-- =============================================================================
-- Ceklist Harian Area Manager
-- =============================================================================
--
-- Area manager mengecek outlet binaannya setiap hari: Kebersihan, Stok, Seragam &
-- Crew, Rasa (Sapi, Ayam, Kentang, Tum, Sayur), dan Peralatan — masing-masing
-- dinilai baik / perhatian / buruk dengan keterangan, dan SETIAP KATEGORI wajib
-- berfoto. Ditutup daftar Temuan dan Perbaikan. Regional manager memantau dan
-- menandai laporan sebagai sudah ditinjau, boleh dengan tanggapan.
--
-- Bentuk data:
--   ceklist_harian        satu baris per outlet per hari (Asia/Jakarta)
--   ceklist_harian_item   sembilan penilaian (4 kategori + 5 sub-item rasa)
--   ceklist_harian_foto   1..3 foto per kategori, di bucket privat ceklist-harian-foto
--
-- Seluruh penulisan lewat RPC SECURITY DEFINER yang memeriksa role sendiri —
-- tabelnya sengaja TIDAK punya policy INSERT/UPDATE/DELETE. Pola yang sama dengan
-- submit_inventaris dan area_manager_process_petty_cash: header + detail tersimpan
-- dalam satu transaksi, dan kewenangan tidak bergantung pada klien.
--
-- Tanggal ditentukan server, bukan klien, supaya ceklist tidak bisa dimundurkan.
-- Idempoten.
-- =============================================================================

set local lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.ceklist_harian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  submitted_by UUID NOT NULL REFERENCES public.outlet_staff(id) ON DELETE RESTRICT,
  -- Snapshot nama supaya regional manager tidak perlu membaca outlet_staff orang lain.
  nama_am TEXT NOT NULL DEFAULT '',
  tanggal DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')::date,
  temuan TEXT[] NOT NULL DEFAULT '{}',
  perbaikan TEXT[] NOT NULL DEFAULT '{}',
  catatan TEXT,
  ditinjau_oleh UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  nama_peninjau TEXT,
  ditinjau_pada TIMESTAMPTZ,
  tanggapan_rm TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (outlet_id, tanggal)
);

CREATE TABLE IF NOT EXISTS public.ceklist_harian_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ceklist_id UUID NOT NULL REFERENCES public.ceklist_harian(id) ON DELETE CASCADE,
  kategori TEXT NOT NULL CHECK (kategori IN ('kebersihan', 'stok', 'seragam_crew', 'rasa', 'peralatan')),
  -- '' untuk kategori tanpa sub-item; bukan NULL supaya UNIQUE di bawah berlaku.
  sub_item TEXT NOT NULL DEFAULT '',
  nilai TEXT NOT NULL CHECK (nilai IN ('baik', 'perhatian', 'buruk')),
  keterangan TEXT,
  UNIQUE (ceklist_id, kategori, sub_item),
  CHECK (
    (kategori = 'rasa' AND sub_item IN ('sapi', 'ayam', 'kentang', 'tum', 'sayur'))
    OR (kategori <> 'rasa' AND sub_item = '')
  )
);

CREATE TABLE IF NOT EXISTS public.ceklist_harian_foto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ceklist_id UUID NOT NULL REFERENCES public.ceklist_harian(id) ON DELETE CASCADE,
  kategori TEXT NOT NULL CHECK (kategori IN ('kebersihan', 'stok', 'seragam_crew', 'rasa', 'peralatan')),
  path TEXT NOT NULL CHECK (char_length(path) > 0),
  urutan INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ceklist_harian_tanggal_outlet
  ON public.ceklist_harian(tanggal DESC, outlet_id);
CREATE INDEX IF NOT EXISTS idx_ceklist_harian_submitted_by
  ON public.ceklist_harian(submitted_by);
CREATE INDEX IF NOT EXISTS idx_ceklist_harian_ditinjau_oleh
  ON public.ceklist_harian(ditinjau_oleh);
CREATE INDEX IF NOT EXISTS idx_ceklist_harian_item_ceklist
  ON public.ceklist_harian_item(ceklist_id);
CREATE INDEX IF NOT EXISTS idx_ceklist_harian_foto_ceklist
  ON public.ceklist_harian_foto(ceklist_id);

ALTER TABLE public.ceklist_harian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceklist_harian_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceklist_harian_foto ENABLE ROW LEVEL SECURITY;

-- Hanya manajemen yang membaca: crew dan leader tidak perlu melihat penilaian AM
-- atas outlet mereka sendiri. Cakupan outlet tetap dari accessible_outlet_ids().
CREATE OR REPLACE FUNCTION public.boleh_membaca_ceklist_harian()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid()
      AND role IN ('area_manager', 'regional_manager', 'admin', 'owner', 'developer')
  );
$$;

REVOKE ALL ON FUNCTION public.boleh_membaca_ceklist_harian() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.boleh_membaca_ceklist_harian() TO authenticated;

DROP POLICY IF EXISTS ceklist_harian_read ON public.ceklist_harian;
CREATE POLICY ceklist_harian_read ON public.ceklist_harian
  FOR SELECT TO authenticated
  USING (
    (SELECT public.boleh_membaca_ceklist_harian())
    AND outlet_id IN (SELECT public.accessible_outlet_ids())
  );

DROP POLICY IF EXISTS ceklist_harian_item_read ON public.ceklist_harian_item;
CREATE POLICY ceklist_harian_item_read ON public.ceklist_harian_item
  FOR SELECT TO authenticated
  USING (ceklist_id IN (SELECT id FROM public.ceklist_harian));

DROP POLICY IF EXISTS ceklist_harian_foto_read ON public.ceklist_harian_foto;
CREATE POLICY ceklist_harian_foto_read ON public.ceklist_harian_foto
  FOR SELECT TO authenticated
  USING (ceklist_id IN (SELECT id FROM public.ceklist_harian));

-- -----------------------------------------------------------------------------
-- submit_ceklist_harian — area manager mengisi / menyunting ceklist hari ini.
--
-- p_items : [{kategori, sub_item, nilai, keterangan}]  tepat 9 baris
-- p_foto  : [{kategori, path}]                         1..3 per kategori
--
-- Menyunting ceklist yang sudah ditinjau menghapus tanda tinjauannya: regional
-- manager harus melihat versi yang baru, bukan menganggap versi lama masih berlaku.
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

  -- Sembilan penilaian, masing-masing tepat sekali.
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Penilaian ceklist belum lengkap';
  END IF;
  IF (
    SELECT count(DISTINCT (r.kategori, COALESCE(r.sub_item, '')))
    FROM jsonb_to_recordset(p_items) AS r(kategori TEXT, sub_item TEXT, nilai TEXT)
    WHERE r.nilai IN ('baik', 'perhatian', 'buruk')
      AND (r.kategori, COALESCE(r.sub_item, '')) IN (
        ('kebersihan', ''), ('stok', ''), ('seragam_crew', ''), ('peralatan', ''),
        ('rasa', 'sapi'), ('rasa', 'ayam'), ('rasa', 'kentang'), ('rasa', 'tum'), ('rasa', 'sayur')
      )
  ) <> 9 OR jsonb_array_length(p_items) <> 9 THEN
    RAISE EXCEPTION 'Penilaian ceklist belum lengkap';
  END IF;

  -- Foto: setiap kategori 1..3, semuanya di folder milik pengisi.
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
    FROM unnest(ARRAY['kebersihan', 'stok', 'seragam_crew', 'rasa', 'peralatan']) AS k(kategori)
    LEFT JOIN jsonb_to_recordset(p_foto) AS f(kategori TEXT, path TEXT) ON f.kategori = k.kategori
    GROUP BY k.kategori
    HAVING count(f.path) NOT BETWEEN 1 AND 3
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
GRANT EXECUTE ON FUNCTION public.submit_ceklist_harian(UUID, JSONB, JSONB, TEXT[], TEXT[], TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- tinjau_ceklist_harian — regional manager menandai laporan sudah ditinjau.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tinjau_ceklist_harian(
  p_ceklist_id UUID,
  p_tanggapan TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_role TEXT;
  v_nama TEXT;
  v_outlet UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sesi login tidak ditemukan';
  END IF;

  SELECT role, COALESCE(NULLIF(display_name, ''), name, '')
    INTO v_role, v_nama
    FROM public.outlet_staff WHERE id = v_user;
  IF v_role IS NULL OR v_role NOT IN ('regional_manager', 'admin', 'owner') THEN
    RAISE EXCEPTION 'Hanya regional manager yang boleh meninjau ceklist harian';
  END IF;

  SELECT outlet_id INTO v_outlet FROM public.ceklist_harian WHERE id = p_ceklist_id;
  IF v_outlet IS NULL THEN
    RAISE EXCEPTION 'Ceklist tidak ditemukan';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accessible_outlet_ids() AS a(id) WHERE a.id = v_outlet) THEN
    RAISE EXCEPTION 'Outlet di luar scope akses Anda';
  END IF;

  UPDATE public.ceklist_harian SET
    ditinjau_oleh = v_user,
    nama_peninjau = v_nama,
    ditinjau_pada = NOW(),
    tanggapan_rm = NULLIF(btrim(p_tanggapan), '')
  WHERE id = p_ceklist_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tinjau_ceklist_harian(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tinjau_ceklist_harian(UUID, TEXT) TO authenticated;

-- REVOKE FROM PUBLIC tidak cukup: default privileges Supabase memberi EXECUTE
-- langsung ke role anon. Fungsinya sudah menolak tanpa sesi, tapi pintunya ditutup.
REVOKE EXECUTE ON FUNCTION public.submit_ceklist_harian(UUID, JSONB, JSONB, TEXT[], TEXT[], TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.tinjau_ceklist_harian(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.boleh_membaca_ceklist_harian() FROM anon;

-- -----------------------------------------------------------------------------
-- Storage: bucket privat, unggah hanya ke folder auth.uid() sendiri.
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ceklist-harian-foto', 'ceklist-harian-foto', false, 2097152, ARRAY['image/jpeg', 'image/jpg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS ceklist_harian_photo_upload ON storage.objects;
CREATE POLICY ceklist_harian_photo_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ceklist-harian-foto'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS ceklist_harian_photo_read ON storage.objects;
CREATE POLICY ceklist_harian_photo_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ceklist-harian-foto' AND (SELECT public.boleh_membaca_ceklist_harian()));

-- -----------------------------------------------------------------------------
-- Realtime: layar pemantauan RM bergerak begitu AM mengirim, dan layar AM
-- bergerak begitu RM meninjau. Tabel header saja — item & foto selalu ditulis
-- dalam transaksi yang sama dengan header.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ceklist_harian'
  ) then
    alter publication supabase_realtime add table public.ceklist_harian;
  end if;
end
$$;
