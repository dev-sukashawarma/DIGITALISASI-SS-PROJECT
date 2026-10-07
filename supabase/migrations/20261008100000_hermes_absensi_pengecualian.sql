-- Alpa bot HRD mengecualikan cuti disetujui, hari libur role kantor, dan Off Shift Roster.
-- Menambah kolom `hari_dikecualikan` ke hermes_absensi_rekap_staf: jumlah hari WIB dalam
-- rentang (dipotong hari ini) di mana staf TIDAK punya absen non-alpha DAN dikecualikan:
--   (a) cuti/izin disetujui (leave_requests.status='approved') mencakup hari itu, atau
--   (b) Off di Shift Roster (attendance_logs.notes ILIKE 'off'), atau
--   (c) bukan hari kerja (hr_hari_kerja: Minggu / tanggal merah aktif) DAN role termasuk
--       hr_role_libur_kantor() — crew outlet tetap wajib masuk.
-- Cakupan staf: seluruh outlet_staff aktif + staf yang punya absen di rentang (agar hari
-- dikecualikan staf tanpa absen sama sekali ikut terhitung).
-- Alpa = hari dinilai - hari_hadir - hari_dikecualikan (alpaDariHariHadir di @suka/hr-rumus).
-- Kolom output berubah -> DROP lalu CREATE.

DROP FUNCTION IF EXISTS public.hermes_absensi_rekap_staf(date, date);

CREATE FUNCTION public.hermes_absensi_rekap_staf(p_dari date, p_sampai date)
RETURNS TABLE (
  outlet_staff_id uuid,
  hari_hadir integer,
  jumlah_telat integer,
  jumlah_telat_toleransi integer,
  total_menit_telat integer,
  hari_dikecualikan integer
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH rentang AS (
    SELECT (p_dari::timestamp AT TIME ZONE 'Asia/Jakarta') AS t0,
           ((p_sampai + 1)::timestamp AT TIME ZONE 'Asia/Jakarta') AS t1
  ),
  absen AS (
    SELECT a.outlet_staff_id AS sid,
           (a.ts_server AT TIME ZONE 'Asia/Jakarta')::date AS hari,
           a.type, a.status, a.telat_menit
      FROM attendance a, rentang r
     WHERE a.ts_server >= r.t0 AND a.ts_server < r.t1
       AND a.outlet_staff_id IS NOT NULL
  ),
  agregat AS (
    SELECT sid,
           count(DISTINCT hari) FILTER (WHERE status <> 'alpha')::int AS hadir,
           count(*) FILTER (WHERE type = 'in' AND status = 'telat')::int AS telat,
           count(*) FILTER (WHERE type = 'in' AND status = 'telat_toleransi')::int AS toleransi,
           COALESCE(sum(telat_menit) FILTER (WHERE type = 'in' AND status IN ('telat','telat_toleransi')), 0)::int AS menit
      FROM absen GROUP BY sid
  ),
  hadir_hari AS (
    SELECT DISTINCT sid, hari FROM absen WHERE status <> 'alpha'
  ),
  staf AS (
    SELECT s.id AS sid, s.role FROM outlet_staff s WHERE s.status = 'active'
    UNION
    SELECT s.id, s.role FROM outlet_staff s WHERE s.id IN (SELECT sid FROM agregat)
  ),
  hari AS (
    SELECT d::date AS tgl, hr_hari_kerja(d::date) AS kerja
      FROM generate_series(p_dari, LEAST(p_sampai, (now() AT TIME ZONE 'Asia/Jakarta')::date), interval '1 day') d
  ),
  role_libur AS (SELECT hr_role_libur_kantor() AS roles),
  kecuali AS (
    SELECT st.sid, count(*)::int AS n
      FROM staf st
      CROSS JOIN hari h
      CROSS JOIN role_libur rl
     WHERE NOT EXISTS (SELECT 1 FROM hadir_hari hh WHERE hh.sid = st.sid AND hh.hari = h.tgl)
       AND (
         EXISTS (SELECT 1 FROM leave_requests l
                  WHERE l.staff_id = st.sid AND l.status = 'approved'
                    AND h.tgl BETWEEN l.start_date AND l.end_date)
         OR EXISTS (SELECT 1 FROM attendance_logs al
                     WHERE al.staff_id = st.sid AND al.date = h.tgl AND al.notes ILIKE 'off')
         OR (NOT h.kerja AND st.role = ANY (rl.roles))
       )
     GROUP BY st.sid
  )
  SELECT st.sid,
         COALESCE(ag.hadir, 0),
         COALESCE(ag.telat, 0),
         COALESCE(ag.toleransi, 0),
         COALESCE(ag.menit, 0),
         COALESCE(k.n, 0)
    FROM staf st
    LEFT JOIN agregat ag ON ag.sid = st.sid
    LEFT JOIN kecuali k ON k.sid = st.sid
$$;

REVOKE ALL ON FUNCTION public.hermes_absensi_rekap_staf(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hermes_absensi_rekap_staf(date, date) TO service_role;
-- Fungsi bantu SECURITY DEFINER harus bisa dipanggil service_role (default grant tak dijamin).
GRANT EXECUTE ON FUNCTION public.hr_hari_kerja(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_role_libur_kantor() TO service_role;
