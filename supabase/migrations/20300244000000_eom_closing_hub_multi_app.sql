-- =============================================================================
-- EOM Closing HUB: Distributed End-of-Month Closing System
-- =============================================================================
-- Memungkinkan setiap aplikasi satelit (stok, hr, marcom, finance) men-generate
-- Berita Acara Rekap Akhir Bulan, diverifikasi oleh PIC dengan 1-klik, dan
-- masuk secara real-time ke Admin Dashboard (EOM Closing HUB).
--
-- Divisi yang dipantau (6 Divisi):
-- 1. kasir_outlet      (apps/finance - Modul Audit Kasir & Setoran)
-- 2. kitchen_stok     (apps/stok / apps/distribusi - SO, Shrinkage & Waste)
-- 3. purchasing       (apps/finance - Tagihan PO & AP Aging)
-- 4. hr_payroll       (apps/HR / apps/absensi - Absensi, Bonus, Gaji)
-- 5. marcom           (apps/marcom - Realisasi Ads & Endorse)
-- 6. finance_akuntansi (apps/finance - Rekonsiliasi Bank & Aggregator)
-- =============================================================================

SET LOCAL lock_timeout = '5s';

-- 1. Master Periode Tutup Buku
CREATE TABLE IF NOT EXISTS public.eom_closing_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulan INT NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  tahun INT NOT NULL CHECK (tahun >= 2026),
  cut_off_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'all_verified', 'finalized')),
  finalized_at TIMESTAMPTZ,
  finalized_by UUID REFERENCES public.outlet_staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bulan, tahun)
);

-- 2. Submisi Dokumen & Verifikasi per Divisi
CREATE TABLE IF NOT EXISTS public.eom_closing_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.eom_closing_periods(id) ON DELETE CASCADE,
  divisi TEXT NOT NULL CHECK (divisi IN (
    'kasir_outlet',
    'kitchen_stok',
    'purchasing',
    'hr_payroll',
    'marcom',
    'finance_akuntansi'
  )),
  app_source TEXT NOT NULL,
  judul_dokumen TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'verified' CHECK (status IN ('draft', 'verified', 'rejected')),
  ringkasan_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  dokumen_url TEXT,
  catatan TEXT,
  verified_by UUID NOT NULL REFERENCES public.outlet_staff(id) ON DELETE RESTRICT,
  nama_pic TEXT NOT NULL DEFAULT '',
  role_pic TEXT NOT NULL DEFAULT '',
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (period_id, divisi)
);

CREATE INDEX IF NOT EXISTS idx_eom_submissions_period_divisi 
ON public.eom_closing_submissions (period_id, divisi);

-- Enable RLS
ALTER TABLE public.eom_closing_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eom_closing_submissions ENABLE ROW LEVEL SECURITY;

-- Read policy: Siapa saja staf login boleh melihat status closing
DROP POLICY IF EXISTS "eom_periods_read_all" ON public.eom_closing_periods;
CREATE POLICY "eom_periods_read_all" ON public.eom_closing_periods
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "eom_submissions_read_all" ON public.eom_closing_submissions;
CREATE POLICY "eom_submissions_read_all" ON public.eom_closing_submissions
  FOR SELECT TO authenticated USING (true);

