# Finance M5 — P1 Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bangun fondasi app Treasury `apps/finance` — role `admin_finance`, buku besar kas (`cash_transaction`) dengan saldo per-lokasi yang atomik, kontrol maker-checker via RPC, RLS ketat, app scaffold, dan deploy subdomain — sehingga P2–P4 (payroll/supplier/reconciliation) tinggal menaruh vertical slice di atasnya.

**Architecture:** Ledger bertanda (in +, out −) meniru disiplin `ledger_stok`/`stok_balance`: setiap mutasi kas = satu baris `cash_transaction`; trigger `BEFORE INSERT` mengelola `cash_balance` secara **atomik** (upsert increment + row-lock, hindari lost-update — pelajaran migration `20260708100001`). Uang tunai punya lokasi fisik "Kas Pusat" (`cash_location.kind='cash'`) terpisah dari rekening bank. Semua tulis kas lewat **RPC `SECURITY DEFINER`** dengan enforcement maker-checker; tabel tak boleh ditulis langsung oleh user.

**Tech Stack:** Supabase (Postgres, RLS, RPC plpgsql), Next.js 16 app-router + React 19, TypeScript, Tailwind v4, `@suka/auth`, `@suka/design-system`, `@tanstack/react-query`, Vitest. Deploy: cPanel + CloudLinux Node Selector + LiteSpeed (`server.cjs`).

**Referensi spec:** `plan_masa_depan/M5_FINANCE_APP.md` (§3, §4, §5, §7, §8).

**Konvensi testing DB:** Repo ini tak memakai pgTAP. "Test" untuk lapisan DB = **skrip SQL assertion** (`supabase/tests/finance_p1_verify.sql`) yang dijalankan dalam satu transaksi `BEGIN…ROLLBACK`, memakai `ASSERT`/`RAISE EXCEPTION` untuk gagal keras. Jalankan via `psql` ke DB lokal (`supabase start`) atau, bila Docker mati, ke branch/DB test — **jangan** ke DB produksi.

---

## File Structure

**Migrations (baru, aditif, idempotent):**
- `supabase/migrations/20260711100000_finance_role_admin_finance.sql` — role + `ROLE_APP_ACCESS` DB-side (accessible_outlet_ids tak berubah; admin_finance = akses pusat, bukan outlet-scoped)
- `supabase/migrations/20260711100100_finance_treasury_tables.sql` — `cash_location`, `cash_transaction`, `cash_balance` + trigger saldo atomik + guard
- `supabase/migrations/20260711100200_finance_treasury_rpcs.sql` — `is_finance()`, `submit_cash_transaction`, `approve_cash_transaction`, `reject_cash_transaction`, `record_cash_transfer` (dua-kaki)
- `supabase/migrations/20260711100300_finance_rls_storage.sql` — RLS ketiga tabel + bucket `finance-proofs`

**Test:**
- `supabase/tests/finance_p1_verify.sql` — assertion harness (transaksi rollback)

**App scaffold (`apps/finance/`):**
- `package.json`, `next.config.mjs`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.env.local.example`
- `src/app/layout.tsx`, `src/app/Providers.tsx`, `src/app/globals.css`, `src/app/page.tsx`
- `src/lib/supabase.ts` (browser client via `@suka/auth`)
- `src/middleware.ts` (auth + role gate)
- `server.cjs` (dibuat di docroot subdomain saat deploy, bukan di repo app)

**Package auth (modifikasi):**
- `packages/auth/src/roles.ts` (atau file `ROLE_APP_ACCESS` — cek path aktual) — tambah `admin_finance`
- rebuild `packages/auth/dist/`

---

## Task 1: Migration — Role `admin_finance`

**Files:**
- Create: `supabase/migrations/20260711100000_finance_role_admin_finance.sql`

Konteks: set role kanonik saat ini (dari `20260707000000_fix_mitra_role_lost_in_staff_pusat_migration.sql`) = `admin, admin_hr, owner, spv, leader, crew, kiosk, kitchen, mitra, staff_pusat`. Tambah `admin_finance`. `admin_finance` mengakses data **pusat** (bukan outlet tunggal), jadi masuk ke cabang "semua outlet" di `accessible_outlet_ids()` bersama owner/admin.

- [ ] **Step 1: Tulis migration**

```sql
-- 20260711100000_finance_role_admin_finance.sql
-- M5 Finance: role baru 'admin_finance' (maker treasury). Owner = checker.
-- Pola sama seperti add_mitra_role / add_staff_pusat_role.

