# Login SSO — Plan 1: Fondasi Identitas (DB) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyatukan identitas ke satu sumber (`outlet_staff`) dengan role lengkap & scope multi-outlet, sebagai fondasi SSO.

**Architecture:** Tambah role `admin/owner/kiosk` ke `outlet_staff`; buat tabel pemetaan `staff_outlets` (kepala_outlet multi-outlet); migrasikan baris `profiles` ke `outlet_staff` lalu ubah `profiles` jadi VIEW kompat; perbarui helper RLS pos-kasir agar membaca `outlet_staff`.

**Tech Stack:** PostgreSQL (Supabase), migration SQL di `supabase/migrations/`. Verifikasi via query psql (`supabase db push` + assert query), bukan unit test (proyek belum punya test SQL).

---

## Decomposition (peta 4 plan)

- **Plan 1 (dokumen ini): Fondasi Identitas DB** — role enum, `staff_outlets`, migrasi `profiles`→`outlet_staff`, view kompat, helper RLS.
- **Plan 2: `packages/auth`** — shared lib (`AuthProvider/useAuth`, `getOutletStaff`, `ROLE_APP_ACCESS`, `requireRole`, `getAccessibleOutlets`, supabase client cookie-domain configurable).
- **Plan 3: `apps/portal`** — app login + launcher kartu per role + logout global.
- **Plan 4: Integrasi 5 app** — pakai `packages/auth`, middleware guard standar, login lama → redirect portal, pos-kasir baca outlet_staff.

Plan 2–4 ditulis saat Plan 1 selesai (masing-masing bergantung pada artefak sebelumnya).

---

## Catatan penting sebelum mulai

- **Migration history drift** (lihat `CLAUDE.md`): remote sering diverged. Sebelum `supabase db push`, jalankan `supabase migration list`; jika ada drift, `supabase migration repair --status applied <version>` dulu.
- `outlet_staff.id` di basis data ini **sama dengan `auth.users.id`** (AuthContext memetakan `outlet_staff.id == user.id`). `profiles.id` FK ke `auth.users`. Maka migrasi `profiles`→`outlet_staff` dipetakan **by id**.
- Semua migrasi pakai pola idempoten (`IF NOT EXISTS` / `DROP ... IF EXISTS`) agar aman terhadap riwayat diverged.

---

### Task 1: Perluas role enum `outlet_staff`

**Files:**
- Create: `supabase/migrations/20260613000300_outlet_staff_role_expand.sql`

- [ ] **Step 1: Tulis migrasi mengganti CHECK constraint role**

```sql
-- 20260613000300_outlet_staff_role_expand.sql
-- Perluas daftar role outlet_staff jadi 7 role kanonik (SSO per role).
ALTER TABLE public.outlet_staff
  DROP CONSTRAINT IF EXISTS outlet_staff_role_check;

ALTER TABLE public.outlet_staff
  ADD CONSTRAINT outlet_staff_role_check
  CHECK (role IN ('admin', 'owner', 'spv', 'kepala_outlet', 'kasir', 'crew', 'kiosk'));
```

- [ ] **Step 2: Push & verifikasi constraint**

Run:
```bash
supabase db push
```
Lalu verifikasi (psql / SQL editor):
```sql
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'outlet_staff_role_check';
```
Expected: definisi memuat ketujuh role (`admin`, `owner`, `spv`, `kepala_outlet`, `kasir`, `crew`, `kiosk`).

- [ ] **Step 3: Verifikasi insert role baru lolos & role asing ditolak**