-- 3. RPC untuk Verifikasi 1-Klik dari App Satelit
CREATE OR REPLACE FUNCTION public.submit_eom_verification(
  p_bulan INT,
  p_tahun INT,
  p_divisi TEXT,
  p_app_source TEXT,
  p_judul_dokumen TEXT,
  p_ringkasan_data JSONB,
  p_catatan TEXT DEFAULT NULL,
  p_dokumen_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_staff_id UUID := auth.uid();
  v_staff_name TEXT;
  v_staff_role TEXT;
  v_period_id UUID;
  v_sub_id UUID;
  v_verified_count INT;
  v_cut_off TIMESTAMPTZ;
BEGIN
  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: User belum login.';
  END IF;

  SELECT COALESCE(NULLIF(btrim(name), ''), display_name, 'Staff'), role
    INTO v_staff_name, v_staff_role
    FROM public.outlet_staff
   WHERE id = v_staff_id;

  -- Hitung tanggal cut-off akhir bulan (detik terakhir bulan p_bulan p_tahun di WIB)
  v_cut_off := (make_date(p_tahun, p_bulan, 1) + interval '1 month' - interval '1 second');

  -- Dapatkan atau buat entri periode
  INSERT INTO public.eom_closing_periods (bulan, tahun, cut_off_at)
  VALUES (p_bulan, p_tahun, v_cut_off)
  ON CONFLICT (bulan, tahun) DO UPDATE SET updated_at = NOW()
  RETURNING id INTO v_period_id;

  -- Pastikan periode belum difinalisasi secara permanen
  IF EXISTS (SELECT 1 FROM public.eom_closing_periods WHERE id = v_period_id AND status = 'finalized') THEN
    RAISE EXCEPTION 'Periode %-% sudah difinalisasi dan dikunci permanen.', p_bulan, p_tahun;
  END IF;

  -- Upsert submisi verifikasi
  INSERT INTO public.eom_closing_submissions (
    period_id,
    divisi,
    app_source,
    judul_dokumen,
    status,
    ringkasan_data,
    dokumen_url,
    catatan,
    verified_by,
    nama_pic,
    role_pic,
    verified_at
  ) VALUES (
    v_period_id,
    p_divisi,
    p_app_source,
    p_judul_dokumen,
    'verified',
    COALESCE(p_ringkasan_data, '{}'::jsonb),
    p_dokumen_url,
    p_catatan,
    v_staff_id,
    v_staff_name,
    v_staff_role,
    NOW()
  )
  ON CONFLICT (period_id, divisi) DO UPDATE SET
    status = 'verified',
    app_source = EXCLUDED.app_source,
    judul_dokumen = EXCLUDED.judul_dokumen,
    ringkasan_data = EXCLUDED.ringkasan_data,
    dokumen_url = COALESCE(EXCLUDED.dokumen_url, eom_closing_submissions.dokumen_url),
    catatan = EXCLUDED.catatan,
    verified_by = EXCLUDED.verified_by,
    nama_pic = EXCLUDED.nama_pic,
    role_pic = EXCLUDED.role_pic,
    verified_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_sub_id;

  -- Cek jumlah divisi yang sudah verified
  SELECT COUNT(*) INTO v_verified_count
    FROM public.eom_closing_submissions
   WHERE period_id = v_period_id AND status = 'verified';

  IF v_verified_count >= 6 THEN
    UPDATE public.eom_closing_periods
       SET status = 'all_verified', updated_at = NOW()
     WHERE id = v_period_id AND status = 'open';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'submission_id', v_sub_id,
    'period_id', v_period_id,
    'verified_count', v_verified_count,
    'nama_pic', v_staff_name,
    'verified_at', NOW()
  );
END;
$$;

-- 4. RPC untuk Finalisasi Konsolidasi Master Report oleh Admin
CREATE OR REPLACE FUNCTION public.finalize_eom_closing(
  p_bulan INT,
  p_tahun INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_staff_id UUID := auth.uid();
  v_staff_role TEXT;
  v_period_id UUID;
  v_verified_count INT;
BEGIN
  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: User belum login.';
  END IF;

  SELECT role INTO v_staff_role
    FROM public.outlet_staff
   WHERE id = v_staff_id;

  IF v_staff_role NOT IN ('owner', 'admin', 'admin_finance') THEN
    RAISE EXCEPTION 'Hanya Owner atau Admin yang boleh memfinalisasi laporan konsolidasi akhir bulan.';
  END IF;

  SELECT id INTO v_period_id
    FROM public.eom_closing_periods
   WHERE bulan = p_bulan AND tahun = p_tahun;

  IF v_period_id IS NULL THEN
    RAISE EXCEPTION 'Periode %-% belum memiliki catatan data closing.', p_bulan, p_tahun;
  END IF;

  SELECT COUNT(*) INTO v_verified_count
    FROM public.eom_closing_submissions
   WHERE period_id = v_period_id AND status = 'verified';

  IF v_verified_count < 6 THEN
    RAISE EXCEPTION 'Tidak dapat memfinalisasi: Baru % dari 6 divisi yang terverifikasi.', v_verified_count;
  END IF;

  UPDATE public.eom_closing_periods
     SET status = 'finalized',
         finalized_at = NOW(),
         finalized_by = v_staff_id,
         updated_at = NOW()
   WHERE id = v_period_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'finalized',
    'finalized_at', NOW()
  );
END;
$$;
