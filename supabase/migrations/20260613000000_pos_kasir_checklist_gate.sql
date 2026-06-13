-- 20260613000000_pos_kasir_checklist_gate.sql
-- Gate dashboard kasir (apps/pos-kasir) berdasarkan status operasional outlet:
--   belum_mulai -> buka (kru hadir + checklist buka toko 100%) -> tutup (semua kru absen pulang)
--
-- Lihat CONTEXT.md bagian "Operasional Harian Outlet & Gate Kasir".

-- 1. Status operasional outlet hari ini (3 state, menggantikan get_outlet_presence di blocker)
CREATE OR REPLACE FUNCTION get_outlet_day_status(p_outlet_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM attendance
      WHERE outlet_id = p_outlet_id
        AND (ts_server AT TIME ZONE 'Asia/Jakarta')::date = (NOW() AT TIME ZONE 'Asia/Jakarta')::date
        AND status != 'alpha'
    ) THEN 'belum_mulai'
    WHEN EXISTS (
      SELECT 1
      FROM (
        SELECT outlet_staff_id, (array_agg(type ORDER BY ts_server DESC))[1] AS latest_type
        FROM attendance
        WHERE outlet_id = p_outlet_id
          AND (ts_server AT TIME ZONE 'Asia/Jakarta')::date = (NOW() AT TIME ZONE 'Asia/Jakarta')::date
          AND status != 'alpha'
        GROUP BY outlet_staff_id
      ) sub
      WHERE latest_type = 'in'
    ) THEN 'buka'
    ELSE 'tutup'
  END;
$$;

-- 2. Progress checklist (total vs selesai) untuk fase tertentu, hari ini
CREATE OR REPLACE FUNCTION get_outlet_checklist_progress(p_outlet_id UUID, p_phase TEXT)
RETURNS TABLE(total_items INT, done_items INT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH items AS (
    SELECT ci.id
    FROM checklist_items ci
    JOIN checklist_categories cc ON cc.id = ci.category_id
    WHERE cc.outlet_id = p_outlet_id AND cc.phase = p_phase
  ),
  today_record AS (
    SELECT id FROM daily_checklist_records
    WHERE outlet_id = p_outlet_id
      AND date = (NOW() AT TIME ZONE 'Asia/Jakarta')::date
  )
  SELECT
    (SELECT COUNT(*) FROM items)::int,
    (SELECT COUNT(*) FROM daily_checklist_ticks t
      WHERE t.item_id IN (SELECT id FROM items)
        AND t.record_id IN (SELECT id FROM today_record))::int;
$$;

-- 3. RLS: izinkan profil kasir membaca data checklist outlet-nya sendiri
-- (diperlukan agar realtime postgres_changes bisa diterima oleh GlobalBlockerMount)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_checklist_records' AND policyname = 'checklist_records_read_kasir'
  ) THEN
    CREATE POLICY "checklist_records_read_kasir" ON daily_checklist_records
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM outlet_staff s
          WHERE s.id = auth.uid()
            AND s.role = 'kasir'
            AND s.outlet_id = daily_checklist_records.outlet_id
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_checklist_ticks' AND policyname = 'checklist_ticks_read_kasir'
  ) THEN
    CREATE POLICY "checklist_ticks_read_kasir" ON daily_checklist_ticks
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM daily_checklist_records r
          JOIN outlet_staff s ON s.outlet_id = r.outlet_id
          WHERE r.id = daily_checklist_ticks.record_id
            AND s.id = auth.uid()
            AND s.role = 'kasir'
        )
      );
  END IF;
END $$;

-- 4. Pastikan daily_checklist_records ikut di Realtime publication
-- (daily_checklist_ticks sudah ditambahkan di migration m1_absensi_checklist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'daily_checklist_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE daily_checklist_records;
  END IF;
END $$;
