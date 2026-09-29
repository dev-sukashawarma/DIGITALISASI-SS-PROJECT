-- TEMPLATE: status yang dihitung dari KETIADAAN data (alfa, belum setor, tidak opname, ...)
-- Contoh nyata: 20260929150000_hr_status_kehadiran_lengkap.sql
-- Tulis ke tabel rekap dengan kolom `sumber` ('data' | 'otomatis'), jangan ke tabel mentah.

-- Satu fungsi idempoten per (tanggal, entitas?). p_entitas NULL = semua.
CREATE OR REPLACE FUNCTION public.hitung_status_otomatis(p_tgl date, p_entitas uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer; v_hari_ini date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  DELETE FROM <rekap> r WHERE r.tgl = p_tgl AND r.sumber = 'otomatis'
    AND (p_entitas IS NULL OR r.entitas_id = p_entitas);

  IF NOT <hari_wajib>(p_tgl) THEN RETURN 0; END IF;      -- libur/tanggal merah dari TABEL

  INSERT INTO <rekap> (entitas_id, tgl, status, sumber)
  SELECT e.id, p_tgl, 'tidak_ada', 'otomatis'
  FROM <entitas> e
  WHERE (p_entitas IS NULL OR e.id = p_entitas)
    AND <entitas_sungguhan>                                 -- bukan akun tes/dummy
    AND p_tgl >= <tanggal_mulai_entitas>                    -- sejak bergabung
    AND p_tgl <  v_hari_ini                                 -- hari sudah selesai
    AND p_tgl >= <tanggal_mulai_pelacakan>()                -- dari global_settings
    AND EXISTS (SELECT 1 FROM <rekap> f                     -- sejak pertama memakai sistem
                WHERE f.entitas_id = e.id AND f.sumber = 'data' AND f.tgl <= p_tgl)
    AND NOT EXISTS (SELECT 1 FROM <rekap> d                 -- belum ada data hari itu
                    WHERE d.entitas_id = e.id AND d.tgl = p_tgl AND d.sumber = 'data')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END; $$;
REVOKE ALL ON FUNCTION public.hitung_status_otomatis(date, uuid) FROM PUBLIC, anon, authenticated;

-- Dipicu oleh SETIAP sumber yang memengaruhi hasil: data masuk/dihapus, pengecualian
-- (cuti/izin) berubah, hari libur berubah, master entitas berubah → PERFORM hitung_status_otomatis(tgl, id)

-- Cron harian: tutup kemarin + lookback 7 hari. pg_cron = UTC → '10 17 * * *' = 00:10 WIB
SELECT cron.schedule('status-otomatis-harian', '10 17 * * *',
  $c$SELECT public.hitung_status_otomatis(d::date)
     FROM generate_series((now() AT TIME ZONE 'Asia/Jakarta')::date - 7,
                          (now() AT TIME ZONE 'Asia/Jakarta')::date - 1, interval '1 day') d;$c$);
