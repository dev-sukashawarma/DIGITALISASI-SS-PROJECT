-- Jalankan di transaksi; ROLLBACK di akhir. Gagal = RAISE EXCEPTION.
BEGIN;
DO $$
DECLARE r record; n int; b bigint;
BEGIN
  -- 1) hari_hadir setara aturan Rekap: hari WIB berbeda dengan absen non-alpha
  SELECT count(*) INTO n FROM hermes_absensi_rekap_staf(current_date - 7, current_date);
  IF n = 0 THEN RAISE EXCEPTION 'rekap_staf kosong untuk 7 hari terakhir'; END IF;

  SELECT x.outlet_staff_id, x.hari_hadir INTO r
    FROM hermes_absensi_rekap_staf(current_date - 7, current_date) x ORDER BY x.hari_hadir DESC LIMIT 1;
  SELECT count(DISTINCT (a.ts_server AT TIME ZONE 'Asia/Jakarta')::date) INTO b
    FROM attendance a
   WHERE a.outlet_staff_id = r.outlet_staff_id AND a.status <> 'alpha'
     AND a.ts_server >= ((current_date - 7)::timestamp AT TIME ZONE 'Asia/Jakarta')
     AND a.ts_server <  ((current_date + 1)::timestamp AT TIME ZONE 'Asia/Jakarta');
  IF b <> r.hari_hadir THEN RAISE EXCEPTION 'hari_hadir % <> hitung manual %', r.hari_hadir, b; END IF;

  -- 2) kasbon per outlet = total hr_perizinan_ringkasan(p_exclude_staff uuid[]) (predikat sama)
  SELECT coalesce(sum(menunggu_jumlah),0) INTO n FROM hermes_kasbon_per_outlet('{}');
  SELECT ((hr_perizinan_ringkasan('{}')->'kasbon'->>'pending'))::int INTO b;
  IF n <> b THEN RAISE EXCEPTION 'kasbon menunggu % <> ringkasan HR %', n, b; END IF;

  SELECT coalesce(sum(aktif_jumlah),0) INTO n FROM hermes_kasbon_per_outlet('{}');
  SELECT ((hr_perizinan_ringkasan('{}')->'kasbon'->>'active'))::int INTO b;
  IF n <> b THEN RAISE EXCEPTION 'kasbon aktif % <> ringkasan HR %', n, b; END IF;

  -- 3) bukan untuk authenticated/anon
  IF has_function_privilege('authenticated', 'public.hermes_kasbon_per_outlet(uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated tidak boleh EXECUTE hermes_kasbon_per_outlet';
  END IF;
  IF has_function_privilege('anon', 'public.hermes_absensi_rekap_staf(date,date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon tidak boleh EXECUTE hermes_absensi_rekap_staf';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.hermes_absensi_rekap_staf(date,date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role harus EXECUTE hermes_absensi_rekap_staf';
  END IF;
  RAISE NOTICE 'T2 LULUS';
END $$;
ROLLBACK;
