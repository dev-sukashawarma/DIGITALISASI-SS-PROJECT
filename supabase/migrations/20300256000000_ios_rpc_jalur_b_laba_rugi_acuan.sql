-- iOS (Suka Admin native) — RPC "jalur B" untuk OPEX acuan Laba Rugi (PRD iOS §5.1).
--
-- Web membaca tabel-tabel ini lewat service client (createServiceClient) di lib/server/opexLabaRugi.ts dan
-- turunannya. Aplikasi iOS tidak memegang service-role key, jadi bacaan yang sama disediakan lewat RPC
-- SECURITY DEFINER dengan cek peran di dalam fungsi. Setiap fungsi mengembalikan BARIS MENTAH (RETURNS SETOF)
-- supaya iOS tetap memakai select/embed/filter/order/paginasi yang identik dengan kode web.
--
-- Akses: hanya `authenticated` (anon & PUBLIC dicabut); di dalam fungsi dicek peran outlet_staff aktif.
-- Sumber draf: repo iOS docs/rpc-jalur-b/*.sql.

-- ============================================================================
-- ios_kas_kecil_mentah
-- ============================================================================
--
-- Pengganti bacaan service-client `petty_cash_expenses` di lib/pengeluaran/ambilPengeluaran.ts (dipakai
-- lib/server/opexLabaRugi.ts → OPEX acuan Laba Rugi di Ringkasan Bisnis).
-- Alasan: RLS `petty_cash_expenses_select` (20300105000016) tidak memuat role `developer` → developer hanya
-- melihat outlet staff_outlets/outlet utamanya. Owner/admin sudah membaca semua lewat RLS (iOS memakai jalur A
-- sebagai cadangan untuk mereka bila RPC ini belum ada).
--
-- Mengembalikan BARIS MENTAH tabel (RETURNS SETOF) supaya iOS tetap memakai select/embed
-- (`outlets(name)`, `outlet_staff:created_by(name)`), filter (`status`, `deleted_at`, `category`, `outlet_id`),
-- order (`expense_date.desc,id.desc`) dan paginasi `offset/limit` yang SAMA PERSIS dengan kode web.
-- p_from/p_to hanya membatasi pemindaian; iOS tetap mengirim gte/lte yang sama.
CREATE OR REPLACE FUNCTION public.ios_kas_kecil_mentah(p_from date, p_to date)
RETURNS SETOF public.petty_cash_expenses
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- requireRole(PERAN_KEUANGAN): owner/admin + developer (superuser teknis), status aktif.
  IF NOT EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.id = auth.uid() AND s.status = 'active' AND s.role IN ('owner', 'admin', 'developer')
  ) THEN
    RAISE EXCEPTION 'Forbidden: aksi ini hanya untuk role owner/admin' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT p.*
    FROM public.petty_cash_expenses p
    WHERE p.expense_date >= p_from
      AND p.expense_date <= p_to
      AND p.outlet_id IN (SELECT public.accessible_outlet_ids());
END;
$$;

REVOKE ALL ON FUNCTION public.ios_kas_kecil_mentah(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ios_kas_kecil_mentah(date, date) TO authenticated;
COMMENT ON FUNCTION public.ios_kas_kecil_mentah(date, date) IS
  'iOS jalur B: baris mentah petty_cash_expenses untuk OPEX acuan Laba Rugi (pengganti service client ambilPengeluaranMentah).';

-- ============================================================================
-- ios_absensi_masuk_mentah
-- ============================================================================
--
-- Pengganti bacaan service-client `attendance` di lib/server/ringkasanPayrollHr.ts#fetchAllAttendanceRows
-- (ringkasan payroll HR → gaji/bonus outlet di OPEX acuan Laba Rugi).
-- Alasan: policy RESTRICTIVE `attendance_kantor_pusat_hanya_hr` (20300254001400) menyembunyikan absen outlet
-- Kantor Pusat (ffffffff-…) dari OWNER (boleh_lihat_absen_kantor_pusat() hanya admin/admin_hr/developer).
-- Absen Kantor Pusat ikut menentukan kru mutasi lintas cabang (rawAttMap.size > 1) dan pembagi hari → tanpa
-- baris itu angka gaji per outlet owner BERBEDA dari web. Admin/developer sudah membaca semua (cadangan jalur A
-- iOS untuk mereka); untuk owner iOS menolak menghitung (LabaRugiAcuanError.rpcJalurBBelumAda) sampai RPC ada.
--
-- RETURNS SETOF attendance: iOS tetap mengirim select `id, outlet_staff_id, outlet_id, ts_server`, filter
-- `ts_server` gte/lte, `type in (in,masuk)`, order `ts_server.asc,id.asc`, paginasi 1.000 — sama dengan web.
CREATE OR REPLACE FUNCTION public.ios_absensi_masuk_mentah(p_from timestamptz, p_to timestamptz)
RETURNS SETOF public.attendance
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Rantai ini hanya dipanggil dari getProrataAuxiliaryDataAction/OPEX acuan → requireRole(PERAN_KEUANGAN).
  IF NOT EXISTS (
    SELECT 1 FROM public.outlet_staff s
    WHERE s.id = auth.uid() AND s.status = 'active' AND s.role IN ('owner', 'admin', 'developer')
  ) THEN
    RAISE EXCEPTION 'Forbidden: aksi ini hanya untuk role owner/admin' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT a.*
    FROM public.attendance a
    WHERE a.ts_server >= p_from
      AND a.ts_server <= p_to
      AND a.outlet_id IN (SELECT public.accessible_outlet_ids());
END;
$$;

REVOKE ALL ON FUNCTION public.ios_absensi_masuk_mentah(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ios_absensi_masuk_mentah(timestamptz, timestamptz) TO authenticated;
COMMENT ON FUNCTION public.ios_absensi_masuk_mentah(timestamptz, timestamptz) IS
  'iOS jalur B: baris mentah attendance (semua outlet termasuk Kantor Pusat) untuk ringkasan payroll HR acuan Laba Rugi.';

-- ============================================================================
-- ios_investasi_mitra_mentah
-- ============================================================================
--
-- Pengganti bacaan service-client di lib/server/mitraInvestasiServer.ts#ambilInvestasiMitraServer
-- (fee 3% mitra di Ringkasan Bisnis; nanti Laba Rugi/Kemitraan).
-- Alasan: tabel `mitra_investments` & `mitra_transfers` TIDAK ada di supabase/migrations (dibuat manual lewat
-- apps/admin-dashboard/migration_mitra.sql): policy `*_admin_all` hanya owner/admin → developer tidak terbaca;
-- skema live sudah bergeser → perlu dicek live. Owner/admin: cadangan jalur A iOS.
--
-- Web memanggilnya dengan service client juga untuk MITRA yang dikunci ke outletnya (hanya angka fee yang sampai ke
-- browser). Di iOS baris dikirim ke perangkat, jadi MITRA dibatasi ke outlet miliknya (accessible_outlet_ids()
-- memuat outlet mitra_profiles aktif) — fee outlet terkunci tetap identik karena hanya baris outlet itu yang dibaca.
CREATE OR REPLACE FUNCTION public.ios_investasi_mitra_mentah()
RETURNS SETOF public.mitra_investments
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT s.role INTO v_role FROM public.outlet_staff s WHERE s.id = auth.uid() AND s.status = 'active';
  IF v_role IN ('owner', 'admin', 'developer') THEN
    RETURN QUERY SELECT i.* FROM public.mitra_investments i;
  ELSIF v_role = 'mitra' THEN
    RETURN QUERY SELECT i.* FROM public.mitra_investments i WHERE i.outlet_id IN (SELECT public.accessible_outlet_ids());
  ELSE
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ios_investasi_mitra_mentah() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ios_investasi_mitra_mentah() TO authenticated;
COMMENT ON FUNCTION public.ios_investasi_mitra_mentah() IS
  'iOS jalur B: baris mentah mitra_investments (select * web) untuk fee 3% mitra / BEP.';

-- ============================================================================
-- ios_transfer_mitra_mentah
-- ============================================================================
--
-- Pengganti `fetchAllPages(() => supabase.from('mitra_transfers').select('id, outlet_id, bulan, nominal').order('id'))`
-- di lib/server/mitraInvestasiServer.ts. RETURNS SETOF → iOS tetap memakai select/order/paginasi 1.000 yang sama.
CREATE OR REPLACE FUNCTION public.ios_transfer_mitra_mentah()
RETURNS SETOF public.mitra_transfers
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT s.role INTO v_role FROM public.outlet_staff s WHERE s.id = auth.uid() AND s.status = 'active';
  IF v_role IN ('owner', 'admin', 'developer') THEN
    RETURN QUERY SELECT t.* FROM public.mitra_transfers t;
  ELSIF v_role = 'mitra' THEN
    RETURN QUERY SELECT t.* FROM public.mitra_transfers t WHERE t.outlet_id IN (SELECT public.accessible_outlet_ids());
  ELSE
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ios_transfer_mitra_mentah() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ios_transfer_mitra_mentah() TO authenticated;
COMMENT ON FUNCTION public.ios_transfer_mitra_mentah() IS
  'iOS jalur B: baris mentah mitra_transfers untuk total dana kembali / BEP mitra.';
