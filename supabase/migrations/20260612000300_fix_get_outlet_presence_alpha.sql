-- Fix: get_outlet_presence incorrectly counts 'alpha' records as 'in'
--
-- Akar masalah: cron job absen otomatis memasukkan record dengan type='in' dan status='alpha'
-- untuk orang yang tidak absen. Fungsi get_outlet_presence hanya mengecek latest_type='in',
-- sehingga menganggap outlet masih "ada orang" meskipun orang yang benar-benar masuk
-- sudah absen pulang (type='out').
--
-- Solusi: Filter record dengan status='alpha' dari subquery, sehingga hanya
-- absen masuk/pulang riil yang dihitung.

CREATE OR REPLACE FUNCTION get_outlet_presence(p_outlet_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM (
      SELECT outlet_staff_id, (array_agg(type ORDER BY ts_server DESC))[1] as latest_type
      FROM attendance
      WHERE outlet_id = p_outlet_id
        AND (ts_server AT TIME ZONE 'Asia/Jakarta')::date = (NOW() AT TIME ZONE 'Asia/Jakarta')::date
        AND status != 'alpha' -- EXCLUDE alpha records
      GROUP BY outlet_staff_id
    ) sub
    WHERE latest_type = 'in'
  );
$$;
