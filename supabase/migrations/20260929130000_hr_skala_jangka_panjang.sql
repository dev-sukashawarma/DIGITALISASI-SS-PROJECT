-- HR: query yang tetap hemat saat data menumpuk bertahun-tahun.
--
-- 1. `attendance_harian` — 1 baris per (staf, outlet, tanggal WIB), dipelihara
--    trigger di `attendance`. Halaman Absensi & rekap payroll/KPI membaca tabel
--    ini, bukan mengelompokkan ulang baris mentah tiap request. Biaya per halaman
--    jadi sebanding ukuran halaman (LIMIT lewat index), bukan panjang rentang.
--    Tambahan biaya tulis: 1 upsert kecil per clock-in/out.
-- 2. `hr_absensi_harian` & `hr_rekap_absensi_staf` ditulis ulang di atas tabel itu
--    (signature & bentuk hasil TIDAK berubah → aplikasi tidak perlu tahu).
-- 3. `hr_perizinan_ringkasan` — angka kartu Cuti/Kasbon dihitung di database,
--    supaya daftar Cuti/Kasbon bisa dipaginasi di server.
-- 4. Index untuk urutan/penyaringan daftar yang dipakai app HR.

-- ── 1. Tabel rekap harian ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_harian (
  staff_id          uuid        NOT NULL,
  outlet_id         uuid        NOT NULL,
  tgl               date        NOT NULL,           -- tanggal WIB
  first_id          uuid        NOT NULL,           -- id baris attendance pertama hari itu
  first_ts          timestamptz NOT NULL,
  clock_in          timestamptz,                    -- clock-in pertama
  clock_out         timestamptz,                    -- clock-out terakhir
  status_in         text,                           -- status mentah clock-in pertama
  status            text        NOT NULL,           -- hadir | terlambat | alfa
  telat_menit       integer     NOT NULL DEFAULT 0, -- tampilan (status terlambat)
  telat_menit_denda integer     NOT NULL DEFAULT 0, -- aturan denda payroll (semua clock-in hari itu)
  manual_in         boolean     NOT NULL DEFAULT false,
  selfie_in         text,
  selfie_out        text,
  lat               numeric,
  lng               numeric,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, outlet_id, tgl)
);

COMMENT ON TABLE public.attendance_harian IS
  'Rekap harian absensi (turunan attendance, dipelihara trigger trg_attendance_harian). Jangan ditulis manual.';

-- Urutan halaman (tgl desc, jam masuk desc) + kolom untuk hitung ringkasan tanpa baca tabel
CREATE INDEX IF NOT EXISTS idx_attendance_harian_tgl
  ON public.attendance_harian (tgl DESC, clock_in DESC NULLS LAST, staff_id)
  INCLUDE (status, outlet_id);
CREATE INDEX IF NOT EXISTS idx_attendance_harian_outlet_tgl
  ON public.attendance_harian (outlet_id, tgl DESC);

ALTER TABLE public.attendance_harian ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_harian FROM anon, authenticated;
GRANT SELECT ON public.attendance_harian TO authenticated;

-- RLS baca = cermin persis policy SELECT di `attendance` (per 2026-09-29)
DROP POLICY IF EXISTS attendance_harian_read ON public.attendance_harian;
CREATE POLICY attendance_harian_read ON public.attendance_harian FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT accessible_outlet_ids()));
DROP POLICY IF EXISTS attendance_harian_read_own ON public.attendance_harian;
CREATE POLICY attendance_harian_read_own ON public.attendance_harian FOR SELECT TO authenticated
  USING (staff_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS attendance_harian_read_kasir ON public.attendance_harian;
CREATE POLICY attendance_harian_read_kasir ON public.attendance_harian FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM outlet_staff s
    WHERE s.id = (SELECT auth.uid())
      AND (s.outlet_id = attendance_harian.outlet_id
           OR s.role = ANY (ARRAY['admin', 'admin_hr', 'spv', 'korlap']))
  ));
DROP POLICY IF EXISTS attendance_harian_spv_read_outlet ON public.attendance_harian;
CREATE POLICY attendance_harian_spv_read_outlet ON public.attendance_harian FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM outlet_staff me
    WHERE me.id = (SELECT auth.uid())
      AND me.outlet_id = attendance_harian.outlet_id
      AND me.role = ANY (ARRAY['spv', 'leader', 'kitchen'])
  ));

