-- 20260613000100_unify_profiles_into_outlet_staff.sql
-- Menyatukan tabel `profiles` (identitas POS) ke dalam `outlet_staff`
-- (identitas kanonik suite). Sejak migration ini, `outlet_staff` adalah SATU-SATUNYA
-- tabel identitas user untuk seluruh aplikasi (absensi, POS kasir, dan sistem lain
-- yang akan diintegrasikan). Tabel `profiles` di-DROP.
--
-- Keputusan (lihat CONTEXT.md "Identitas & Orang" + docs/adr):
--   1. Satu kolom `role` dengan 6 nilai: crew, kasir, spv, kepala_outlet, admin, kiosk
--   2. Tambah kolom is_active + inactive_reason (gate akun untuk POS/blocker)
--   3. outlet_id jadi NULLABLE (admin global tanpa outlet)
--   4. profiles di-DROP setelah datanya dipindah
--
-- ⚠️ outlet_staff.id TETAP = auth.users.id (aturan provisioning tidak berubah).

-- ── 1. Perluas kolom outlet_staff ──────────────────────────────────────────

-- 1a. Tambah kolom yang sebelumnya milik profiles
ALTER TABLE public.outlet_staff
  ADD COLUMN IF NOT EXISTS username        TEXT,
  ADD COLUMN IF NOT EXISTS is_active       BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inactive_reason TEXT;

-- 1b. username unik (abaikan NULL — staf absensi lama tidak punya username)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'outlet_staff_username_key'
  ) THEN
    ALTER TABLE public.outlet_staff ADD CONSTRAINT outlet_staff_username_key UNIQUE (username);
  END IF;
END $$;

-- 1c. outlet_id jadi nullable (admin global)
ALTER TABLE public.outlet_staff ALTER COLUMN outlet_id DROP NOT NULL;

-- 1d. Perluas CHECK role jadi 6 nilai
ALTER TABLE public.outlet_staff DROP CONSTRAINT IF EXISTS outlet_staff_role_check;
ALTER TABLE public.outlet_staff
  ADD CONSTRAINT outlet_staff_role_check
  CHECK (role IN ('crew', 'kasir', 'spv', 'kepala_outlet', 'admin', 'kiosk'));

-- 1e. Selaraskan is_active dengan status lama untuk baris yang sudah ada
UPDATE public.outlet_staff SET is_active = (status = 'active') WHERE status IS NOT NULL;

-- ── 2. Migrasi data (idempotent, tahan untuk profiles=TABEL maupun VIEW) ─────
-- Catatan: di DB ini `profiles` adalah VIEW di atas outlet_staff (data SUDAH
-- ada di outlet_staff) → cukup pulihkan kolom baru. Bila di environment lain
-- `profiles` masih TABEL nyata, blok BASE TABLE memindahkan datanya.
DO $$
DECLARE prof_kind text;
BEGIN
  SELECT table_type INTO prof_kind FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'profiles';

  IF prof_kind = 'BASE TABLE' THEN
    -- 2a. Salin is_active + inactive_reason dari tabel profiles nyata
    UPDATE public.outlet_staff os
    SET is_active       = COALESCE(p.is_active, os.is_active),
        inactive_reason = COALESCE(os.inactive_reason, p.inactive_reason)
    FROM public.profiles p
    WHERE p.id = os.id;

    -- 2b. Insert baris yang HANYA ada di profiles (admin/kiosk), tanpa username
    INSERT INTO public.outlet_staff (id, outlet_id, name, role, status, is_active, inactive_reason)
    SELECT
      p.id, p.outlet_id,
      COALESCE(p.username, (SELECT email FROM auth.users u WHERE u.id = p.id), 'user_' || left(p.id::text, 8)),
      p.role,
      CASE WHEN COALESCE(p.is_active, true) THEN 'active' ELSE 'inactive' END,
      COALESCE(p.is_active, true),
      p.inactive_reason
    FROM public.profiles p
    WHERE NOT EXISTS (SELECT 1 FROM public.outlet_staff os WHERE os.id = p.id)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 2c. Pulihkan username login dari pseudo-email (username@outlet.local),
