-- Wizard Penutupan Outlet — fondasi (Task 1).
-- Spec: docs/superpowers/specs/2026-11-13-wizard-penutupan-outlet-design.md
--
-- 1. Kolom penutupan di outlets.
-- 2. Tabel centang langkah manual (outlet_penutupan_centang).
-- 3. CHECK aksi outlet_pembukaan_log diperluas (log dipakai bersama pembukaan & penutupan).
-- 4. penutupan_outlet_cek_peran(): penjaga role semua RPC penutupan.
-- 5. outlets_catat_nonaktif(): hormati nonaktif_at yang diberikan RPC penutupan
--    (tanggal terakhir jualan sebenarnya, bukan now()).
-- 6. Penjaga status DUA ARAH untuk outlet internal/mitra: aktif↔nonaktif hanya
--    lewat RPC penutupan (GUC app.penutupan_outlet).
--    SENGAJA diam (bukan RAISE), sama seperti penjaga Persiapan: saveGlobalConfig
--    di app absensi (apps/absensi/src/app/dashboard/pengaturan/actions.ts) menulis
--    is_active ke SEMUA outlet sekaligus. Kalau ditolak, simpan setelan absensi
--    gagal total; kalau dibiarkan, semua outlet tutup hidup lagi dan nonaktif_at
--    terhapus. Tombol di admin-dashboard dialihkan ke wizard, jadi jalur yang
--    dipakai orang tidak pernah tertahan tanpa sebab.
--    Nama trg_zz_* WAJIB: trigger BEFORE berjalan urut nama, dan penjaga harus
--    melihat hasil akhir trg_outlets_catat_nonaktif & trg_sync_outlet_status_active.
-- 7. Backfill: stempel sekali 4 outlet yang sudah tutup sebelum wizard ada.

ALTER TABLE public.outlets
  ADD COLUMN IF NOT EXISTS alasan_tutup text,
  ADD COLUMN IF NOT EXISTS ditutup_by uuid,
  ADD COLUMN IF NOT EXISTS penutupan_selesai_at timestamptz,
  ADD COLUMN IF NOT EXISTS penutupan_selesai_by uuid;

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outlet_penutupan_centang (
  outlet_id uuid NOT NULL,
  kunci     text NOT NULL,
  oleh      uuid,
  oleh_nama text,
  catatan   text,
  dibuat_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (outlet_id, kunci)
);
ALTER TABLE public.outlet_penutupan_centang ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.outlet_penutupan_centang FROM anon, authenticated;
GRANT SELECT ON public.outlet_penutupan_centang TO authenticated;
DROP POLICY IF EXISTS outlet_penutupan_centang_baca ON public.outlet_penutupan_centang;
CREATE POLICY outlet_penutupan_centang_baca ON public.outlet_penutupan_centang
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.id = auth.uid() AND s.status = 'active'
      AND s.role IN ('admin','owner','developer','admin_finance')
  ));

-- ---------------------------------------------------------------------------
ALTER TABLE public.outlet_pembukaan_log DROP CONSTRAINT IF EXISTS outlet_pembukaan_log_aksi_check;
ALTER TABLE public.outlet_pembukaan_log ADD CONSTRAINT outlet_pembukaan_log_aksi_check
  CHECK (aksi IN ('dibuat','go_live','dinonaktifkan','dihapus',
                  'ditutup','penutupan_selesai','tanggal_tutup_dikoreksi','dibuka_kembali',
                  'stok_dinolkan','centang','centang_dibatalkan'));