-- Hitung ulang satu (staf, outlet, tanggal) dari baris mentah. Idempoten.
CREATE OR REPLACE FUNCTION public.attendance_harian_hitung(p_staff uuid, p_outlet uuid, p_tgl date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Serialisasi per kunci: clock-in & clock-out yang masuk bersamaan tidak saling timpa.
  -- Setelah lock, statement berikut memakai snapshot baru (READ COMMITTED) → melihat
  -- baris milik transaksi yang tadi memegang lock.
  PERFORM pg_advisory_xact_lock(hashtextextended('attendance_harian:' || p_staff || ':' || p_outlet || ':' || p_tgl, 0));

  WITH raw AS (
    SELECT a.id, a.type, a.ts_server, a.status, a.selfie_url, a.gps_lat, a.gps_lng,
           a.telat_menit, a.is_manual_button
    FROM attendance a
    WHERE a.outlet_staff_id = p_staff
      AND a.outlet_id = p_outlet
      AND a.ts_server >= (p_tgl::timestamp AT TIME ZONE 'Asia/Jakarta')
      AND a.ts_server <  ((p_tgl + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
  ),
  agg AS (
    SELECT
      (array_agg(r.id ORDER BY r.ts_server))[1]                                           AS first_id,
      min(r.ts_server)                                                                     AS first_ts,
      min(r.ts_server) FILTER (WHERE r.type = 'in')                                        AS clock_in,
      max(r.ts_server) FILTER (WHERE r.type = 'out')                                       AS clock_out,
      (array_agg(r.status ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1]           AS status_in,
      (array_agg(r.telat_menit ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1]      AS telat_in,
      COALESCE(sum(r.telat_menit) FILTER (
        WHERE r.type = 'in' AND (COALESCE(r.telat_menit, 0) > 0 OR r.status IN ('telat', 'terlambat'))
      ), 0)::integer                                                                       AS telat_denda,
      COALESCE((array_agg(r.is_manual_button ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1], false) AS manual_in,
      (array_agg(r.selfie_url ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1]       AS selfie_in,
      (array_agg(r.gps_lat ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1]          AS lat,
      (array_agg(r.gps_lng ORDER BY r.ts_server) FILTER (WHERE r.type = 'in'))[1]          AS lng,
      (array_agg(r.selfie_url ORDER BY r.ts_server DESC) FILTER (WHERE r.type = 'out'))[1] AS selfie_out,
      count(*) AS n
    FROM raw r
  )
  INSERT INTO attendance_harian AS h (
    staff_id, outlet_id, tgl, first_id, first_ts, clock_in, clock_out, status_in, status,
    telat_menit, telat_menit_denda, manual_in, selfie_in, selfie_out, lat, lng, updated_at
  )
  SELECT p_staff, p_outlet, p_tgl, g.first_id, g.first_ts, g.clock_in, g.clock_out, g.status_in,
    CASE
      WHEN g.status_in IN ('telat', 'terlambat', 'telat_toleransi') THEN 'terlambat'
      WHEN g.status_in IN ('alpha', 'alfa') THEN 'alfa'
      ELSE 'hadir'
    END,
    CASE WHEN g.status_in IN ('telat', 'terlambat', 'telat_toleransi') THEN COALESCE(g.telat_in, 0) ELSE 0 END,
    g.telat_denda, g.manual_in, g.selfie_in, g.selfie_out, g.lat, g.lng, now()
  FROM agg g
  WHERE g.n > 0
  ON CONFLICT (staff_id, outlet_id, tgl) DO UPDATE SET
    first_id = EXCLUDED.first_id, first_ts = EXCLUDED.first_ts,
    clock_in = EXCLUDED.clock_in, clock_out = EXCLUDED.clock_out,
    status_in = EXCLUDED.status_in, status = EXCLUDED.status,
    telat_menit = EXCLUDED.telat_menit, telat_menit_denda = EXCLUDED.telat_menit_denda,
    manual_in = EXCLUDED.manual_in, selfie_in = EXCLUDED.selfie_in, selfie_out = EXCLUDED.selfie_out,
    lat = EXCLUDED.lat, lng = EXCLUDED.lng, updated_at = now();

  -- Semua baris hari itu terhapus → hapus rekapnya juga
  IF NOT FOUND THEN
    DELETE FROM attendance_harian
    WHERE staff_id = p_staff AND outlet_id = p_outlet AND tgl = p_tgl;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.attendance_harian_hitung(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_attendance_harian()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_tgl date;
  v_old_tgl date;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new_tgl := (NEW.ts_server AT TIME ZONE 'Asia/Jakarta')::date;
    PERFORM attendance_harian_hitung(NEW.outlet_staff_id, NEW.outlet_id, v_new_tgl);
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old_tgl := (OLD.ts_server AT TIME ZONE 'Asia/Jakarta')::date;
    IF TG_OP = 'DELETE'
       OR OLD.outlet_staff_id IS DISTINCT FROM NEW.outlet_staff_id
       OR OLD.outlet_id IS DISTINCT FROM NEW.outlet_id
       OR v_old_tgl IS DISTINCT FROM v_new_tgl THEN
      PERFORM attendance_harian_hitung(OLD.outlet_staff_id, OLD.outlet_id, v_old_tgl);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_attendance_harian() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_attendance_harian ON public.attendance;
CREATE TRIGGER trg_attendance_harian
  AFTER INSERT OR UPDATE OR DELETE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.trg_attendance_harian();

-- Backfill (idempoten): hitung ulang semua kunci yang ada
DO $$
DECLARE k record;
BEGIN
  FOR k IN
    SELECT DISTINCT outlet_staff_id, outlet_id, (ts_server AT TIME ZONE 'Asia/Jakarta')::date AS tgl
    FROM attendance
  LOOP
    PERFORM attendance_harian_hitung(k.outlet_staff_id, k.outlet_id, k.tgl);
  END LOOP;
END $$;

-- ── 2. RPC halaman Absensi di atas rekap harian ───────────────────────────────
-- Halaman: index idx_attendance_harian_tgl dibaca berurutan lalu berhenti di LIMIT.
-- Total & ringkasan: index-only scan kecil atas rentang (tanpa membaca baris tabel).
CREATE OR REPLACE FUNCTION public.hr_absensi_harian(
  p_from           date,
  p_to             date,
  p_outlet         uuid    DEFAULT NULL,
  p_status         text    DEFAULT NULL,
  p_search         text    DEFAULT NULL,
  p_exclude_staff  uuid[]  DEFAULT '{}',
  p_exclude_outlet uuid[]  DEFAULT '{}',
  p_limit          integer DEFAULT 50,
  p_offset         integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_status  text := NULLIF(NULLIF(p_status, ''), 'all');
  v_q       text := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_staff   uuid[];
  v_ex_s    uuid[] := COALESCE(p_exclude_staff, '{}');
  v_ex_o    uuid[] := COALESCE(p_exclude_outlet, '{}');
  v_limit   integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 5000);
  v_offset  integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_ring    jsonb;
  v_total   bigint;
  v_rows    jsonb;
BEGIN
  -- Pencarian nama/username → daftar id staf (tabel staf kecil), lalu disaring pakai id
  IF v_q IS NOT NULL THEN
    v_q := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    SELECT COALESCE(array_agg(s.id), '{}') INTO v_staff
    FROM outlet_staff s
    WHERE s.name ILIKE v_q OR s.username ILIKE v_q;
  END IF;

  SELECT
    jsonb_build_object(
      'hadir',     count(*) FILTER (WHERE h.status = 'hadir'),
      'terlambat', count(*) FILTER (WHERE h.status = 'terlambat'),
      'alfa',      count(*) FILTER (WHERE h.status = 'alfa')
    ),
    count(*) FILTER (WHERE v_status IS NULL OR h.status = v_status)
  INTO v_ring, v_total
  FROM attendance_harian h
  WHERE h.tgl BETWEEN p_from AND p_to
    AND (p_outlet IS NULL OR h.outlet_id = p_outlet)
    AND NOT (h.staff_id = ANY (v_ex_s))
    AND NOT (h.outlet_id = ANY (v_ex_o))
    AND (v_staff IS NULL OR h.staff_id = ANY (v_staff));

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', p.first_id,
      'staff_id', p.staff_id,
      'outlet_id', p.outlet_id,
      'date', to_char(p.tgl, 'YYYY-MM-DD'),
      'clock_in', p.clock_in,
      'clock_out', p.clock_out,
      'status', p.status,
      'late_minutes', p.telat_menit,
      'notes', NULLIF(concat_ws(', ',
        CASE WHEN p.manual_in THEN 'Absen Manual' END,
        CASE WHEN p.status_in = 'telat_toleransi' THEN 'Telat dalam toleransi' END), ''),
      'selfie_in', p.selfie_in,
      'selfie_out', p.selfie_out,
      'lat', p.lat,
      'lng', p.lng,
      'created_at', p.first_ts,
      'outlet_staff', CASE WHEN s.id IS NULL THEN NULL ELSE
        jsonb_build_object('name', s.name, 'role', s.role, 'username', s.username) END,
      'outlets', CASE WHEN o.id IS NULL THEN NULL ELSE jsonb_build_object('name', o.name) END
    ) ORDER BY p.tgl DESC, p.clock_in DESC NULLS LAST, p.staff_id), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT h.*
    FROM attendance_harian h
    WHERE h.tgl BETWEEN p_from AND p_to
      AND (p_outlet IS NULL OR h.outlet_id = p_outlet)
      AND (v_status IS NULL OR h.status = v_status)
      AND NOT (h.staff_id = ANY (v_ex_s))
      AND NOT (h.outlet_id = ANY (v_ex_o))
      AND (v_staff IS NULL OR h.staff_id = ANY (v_staff))
    ORDER BY h.tgl DESC, h.clock_in DESC NULLS LAST, h.staff_id
    LIMIT v_limit OFFSET v_offset
  ) p
  LEFT JOIN outlet_staff s ON s.id = p.staff_id
  LEFT JOIN outlets o      ON o.id = p.outlet_id;

  RETURN jsonb_build_object('total', v_total, 'ringkasan', v_ring, 'rows', v_rows);
END;
$$;

-- ── Rekap per staf (payroll & KPI) di atas rekap harian ───────────────────────
CREATE OR REPLACE FUNCTION public.hr_rekap_absensi_staf(p_from date, p_to date)
RETURNS TABLE (
  staff_id          uuid,
  hari_masuk        integer,
  hari_tepat        integer,
  telat_menit_total integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  -- DISTINCT tgl: staf yang absen di 2 outlet pada hari yang sama tetap dihitung 1 hari
  SELECT h.staff_id,
         count(DISTINCT h.tgl) FILTER (WHERE h.clock_in IS NOT NULL)::integer,
         count(DISTINCT h.tgl) FILTER (WHERE h.status_in = 'tepat')::integer,
         COALESCE(sum(h.telat_menit_denda), 0)::integer
  FROM attendance_harian h
  WHERE h.tgl BETWEEN p_from AND p_to
  GROUP BY h.staff_id
  HAVING count(*) FILTER (WHERE h.clock_in IS NOT NULL) > 0;
$$;

-- ── 3. Ringkasan kartu Cuti & Kasbon ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hr_perizinan_ringkasan(p_exclude_staff uuid[] DEFAULT '{}')
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'cuti', (
      SELECT jsonb_build_object(
        'pending',  count(*) FILTER (WHERE l.status = 'pending'),
        'approved', count(*) FILTER (WHERE l.status = 'approved'),
        'rejected', count(*) FILTER (WHERE l.status = 'rejected'),
        'total',    count(*)
      )
      FROM leave_requests l
      WHERE NOT (l.staff_id = ANY (COALESCE(p_exclude_staff, '{}')))
    ),
    'kasbon', (
      SELECT jsonb_build_object(
        'pending',       count(*) FILTER (WHERE k.status = 'pending'),
        'active',        count(*) FILTER (WHERE k.status = 'active'),
        'total',         count(*),
        'active_amount', COALESCE(sum(COALESCE(k.remaining, k.amount)) FILTER (WHERE k.status = 'active'), 0),
        'paid_amount',   COALESCE(sum(k.amount - COALESCE(k.remaining, k.amount)), 0)
      )
      FROM cash_advances k
      WHERE NOT (k.staff_id = ANY (COALESCE(p_exclude_staff, '{}')))
    )
  );
$$;

REVOKE ALL ON FUNCTION public.hr_perizinan_ringkasan(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_perizinan_ringkasan(uuid[]) TO authenticated;

-- ── 4. Index daftar ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leave_requests_created_at ON public.leave_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_advances_created_at  ON public.cash_advances (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_advances_status      ON public.cash_advances (status);
-- FK tanpa index: embed cash_advance_payments per kasbon & ON DELETE memindai seluruh tabel
CREATE INDEX IF NOT EXISTS idx_cash_advance_payments_ca  ON public.cash_advance_payments (cash_advance_id);
