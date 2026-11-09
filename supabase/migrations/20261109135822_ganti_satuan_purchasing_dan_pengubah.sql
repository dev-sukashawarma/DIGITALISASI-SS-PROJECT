-- Ganti Satuan boleh dijalankan purchasing + "Diubah oleh" di daftar Master Bahan Baku.
-- Permintaan owner 2026-11-09.
--
-- 1. _peran_master: lingkup baru 'satuan' = admin, owner, purchasing, developer. Lingkup 'data'
--    (mengubah identitas/satuan biasa, nonaktifkan, hapus, SKU) TIDAK berubah.
-- 2. pratinjau_ganti_satuan & ganti_satuan_bahan memakai lingkup 'satuan'.
-- 3. pengubah_terakhir_bahan(): perubahan terakhir per bahan (data, harga master, harga vendor —
--    sumber yang sama dengan tab Riwayat) beserta nama pelakunya. SECURITY DEFINER karena nama
--    staf di outlet_staff tertahan RLS untuk purchasing; hanya peran yang boleh membaca riwayat
--    master bahan (mba_select: admin/owner/purchasing) + developer.
-- Uji: supabase/verifikasi/ganti_satuan/t6_purchasing_dan_pengubah.sql.

DO $do$
DECLARE v_def text; v_baru text; r regprocedure;
BEGIN
  v_def := pg_get_functiondef('public._peran_master(text)'::regprocedure);
  IF position($x$p_lingkup = 'satuan'$x$ IN v_def) = 0 THEN
    v_baru := replace(v_def, $a$  IF p_lingkup = 'harga'$a$,
      $b$  IF p_lingkup = 'satuan' AND v_role IN ('admin', 'owner', 'purchasing', 'developer') THEN
    RETURN v_uid;
  END IF;
  IF p_lingkup = 'harga'$b$);
    IF v_baru = v_def THEN RAISE EXCEPTION '_peran_master: pola tidak ditemukan'; END IF;
    EXECUTE v_baru;
  END IF;

  FOREACH r IN ARRAY ARRAY['public.pratinjau_ganti_satuan(uuid,jsonb,numeric)'::regprocedure,
                           'public.ganti_satuan_bahan(uuid,jsonb,numeric,text)'::regprocedure] LOOP
    v_def := pg_get_functiondef(r);
    v_baru := replace(v_def, $a$_peran_master('data')$a$, $b$_peran_master('satuan')$b$);
    IF v_baru <> v_def THEN EXECUTE v_baru; END IF;
    IF position($x$_peran_master('satuan')$x$ IN pg_get_functiondef(r)) = 0 THEN
      RAISE EXCEPTION '% tidak memakai lingkup satuan', r;
    END IF;
  END LOOP;
END $do$;

CREATE OR REPLACE FUNCTION public.pengubah_terakhir_bahan()
RETURNS TABLE (bahan_baku_id uuid, diubah_at timestamptz, diubah_oleh uuid, nama_pengubah text, jenis text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.outlet_staff s
                  WHERE s.id = auth.uid() AND s.status = 'active'
                    AND s.role IN ('admin', 'owner', 'purchasing', 'developer')) THEN
    RAISE EXCEPTION 'Tidak berhak membaca riwayat master bahan baku' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT DISTINCT ON (r.bahan_baku_id) r.bahan_baku_id, r.changed_at, r.changed_by, s.name, r.jenis
      FROM public.riwayat_master_bahan r
      LEFT JOIN public.outlet_staff s ON s.id = r.changed_by
     WHERE r.bahan_baku_id IS NOT NULL
     ORDER BY r.bahan_baku_id, r.changed_at DESC NULLS LAST;
END;
$$;
REVOKE ALL ON FUNCTION public.pengubah_terakhir_bahan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pengubah_terakhir_bahan() TO authenticated;
