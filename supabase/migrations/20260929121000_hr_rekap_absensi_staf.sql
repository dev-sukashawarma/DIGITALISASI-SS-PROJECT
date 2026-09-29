-- Rekap absensi per staf untuk satu rentang tanggal (WIB), dihitung di database.
--
-- Dipakai apps/HR: denda telat payroll (usePayrollMutations) dan KPI performa
-- (usePerformance). Keduanya dulu menarik SELURUH baris `attendance` sebulan ke
-- browser tanpa pagination → terpotong di 1.000 baris (September = 2.405 baris),
-- jadi sebagian staf dapat denda telat Rp 0 / KPI salah, dan acak antar-run.
-- Hasil fungsi ini 1 baris per staf (±170), jauh di bawah batas PostgREST.
--
-- Aturan denda telat SAMA PERSIS dengan kode lama (baris `in` dengan
-- telat_menit > 0 atau status telat/terlambat) — tidak ada perubahan kebijakan.
-- SECURITY INVOKER: RLS `attendance` tetap berlaku.

CREATE OR REPLACE FUNCTION public.hr_rekap_absensi_staf(p_from date, p_to date)
RETURNS TABLE (
  staff_id          uuid,
  hari_masuk        integer,  -- tanggal WIB berbeda dengan clock-in
  hari_tepat        integer,  -- tanggal WIB dengan clock-in pertama berstatus 'tepat'
  telat_menit_total integer   -- jumlah menit telat (aturan denda payroll)
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH masuk AS (
    SELECT a.outlet_staff_id,
           (a.ts_server AT TIME ZONE 'Asia/Jakarta')::date AS tgl,
           a.ts_server, a.status, a.telat_menit
    FROM attendance a
    WHERE a.type = 'in'
      AND a.ts_server >= (p_from::timestamp AT TIME ZONE 'Asia/Jakarta')
      AND a.ts_server <  ((p_to + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
  ),
  per_hari AS (
    SELECT m.outlet_staff_id, m.tgl,
           (array_agg(m.status ORDER BY m.ts_server))[1] AS status_pertama
    FROM masuk m
    GROUP BY m.outlet_staff_id, m.tgl
  ),
  telat AS (
    SELECT m.outlet_staff_id,
           COALESCE(sum(m.telat_menit) FILTER (
             WHERE COALESCE(m.telat_menit, 0) > 0 OR m.status IN ('telat', 'terlambat')
           ), 0)::integer AS menit
    FROM masuk m
    GROUP BY m.outlet_staff_id
  )
  SELECT h.outlet_staff_id,
         count(*)::integer,
         count(*) FILTER (WHERE h.status_pertama = 'tepat')::integer,
         COALESCE(max(t.menit), 0)::integer
  FROM per_hari h
  LEFT JOIN telat t ON t.outlet_staff_id = h.outlet_staff_id
  GROUP BY h.outlet_staff_id;
$$;

REVOKE ALL ON FUNCTION public.hr_rekap_absensi_staf(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_rekap_absensi_staf(date, date) TO authenticated;