Run:
```sql
-- harus SUKSES (rollback agar tidak mengotori data)
BEGIN;
INSERT INTO outlet_staff (id, outlet_id, name, role)
SELECT gen_random_uuid(), id, '___test_owner', 'owner' FROM outlets LIMIT 1;
ROLLBACK;

-- harus GAGAL (check violation)
BEGIN;
INSERT INTO outlet_staff (id, outlet_id, name, role)
SELECT gen_random_uuid(), id, '___test_bad', 'manager' FROM outlets LIMIT 1;
ROLLBACK;
```
Expected: insert `owner` sukses; insert `manager` error `violates check constraint`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260613000300_outlet_staff_role_expand.sql
git commit -m "feat(db): perluas role outlet_staff jadi 7 role kanonik"
```

---

### Task 2: Tabel pemetaan `staff_outlets`

**Files:**
- Create: `supabase/migrations/20260613000400_staff_outlets.sql`

- [ ] **Step 1: Tulis migrasi tabel + index**

```sql
-- 20260613000400_staff_outlets.sql
-- Pemetaan many-to-many staff <-> outlet, dipakai untuk kepala_outlet multi-outlet.
CREATE TABLE IF NOT EXISTS public.staff_outlets (
  staff_id  uuid NOT NULL REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (staff_id, outlet_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_outlets_staff  ON public.staff_outlets(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_outlets_outlet ON public.staff_outlets(outlet_id);

ALTER TABLE public.staff_outlets ENABLE ROW LEVEL SECURITY;

-- Staff boleh membaca baris pemetaannya sendiri.
DROP POLICY IF EXISTS staff_outlets_select_self ON public.staff_outlets;
CREATE POLICY staff_outlets_select_self ON public.staff_outlets
  FOR SELECT TO authenticated
  USING (staff_id = auth.uid());
```

- [ ] **Step 2: Push & verifikasi tabel ada**

Run: `supabase db push`
Lalu:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'staff_outlets' ORDER BY ordinal_position;
```
Expected: kolom `staff_id (uuid)`, `outlet_id (uuid)`, `created_at (timestamp with time zone)`.

- [ ] **Step 3: Verifikasi FK cascade & PK**

Run:
```sql
SELECT conname, contype FROM pg_constraint
WHERE conrelid = 'public.staff_outlets'::regclass ORDER BY contype;
```
Expected: ada PK (`p`) dan dua FK (`f`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260613000400_staff_outlets.sql
git commit -m "feat(db): tabel staff_outlets untuk kepala_outlet multi-outlet"
```

---

### Task 3: Helper resolusi scope outlet

**Files:**
- Create: `supabase/migrations/20260613000500_accessible_outlets_fn.sql`

Helper ini dipakai RLS & app untuk menjawab "outlet apa saja yang boleh diakses user ini".

- [ ] **Step 1: Tulis fungsi `accessible_outlet_ids`**

```sql
-- 20260613000500_accessible_outlets_fn.sql
-- Mengembalikan himpunan outlet_id yang boleh diakses user saat ini, sesuai role.
--  - admin/owner/spv  : semua outlet
--  - kepala_outlet     : outlet di staff_outlets + outlet_id home (bila ada)
--  - kasir/crew/kiosk  : outlet_id home
CREATE OR REPLACE FUNCTION public.accessible_outlet_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT id, role, outlet_id FROM outlet_staff WHERE id = auth.uid()
  )
  SELECT o.id FROM outlets o, me
    WHERE me.role IN ('admin','owner','spv')
  UNION
  SELECT so.outlet_id FROM staff_outlets so, me
    WHERE me.role = 'kepala_outlet' AND so.staff_id = me.id
  UNION
  SELECT me.outlet_id FROM me
    WHERE me.outlet_id IS NOT NULL
      AND me.role IN ('kepala_outlet','kasir','crew','kiosk');
$$;
```

- [ ] **Step 2: Push & verifikasi fungsi ada**

Run: `supabase db push`
Lalu:
```sql
SELECT proname, prosecdef FROM pg_proc WHERE proname = 'accessible_outlet_ids';
```
Expected: 1 baris, `prosecdef = true` (security definer).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260613000500_accessible_outlets_fn.sql
git commit -m "feat(db): fungsi accessible_outlet_ids untuk resolusi scope role"
```

---

### Task 4: Migrasi data `profiles` → `outlet_staff`

**Files:**
- Create: `supabase/migrations/20260613000600_migrate_profiles_to_outlet_staff.sql`

**Pemetaan role:** `profiles.role` (`admin`/`kasir`/`kiosk`) → `outlet_staff.role` sama. `profiles.is_active=false` → `status='inactive'`, else `'active'`. Nama diambil dari `username` (fallback `'(tanpa nama)'`).

- [ ] **Step 1: Tulis migrasi upsert by id**

```sql
-- 20260613000600_migrate_profiles_to_outlet_staff.sql
-- Pindahkan identitas POS (profiles) ke outlet_staff (sumber kebenaran tunggal).
-- Keyed by id (profiles.id = outlet_staff.id = auth.users.id).
INSERT INTO public.outlet_staff (id, outlet_id, name, role, status)
SELECT
  p.id,
  COALESCE(p.outlet_id, (SELECT id FROM public.outlets ORDER BY created_at LIMIT 1)),
  COALESCE(p.username, '(tanpa nama)'),
  p.role,
  CASE WHEN p.is_active IS FALSE THEN 'inactive' ELSE 'active' END
FROM public.profiles p
ON CONFLICT (id) DO UPDATE
  SET role   = EXCLUDED.role,
      status = EXCLUDED.status;
```

> Catatan: `outlet_id` NOT NULL di `outlet_staff`, sedangkan `profiles.outlet_id` boleh NULL (mis. admin). COALESCE memberi outlet pertama sebagai placeholder "home"; akses lintas-outlet admin tetap dari role, bukan kolom ini.

- [ ] **Step 2: Push & verifikasi jumlah baris cocok**

Run: `supabase db push`
Lalu:
```sql
SELECT
  (SELECT count(*) FROM profiles) AS profiles_count,
  (SELECT count(*) FROM outlet_staff os WHERE EXISTS
     (SELECT 1 FROM profiles p WHERE p.id = os.id)) AS migrated_count;
```
Expected: `migrated_count = profiles_count` (semua profiles ada padanannya di outlet_staff).

- [ ] **Step 3: Verifikasi role kiosk & admin terbawa**

Run:
```sql
SELECT role, count(*) FROM outlet_staff
WHERE id IN (SELECT id FROM profiles) GROUP BY role ORDER BY role;
```
Expected: distribusi role sesuai data profiles (mis. ada `admin`, `kasir`, `kiosk`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260613000600_migrate_profiles_to_outlet_staff.sql
git commit -m "feat(db): migrasi data profiles ke outlet_staff (by id)"
```

---

### Task 5: Ubah `profiles` jadi VIEW kompatibilitas

**Files:**
- Create: `supabase/migrations/20260613000700_profiles_compat_view.sql`

Agar kode pos-kasir lama (yang query `profiles.role`/`outlet_id`/`username`) tetap jalan selama transisi, `profiles` jadi VIEW dari `outlet_staff`.

- [ ] **Step 1: Tulis migrasi drop table → create view**

```sql
-- 20260613000700_profiles_compat_view.sql
-- profiles menjadi VIEW kompat di atas outlet_staff (transisi; akan dihapus saat
-- pos-kasir dirombak penuh ke outlet_staff).
-- Lepas policy lama dulu (akan ikut hilang bersama tabel).
DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE VIEW public.profiles
WITH (security_invoker = true) AS
SELECT
  os.id,
  os.role,
  os.outlet_id,
  os.name        AS username,
  os.created_at,
  os.updated_at,
  (os.status = 'active') AS is_active,
  NULL::text     AS inactive_reason
FROM public.outlet_staff os;
```

> `security_invoker = true` agar view menghormati RLS `outlet_staff` pemanggil. Helper `get_user_role()`/`get_user_outlet_id()` (didefinisikan di `20260612000001_merge_pos_schema.sql`) tetap berfungsi karena membaca dari `profiles` (kini view).

- [ ] **Step 2: Push & verifikasi view + helper konsisten**

Run: `supabase db push`
Lalu:
```sql
SELECT table_type FROM information_schema.tables WHERE table_name = 'profiles';
-- Expected: VIEW

-- helper get_user_role harus tetap mengembalikan role untuk user yang ada
SELECT (SELECT role FROM profiles LIMIT 1) AS sample_role;
```
Expected: `profiles` bertipe `VIEW`; query role berhasil tanpa error.

- [ ] **Step 3: Verifikasi DROP CASCADE tidak mematikan fungsi pos**

Run:
```sql
SELECT proname FROM pg_proc WHERE proname IN ('get_user_role','get_user_outlet_id');
```
Expected: kedua fungsi masih ada (mereka SQL function ber-body `SELECT ... FROM profiles`, valid terhadap view).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260613000700_profiles_compat_view.sql
git commit -m "feat(db): profiles jadi view kompat di atas outlet_staff"
```

---

### Task 6: RLS kepala_outlet berbasis `staff_outlets`

**Files:**
- Create: `supabase/migrations/20260613000800_rls_kepala_outlet_multi.sql`

Memberi `kepala_outlet` akses baca lintas outlet binaannya pada tabel inti operasional. Contoh di sini untuk `attendance` & `ledger_stok`; pola sama diterapkan ke tabel lain saat Plan 4 bila perlu.

- [ ] **Step 1: Tulis policy SELECT berbasis accessible_outlet_ids**

```sql
-- 20260613000800_rls_kepala_outlet_multi.sql
-- kepala_outlet boleh membaca data outlet binaannya (staff_outlets) via helper.
DROP POLICY IF EXISTS attendance_read_kepala_multi ON public.attendance;
CREATE POLICY attendance_read_kepala_multi ON public.attendance
  FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT public.accessible_outlet_ids()));

DROP POLICY IF EXISTS ledger_read_kepala_multi ON public.ledger_stok;
CREATE POLICY ledger_read_kepala_multi ON public.ledger_stok
  FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT public.accessible_outlet_ids()));
```

- [ ] **Step 2: Push & verifikasi policy terdaftar**

Run: `supabase db push`
Lalu:
```sql
SELECT polname, polcmd FROM pg_policy
WHERE polrelid IN ('public.attendance'::regclass, 'public.ledger_stok'::regclass)
  AND polname LIKE '%kepala_multi%';
```
Expected: 2 policy `*_kepala_multi` dengan `polcmd = r` (SELECT).

- [ ] **Step 3: Verifikasi fungsional dengan data uji (transaksi rollback)**

Run (sebagai service role / SQL editor, simulasi keanggotaan):
```sql
-- Pastikan helper mengembalikan >1 outlet untuk kepala_outlet yang dipetakan ke 2 outlet.
-- (jalankan setelah Plan 4 menyiapkan akun uji; di sini cukup cek helper bisa dipanggil)
SELECT count(*) FROM public.accessible_outlet_ids();
```
Expected: query berjalan tanpa error (jumlah tergantung user konteks).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260613000800_rls_kepala_outlet_multi.sql
git commit -m "feat(db): RLS kepala_outlet multi-outlet via accessible_outlet_ids"
```

---

### Task 7: Update CLAUDE.md (Outlet Model)

**Files:**
- Modify: `CLAUDE.md` (bagian "### 3. Outlet Model")

CLAUDE.md menyatakan `outlet_staff` "1 row per user, outlet_id tunggal". Tambahkan `staff_outlets` & role baru agar dokumen kanonik tidak menyesatkan.

- [ ] **Step 1: Edit bagian Outlet Model**

Ganti baris role & tambah catatan multi-outlet:
```markdown
**Canonical:** `outlet_staff` (1 row per user, `id` = auth.users.id). Role: admin, owner, spv, kepala_outlet, kasir, crew, kiosk. Bukan `outlet_users`; `profiles` (lama POS) kini VIEW kompat di atas `outlet_staff`.

**Multi-outlet:** `kepala_outlet` bisa membina beberapa outlet via tabel `staff_outlets` (many-to-many). `kasir`/`crew`/`kiosk` tetap 1 outlet (`outlet_staff.outlet_id`). `spv`/`admin`/`owner` akses semua outlet. Helper `accessible_outlet_ids()` meresolusi scope.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): outlet_staff 7 role + staff_outlets multi-outlet"
```

---

## Self-Review

**Spec coverage (Bagian 6 spec — Migrasi):**
1. Enum role +owner/+kiosk → Task 1 ✅
2. Tabel `staff_outlets` → Task 2 ✅
3. Migrasi `profiles`→`outlet_staff` → Task 4 ✅
4. View kompat `profiles` → Task 5 ✅
5. RLS `kepala_outlet` via keanggotaan → Task 3 (helper) + Task 6 (policy) ✅
- Resolusi scope (`getAccessibleOutlets`) sisi DB → Task 3 ✅ (sisi TS di Plan 2).
- Dokumen kanonik → Task 7 ✅.

**Placeholder scan:** tidak ada TBD; semua SQL & query verifikasi konkret. Test fungsional penuh RLS per-user ditandai bergantung akun uji Plan 4 (eksplisit, bukan placeholder).

**Type consistency:** nama fungsi `accessible_outlet_ids()` dipakai konsisten (Task 3, 6). Kolom view `profiles` (`id,role,outlet_id,username,created_at,updated_at,is_active,inactive_reason`) cocok dengan kolom yang dibaca kode pos-kasir lama (`role`, `outlet_id`, `username`).

---

## Risiko & Catatan Eksekusi

- **Urutan wajib:** Task 4 (migrasi data) harus jalan **sebelum** Task 5 (drop table → view), kalau tidak data profiles hilang. Penomoran migrasi sudah menjamin urutan.
- **Drift remote:** jalankan `supabase migration list` + `migration repair` bila perlu sebelum tiap `db push`.
- **Backup:** sebelum Task 5 (DROP TABLE profiles), pastikan Task 4 terverifikasi (`migrated_count = profiles_count`).