-- 1. Perluas CHECK constraint outlet_staff.role — sertakan SEMUA role valid + admin_finance
ALTER TABLE public.outlet_staff
  DROP CONSTRAINT IF EXISTS outlet_staff_role_check;
ALTER TABLE public.outlet_staff
  ADD CONSTRAINT outlet_staff_role_check
  CHECK (role IN (
    'admin', 'admin_hr', 'owner', 'spv', 'leader',
    'crew', 'kiosk', 'kitchen', 'mitra', 'staff_pusat', 'admin_finance'
  ));

-- 2. admin_finance melihat semua outlet (data pusat). Tambah ke cabang "semua outlet".
CREATE OR REPLACE FUNCTION public.accessible_outlet_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (
    SELECT id, role, outlet_id FROM public.outlet_staff WHERE id = auth.uid()
  )
  SELECT o.id FROM public.outlets o, me
    WHERE me.role IN ('admin', 'admin_hr', 'owner', 'spv', 'kitchen', 'admin_finance')
  UNION
  SELECT so.outlet_id FROM public.staff_outlets so, me
    WHERE me.role = 'leader' AND so.staff_id = me.id
  UNION
  SELECT me.outlet_id FROM me
    WHERE me.outlet_id IS NOT NULL
      AND me.role IN ('crew', 'kiosk', 'mitra', 'staff_pusat');
$$;

-- DOWN: hapus 'admin_finance' dari constraint & accessible_outlet_ids (kembali ke state sebelumnya).
```

- [ ] **Step 2: Terapkan ke DB lokal & verifikasi constraint menerima role baru**

Run:
```bash
psql "$DATABASE_URL" -f supabase/migrations/20260711100000_finance_role_admin_finance.sql
psql "$DATABASE_URL" -c "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='outlet_staff_role_check';"
```
Expected: definisi constraint memuat `'admin_finance'`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260711100000_finance_role_admin_finance.sql
git commit -m "feat(finance): add admin_finance role + accessible_outlet_ids"
```

---

## Task 2: Migration — Tabel treasury + trigger saldo atomik

**Files:**
- Create: `supabase/migrations/20260711100100_finance_treasury_tables.sql`

- [ ] **Step 1: Tulis migration (tabel + trigger)**