-- ---------------------------------------------------------------------------
-- p_lingkup: 'tulis' → admin/developer; 'baca' → admin/owner/developer;
--            'centang' → admin/owner/developer/admin_finance.
CREATE OR REPLACE FUNCTION public.penutupan_outlet_cek_peran(p_lingkup text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_peran text[] := CASE p_lingkup
    WHEN 'tulis'   THEN ARRAY['admin','developer']
    WHEN 'baca'    THEN ARRAY['admin','owner','developer']
    WHEN 'centang' THEN ARRAY['admin','owner','developer','admin_finance']
  END;
BEGIN
  IF v_peran IS NULL THEN
    RAISE EXCEPTION 'Lingkup peran tidak dikenal: %', p_lingkup;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.id = auth.uid() AND s.status = 'active' AND s.role = ANY (v_peran)
  ) THEN
    RAISE EXCEPTION 'Hanya % yang boleh melakukan ini pada penutupan outlet', array_to_string(v_peran, '/')
      USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.penutupan_outlet_cek_peran(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.penutupan_outlet_cek_peran(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Sama dengan 20261113190000, ditambah: RPC penutupan (GUC on) boleh menentukan
-- nonaktif_at sendiri (tanggal terakhir jualan, bisa mundur).
CREATE OR REPLACE FUNCTION public.outlets_catat_nonaktif()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_baru boolean := NEW.status = 'inactive' OR (NEW.status IS NULL AND NOT NEW.is_active);
  v_lama boolean := TG_OP = 'UPDATE'
    AND (OLD.status = 'inactive' OR (OLD.status IS NULL AND NOT OLD.is_active));
  v_dari_rpc boolean := coalesce(current_setting('app.penutupan_outlet', true), '') = 'on'
    AND NEW.nonaktif_at IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.nonaktif_at IS DISTINCT FROM OLD.nonaktif_at);
BEGIN
  IF v_baru AND NOT v_lama AND NOT v_dari_rpc THEN
    NEW.nonaktif_at := now();
  ELSIF NOT v_baru THEN
    NEW.nonaktif_at := NULL;
  END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.outlets_jaga_penutupan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.type IN ('internal','mitra')
     AND OLD.status IN ('active','inactive')
     AND NEW.status IS DISTINCT FROM OLD.status
     AND coalesce(current_setting('app.penutupan_outlet', true), '') <> 'on' THEN
    RAISE NOTICE 'Outlet %: status aktif/nonaktif hanya berubah lewat Tutup Outlet atau Buka kembali', OLD.name;
    NEW.status      := OLD.status;
    NEW.is_active   := OLD.is_active;
    NEW.nonaktif_at := OLD.nonaktif_at;
    NEW.deleted_at  := OLD.deleted_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zz_outlets_jaga_penutupan ON public.outlets;
CREATE TRIGGER trg_zz_outlets_jaga_penutupan
  BEFORE UPDATE ON public.outlets
  FOR EACH ROW EXECUTE FUNCTION public.outlets_jaga_penutupan();

-- ---------------------------------------------------------------------------
-- Backfill (sekali): outlet yang tutup sebelum wizard ada.
UPDATE public.outlets
   SET alasan_tutup = '(ditutup sebelum wizard)'
 WHERE id IN ('550e8400-e29b-41d4-a716-446655440008',  -- SUKA SHAWARMA SAWANGAN (INTERNAL)
              '550e8400-e29b-41d4-a716-446655440005',  -- SUKA SHAWARMA DEPOK SUKMAJAYA
              '550e8400-e29b-41d4-a716-446655440017',  -- MITRA CISEENG
              '550e8400-e29b-41d4-a716-446655440012')  -- SUKA SHAWARMA JATIASIH
   AND status = 'inactive'
   AND alasan_tutup IS NULL;

INSERT INTO public.outlet_pembukaan_log (outlet_id, nama_outlet, aksi, alasan, detail, pelaku, pelaku_nama)
SELECT o.id, o.name, 'ditutup', '(ditutup sebelum wizard)',
       jsonb_build_object('backfill', true, 'nonaktif_at', o.nonaktif_at), NULL, 'sistem (backfill)'
  FROM public.outlets o
 WHERE o.alasan_tutup = '(ditutup sebelum wizard)'
   AND NOT EXISTS (SELECT 1 FROM public.outlet_pembukaan_log l WHERE l.outlet_id = o.id AND l.aksi = 'ditutup');
