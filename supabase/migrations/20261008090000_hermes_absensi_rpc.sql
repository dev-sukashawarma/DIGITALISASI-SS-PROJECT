-- Agregasi absensi & kasbon untuk alat MCP Hermes domain `absensi` (bot HRD).
-- Spec: docs/superpowers/specs/2026-10-07-bot-hrd-dashboard-design.md
-- Hanya service_role (dipanggil route /api/hermes/mcp setelah autentikasi kunci).

-- Per staf dalam rentang tanggal WIB (inklusif).
-- hari_hadir = jumlah hari WIB berbeda dengan absen ber-status <> 'alpha'
--              (= aturan "alpha virtual" layar Rekap; alpa = hari dinilai - hari_hadir,
--               dihitung di @suka/hr-rumus alpaDariHariHadir).
-- Telat dihitung dari status tersimpan absen masuk (tidak dihitung ulang).
-- Index: idx_attendance_ts_server (20260929120000) menutup filter rentang ts_server.
CREATE OR REPLACE FUNCTION public.hermes_absensi_rekap_staf(p_dari date, p_sampai date)
RETURNS TABLE (
  outlet_staff_id uuid,
  hari_hadir integer,
  jumlah_telat integer,
  jumlah_telat_toleransi integer,
  total_menit_telat integer
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT a.outlet_staff_id,
         count(DISTINCT (a.ts_server AT TIME ZONE 'Asia/Jakarta')::date) FILTER (WHERE a.status <> 'alpha')::int,
         count(*) FILTER (WHERE a.type = 'in' AND a.status = 'telat')::int,
         count(*) FILTER (WHERE a.type = 'in' AND a.status = 'telat_toleransi')::int,
         COALESCE(sum(a.telat_menit) FILTER (WHERE a.type = 'in' AND a.status IN ('telat','telat_toleransi')), 0)::int
    FROM attendance a
   WHERE a.ts_server >= (p_dari::timestamp AT TIME ZONE 'Asia/Jakarta')
     AND a.ts_server <  ((p_sampai + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
     AND a.outlet_staff_id IS NOT NULL
   GROUP BY a.outlet_staff_id
$$;

-- Kasbon per outlet staf. Predikat SAMA dengan hr_perizinan_ringkasan
-- (migration 20260930191000): menunggu = status_hr pending & belum lunas;
-- aktif = disetujui & berjalan, sisa = COALESCE(remaining, amount).
-- LEFT JOIN: kasbon tanpa baris staf tetap terhitung (outlet_id NULL) agar total
-- selalu sama dengan ringkasan HR.
CREATE OR REPLACE FUNCTION public.hermes_kasbon_per_outlet(p_exclude_staff uuid[] DEFAULT '{}')
RETURNS TABLE (
  outlet_id uuid,
  menunggu_jumlah integer,
  menunggu_nominal numeric,
  aktif_jumlah integer,
  aktif_sisa numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT s.outlet_id,
         count(*) FILTER (WHERE COALESCE(k.status_hr, 'pending') = 'pending' AND k.status != 'paid_off')::int,
         COALESCE(sum(k.amount) FILTER (WHERE COALESCE(k.status_hr, 'pending') = 'pending' AND k.status != 'paid_off'), 0),
         count(*) FILTER (WHERE k.status_hr = 'approved' AND k.status = 'active')::int,
         COALESCE(sum(COALESCE(k.remaining, k.amount)) FILTER (WHERE k.status_hr = 'approved' AND k.status = 'active'), 0)
    FROM cash_advances k
    LEFT JOIN outlet_staff s ON s.id = k.staff_id
   WHERE NOT (k.staff_id = ANY (COALESCE(p_exclude_staff, '{}')))
   GROUP BY s.outlet_id
$$;

REVOKE ALL ON FUNCTION public.hermes_absensi_rekap_staf(date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hermes_kasbon_per_outlet(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hermes_absensi_rekap_staf(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.hermes_kasbon_per_outlet(uuid[]) TO service_role;