```sql
-- 20260711100100_finance_treasury_tables.sql
-- M5 Finance: buku besar kas. cash_location (bank ATAU kas fisik) + cash_transaction
-- (bertanda) + cash_balance (saldo per-lokasi, dijaga trigger atomik meniru stok_balance).

-- 1. Lokasi uang: rekening bank ATAU kas fisik (mis. "Kas Pusat / Brankas")
CREATE TABLE IF NOT EXISTS public.cash_location (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label        text NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('bank', 'cash')),
  bank_name    text,
  account_no   text,
  holder_name  text,
  scope        text NOT NULL DEFAULT 'pusat' CHECK (scope IN ('pusat', 'outlet')),
  outlet_id    uuid REFERENCES public.outlets(id),
  is_active    boolean NOT NULL DEFAULT true,
  opening_balance numeric NOT NULL DEFAULT 0,
  opening_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 2. Buku besar kas. amount selalu > 0; direction menentukan tanda; signed_amount generated.
CREATE TABLE IF NOT EXISTS public.cash_transaction (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_location_id uuid NOT NULL REFERENCES public.cash_location(id),
  direction    text NOT NULL CHECK (direction IN ('in', 'out')),
  amount       numeric NOT NULL CHECK (amount > 0),
  signed_amount numeric GENERATED ALWAYS AS (CASE WHEN direction = 'in' THEN amount ELSE -amount END) STORED,
  category     text,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  note         text,
  source_type  text NOT NULL DEFAULT 'manual'
                 CHECK (source_type IN ('payroll','supplier_po','expense_pusat','kasbon','cash_deposit','manual','transfer')),
  source_id    uuid,
  counter_transaction_id uuid REFERENCES public.cash_transaction(id),  -- kaki lawan utk transfer dua-kaki
  status       text NOT NULL DEFAULT 'pending_approval'
                 CHECK (status IN ('draft','pending_approval','approved','paid','reconciled','rejected','void')),
  -- Fase B (disbursement API) — nullable sampai P5
  gateway        text,
  gateway_ref    text,
  gateway_status text,
  disbursed_at   timestamptz,
  -- rekonsiliasi
  proof_url      text,
  reconciled_by  uuid REFERENCES public.outlet_staff(id),
  reconciled_at  timestamptz,
  -- audit maker-checker
  created_by   uuid REFERENCES public.outlet_staff(id),
  approved_by  uuid REFERENCES public.outlet_staff(id),
  approved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cash_tx_location ON public.cash_transaction(cash_location_id);
CREATE INDEX IF NOT EXISTS idx_cash_tx_status   ON public.cash_transaction(status);
CREATE INDEX IF NOT EXISTS idx_cash_tx_source   ON public.cash_transaction(source_type, source_id);

-- 3. Saldo berjalan per lokasi.
CREATE TABLE IF NOT EXISTS public.cash_balance (
  cash_location_id uuid PRIMARY KEY REFERENCES public.cash_location(id),
  saldo      numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Trigger saldo atomik. Saldo hanya bergerak saat transaksi mencapai status yang
--    "mempengaruhi kas": 'paid' atau 'reconciled'. draft/pending/approved TIDAK mengubah saldo.
--    Increment relatif via upsert ON CONFLICT (row-lock) — anti lost-update (lih. 20260708100001).
--    WAJIB SECURITY DEFINER: 'authenticated' tak punya policy tulis cash_balance.
CREATE OR REPLACE FUNCTION public.cash_apply_balance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE loc uuid; delta numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- hanya terapkan bila lahir langsung sebagai paid/reconciled (jarang; normalnya via UPDATE status)
    IF NEW.status IN ('paid','reconciled') THEN
      loc := NEW.cash_location_id; delta := NEW.signed_amount;
    ELSE RETURN NEW; END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- transisi MASUK ke paid/reconciled (dari status non-kas) → terapkan
    IF NEW.status IN ('paid','reconciled') AND OLD.status NOT IN ('paid','reconciled') THEN
      loc := NEW.cash_location_id; delta := NEW.signed_amount;
    -- transisi KELUAR dari paid/reconciled (mis. void) → balikkan
    ELSIF OLD.status IN ('paid','reconciled') AND NEW.status NOT IN ('paid','reconciled') THEN
      loc := OLD.cash_location_id; delta := -OLD.signed_amount;
    ELSE RETURN NEW; END IF;
  END IF;

  INSERT INTO public.cash_balance (cash_location_id, saldo, updated_at)
  VALUES (loc, delta, now())
  ON CONFLICT (cash_location_id)
  DO UPDATE SET saldo = public.cash_balance.saldo + EXCLUDED.saldo, updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cash_apply_balance ON public.cash_transaction;
CREATE TRIGGER trg_cash_apply_balance
  AFTER INSERT OR UPDATE OF status ON public.cash_transaction
  FOR EACH ROW EXECUTE FUNCTION public.cash_apply_balance();

-- DOWN: DROP TRIGGER/FUNCTION cash_apply_balance; DROP TABLE cash_balance, cash_transaction, cash_location CASCADE;
```

- [ ] **Step 2: Terapkan & sanity check tabel ada**

Run:
```bash
psql "$DATABASE_URL" -f supabase/migrations/20260711100100_finance_treasury_tables.sql
psql "$DATABASE_URL" -c "\d public.cash_transaction" -c "\d public.cash_balance"
```
Expected: kedua tabel tampil dengan kolom sesuai definisi.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260711100100_finance_treasury_tables.sql
git commit -m "feat(finance): treasury tables + atomic cash_balance trigger"
```

---

## Task 3: Migration — RPC maker-checker + transfer dua-kaki

**Files:**
- Create: `supabase/migrations/20260711100200_finance_treasury_rpcs.sql`

Aturan maker-checker: **maker tak boleh approve transaksinya sendiri**; hanya `owner`/`admin` (checker) yang boleh approve; `admin_finance` (maker) membuat & submit. Saldo hanya bergerak saat status → `paid`/`reconciled` (di-drive UPDATE status, Task 2).

- [ ] **Step 1: Tulis migration (helper + RPC)**

```sql
-- 20260711100200_finance_treasury_rpcs.sql
-- M5 Finance: helper is_finance() + RPC maker-checker. Semua tulis kas WAJIB lewat sini.

CREATE OR REPLACE FUNCTION public.is_finance() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND role IN ('admin_finance','owner','admin'));
$$;

CREATE OR REPLACE FUNCTION public.is_finance_checker() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND role IN ('owner','admin'));
$$;

