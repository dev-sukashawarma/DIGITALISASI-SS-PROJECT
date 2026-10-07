-- Uji hermes_absensi_rekap_staf: kolom hari_dikecualikan + hak akses. Selalu ROLLBACK.
-- Lulus = RAISE NOTICE 'T4 LULUS' tanpa error.
BEGIN;
DO $$
DECLARE v_ada boolean; v_staf uuid; v_n integer; v_ok boolean;
BEGIN
  -- (a) kolom hari_dikecualikan ada di keluaran
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'hermes_absensi_rekap_staf'
       AND 'hari_dikecualikan' = ANY (p.proargnames)) INTO v_ada;
  IF NOT v_ada THEN RAISE EXCEPTION '(a) kolom hari_dikecualikan tidak ada'; END IF;
  PERFORM * FROM public.hermes_absensi_rekap_staf(current_date - 30, current_date) LIMIT 1;

  -- (b) staf dengan cuti disetujui pada 30 hari terakhir (yang sudah lewat) -> hari_dikecualikan > 0
  SELECT l.staff_id INTO v_staf
    FROM leave_requests l
   WHERE l.status = 'approved' AND l.start_date <= current_date - 1 AND l.end_date >= current_date - 30
   LIMIT 1;
  IF v_staf IS NULL THEN
    RAISE NOTICE '(b) dilewati: tak ada cuti disetujui 30 hari terakhir';
  ELSE
    SELECT r.hari_dikecualikan INTO v_n
      FROM public.hermes_absensi_rekap_staf(current_date - 30, current_date) r WHERE r.outlet_staff_id = v_staf;
    -- bisa 0 bila staf hadir di seluruh hari cutinya; hanya gagal bila baris tak muncul
    IF v_n IS NULL THEN RAISE EXCEPTION '(b) staf bercuti tidak muncul di rekap'; END IF;
    IF v_n = 0 AND NOT EXISTS (
         SELECT 1 FROM attendance a, leave_requests l
          WHERE a.outlet_staff_id = v_staf AND l.staff_id = v_staf AND l.status = 'approved'
            AND a.status <> 'alpha'
            AND (a.ts_server AT TIME ZONE 'Asia/Jakarta')::date BETWEEN l.start_date AND l.end_date) THEN
      RAISE EXCEPTION '(b) hari_dikecualikan = 0 padahal ada cuti disetujui tanpa absen';
    END IF;
  END IF;

  -- (c) anon & authenticated tidak boleh mengeksekusi
  SET LOCAL ROLE anon;
  v_ok := false;
  BEGIN PERFORM * FROM public.hermes_absensi_rekap_staf(current_date - 1, current_date);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  RESET ROLE;
  IF NOT v_ok THEN RAISE EXCEPTION '(c) anon bisa mengeksekusi hermes_absensi_rekap_staf'; END IF;

  RAISE NOTICE 'T4 LULUS';
END $$;
ROLLBACK;