-- bukan dari `name`. Dedup-safe: kalau bentrok, biarkan NULL.
UPDATE public.outlet_staff os
SET username = split_part(u.email, '@', 1)
FROM auth.users u
WHERE u.id = os.id
  AND os.username IS NULL
  AND u.email LIKE '%@outlet.local'
  AND NOT EXISTS (
    SELECT 1 FROM public.outlet_staff o2
    WHERE o2.username = split_part(u.email, '@', 1) AND o2.id <> os.id
  );

-- ── 3. Repoint fungsi helper POS ke outlet_staff ───────────────────────────
-- (Policy POS yang memakai fungsi ini otomatis ikut benar setelah ini.)
CREATE OR REPLACE FUNCTION get_user_role() RETURNS text AS $$
  SELECT role FROM public.outlet_staff WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_outlet_id() RETURNS uuid AS $$
  SELECT outlet_id FROM public.outlet_staff WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ── 4. Recreate policy yang LANGSUNG menyebut profiles → pakai outlet_staff ──

-- 4a. attendance_read_kasir (dibuat di merge_pos_schema + fix_realtime_attendance)
DROP POLICY IF EXISTS "attendance_read_kasir" ON public.attendance;
CREATE POLICY "attendance_read_kasir" ON public.attendance
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid()
        AND s.role = 'kasir'
        AND s.outlet_id = attendance.outlet_id
    )
  );

-- 4b. Admin akses penuh ke outlet_staff (pengganti profiles_all_admin)
-- Dibutuhkan agar halaman /admin/users (client) bisa LIST semua user.
-- get_user_role() SECURITY DEFINER → tidak rekursif terhadap RLS outlet_staff.
DROP POLICY IF EXISTS "outlet_staff_admin_all" ON public.outlet_staff;
CREATE POLICY "outlet_staff_admin_all" ON public.outlet_staff
  FOR ALL
  TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- 4c. Checklist gate policies: drop+recreate pakai outlet_staff.
-- (Kalau gate migration lama sempat membuatnya menyebut profiles, ini melepas
--  dependensi tsb agar DROP TABLE profiles tidak gagal.)
DROP POLICY IF EXISTS "checklist_records_read_kasir" ON public.daily_checklist_records;
CREATE POLICY "checklist_records_read_kasir" ON public.daily_checklist_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid() AND s.role = 'kasir'
        AND s.outlet_id = daily_checklist_records.outlet_id
    )
  );

DROP POLICY IF EXISTS "checklist_ticks_read_kasir" ON public.daily_checklist_ticks;
CREATE POLICY "checklist_ticks_read_kasir" ON public.daily_checklist_ticks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_checklist_records r
      JOIN public.outlet_staff s ON s.outlet_id = r.outlet_id
      WHERE r.id = daily_checklist_ticks.record_id
        AND s.id = auth.uid() AND s.role = 'kasir'
    )
  );

-- ── 5. Realtime: pastikan outlet_staff ikut publication ────────────────────
-- (GlobalBlockerMount subscribe UPDATE outlet_staff untuk blokir akun real-time)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'outlet_staff'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.outlet_staff;
  END IF;
END $$;

-- ── 6. Hapus profiles (otomatis: VIEW → DROP VIEW, TABEL → DROP TABLE) ──────
DO $$
DECLARE prof_kind text;
BEGIN
  SELECT table_type INTO prof_kind FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'profiles';

  IF prof_kind = 'VIEW' THEN
    DROP VIEW IF EXISTS public.profiles;
  ELSIF prof_kind = 'BASE TABLE' THEN
    DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_all_admin"  ON public.profiles;
    DROP TABLE IF EXISTS public.profiles;
  END IF;
END $$;