-- Maker membuat transaksi keluar/masuk (status pending_approval).
CREATE OR REPLACE FUNCTION public.submit_cash_transaction(
  p_location uuid, p_direction text, p_amount numeric, p_category text,
  p_source_type text DEFAULT 'manual', p_source_id uuid DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF NOT public.is_finance() THEN RAISE EXCEPTION 'forbidden: bukan finance'; END IF;
  INSERT INTO public.cash_transaction (cash_location_id, direction, amount, category,
    source_type, source_id, note, status, created_by)
  VALUES (p_location, p_direction, p_amount, p_category,
    p_source_type, p_source_id, p_note, 'pending_approval', auth.uid())
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- Checker approve → status approved (belum menggerakkan saldo; saldo bergerak saat 'paid'/'reconciled').
CREATE OR REPLACE FUNCTION public.approve_cash_transaction(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE maker uuid;
BEGIN
  IF NOT public.is_finance_checker() THEN RAISE EXCEPTION 'forbidden: bukan checker'; END IF;
  SELECT created_by INTO maker FROM public.cash_transaction WHERE id = p_id;
  IF maker = auth.uid() THEN RAISE EXCEPTION 'maker tak boleh approve transaksinya sendiri'; END IF;
  UPDATE public.cash_transaction
    SET status = 'approved', approved_by = auth.uid(), approved_at = now()
    WHERE id = p_id AND status = 'pending_approval';
  IF NOT FOUND THEN RAISE EXCEPTION 'transaksi tak ada / bukan pending_approval'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_cash_transaction(p_id uuid, p_reason text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_finance_checker() THEN RAISE EXCEPTION 'forbidden: bukan checker'; END IF;
  UPDATE public.cash_transaction
    SET status = 'rejected', note = COALESCE(p_reason, note), approved_by = auth.uid(), approved_at = now()
    WHERE id = p_id AND status IN ('pending_approval','approved');
  IF NOT FOUND THEN RAISE EXCEPTION 'transaksi tak bisa ditolak dari status saat ini'; END IF;
END;
$$;

-- Tandai transaksi approved → paid (+ opsional bukti). Menggerakkan saldo via trigger.
CREATE OR REPLACE FUNCTION public.mark_cash_transaction_paid(p_id uuid, p_proof_url text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_finance() THEN RAISE EXCEPTION 'forbidden: bukan finance'; END IF;
  UPDATE public.cash_transaction
    SET status = 'reconciled', proof_url = COALESCE(p_proof_url, proof_url),
        reconciled_by = auth.uid(), reconciled_at = now()
    WHERE id = p_id AND status = 'approved';
  IF NOT FOUND THEN RAISE EXCEPTION 'transaksi belum approved'; END IF;
END;
$$;

-- Transfer dua-kaki (Kas Pusat → bank). Buat dua cash_transaction saling-refer, atomik.
-- Langsung 'reconciled' (uang riil sudah berpindah + slip diupload). Butuh checker.
CREATE OR REPLACE FUNCTION public.record_cash_transfer(
  p_from uuid, p_to uuid, p_amount numeric, p_proof_url text DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE out_id uuid; in_id uuid;
BEGIN
  IF NOT public.is_finance_checker() THEN RAISE EXCEPTION 'forbidden: transfer butuh checker'; END IF;
  IF p_from = p_to THEN RAISE EXCEPTION 'lokasi asal & tujuan sama'; END IF;

  INSERT INTO public.cash_transaction (cash_location_id, direction, amount, category,
    source_type, status, note, proof_url, created_by, approved_by, approved_at, reconciled_by, reconciled_at)
  VALUES (p_from, 'out', p_amount, 'transfer', 'transfer', 'reconciled', p_note, p_proof_url,
    auth.uid(), auth.uid(), now(), auth.uid(), now())
  RETURNING id INTO out_id;

  INSERT INTO public.cash_transaction (cash_location_id, direction, amount, category,
    source_type, status, note, proof_url, counter_transaction_id, created_by, approved_by, approved_at, reconciled_by, reconciled_at)
  VALUES (p_to, 'in', p_amount, 'transfer', 'transfer', 'reconciled', p_note, p_proof_url,
    out_id, auth.uid(), auth.uid(), now(), auth.uid(), now())
  RETURNING id INTO in_id;

  UPDATE public.cash_transaction SET counter_transaction_id = in_id WHERE id = out_id;
  RETURN out_id;
END;
$$;

-- DOWN: DROP FUNCTION untuk semua fungsi di atas.
```

- [ ] **Step 2: Terapkan**

Run: `psql "$DATABASE_URL" -f supabase/migrations/20260711100200_finance_treasury_rpcs.sql`
Expected: sukses tanpa error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260711100200_finance_treasury_rpcs.sql
git commit -m "feat(finance): maker-checker RPCs + two-leg transfer"
```

---

## Task 4: Migration — RLS + storage bucket

**Files:**
- Create: `supabase/migrations/20260711100300_finance_rls_storage.sql`

- [ ] **Step 1: Tulis migration**

```sql
-- 20260711100300_finance_rls_storage.sql
-- M5 Finance: RLS ketat (hanya finance) + bucket bukti transfer.

ALTER TABLE public.cash_location    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_balance     ENABLE ROW LEVEL SECURITY;

-- SELECT: hanya finance (admin_finance/owner/admin). Tulis via RPC DEFINER, jadi tak perlu policy INSERT/UPDATE utk user.
DROP POLICY IF EXISTS cash_location_read    ON public.cash_location;
DROP POLICY IF EXISTS cash_transaction_read ON public.cash_transaction;
DROP POLICY IF EXISTS cash_balance_read     ON public.cash_balance;

CREATE POLICY cash_location_read    ON public.cash_location    FOR SELECT USING (public.is_finance());
CREATE POLICY cash_transaction_read ON public.cash_transaction FOR SELECT USING (public.is_finance());
CREATE POLICY cash_balance_read     ON public.cash_balance     FOR SELECT USING (public.is_finance());

-- cash_location dikelola owner/admin (setup rekening) — izinkan tulis utk checker.
DROP POLICY IF EXISTS cash_location_write ON public.cash_location;
CREATE POLICY cash_location_write ON public.cash_location FOR ALL
  USING (public.is_finance_checker()) WITH CHECK (public.is_finance_checker());

-- Storage bucket bukti (private).
INSERT INTO storage.buckets (id, name, public)
VALUES ('finance-proofs', 'finance-proofs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS finance_proofs_rw ON storage.objects;
CREATE POLICY finance_proofs_rw ON storage.objects FOR ALL
  USING (bucket_id = 'finance-proofs' AND public.is_finance())
  WITH CHECK (bucket_id = 'finance-proofs' AND public.is_finance());

-- DOWN: DROP POLICY ...; ALTER TABLE ... DISABLE ROW LEVEL SECURITY; DELETE FROM storage.buckets WHERE id='finance-proofs';
```

- [ ] **Step 2: Terapkan & cek RLS aktif**

Run:
```bash
psql "$DATABASE_URL" -f supabase/migrations/20260711100300_finance_rls_storage.sql
psql "$DATABASE_URL" -c "SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('cash_location','cash_transaction','cash_balance');"
```
Expected: `relrowsecurity = t` untuk ketiganya.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260711100300_finance_rls_storage.sql
git commit -m "feat(finance): RLS + finance-proofs storage bucket"
```

---

## Task 5: SQL verification harness (test lapisan DB)

**Files:**
- Create: `supabase/tests/finance_p1_verify.sql`

Ini adalah **test** untuk semua logika DB Task 2–3. Dijalankan dalam `BEGIN…ROLLBACK` sehingga tak meninggalkan data. Memakai `auth.uid()` — set via `SET LOCAL request.jwt.claims` atau, lebih sederhana untuk harness superuser, buat helper yang bypass. Karena RPC memanggil `auth.uid()`, harness men-set klaim JWT lokal.

- [ ] **Step 1: Tulis harness assertion**

```sql
-- supabase/tests/finance_p1_verify.sql
-- Jalankan: psql "$DATABASE_URL" -f supabase/tests/finance_p1_verify.sql
-- Semua di dalam transaksi yang di-ROLLBACK di akhir.
BEGIN;

-- Seed: dua staff (maker admin_finance, checker owner) + dua lokasi (Kas Pusat, Bank).
-- Catatan: outlet_staff.id = auth.users.id; untuk test kita insert langsung sbagai superuser.
INSERT INTO public.outlet_staff (id, name, role)
VALUES ('11111111-1111-1111-1111-111111111111','Maker Finance','admin_finance'),
       ('22222222-2222-2222-2222-222222222222','Owner Checker','owner')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cash_location (id, label, kind)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001','Kas Pusat','cash'),
       ('bbbbbbbb-0000-0000-0000-000000000002','BCA Pusat','bank');

-- Helper: jalankan sbg user tertentu dgn set klaim JWT (auth.uid() membacanya).
-- Maker submit transaksi keluar Rp100.000 dari Bank.
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
SELECT public.submit_cash_transaction(
  'bbbbbbbb-0000-0000-0000-000000000002','out',100000,'manual') AS tx_id \gset

-- ASSERT 1: saldo bank BELUM berubah (masih pending_approval).
DO $$ DECLARE s numeric; BEGIN
  SELECT COALESCE(saldo,0) INTO s FROM public.cash_balance WHERE cash_location_id='bbbbbbbb-0000-0000-0000-000000000002';
  ASSERT COALESCE(s,0) = 0, 'FAIL: saldo berubah sebelum reconciled';
END $$;

-- ASSERT 2: maker TAK BOLEH approve transaksinya sendiri.
DO $$ BEGIN
  BEGIN
    PERFORM public.approve_cash_transaction(:'tx_id');
    ASSERT false, 'FAIL: maker berhasil approve transaksinya sendiri';
  EXCEPTION WHEN others THEN NULL; -- diharapkan gagal
  END;
END $$;

-- Checker approve → paid.
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
SELECT public.approve_cash_transaction(:'tx_id');
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
SELECT public.mark_cash_transaction_paid(:'tx_id');

-- ASSERT 3: saldo bank kini -100000 (out, reconciled).
DO $$ DECLARE s numeric; BEGIN
  SELECT saldo INTO s FROM public.cash_balance WHERE cash_location_id='bbbbbbbb-0000-0000-0000-000000000002';
  ASSERT s = -100000, format('FAIL: saldo bank = %s, harusnya -100000', s);
END $$;

-- ASSERT 4: transfer dua-kaki Kas Pusat -> Bank Rp50.000 (butuh checker).
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
SELECT public.record_cash_transfer(
  'aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002',50000) AS tr_id \gset

DO $$ DECLARE kas numeric; bank numeric; BEGIN
  SELECT saldo INTO kas  FROM public.cash_balance WHERE cash_location_id='aaaaaaaa-0000-0000-0000-000000000001';
  SELECT saldo INTO bank FROM public.cash_balance WHERE cash_location_id='bbbbbbbb-0000-0000-0000-000000000002';
  ASSERT kas = -50000, format('FAIL: Kas Pusat = %s, harusnya -50000', kas);
  ASSERT bank = -50000, format('FAIL: Bank = %s, harusnya -50000 (-100000 + 50000)', bank);
END $$;

DO $$ BEGIN RAISE NOTICE 'ALL FINANCE P1 ASSERTIONS PASSED'; END $$;
ROLLBACK;
```

- [ ] **Step 2: Jalankan harness — harus semua assertion lolos**

Run: `psql "$DATABASE_URL" -f supabase/tests/finance_p1_verify.sql`
Expected: output memuat `ALL FINANCE P1 ASSERTIONS PASSED`, tanpa `FAIL:` / error. (Jika `request.jwt.claims` tak terbaca oleh `auth.uid()` di env lokal, ganti seed agar RPC memakai parameter user eksplisit untuk test, atau jalankan lewat Supabase SQL editor dengan role `authenticated` impersonation.)

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/finance_p1_verify.sql
git commit -m "test(finance): P1 DB assertion harness (saldo atomik, maker-checker, transfer)"
```

---

## Task 6: `@suka/auth` — daftarkan role & app access

**Files:**
- Modify: `packages/auth/src/*` (file yang mendefinisikan `Role` union & `ROLE_APP_ACCESS` — cari dengan grep di bawah)
- Rebuild: `packages/auth/dist/`

- [ ] **Step 1: Temukan definisi Role & ROLE_APP_ACCESS**

Run: `grep -rn "ROLE_APP_ACCESS\|admin_finance\|mitra'" packages/auth/src`
Expected: menemukan file berisi union `Role` dan map `ROLE_APP_ACCESS`.

- [ ] **Step 2: Tambah `admin_finance`**

Tambahkan `'admin_finance'` ke union `Role`, dan entri:
```ts
admin_finance: ['finance'],
```
ke `ROLE_APP_ACCESS` (samakan gaya dengan `mitra: ['admin-dashboard']`). Jika ada daftar `ROLES` untuk provisioning UI, tambahkan juga `'admin_finance'`.

- [ ] **Step 3: Rebuild dist (consumer import dari dist/)**

Run: `cd packages/auth && yarn build`
Expected: `dist/` ter-update tanpa error. (Lihat memori [[suka-auth-dist-gotcha]] — edit src saja tak berpengaruh sampai build.)

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src packages/auth/dist
git commit -m "feat(auth): register admin_finance role + finance app access"
```

---

## Task 7: Scaffold `apps/finance`

**Files (Create):** `apps/finance/{package.json,next.config.mjs,tsconfig.json,tailwind.config.ts,postcss.config.mjs,vitest.config.ts,.env.local.example}`, `apps/finance/src/app/{layout.tsx,Providers.tsx,globals.css,page.tsx}`, `apps/finance/src/lib/supabase.ts`, `apps/finance/src/middleware.ts`

Pola persis mengikuti `apps/stok` (sudah terbukti). Salin lalu ubah nama/port.

- [ ] **Step 1: `package.json`** — salin dari `apps/stok/package.json`, ubah:

```json
{
  "name": "@suka/finance",
  "version": "0.0.1",
  "description": "M5 — Treasury / Finance",
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3020",
    "build": "next build",
    "start": "next start",
    "type-check": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^19.0.0-rc.0",
    "react-dom": "^19.0.0-rc.0",
    "next": "^16.1.6",
    "@supabase/supabase-js": "^2.38.0",
    "@supabase/ssr": "^0.2.0",
    "@suka/auth": "*",
    "@suka/design-system": "*",
    "@tanstack/react-query": "^5.101.0"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/node": "^20.10.6",
    "@types/react": "^18.2.45",
    "@types/react-dom": "^18.2.18",
    "tailwindcss": "^4.0.0",
    "postcss": "^8.4.32",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Salin file config apa adanya**

Salin dari `apps/stok/`: `next.config.mjs`, `tsconfig.json` (pastikan `"baseUrl": "."` ada — lih. sesi 2026-06-15), `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `src/app/globals.css`. Tak ada perubahan isi kecuali path spesifik-app bila ada.

- [ ] **Step 3: `src/app/Providers.tsx`** — salin dari stok, **buang** `OutletScopeProvider` (finance tak per-outlet):

```tsx
'use client'
import { ReactNode, useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'
import type { OutletStaffProfile } from '@suka/auth'

export function Providers({ children, initialStaff = null }: {
  children: ReactNode; initialStaff?: OutletStaffProfile | null
}) {
  const queryClient = useMemo(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false, retry: 1 } },
  }), [])
  const supabase = createSupabaseBrowserClient()
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider supabase={supabase} initialStaff={initialStaff}>{children}</AuthProvider>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 4: `src/app/layout.tsx`** — salin dari stok, ganti judul jadi "Suka Finance". Bungkus children dengan `<Providers>`.

- [ ] **Step 5: `src/app/page.tsx`** — placeholder Net Cash (diisi P4):

```tsx
export default function Home() {
  return <main className="p-8"><h1 className="text-2xl font-bold text-suka-brown">Suka Finance — Treasury</h1>
    <p className="text-suka-gray-500 mt-2">Fondasi P1 aktif. Modul disbursement menyusul (P2–P4).</p></main>
}
```

- [ ] **Step 6: `src/middleware.ts`** — role gate: hanya `admin_finance`/`owner`/`admin`. Salin pola middleware auth dari app lain (mis. `apps/admin-dashboard/src/middleware.ts`), ubah daftar role yang diizinkan.

- [ ] **Step 7: `.env.local.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com
SUPABASE_JWT_SECRET=
```

- [ ] **Step 8: Install & type-check & build**

Run: `yarn install && cd apps/finance && yarn type-check && yarn build`
Expected: type-check 0 error; build sukses (route `/` = Static/Dynamic tanpa error).

- [ ] **Step 9: Smoke test lokal**

Run: `cd apps/finance && yarn dev` (port 3020), buka `http://localhost:3020`.
Expected: halaman "Suka Finance — Treasury" tampil; login non-finance ter-redirect keluar oleh middleware.

- [ ] **Step 10: Commit**

```bash
git add apps/finance
git commit -m "feat(finance): scaffold apps/finance (auth + role gate + shell)"
```

---

## Task 8: Deploy `finance.sukashawarma.com`

**Files:** `server.cjs` (dibuat di docroot subdomain di server, bukan repo). Ikuti playbook di `CLAUDE.md` §Deployment & memori [[cpanel-litespeed-nextjs-deploy]], [[sso-cookie-domain-gotcha]], [[deploy-resource-limits]].

- [ ] **Step 1: Push migrations ke remote**

Run: `supabase db push`
Expected: keempat migration `20260711*` applied. **Verifikasi nyata di DB live** (jangan andalkan `migration list`):
```bash
supabase migration list
# + cek objek benar-benar ada:
psql "$REMOTE_DB_URL" -c "SELECT to_regclass('public.cash_transaction'), pg_get_functiondef('public.record_cash_transfer'::regproc) IS NOT NULL;"
```

- [ ] **Step 2: cPanel — buat Subdomain `finance` + Setup Node.js App** (Node 24, mode Production, startup `server.cjs`). Upload `apps/finance/.env.local` (isi service keys + `NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com` + `SUPABASE_JWT_SECRET`) via FileZilla.

- [ ] **Step 3: Install & build di server (bypass wrapper npm)**

```bash
cd /home/sukashaw/suka-app && /opt/alt/alt-nodejs24/root/usr/bin/node /opt/alt/alt-nodejs24/root/usr/lib/node_modules/npm/bin/npm-cli.js install
cd /home/sukashaw/suka-app/apps/finance && /opt/alt/alt-nodejs24/root/usr/bin/node /opt/alt/alt-nodejs24/root/usr/lib/node_modules/npm/bin/npm-cli.js run build
```

- [ ] **Step 4: `server.cjs` di docroot subdomain** (absolute path ke build):

```js
const { createServer } = require('http');
const appDir = '/home/sukashaw/suka-app/apps/finance';
process.chdir(appDir);
const next = require(appDir + '/node_modules/next');
const app = next({ dev: false, dir: appDir });
const handle = app.getRequestHandler();
app.prepare().then(() => createServer((req, res) => handle(req, res)).listen(process.env.PORT || 3000));
```

- [ ] **Step 5: Panel Node app** — env `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_JWT_SECRET` + `NEXT_PUBLIC_COOKIE_DOMAIN` → SAVE → RESTART. DNS: A record `finance` → `103.77.106.237` bila belum ada.

- [ ] **Step 6: Verifikasi via IP publik (BUKAN loopback)**

Run: `curl -sk --resolve finance.sukashawarma.com:443:103.77.106.237 https://finance.sukashawarma.com/ | head -c 300`
Expected: HTML halaman "Suka Finance", bukan cPanel defaultwebpage.

- [ ] **Step 7: Update dokumentasi**

Tandai `finance.sukashawarma.com` LIVE di `CLAUDE.md` §Deployment Status. Commit.

```bash
git add CLAUDE.md
git commit -m "docs(deploy): finance.sukashawarma.com LIVE (P1 foundations)"
```

---

## Self-Review (sudah dijalankan penulis plan)

- **Spec coverage:** §3 arsitektur → Task 7/8. §4 data model (cash_location/cash_transaction/cash_balance, dua-kaki transfer, kolom Fase B nullable) → Task 2/3. §5.3 dua-hop → RPC `record_cash_transfer` (Task 3) + assertion (Task 5). §7 RLS/maker-checker/role → Task 1/3/4/6. §8 langkah eksekusi → seluruh task. Fitur UI §5.1/5.2/5.4/5.5 **sengaja di luar P1** (jadi P2–P4).
- **Placeholder scan:** tak ada TBD; SQL & config konkret lengkap. Satu catatan realistis di Task 5 Step 2 tentang `auth.uid()` di harness lokal (fallback dijelaskan), bukan placeholder.
- **Type/nama konsistensi:** `cash_location`/`cash_transaction`/`cash_balance`, `is_finance()`/`is_finance_checker()`, `submit_/approve_/reject_/mark_cash_transaction_paid`/`record_cash_transfer`, `counter_transaction_id`, status set `draft|pending_approval|approved|paid|reconciled|rejected|void` — dipakai konsisten lintas Task 2/3/5.
- **Catatan trigger:** saldo hanya bergerak pada transisi ke/dari `paid`/`reconciled` (Task 2). RPC normal: submit(pending) → approve(approved) → mark_paid(reconciled). `record_cash_transfer` lahir langsung `reconciled` (INSERT branch trigger menanganinya).

## Execution Handoff

Plan lengkap tersimpan di `docs/superpowers/plans/2026-07-10-finance-p1-foundations.md`.
