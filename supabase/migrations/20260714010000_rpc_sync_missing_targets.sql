-- ====================================================================
-- Menambahkan fungsi RPC untuk memicu pencatatan target secara manual
-- dari dashboard admin. Ini berguna saat cron job gagal berjalan 
-- karena komputer mati/sleep di lokal, atau untuk melakukan backfill
-- rentang tanggal secara on-demand.
-- ====================================================================

CREATE OR REPLACE FUNCTION sync_missing_daily_targets(p_start_date date, p_end_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  d date;
BEGIN
  -- Batasi maksimal 31 hari dalam satu kali sinkronisasi untuk mencegah beban berlebih
  IF (p_end_date - p_start_date) > 31 THEN
    RAISE EXCEPTION 'Rentang tanggal maksimal untuk sinkronisasi adalah 31 hari';
  END IF;

  IF p_start_date > p_end_date THEN
    RAISE EXCEPTION 'Tanggal mulai tidak boleh lebih besar dari tanggal akhir';
  END IF;

  -- Loop dari start_date hingga end_date
  FOR d IN SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date LOOP
    PERFORM snapshot_daily_targets(d);
  END LOOP;
END;
$$;

-- Berikan akses agar bisa dipanggil melalui API Supabase (authenticated user)
GRANT EXECUTE ON FUNCTION sync_missing_daily_targets(date, date) TO authenticated;
