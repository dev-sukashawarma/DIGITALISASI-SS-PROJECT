# Permintaan Bahan Baku Berbasis Budget Outlet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hapus tab "Target Menu (Jualan)" dari form permintaan bahan baku crew (`apps/stok`), jadikan alur "Tambah Manual" satu-satunya cara mengajukan, dan tambahkan lapisan budget pembelian per outlet (plafon Rp per periode, diset owner) yang tampil sebagai info/badge ke crew dan approver tanpa memblokir submit/approve otomatis.

**Architecture:** Tabel baru `outlet_budget_config` (1 baris per outlet) + kolom `harga_snapshot` di `permintaan_bahan_item` (diisi saat approve, snapshot harga permanen) + RPC `SECURITY DEFINER` (`get_outlet_budget_status`, `estimate_permintaan_value`) yang menghitung nilai Rupiah tanpa expose `bahan_baku_harga` (RLS admin-only) ke crew. Server Actions baru mem-bungkus RPC ini dengan gerbang otorisasi eksplisit (pola sama seperti `app/actions/permintaan.ts`), lalu hook React Query + komponen `BudgetBadge` menampilkannya di form crew, `ApprovalList`/`ApprovalModal`, dan halaman baru owner-only `/stok/budget-outlet`.

**Tech Stack:** Next.js App Router (apps/stok), Supabase Postgres (RLS + PL/pgSQL RPC), React Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-18-permintaan-budget-outlet-design.md`

## Global Constraints

- **Migration timestamp landmine (WAJIB):** repo ini punya migration bertimestamp 2030 (`20300108000006` adalah yang terbaru per penulisan plan ini) yang selalu jalan paling akhir secara alfabetis. Migration baru untuk fitur ini HARUS pakai timestamp `>= 20300108000007` supaya benar-benar berlaku, bukan tertimpa. Jangan pakai timestamp 2026-nyata.
- **Snapshot harga, bukan live** — nilai Rupiah permintaan yang sudah disetujui dihitung dari `harga_snapshot` yang dicatat permanen saat approve, tidak pernah dihitung ulang dari `bahan_beli` terkini (spec §4.2, §12).
- **Tidak ada blokir otomatis** — melebihi budget hanya menghasilkan badge visual "Melebihi Budget", tidak pernah men-disable tombol submit/approve.
- **Outlet tanpa `outlet_budget_config`** = dianggap tak terbatas, semua UI budget disembunyikan untuk outlet itu (bukan Rp 0).
- **`bahan_baku_harga` RLS tetap admin-only** — semua akses harga HARUS lewat RPC `SECURITY DEFINER`/Server Action, tidak pernah query langsung dari client.
- **⚠️ Konfirmasi user sebelum `supabase db push` ke database live/shared** (Task 1 & Task 2) — proyek ini punya riwayat migration drift dari tim lain yang aktif push paralel (lihat CLAUDE.md "Supabase Migration History Drift"). Setelah menulis file migration, verifikasi dengan `supabase migration list` dulu sebelum push, dan verifikasi lagi via `supabase db query "..." --linked` setelah push (jangan andalkan `migration list` saja).
- Semua Server Action baru WAJIB punya gerbang otorisasi eksplisit sendiri (mengacu insiden [Server Action authz gap](../../../CLAUDE.md), sesi 2026-07-20) — jangan andalkan middleware/page guard.
- Setelah setiap task TypeScript, jalankan `yarn type-check` dan `yarn test` di `apps/stok` (bukan root) sebelum commit.

---

### Task 1: Migration — Skema (`outlet_budget_config`, kolom `harga_snapshot`, realtime publication)

**Files:**
- Create: `supabase/migrations/20300108000007_permintaan_budget_outlet_schema.sql`

**Interfaces:**
- Produces: tabel `outlet_budget_config(outlet_id, nominal, period_type, effective_from, updated_by, updated_at)`; kolom `permintaan_bahan_item.harga_snapshot NUMERIC`; keduanya dipublish ke `supabase_realtime`.

- [ ] **Step 1: Tulis migration**

```sql
-- 20300108000007_permintaan_budget_outlet_schema.sql
-- Budget pembelian per outlet: plafon Rupiah per periode, diset owner.
-- Lihat docs/superpowers/specs/2026-08-18-permintaan-budget-outlet-design.md §4.
-- Aditif & idempoten.

CREATE TABLE IF NOT EXISTS outlet_budget_config (
  outlet_id      UUID PRIMARY KEY REFERENCES outlets(id) ON DELETE CASCADE,
  nominal        NUMERIC NOT NULL CHECK (nominal >= 0),
  period_type    TEXT NOT NULL CHECK (period_type IN ('harian', 'mingguan', 'bulanan')),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_by     UUID REFERENCES outlet_staff(id),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE outlet_budget_config ENABLE ROW LEVEL SECURITY;

-- Read: outlet sendiri (crew) atau semua outlet accessible (kitchen/admin/owner/spv/leader).
DROP POLICY IF EXISTS obc_select ON outlet_budget_config;
CREATE POLICY obc_select ON outlet_budget_config FOR SELECT TO authenticated
  USING (outlet_id IN (SELECT accessible_outlet_ids()));

-- Write: owner-only.
DROP POLICY IF EXISTS obc_write ON outlet_budget_config;
CREATE POLICY obc_write ON outlet_budget_config FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'owner' AND status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'owner' AND status = 'active'));

-- Snapshot harga saat item disetujui (diisi oleh approve_permintaan_svc, lihat migration 20300108000008).
ALTER TABLE permintaan_bahan_item
  ADD COLUMN IF NOT EXISTS harga_snapshot NUMERIC;

-- Realtime: tambah ke publication supaya useRealtimeInvalidate di client bisa subscribe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'outlet_budget_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.outlet_budget_config;
  END IF;
END $$;

-- DOWN:
-- ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS outlet_budget_config;
-- ALTER TABLE permintaan_bahan_item DROP COLUMN IF EXISTS harga_snapshot;
-- DROP TABLE IF EXISTS outlet_budget_config;
```

- [ ] **Step 2: Verifikasi status migration lokal**

Run: `supabase migration list` (dari root repo)
Expected: `20300108000007_permintaan_budget_outlet_schema` muncul di kolom Local, belum di Remote.

- [ ] **Step 3: ⚠️ Konfirmasi ke user, lalu push**

Tanyakan eksplisit ke user sebelum menjalankan, karena ini menyentuh DB live/shared:

Run: `supabase db push`
Expected: migration ter-apply tanpa error. Kalau ada migration remote-only tanpa file lokal yang memblokir push (drift dari tim lain), JANGAN `migration repair` sepihak — laporkan ke user dulu (lihat CLAUDE.md "Supabase Migration History Drift").

- [ ] **Step 4: Verifikasi ground-truth di DB live**

Run: `supabase db query "SELECT column_name FROM information_schema.columns WHERE table_name = 'permintaan_bahan_item' AND column_name = 'harga_snapshot'" --linked`
Expected: 1 baris, `harga_snapshot`.

Run: `supabase db query "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'outlet_budget_config'" --linked`
Expected: 1 baris, `outlet_budget_config`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20300108000007_permintaan_budget_outlet_schema.sql
git commit -m "feat(db): tambah outlet_budget_config + kolom harga_snapshot permintaan"
```

---

### Task 2: Migration — RPC budget + `approve_permintaan_svc` isi `harga_snapshot`

**Files:**
- Create: `supabase/migrations/20300108000008_permintaan_budget_outlet_rpcs.sql`

**Interfaces:**
- Consumes: `outlet_budget_config` (Task 1), `bahan_baku_harga.harga_beli` (existing, admin-only RLS — RPC ini `SECURITY DEFINER` sehingga bypass).
- Produces: RPC `get_outlet_budget_status(p_outlet_id UUID) RETURNS TABLE(nominal, period_type, period_start, period_end, terpakai, sisa, has_config)`; RPC `estimate_permintaan_value(p_items JSONB) RETURNS TABLE(total_nilai, item_tanpa_harga)`; `approve_permintaan_svc` sekarang mengisi `harga_snapshot`.

**Catatan penting:** definisi live `approve_permintaan_svc` di bawah ini SUDAH diverifikasi via `pg_get_functiondef` pada 2026-08-18 (lihat sesi brainstorming). **Sebelum menjalankan Step 1, verifikasi ulang** — definisi live bisa saja sudah berubah karena tim lain aktif push migration paralel ke DB shared ini (pola berulang, lihat CLAUDE.md):

```bash
supabase db query "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'approve_permintaan_svc'" --linked
```

Kalau hasilnya BEDA dari definisi di Step 1 di bawah, hentikan — sesuaikan migration dengan definisi live yang baru, jangan timpa begitu saja.

- [ ] **Step 1: Tulis migration**

```sql
-- 20300108000008_permintaan_budget_outlet_rpcs.sql
-- RPC budget outlet + approve_permintaan_svc kini snapshot harga_beli saat approve.
-- Lihat docs/superpowers/specs/2026-08-18-permintaan-budget-outlet-design.md §4.3, §4.4, §6.
-- Aditif. approve_permintaan_svc di-CREATE OR REPLACE berdasarkan definisi live
-- terverifikasi via pg_get_functiondef (RPC ini tidak punya migration tracked
-- sebelumnya di repo -- lihat CLAUDE.md temuan sesi 2026-07-20).

CREATE OR REPLACE FUNCTION get_outlet_budget_status(p_outlet_id UUID)
RETURNS TABLE (
  nominal      NUMERIC,
  period_type  TEXT,
  period_start DATE,
  period_end   DATE,
  terpakai     NUMERIC,
  sisa         NUMERIC,
  has_config   BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg          outlet_budget_config;
  v_today        DATE := (NOW() AT TIME ZONE 'Asia/Jakarta')::date;
  v_start        DATE;
  v_end          DATE;
  v_days_since   INT;
  v_period_index INT;
  v_terpakai     NUMERIC;
BEGIN
  SELECT * INTO v_cfg FROM outlet_budget_config WHERE outlet_budget_config.outlet_id = p_outlet_id;

  IF v_cfg.outlet_id IS NULL THEN
    RETURN QUERY SELECT 0::NUMERIC, NULL::TEXT, NULL::DATE, NULL::DATE, 0::NUMERIC, 0::NUMERIC, false;
    RETURN;
  END IF;

  IF v_cfg.period_type = 'harian' THEN
    v_start := v_today;
    v_end := v_today;
  ELSIF v_cfg.period_type = 'mingguan' THEN
    v_days_since := v_today - v_cfg.effective_from;
    v_period_index := FLOOR(v_days_since / 7.0);
    v_start := v_cfg.effective_from + (v_period_index * 7);
    v_end := v_start + 6;
  ELSE -- bulanan
    v_start := DATE_TRUNC('month', v_today)::date;
    v_end := (DATE_TRUNC('month', v_today) + INTERVAL '1 month' - INTERVAL '1 day')::date;
  END IF;

  SELECT COALESCE(SUM(pbi.qty_disetujui * COALESCE(pbi.harga_snapshot, 0)), 0)
  INTO v_terpakai
  FROM permintaan_bahan pb
  JOIN permintaan_bahan_item pbi ON pbi.permintaan_id = pb.id
  WHERE pb.outlet_id = p_outlet_id
    AND pb.status = 'disetujui'
    AND (pb.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_start AND v_end;

  RETURN QUERY SELECT v_cfg.nominal, v_cfg.period_type, v_start, v_end, v_terpakai, (v_cfg.nominal - v_terpakai), true;
END;
$$;

CREATE OR REPLACE FUNCTION estimate_permintaan_value(p_items JSONB)
RETURNS TABLE (total_nilai NUMERIC, item_tanpa_harga UUID[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item    JSONB;
  v_bahan   UUID;
  v_qty     NUMERIC;
  v_harga   NUMERIC;
  v_total   NUMERIC := 0;
  v_missing UUID[] := ARRAY[]::UUID[];
BEGIN
  FOR v_item IN SELECT jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_bahan := (v_item->>'bahan_baku_id')::UUID;
    v_qty := (v_item->>'qty')::NUMERIC;
    SELECT harga_beli INTO v_harga FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan;
    IF v_harga IS NULL THEN
      v_missing := array_append(v_missing, v_bahan);
      v_harga := 0;
    END IF;
    v_total := v_total + (v_qty * v_harga);
  END LOOP;
  RETURN QUERY SELECT v_total, v_missing;
END;
$$;

-- approve_permintaan_svc: CREATE OR REPLACE berbasis definisi live terverifikasi
-- (2026-08-18) + tambahan v_harga/harga_snapshot. Perilaku lain PERSIS sama.
CREATE OR REPLACE FUNCTION public.approve_permintaan_svc(p_permintaan_id uuid, p_items jsonb)
 RETURNS permintaan_bahan
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_p       permintaan_bahan;
  v_item    JSONB;
  v_sj      surat_jalan;
  v_sj_items JSONB := '[]'::jsonb;
  v_bahan   UUID;
  v_qty     NUMERIC;
  v_harga   NUMERIC;
BEGIN
  SELECT * INTO v_p FROM permintaan_bahan WHERE id = p_permintaan_id FOR UPDATE;
  IF v_p.id IS NULL THEN
    RAISE EXCEPTION 'permintaan % tidak ditemukan', p_permintaan_id;
  END IF;
  IF v_p.status != 'menunggu' THEN
    RAISE EXCEPTION 'permintaan % berstatus %, harus menunggu', p_permintaan_id, v_p.status;
  END IF;

  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_bahan := (v_item->>'bahan_baku_id')::UUID;
    v_qty   := (v_item->>'qty_disetujui')::NUMERIC;
    v_harga := COALESCE((SELECT harga_beli FROM bahan_baku_harga WHERE bahan_baku_id = v_bahan), 0);

    UPDATE permintaan_bahan_item
    SET qty_disetujui = v_qty,
        harga_snapshot = v_harga
    WHERE permintaan_id = p_permintaan_id AND bahan_baku_id = v_bahan;

    IF NOT FOUND THEN
      INSERT INTO permintaan_bahan_item (permintaan_id, bahan_baku_id, qty_diminta, qty_disetujui, harga_snapshot)
      VALUES (p_permintaan_id, v_bahan, v_qty, v_qty, v_harga);
    END IF;

    IF v_qty > 0 THEN
      v_sj_items := v_sj_items || jsonb_build_object('bahan_baku_id', v_bahan, 'qty_dikirim', v_qty);
    END IF;
  END LOOP;

  UPDATE permintaan_bahan_item
  SET qty_disetujui = 0
  WHERE permintaan_id = p_permintaan_id AND qty_disetujui IS NULL;

  IF jsonb_array_length(v_sj_items) = 0 THEN
    RAISE EXCEPTION 'tidak ada item disetujui (qty > 0); gunakan tolak_permintaan_svc';
  END IF;

  v_sj := create_surat_jalan(v_p.outlet_id, v_sj_items);

  UPDATE permintaan_bahan
  SET status = 'disetujui', surat_jalan_id = v_sj.id, updated_at = NOW()
  WHERE id = p_permintaan_id
  RETURNING * INTO v_p;

  RETURN v_p;
END;
$function$;

-- DOWN: tidak ada rollback aman untuk CREATE OR REPLACE (akan menghapus fitur
-- snapshot). Kalau perlu revert, restore definisi lama dari histori git file ini.
```

- [ ] **Step 2: ⚠️ Konfirmasi ke user, lalu push**

Run: `supabase db push`
Expected: 2 fungsi baru + 1 fungsi ter-replace tanpa error.

- [ ] **Step 3: Verifikasi ground-truth — fungsi baru ada & SECURITY DEFINER**

Run: `supabase db query "SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('get_outlet_budget_status','estimate_permintaan_value','approve_permintaan_svc')" --linked`
Expected: 3 baris, semua `prosecdef = true`.

- [ ] **Step 4: Verifikasi manual — outlet tanpa config**

Run: `supabase db query "SELECT * FROM get_outlet_budget_status('550e8400-e29b-41d4-a716-446655440001')" --linked`
Expected: 1 baris, `has_config = false`, `nominal = 0`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20300108000008_permintaan_budget_outlet_rpcs.sql
git commit -m "feat(db): RPC status budget outlet + approve_permintaan_svc snapshot harga"
```

---

### Task 3: Pure functions — `lib/stok/budget.ts`

**Files:**
- Create: `apps/stok/src/lib/stok/budget.ts`
- Test: `apps/stok/src/lib/stok/budget.test.ts`

**Interfaces:**
- Produces: `type PeriodType = 'harian' | 'mingguan' | 'bulanan'`; `interface BudgetStatus { outletId: string; nominal: number; periodType: PeriodType | null; periodStart: string | null; periodEnd: string | null; terpakai: number; sisa: number; hasConfig: boolean }`; `canManageOutletBudget(role: string | null | undefined): boolean`; `type BudgetBadgeVariant = 'hidden' | 'green' | 'orange' | 'red'`; `budgetBadgeVariant(status: Pick<BudgetStatus,'hasConfig'|'nominal'|'terpakai'>, projectedAdd?: number): BudgetBadgeVariant`.

- [ ] **Step 1: Tulis test (gagal dulu)**

```typescript
// apps/stok/src/lib/stok/budget.test.ts
import { describe, it, expect } from 'vitest'
import { canManageOutletBudget, budgetBadgeVariant } from './budget'

describe('canManageOutletBudget', () => {
  it('owner boleh atur budget', () => {
    expect(canManageOutletBudget('owner')).toBe(true)
  })

  it('role lain tidak boleh atur budget', () => {
    expect(canManageOutletBudget('kitchen')).toBe(false)
    expect(canManageOutletBudget('admin')).toBe(false)
    expect(canManageOutletBudget('spv')).toBe(false)
    expect(canManageOutletBudget('crew')).toBe(false)
    expect(canManageOutletBudget(null)).toBe(false)
    expect(canManageOutletBudget(undefined)).toBe(false)
  })
})

describe('budgetBadgeVariant', () => {
  const base = { hasConfig: true, nominal: 1_000_000, terpakai: 0 }

  it('hidden kalau outlet belum punya config', () => {
    expect(budgetBadgeVariant({ ...base, hasConfig: false })).toBe('hidden')
  })

  it('green kalau terpakai + proyeksi di bawah 80%', () => {
    expect(budgetBadgeVariant({ ...base, terpakai: 500_000 }, 100_000)).toBe('green')
  })

  it('orange kalau terpakai + proyeksi 80%-100%', () => {
    expect(budgetBadgeVariant({ ...base, terpakai: 700_000 }, 150_000)).toBe('orange')
  })

  it('red kalau terpakai + proyeksi melebihi 100%', () => {
    expect(budgetBadgeVariant({ ...base, terpakai: 900_000 }, 200_000)).toBe('red')
  })

  it('red kalau nominal 0 (misconfigured)', () => {
    expect(budgetBadgeVariant({ ...base, nominal: 0 })).toBe('red')
  })

  it('default projectedAdd = 0', () => {
    expect(budgetBadgeVariant({ ...base, terpakai: 100_000 })).toBe('green')
  })
})
```

- [ ] **Step 2: Jalankan test, verifikasi gagal**

Run: `cd apps/stok && yarn test src/lib/stok/budget.test.ts`
Expected: FAIL — `Cannot find module './budget'`

- [ ] **Step 3: Implementasi**

```typescript
// apps/stok/src/lib/stok/budget.ts
export type PeriodType = 'harian' | 'mingguan' | 'bulanan'

export interface BudgetStatus {
  outletId: string
  nominal: number
  periodType: PeriodType | null
  periodStart: string | null
  periodEnd: string | null
  terpakai: number
  sisa: number
  hasConfig: boolean
}

// Role yang boleh mengatur plafon budget outlet. Hanya owner (keputusan
// produk: owner yang menentukan nominal & periode per outlet — lihat
// docs/superpowers/specs/2026-08-18-permintaan-budget-outlet-design.md §9).
const BUDGET_MANAGER_ROLES = ['owner'] as const

export function canManageOutletBudget(role: string | null | undefined): boolean {
  return !!role && (BUDGET_MANAGER_ROLES as readonly string[]).includes(role)
}

export type BudgetBadgeVariant = 'hidden' | 'green' | 'orange' | 'red'

/**
 * Warna badge budget. `projectedAdd` = estimasi nilai keranjang/permintaan
 * yang belum disetujui, dijumlahkan ke `terpakai` untuk proyeksi "kalau ini
 * juga disetujui". Tidak pernah dipakai untuk blokir submit/approve — murni
 * visual (lihat spec §7, §8: keputusan tetap di approver).
 */
export function budgetBadgeVariant(
  status: Pick<BudgetStatus, 'hasConfig' | 'nominal' | 'terpakai'>,
  projectedAdd: number = 0
): BudgetBadgeVariant {
  if (!status.hasConfig) return 'hidden'
  if (status.nominal <= 0) return 'red'
  const projectedPct = ((status.terpakai + projectedAdd) / status.nominal) * 100
  if (projectedPct > 100) return 'red'
  if (projectedPct >= 80) return 'orange'
  return 'green'
}
```

- [ ] **Step 4: Jalankan test, verifikasi lolos**

Run: `cd apps/stok && yarn test src/lib/stok/budget.test.ts`
Expected: PASS — 7 test lolos.

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/lib/stok/budget.ts apps/stok/src/lib/stok/budget.test.ts
git commit -m "feat(stok): pure functions budget outlet (predikat owner + variant badge)"
```

---

### Task 4: Server Actions — `app/actions/budget.ts`

**Files:**
- Create: `apps/stok/src/app/actions/budget.ts`

**Interfaces:**
- Consumes: `canManageOutletBudget` (Task 3, `@/lib/stok/budget`), `assertOutletAccessible`/`getAccessibleOutletIds` (`@/lib/stok/outletAccess`), RPC `get_outlet_budget_status`/`estimate_permintaan_value` (Task 2).
- Produces: `getOutletBudgetStatus(outletId: string): Promise<BudgetStatus>`; `listOutletBudgets(): Promise<Array<BudgetStatus & { outletName: string }>>`; `setOutletBudgetConfig(outletId: string, nominal: number, periodType: PeriodType): Promise<void>`; `estimateCartValue(items: {bahan_baku_id: string; qty: number}[]): Promise<{totalNilai: number; itemTanpaHarga: string[]}>`.

- [ ] **Step 1: Tulis file**

```typescript
// apps/stok/src/app/actions/budget.ts
'use server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { canManageOutletBudget, type BudgetStatus, type PeriodType } from '@/lib/stok/budget'
import { assertOutletAccessible, getAccessibleOutletIds } from '@/lib/stok/outletAccess'

// ---------------------------------------------------------------------------
// Service role client — bypass RLS. WAJIB dipagari gerbang otorisasi sendiri
// di tiap action (mirror app/actions/permintaan.ts) -- 'use server' bukan
// privat, Server Action bisa dipanggil langsung tanpa lewat halaman mana pun.
// ---------------------------------------------------------------------------

function makeServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL! || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjMyOTIsImV4cCI6MjA5NjUzOTI5Mn0.RdsvP6OKs6aiRnqqd02BYiv5gzbh4uGqO88dapo0Gso'
  return createClient(url, key)
}

async function getAuthedClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) =>
      toSet.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, options as any)
      ),
  })
}

async function getCurrentUserId(supabase: Awaited<ReturnType<typeof getAuthedClient>>): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('Unauthorized: No active user session found')
  }
  return user.id
}

/** Gerbang owner-only untuk menulis outlet_budget_config. */
async function requireOwner(): Promise<string> {
  const authedClient = await getAuthedClient()
  const userId = await getCurrentUserId(authedClient)

  const { data: staff, error } = await makeServiceClient()
    .from('outlet_staff')
    .select('role, status')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!staff || staff.status !== 'active' || !canManageOutletBudget(staff.role)) {
    throw new Error('Forbidden: hanya owner yang boleh mengatur budget outlet')
  }
  return userId
}

/** Gerbang minimal untuk aksi read-only ringan (estimasi nilai) -- cukup staff aktif. */
async function requireActiveStaff(): Promise<string> {
  const authedClient = await getAuthedClient()
  const userId = await getCurrentUserId(authedClient)

  const { data: staff, error } = await makeServiceClient()
    .from('outlet_staff')
    .select('status')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!staff || staff.status !== 'active') {
    throw new Error('Forbidden: akun tidak aktif')
  }
  return userId
}

function mapBudgetRow(row: any, outletId: string): BudgetStatus {
  return {
    outletId,
    nominal: Number(row?.nominal ?? 0),
    periodType: (row?.period_type ?? null) as PeriodType | null,
    periodStart: row?.period_start ?? null,
    periodEnd: row?.period_end ?? null,
    terpakai: Number(row?.terpakai ?? 0),
    sisa: Number(row?.sisa ?? 0),
    hasConfig: !!row?.has_config,
  }
}

// ---------------------------------------------------------------------------
// getOutletBudgetStatus — crew (outlet sendiri) atau approver (semua accessible)
// ---------------------------------------------------------------------------

export async function getOutletBudgetStatus(outletId: string): Promise<BudgetStatus> {
  const authedClient = await getAuthedClient()
  await getCurrentUserId(authedClient)
  await assertOutletAccessible(authedClient, outletId)

  const supabase = makeServiceClient()
  const { data, error } = await supabase.rpc('get_outlet_budget_status', { p_outlet_id: outletId })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  return mapBudgetRow(row, outletId)
}

// ---------------------------------------------------------------------------
// listOutletBudgets — owner-only, semua outlet operasional (exclude Gudang/Kantor Pusat)
// ---------------------------------------------------------------------------

export async function listOutletBudgets(): Promise<Array<BudgetStatus & { outletName: string }>> {
  await requireOwner()
  const supabase = makeServiceClient()

  const { data: outlets, error: outletsError } = await supabase
    .from('outlets')
    .select('id, name')
    .eq('is_active', true)
    .eq('type', 'outlet')
    .order('name')
  if (outletsError) throw new Error(outletsError.message)

  const operational = (outlets ?? []).filter(
    (o) => !o.name.toUpperCase().includes('GUDANG') && !o.name.toUpperCase().includes('KANTOR PUSAT')
  )

  const results: Array<BudgetStatus & { outletName: string }> = []
  for (const o of operational) {
    const { data, error } = await supabase.rpc('get_outlet_budget_status', { p_outlet_id: o.id })
    if (error) throw new Error(error.message)
    const row = Array.isArray(data) ? data[0] : data
    results.push({ ...mapBudgetRow(row, o.id), outletName: o.name })
  }
  return results
}

// ---------------------------------------------------------------------------
// setOutletBudgetConfig — owner-only
// ---------------------------------------------------------------------------

export async function setOutletBudgetConfig(
  outletId: string,
  nominal: number,
  periodType: PeriodType
): Promise<void> {
  const userId = await requireOwner()
  if (!(nominal >= 0)) throw new Error('Nominal budget tidak valid')

  const supabase = makeServiceClient()
  const { error } = await supabase.from('outlet_budget_config').upsert({
    outlet_id: outletId,
    nominal,
    period_type: periodType,
    effective_from: new Date().toISOString().slice(0, 10),
    updated_by: userId,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// estimateCartValue — estimasi nilai Rupiah tanpa expose harga per-item ke client
// ---------------------------------------------------------------------------

export async function estimateCartValue(
  items: { bahan_baku_id: string; qty: number }[]
): Promise<{ totalNilai: number; itemTanpaHarga: string[] }> {
  await requireActiveStaff()

  if (items.length === 0) return { totalNilai: 0, itemTanpaHarga: [] }

  const supabase = makeServiceClient()
  const { data, error } = await supabase.rpc('estimate_permintaan_value', {
    p_items: items.map((it) => ({ bahan_baku_id: it.bahan_baku_id, qty: it.qty })),
  })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  return {
    totalNilai: Number(row?.total_nilai ?? 0),
    itemTanpaHarga: (row?.item_tanpa_harga ?? []) as string[],
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error baru terkait `app/actions/budget.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/stok/src/app/actions/budget.ts
git commit -m "feat(stok): server actions budget outlet (get/list/set status, estimate cart)"
```

---

### Task 5: Hook — `hooks/useOutletBudget.ts`

**Files:**
- Create: `apps/stok/src/hooks/useOutletBudget.ts`

**Interfaces:**
- Consumes: `getOutletBudgetStatus`, `listOutletBudgets`, `setOutletBudgetConfig` (Task 4); `useRealtimeInvalidate` (`@suka/realtime`, pola sama `hooks/usePermintaan.ts`).
- Produces: `useOutletBudgetStatus(outletId: string | undefined): { status: BudgetStatus | null; loading: boolean; error: string | null; refresh: () => void }`; `useOutletBudgetAdmin(): { budgets: Array<BudgetStatus & {outletName:string}>; loading; error; refresh; save(outletId, nominal, periodType): Promise<void> }`.

- [ ] **Step 1: Tulis file**

```typescript
// apps/stok/src/hooks/useOutletBudget.ts
'use client'
import { useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRealtimeInvalidate } from '@suka/realtime'
import { getOutletBudgetStatus, listOutletBudgets, setOutletBudgetConfig } from '@/app/actions/budget'
import type { PeriodType } from '@/lib/stok/budget'

export function useOutletBudgetStatus(outletId: string | undefined) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['outlet_budget_status', outletId],
    queryFn: () => getOutletBudgetStatus(outletId as string),
    enabled: !!outletId,
    staleTime: 25000,
    gcTime: 60000,
  })

  const instanceId = useId()
  useRealtimeInvalidate({
    channelName: `outlet_budget_status_${outletId ?? 'none'}_${instanceId}`,
    enabled: !!outletId,
    subs: [
      {
        table: 'permintaan_bahan',
        filter: outletId ? `outlet_id=eq.${outletId}` : undefined,
        queryKeys: [['outlet_budget_status', outletId]],
      },
      {
        table: 'outlet_budget_config',
        filter: outletId ? `outlet_id=eq.${outletId}` : undefined,
        queryKeys: [['outlet_budget_status', outletId]],
      },
    ],
  })

  return {
    status: data ?? null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: refetch,
  }
}

export function useOutletBudgetAdmin() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['outlet_budget_admin_list'],
    queryFn: () => listOutletBudgets(),
    staleTime: 15000,
    gcTime: 60000,
  })

  const save = async (outletId: string, nominal: number, periodType: PeriodType) => {
    await setOutletBudgetConfig(outletId, nominal, periodType)
    await refetch()
  }

  return {
    budgets: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: refetch,
    save,
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error baru terkait `hooks/useOutletBudget.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/stok/src/hooks/useOutletBudget.ts
git commit -m "feat(stok): hook useOutletBudgetStatus & useOutletBudgetAdmin"
```

---

### Task 6: Komponen — `components/permintaan/BudgetBadge.tsx`

**Files:**
- Create: `apps/stok/src/components/permintaan/BudgetBadge.tsx`

**Interfaces:**
- Consumes: `budgetBadgeVariant`, `type BudgetStatus` (Task 3, `@/lib/stok/budget`).
- Produces: `<BudgetBadge status={BudgetStatus | null} projectedAdd?={number} compact?={boolean} />` — dipakai Task 7, 9, 10.

- [ ] **Step 1: Tulis file**

```typescript
// apps/stok/src/components/permintaan/BudgetBadge.tsx
'use client'
import { budgetBadgeVariant, type BudgetStatus } from '@/lib/stok/budget'

interface Props {
  status: BudgetStatus | null
  projectedAdd?: number
  compact?: boolean
}

const VARIANT_STYLE: Record<'green' | 'orange' | 'red', string> = {
  green: 'bg-green-50 text-green-700 border-green-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  red: 'bg-red-50 text-red-700 border-red-200',
}

const PERIOD_LABEL: Record<string, string> = {
  harian: 'Hari Ini',
  mingguan: 'Minggu Ini',
  bulanan: 'Bulan Ini',
}

export function BudgetBadge({ status, projectedAdd = 0, compact = false }: Props) {
  if (!status) return null
  const variant = budgetBadgeVariant(status, projectedAdd)
  if (variant === 'hidden') return null

  const periodLabel = status.periodType ? PERIOD_LABEL[status.periodType] : ''
  const sisaProyeksi = status.sisa - projectedAdd

  if (compact) {
    const label = variant === 'red'
      ? `Melebihi Budget${sisaProyeksi < 0 ? ` +Rp ${Math.abs(sisaProyeksi).toLocaleString('id-ID')}` : ''}`
      : 'Dalam Budget'
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${VARIANT_STYLE[variant]}`}>
        {label}
      </span>
    )
  }

  return (
    <div className={`text-xs font-bold p-3 rounded-xl border ${VARIANT_STYLE[variant]}`}>
      Sisa Budget {periodLabel}: Rp {Math.max(0, sisaProyeksi).toLocaleString('id-ID')} dari Rp {status.nominal.toLocaleString('id-ID')}
      {projectedAdd > 0 && (
        <span className="block font-normal mt-0.5">
          (termasuk estimasi keranjang saat ini: Rp {projectedAdd.toLocaleString('id-ID')})
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error baru terkait `BudgetBadge.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/stok/src/components/permintaan/BudgetBadge.tsx
git commit -m "feat(stok): komponen BudgetBadge"
```

---

### Task 7: `PermintaanForm.tsx` — hapus tab Target Menu, jadikan Tambah Manual satu-satunya alur + budget UI

**Files:**
- Modify: `apps/stok/src/components/permintaan/PermintaanForm.tsx` (rewrite penuh)

**Interfaces:**
- Consumes: `useOutletBudgetStatus` (Task 5), `estimateCartValue` (Task 4), `BudgetBadge` (Task 6), `convertToBaseUnit`/`convertToDistribusiUnit`/`formatTriUnitSaldoAdaptive` (existing, `@/lib/format/compositeUnit`).
- Produces: tidak ada perubahan pada props `PermintaanForm({ outletId, onSubmitSuccess, onCartViewChange })` — konsumen (`app/stok/permintaan/page.tsx`) tidak berubah.

- [ ] **Step 1: Tulis ulang file**

```tsx
// apps/stok/src/components/permintaan/PermintaanForm.tsx
'use client'
import { useEffect, useState, useMemo } from 'react'
import { useSaranItem, usePermintaanActions, usePermintaanList } from '@/hooks/usePermintaan'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import { useOutletBudgetStatus } from '@/hooks/useOutletBudget'
import { estimateCartValue } from '@/app/actions/budget'
import { BudgetBadge } from './BudgetBadge'
import { formatTriUnitSaldoAdaptive, convertToDistribusiUnit, convertToBaseUnit } from '@/lib/format/compositeUnit'

export function PermintaanForm({ outletId, onSubmitSuccess, onCartViewChange }: { outletId: string; onSubmitSuccess?: () => void; onCartViewChange?: (isCart: boolean) => void }) {
  const { saran } = useSaranItem(outletId)
  const { bahanBaku } = useBahanBaku()
  const { buat } = usePermintaanActions()
  const { permintaan: existingList, refresh: refreshExisting } = usePermintaanList(outletId)
  const { status: budgetStatus } = useOutletBudgetStatus(outletId)

  const [manualBahan, setManualBahan] = useState<Record<string, number>>({}) // id -> qty (satuan distribusi)

  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [isCartView, setIsCartView] = useState(false)
  const [manualPickId, setManualPickId] = useState('')
  const [showBatchNudge, setShowBatchNudge] = useState(false)
  const [cartEstimate, setCartEstimate] = useState<{ totalNilai: number; itemTanpaHarga: string[] }>({ totalNilai: 0, itemTanpaHarga: [] })

  // Permintaan 'menunggu' yang sudah >12 jam dibebaskan dari daftar hide --
  // crew boleh minta ulang bahan itu. buat_permintaan_svc otomatis membatalkan
  // request lama yang stale saat request baru untuk bahan sama diajukan (lihat
  // spec 2026-08-03 batch-nudge §5, keputusan: auto-batalkan bukan label).
  const STALE_HOURS = 12
  const pendingItemIds = useMemo(() => {
    const cutoff = Date.now() - STALE_HOURS * 60 * 60 * 1000
    return new Set(
      existingList
        .filter(p => p.status === 'menunggu' && new Date(p.created_at).getTime() >= cutoff)
        .flatMap(p => p.items.map(it => it.bahan_baku_id))
    )
  }, [existingList])

  useEffect(() => {
    if (onCartViewChange) {
      onCartViewChange(isCartView)
    }
  }, [isCartView, onCartViewChange])

  // Final Cart -- selalu dari manualBahan (tab "Target Menu" dihapus, lihat
  // docs/superpowers/specs/2026-08-18-permintaan-budget-outlet-design.md §7).
  const finalCart = useMemo(() => {
    return Object.entries(manualBahan)
      .filter(([id, qty]) => qty > 0 && !pendingItemIds.has(id))
      .map(([id, qty]) => {
        const b = bahanBaku.find(x => x.id === id)
        const saranItem = saran.find(s => s.bahan_baku_id === id)
        const distUnit = b?.satuan_distribusi || b?.satuan || ''
        return {
          id,
          nama: b?.nama ?? id,
          satuan: b?.satuan ?? '',
          dist_satuan: distUnit,
          qty,
          current_qty: saranItem?.current_qty,
          saldo_is_gram: saranItem?.saldo_is_gram,
        }
      })
  }, [manualBahan, bahanBaku, saran, pendingItemIds])

  // Estimasi nilai Rupiah keranjang (debounce), lewat Server Action supaya
  // harga per-item tidak pernah sampai ke client (bahan_baku_harga admin-only RLS).
  useEffect(() => {
    const items = finalCart
      .map(item => {
        const b = bahanBaku.find(x => x.id === item.id)
        const qtyBase = b ? convertToBaseUnit(item.qty, b) : item.qty
        return { bahan_baku_id: item.id, qty: qtyBase }
      })
      .filter(it => it.qty > 0)

    if (items.length === 0) {
      setCartEstimate({ totalNilai: 0, itemTanpaHarga: [] })
      return
    }

    const timer = setTimeout(() => {
      estimateCartValue(items).then(setCartEstimate).catch(console.error)
    }, 500)

    return () => clearTimeout(timer)
  }, [finalCart, bahanBaku])

  function updateManualBahan(id: string, delta: number) {
    setManualBahan(prev => {
      const current = prev[id] || 0
      const next = Math.max(0, current + delta)
      const copy = { ...prev }
      if (next === 0) delete copy[id]
      else copy[id] = next
      return copy
    })
  }

  function addManualFromPicker() {
    if (!manualPickId) return
    setManualBahan(prev => ({
      ...prev,
      [manualPickId]: (prev[manualPickId] || 0) + 1
    }))
    setManualPickId('')
  }

  const cartItemCount = Object.keys(manualBahan).length

  const filteredBahanManual = useMemo(() => {
    return bahanBaku.filter(b => b.nama.toLowerCase().includes(searchQuery.toLowerCase()) && !pendingItemIds.has(b.id))
  }, [bahanBaku, searchQuery, pendingItemIds])

  async function submit() {
    const itemsToRequest = finalCart.filter(r => r.qty > 0)
    if (itemsToRequest.length === 0) {
      setErrorMsg("Tidak ada bahan baku yang perlu diminta (Quantity 0).")
      return
    }

    setBusy(true); setErrorMsg(null); setSuccessMsg(null)
    try {
      await buat(outletId, itemsToRequest.map(r => {
        const b = bahanBaku.find(x => x.id === r.id)
        const qtyDimintaBase = b ? convertToBaseUnit(r.qty, b) : r.qty
        return {
          bahan_baku_id: r.id, qty_diminta: qtyDimintaBase,
        }
      }))
      setManualBahan({})
      setIsCartView(false)
      setShowBatchNudge(false)
      setSuccessMsg(`Permintaan berhasil dikirim (${itemsToRequest.length} item bahan baku). Menunggu persetujuan.`)
      refreshExisting()
      if (onSubmitSuccess) onSubmitSuccess()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  // CART VIEW
  if (isCartView) {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCartView(false)}
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm"
              title="Kembali ke Pilihan Bahan"
            >
              <span className="text-base">←</span>
            </button>
            <h2 className="text-xl font-extrabold text-[#701604] tracking-tight">Tinjau Permintaan</h2>
          </div>
        </div>

        {errorMsg && (
          <div className="text-xs font-bold text-red-700 bg-red-100 border border-red-300 p-3 rounded-xl flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)}>✕</button>
          </div>
        )}

        <BudgetBadge status={budgetStatus} projectedAdd={cartEstimate.totalNilai} />

        <div className="bg-white rounded-2xl shadow-sm border border-suka-gray-200 overflow-hidden">
          <div className="p-4 bg-suka-cream border-b border-suka-orange/20 flex justify-between items-center">
            <span className="font-bold text-suka-brown">Bahan Baku yang Diminta</span>
          </div>
          <div className="rounded-b-2xl">
            <div className="divide-y divide-suka-gray-100 max-h-[60vh] overflow-y-auto">
              {finalCart.length > 0 && (
                <div className="hidden md:grid grid-cols-[minmax(160px,2fr)_1fr_110px] gap-3 px-4 py-3 bg-suka-gray-50 border-b border-suka-gray-200 text-[10px] font-bold text-suka-gray-500 uppercase tracking-wider text-center items-center sticky top-0 z-10 shadow-sm">
                  <div className="text-left">Nama Bahan</div>
                  <div>Stok</div>
                  <div className="text-right">Dipesan</div>
                </div>
              )}
              {finalCart.length === 0 ? (
                <div className="p-8 text-center text-suka-gray-500 font-medium">Belum ada bahan baku yang perlu diminta.</div>
              ) : (
                finalCart.map(item => {
                  const b = bahanBaku.find(x => x.id === item.id);
                  const hargaBelumDiset = cartEstimate.itemTanpaHarga.includes(item.id)
                  return (
                  <div key={item.id} className="px-4 py-4 md:py-3 flex flex-col md:grid md:grid-cols-[minmax(160px,2fr)_1fr_110px] gap-1 md:gap-3 md:items-center hover:bg-suka-gray-50/50 transition-colors">
                    <div className="min-w-0 pr-2">
                      <h3 className="font-bold text-suka-ink text-base md:text-sm">{item.nama}</h3>
                      {hargaBelumDiset && (
                        <span className="inline-block mt-1 bg-suka-gray-100 text-suka-gray-500 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase">
                          Harga belum di-set
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between items-center md:justify-center mt-2 md:mt-0">
                      <span className="md:hidden text-[10px] font-bold text-suka-gray-400 uppercase">Stok (Sisa)</span>
                      {item.current_qty !== undefined ? (
                        <span className="text-[11px] md:text-[10px] text-red-500 font-bold uppercase whitespace-pre-line text-right md:text-center leading-tight">{formatTriUnitSaldoAdaptive(item.current_qty, item.saldo_is_gram ?? false, item.satuan, b?.satuan_tengah, b?.faktor_tengah, b?.satuan_kecil, b?.faktor_tampilan, true)}</span>
                      ) : (
                        <span className="text-suka-gray-400 font-bold">-</span>
                      )}
                    </div>

                    <div className="flex justify-between items-center md:justify-end mt-3 md:mt-0 pt-3 md:pt-0 border-t border-suka-gray-100 md:border-0">
                      <span className="md:hidden text-[10px] font-bold text-suka-gray-500 uppercase">Dipesan</span>
                      <div className="flex items-center bg-suka-gray-50 rounded-lg p-1 border border-suka-gray-200">
                        <button onClick={() => updateManualBahan(item.id, -1)} className="w-8 h-8 flex items-center justify-center text-suka-brown font-bold rounded hover:bg-white hover:shadow-sm transition-all">-</button>
                        <input
                          type="number" value={item.qty}
                          onChange={e => setManualBahan(prev => ({...prev, [item.id]: Number(e.target.value)}))}
                          className="w-12 text-center bg-transparent border-none p-0 font-bold text-sm text-suka-ink focus:ring-0"
                        />
                        <button onClick={() => updateManualBahan(item.id, 1)} className="w-8 h-8 flex items-center justify-center text-suka-brown font-bold rounded hover:bg-white hover:shadow-sm transition-all">+</button>
                      </div>
                    </div>
                  </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="p-4 bg-suka-gray-50 border-t border-suka-gray-200">
            <button
              disabled={busy || finalCart.length === 0}
              onClick={() => {
                if (finalCart.length === 1 && pendingItemIds.size > 0) {
                  setShowBatchNudge(true)
                } else {
                  submit()
                }
              }}
              className="w-full bg-suka-brown hover:bg-suka-ink text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {busy ? 'Mengirim...' : `Kirim ${finalCart.length} Permintaan`}
            </button>
          </div>

          {showBatchNudge && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                <h3 className="font-extrabold text-suka-brown text-base flex items-center gap-2">
                  ⏳ Masih ada permintaan yang menunggu
                </h3>
                <p className="text-sm text-suka-gray-600 leading-relaxed">
                  Anda punya <span className="font-bold text-suka-ink">{pendingItemIds.size} item bahan baku</span> lain
                  yang masih menunggu persetujuan admin_kitchen. Mau kirim yang ini
                  sekarang, atau kembali dulu untuk gabungkan dengan bahan lain?
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setShowBatchNudge(false); setIsCartView(false) }}
                    className="flex-1 border-2 border-suka-gray-200 text-suka-ink font-bold text-xs py-2.5 rounded-xl hover:border-suka-orange hover:text-suka-orange transition-colors"
                  >
                    Kembali, Tambah Dulu
                  </button>
                  <button
                    onClick={() => { setShowBatchNudge(false); submit() }}
                    className="flex-1 bg-suka-brown hover:bg-suka-ink text-white font-bold text-xs py-2.5 rounded-xl transition-colors"
                  >
                    Kirim Sekarang
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // MAIN VIEW
  return (
    <div className="space-y-5 pb-24">
      {pendingItemIds.size > 0 && (
        <div className="text-xs font-bold text-suka-brown bg-orange-100 border border-suka-orange/30 p-3 rounded-xl">
          ⏳ {pendingItemIds.size} item bahan baku sudah menunggu persetujuan admin_kitchen.
        </div>
      )}
      {successMsg && (
        <div className="text-xs font-bold text-suka-green bg-green-50 border border-suka-green/30 p-3 rounded-xl flex justify-between">
          <span>✅ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)}>✕</button>
        </div>
      )}

      <BudgetBadge status={budgetStatus} />

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <span className="text-xl">🔍</span>
        </div>
        <input
          type="text"
          placeholder="Cari bahan baku (misal: Tisu)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-suka-gray-200 text-suka-ink rounded-2xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-suka-orange focus:border-suka-orange shadow-sm font-medium transition-all"
        />
      </div>

      <div className="space-y-4">
        <div className="bg-suka-cream border border-suka-orange/20 rounded-xl p-4">
          <h3 className="font-bold text-suka-brown text-sm mb-1">Item Kritis & Manual</h3>
          <p className="text-xs text-suka-gray-600 mb-3">Item yang stoknya menipis sudah ditambahkan otomatis. Anda bisa menambah bahan baku lain yang tidak terkait resep menu.</p>

          <div className="flex gap-2 mb-4">
            <select
              value={manualPickId}
              onChange={e => setManualPickId(e.target.value)}
              className="flex-1 bg-white border border-suka-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-suka-orange"
            >
              <option value="">-- Pilih Bahan Baku --</option>
              {filteredBahanManual.map(b => (
                <option key={b.id} value={b.id}>{b.nama} ({b.satuan_distribusi || b.satuan})</option>
              ))}
            </select>
            <button
              onClick={addManualFromPicker}
              disabled={!manualPickId}
              className="bg-suka-orange text-white font-bold px-4 py-2 rounded-lg disabled:opacity-50"
            >
              Tambah
            </button>
          </div>

          {saran.filter(s => !manualBahan[s.bahan_baku_id] && !pendingItemIds.has(s.bahan_baku_id)).length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2">Saran Item Kritis:</p>
              <div className="space-y-2">
                {saran.filter(s => !manualBahan[s.bahan_baku_id] && !pendingItemIds.has(s.bahan_baku_id)).map(s => {
                  const b = bahanBaku.find(x => x.id === s.bahan_baku_id)
                  if (!b) return null
                  return (
                    <div key={s.bahan_baku_id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-red-200 shadow-sm">
                      <div>
                        <p className="font-bold text-suka-ink text-sm">{b.nama}</p>
                        <p className="text-xs text-red-500 font-medium">Sisa {formatTriUnitSaldoAdaptive(s.current_qty, s.saldo_is_gram, b.satuan, b.satuan_tengah, b.faktor_tengah, b.satuan_kecil, b.faktor_tampilan)}</p>
                      </div>
                      <button
                        onClick={() => {
                          const kekuranganBase = Math.max(1, Math.ceil(s.threshold - s.current_qty));
                          const b_info = bahanBaku.find(x => x.id === s.bahan_baku_id);
                          const distQty = b_info ? convertToDistribusiUnit(kekuranganBase, b_info) : kekuranganBase;
                          setManualBahan(p => ({...p, [s.bahan_baku_id]: Math.ceil(distQty)}));
                        }}
                        className="bg-red-50 hover:bg-red-100 transition-colors text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200"
                      >
                        + Tambah
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {Object.entries(manualBahan).length === 0 ? (
              <div className="text-center py-4 text-suka-gray-500 text-xs">Belum ada item manual</div>
            ) : (
              Object.entries(manualBahan).map(([id, qty]) => {
                const b = bahanBaku.find(x => x.id === id)
                if (!b) return null
                const saranItem = saran.find(s => s.bahan_baku_id === id)
                return (
                  <div key={id} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-suka-gray-200">
                    <div>
                      <p className="font-bold text-suka-ink text-sm">{b.nama}</p>
                      <p className="text-xs text-suka-gray-500">
                        {b.satuan_distribusi || b.satuan} {saranItem && <span className="text-red-500 ml-1">(Kritis: Sisa {formatTriUnitSaldoAdaptive(saranItem.current_qty, saranItem.saldo_is_gram, b.satuan, b.satuan_tengah, b.faktor_tengah, b.satuan_kecil, b.faktor_tampilan)})</span>}
                      </p>
                    </div>
                    <div className="flex items-center bg-suka-gray-50 rounded p-1 border border-suka-gray-200">
                      <button onClick={() => updateManualBahan(id, -1)} className="w-6 h-6 flex items-center justify-center text-suka-brown font-bold rounded hover:bg-white">-</button>
                      <input
                        type="number"
                        min="0"
                        value={qty || ''}
                        onChange={e => {
                          const val = e.target.value === '' ? 0 : Number(e.target.value);
                          setManualBahan(prev => {
                            const copy = { ...prev };
                            if (val <= 0) delete copy[id];
                            else copy[id] = val;
                            return copy;
                          });
                        }}
                        className="w-12 text-center bg-transparent border border-suka-gray-200 rounded p-0.5 font-bold text-sm text-suka-ink focus:outline-none focus:ring-1 focus:ring-suka-orange mx-1"
                      />
                      <button onClick={() => updateManualBahan(id, 1)} className="w-6 h-6 flex items-center justify-center text-suka-brown font-bold rounded hover:bg-white">+</button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Floating Cart Button */}
      {cartItemCount > 0 && !isCartView && (
        <div className="fixed bottom-[88px] left-0 right-0 px-4 max-w-2xl mx-auto z-40 animate-in slide-in-from-bottom-10 fade-in">
          <button
            onClick={() => setIsCartView(true)}
            className="w-full bg-suka-brown text-white shadow-xl rounded-2xl p-4 flex items-center justify-between hover:bg-suka-ink transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center font-bold relative text-xl">
                🛒
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-suka-brown">
                  {cartItemCount}
                </span>
              </div>
              <div className="text-left">
                <p className="text-[10px] text-white/70 uppercase font-bold tracking-widest">Keranjang</p>
                <p className="font-bold text-sm">Hitung & Tinjau Bahan Baku</p>
              </div>
            </div>
            <div className="bg-white/20 p-2 rounded-xl group-hover:translate-x-1 transition-transform">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error baru terkait `PermintaanForm.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/stok/src/components/permintaan/PermintaanForm.tsx
git commit -m "refactor(stok): hapus tab Target Menu, tambah budget badge di form permintaan"
```

---

### Task 8: Hapus dead code — `TargetMenuCalculator.tsx`

**Files:**
- Delete: `apps/stok/src/components/permintaan/TargetMenuCalculator.tsx`

**Interfaces:**
- Consumes: (tidak ada — file ini sudah tidak diimpor di mana pun, diverifikasi via grep sebelum plan ini ditulis).

- [ ] **Step 1: Verifikasi tidak ada pemakai**

Run: `cd apps/stok && grep -rn "TargetMenuCalculator" src`
Expected: hanya baris di file itu sendiri (definisi), tidak ada import dari file lain.

- [ ] **Step 2: Hapus file**

```bash
git rm apps/stok/src/components/permintaan/TargetMenuCalculator.tsx
```

- [ ] **Step 3: Type-check & build**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(stok): hapus TargetMenuCalculator.tsx (dead code, tak dipakai)"
```

---

### Task 9: `ApprovalList.tsx` — badge budget per card

**Files:**
- Modify: `apps/stok/src/components/permintaan/ApprovalList.tsx`

**Interfaces:**
- Consumes: `useOutletBudgetStatus` (Task 5), `estimateCartValue` (Task 4), `BudgetBadge` (Task 6).

- [ ] **Step 1: Tambah import**

Old:
```tsx
'use client'
import { useState } from 'react'
import { useApprovalList } from '@/hooks/usePermintaan'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import { convertToDistribusiUnit } from '@/lib/format/compositeUnit'
import type { PermintaanWithItems } from '@/types/permintaan'
import { ApprovalModal } from './ApprovalModal'
```

New:
```tsx
'use client'
import { useState, useEffect } from 'react'
import { useApprovalList } from '@/hooks/usePermintaan'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import { useOutletBudgetStatus } from '@/hooks/useOutletBudget'
import { estimateCartValue } from '@/app/actions/budget'
import { convertToDistribusiUnit, convertToBaseUnit } from '@/lib/format/compositeUnit'
import type { PermintaanWithItems, PermintaanItem } from '@/types/permintaan'
import type { BahanBaku } from '@/types/stok'
import { ApprovalModal } from './ApprovalModal'
import { BudgetBadge } from './BudgetBadge'
```

- [ ] **Step 2: Tambah subkomponen badge sebelum `export function ApprovalList`**

Insert sebelum baris `export function ApprovalList({ canApprove = true }: Props) {`:

```tsx
function ApprovalCardBudget({ outletId, items, bahanBakuMap }: {
  outletId: string
  items: PermintaanItem[]
  bahanBakuMap: Map<string, BahanBaku>
}) {
  const { status } = useOutletBudgetStatus(outletId)
  const [estimate, setEstimate] = useState(0)

  useEffect(() => {
    if (!status?.hasConfig || items.length === 0) {
      setEstimate(0)
      return
    }
    const payload = items.map(it => {
      const b = bahanBakuMap.get(it.bahan_baku_id)
      const qtyBase = b ? convertToBaseUnit(it.qty_diminta, b) : it.qty_diminta
      return { bahan_baku_id: it.bahan_baku_id, qty: qtyBase }
    })
    estimateCartValue(payload).then(r => setEstimate(r.totalNilai)).catch(() => setEstimate(0))
  }, [status?.hasConfig, items, bahanBakuMap])

  if (!status) return null
  return <BudgetBadge status={status} projectedAdd={estimate} compact />
}
```

- [ ] **Step 3: Render badge di tiap card**

Old (di dalam `permintaan.map(p => { ... return ( ... <span className="text-xs font-semibold text-[#544437]">{reqCode}</span> ...`):
```tsx
                  <span className="text-xs font-semibold text-[#544437]">{reqCode}</span>
                  {omzetKotor > 0 && (
```

New:
```tsx
                  <span className="text-xs font-semibold text-[#544437]">{reqCode}</span>
                  <ApprovalCardBudget
                    outletId={p.outlet_id}
                    items={p.items}
                    bahanBakuMap={new Map(bahanBaku.map(b => [b.id, b]))}
                  />
                  {omzetKotor > 0 && (
```

**Catatan:** `new Map(...)` dibuat inline per-render di sini demi kesederhanaan (list approval biasanya kecil, < 20 baris pending); kalau list membesar signifikan di masa depan, pindahkan ke `useMemo` di level `ApprovalList`.

- [ ] **Step 4: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error baru terkait `ApprovalList.tsx`.

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/components/permintaan/ApprovalList.tsx
git commit -m "feat(stok): badge status budget per card di ApprovalList"
```

---

### Task 10: `ApprovalModal.tsx` — ringkasan nilai & badge budget

**Files:**
- Modify: `apps/stok/src/components/permintaan/ApprovalModal.tsx`

**Interfaces:**
- Consumes: `useOutletBudgetStatus` (Task 5), `estimateCartValue` (Task 4), `BudgetBadge` (Task 6).

- [ ] **Step 1: Tambah import**

Old:
```tsx
import { useEffect, useRef, useState } from 'react'
import { usePermintaanActions } from '@/hooks/usePermintaan'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import type { PermintaanWithItems } from '@/types/permintaan'
import { fetchCrosscheckStok } from '@/app/actions/permintaan'
import { calculateBahanBakuRequest } from '@/app/actions/permintaan_target'
import { convertToDistribusiUnit, convertToBaseUnit, convertGramToBesar, formatTriUnitSaldoAdaptive } from '@/lib/format/compositeUnit'
```

New:
```tsx
import { useEffect, useRef, useState } from 'react'
import { usePermintaanActions } from '@/hooks/usePermintaan'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import { useOutletBudgetStatus } from '@/hooks/useOutletBudget'
import { estimateCartValue } from '@/app/actions/budget'
import { BudgetBadge } from './BudgetBadge'
import type { PermintaanWithItems } from '@/types/permintaan'
import { fetchCrosscheckStok } from '@/app/actions/permintaan'
import { calculateBahanBakuRequest } from '@/app/actions/permintaan_target'
import { convertToDistribusiUnit, convertToBaseUnit, convertGramToBesar, formatTriUnitSaldoAdaptive } from '@/lib/format/compositeUnit'
```

- [ ] **Step 2: Tambah state + effect estimasi live**

Old:
```tsx
    fetchCrosscheck()
    fetchKebutuhan()
  }, [permintaan.outlet_id, permintaan.items, permintaan.target_metadata])
```

New:
```tsx
    fetchCrosscheck()
    fetchKebutuhan()
  }, [permintaan.outlet_id, permintaan.items, permintaan.target_metadata])

  const { status: budgetStatus } = useOutletBudgetStatus(permintaan.outlet_id)
  const [liveEstimate, setLiveEstimate] = useState<{ totalNilai: number; itemTanpaHarga: string[] }>({ totalNilai: 0, itemTanpaHarga: [] })

  useEffect(() => {
    const items = permintaan.items
      .map(it => {
        const b = bahanBaku.find(x => x.id === it.bahan_baku_id)
        const qtyDisetujuiBase = b ? convertToBaseUnit(qtys[it.bahan_baku_id] ?? 0, b) : (qtys[it.bahan_baku_id] ?? 0)
        return { bahan_baku_id: it.bahan_baku_id, qty: qtyDisetujuiBase }
      })
      .filter(it => it.qty > 0)

    if (items.length === 0) {
      setLiveEstimate({ totalNilai: 0, itemTanpaHarga: [] })
      return
    }

    const timer = setTimeout(() => {
      estimateCartValue(items).then(setLiveEstimate).catch(console.error)
    }, 400)
    return () => clearTimeout(timer)
  }, [qtys, permintaan.items, bahanBaku])
```

- [ ] **Step 3: Render badge sebelum bagian Alasan**

Old:
```tsx
        {/* Alasan */}
        <div>
          <label className="block text-xs font-semibold text-[#544437] mb-1">
            Alasan Penolakan (wajib jika menolak seluruh permintaan)
          </label>
```

New:
```tsx
        {/* Nilai & Budget */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-[#544437] bg-[#faf2e9] p-2.5 rounded-xl">
            <span>Total Nilai Permintaan</span>
            <span className="text-[#701604]">Rp {liveEstimate.totalNilai.toLocaleString('id-ID')}</span>
          </div>
          <BudgetBadge status={budgetStatus} projectedAdd={liveEstimate.totalNilai} />
        </div>

        {/* Alasan */}
        <div>
          <label className="block text-xs font-semibold text-[#544437] mb-1">
            Alasan Penolakan (wajib jika menolak seluruh permintaan)
          </label>
```

- [ ] **Step 4: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error baru terkait `ApprovalModal.tsx`.

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/components/permintaan/ApprovalModal.tsx
git commit -m "feat(stok): ringkasan nilai permintaan + badge budget di ApprovalModal"
```

---

### Task 11: Halaman owner — `/stok/budget-outlet`

**Files:**
- Create: `apps/stok/src/components/permintaan/BudgetOutletList.tsx`
- Create: `apps/stok/src/app/stok/budget-outlet/page.tsx`

**Interfaces:**
- Consumes: `useOutletBudgetAdmin` (Task 5), `type PeriodType` (Task 3).
- Produces: route `/stok/budget-outlet` (owner-only, page-level guard).

- [ ] **Step 1: Tulis komponen list**

```tsx
// apps/stok/src/components/permintaan/BudgetOutletList.tsx
'use client'
import { useState } from 'react'
import { useOutletBudgetAdmin } from '@/hooks/useOutletBudget'
import type { PeriodType } from '@/lib/stok/budget'

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'harian', label: 'Harian' },
  { value: 'mingguan', label: 'Mingguan' },
  { value: 'bulanan', label: 'Bulanan' },
]

export function BudgetOutletList() {
  const { budgets, loading, error, save } = useOutletBudgetAdmin()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nominalInput, setNominalInput] = useState('')
  const [periodInput, setPeriodInput] = useState<PeriodType>('bulanan')
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function startEdit(outletId: string, currentNominal: number, currentPeriod: PeriodType | null) {
    setEditingId(outletId)
    setNominalInput(currentNominal > 0 ? String(currentNominal) : '')
    setPeriodInput(currentPeriod ?? 'bulanan')
    setSaveError(null)
  }

  async function handleSave(outletId: string) {
    const nominal = Number(nominalInput)
    if (!Number.isFinite(nominal) || nominal < 0) {
      setSaveError('Nominal harus angka positif.')
      return
    }
    setBusy(true)
    setSaveError(null)
    try {
      await save(outletId, nominal, periodInput)
      setEditingId(null)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="text-xs text-[#544437]/60">Memuat…</p>
  if (error) return <p className="text-xs text-[#ba1a1a]">{error}</p>

  return (
    <div className="space-y-3">
      {budgets.map(b => (
        <div key={b.outletId} className="bg-white border border-[#d9c2b2]/40 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-bold text-[#701604] text-sm truncate">{b.outletName}</h3>
              {b.hasConfig ? (
                <>
                  <p className="text-xs text-[#544437] mt-0.5">
                    Rp {b.nominal.toLocaleString('id-ID')} / {PERIOD_OPTIONS.find(p => p.value === b.periodType)?.label ?? b.periodType}
                  </p>
                  <div className="w-full h-1.5 bg-[#f5ede3] rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-[#f29744]"
                      style={{ width: `${Math.min(100, b.nominal > 0 ? (b.terpakai / b.nominal) * 100 : 0)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#544437]/70 mt-1">
                    Terpakai Rp {b.terpakai.toLocaleString('id-ID')} — Sisa Rp {b.sisa.toLocaleString('id-ID')}
                  </p>
                </>
              ) : (
                <p className="text-xs text-[#544437]/60 mt-0.5">Belum diset</p>
              )}
            </div>
            <button
              onClick={() => startEdit(b.outletId, b.nominal, b.periodType)}
              className="shrink-0 text-xs font-bold text-[#f29744] border border-[#f29744]/40 rounded-lg px-3 py-1.5 hover:bg-orange-50 transition-colors"
            >
              Atur
            </button>
          </div>

          {editingId === b.outletId && (
            <div className="mt-3 pt-3 border-t border-[#d9c2b2]/30 space-y-2">
              <input
                type="number"
                min="0"
                placeholder="Nominal budget (Rp)"
                value={nominalInput}
                onChange={e => setNominalInput(e.target.value)}
                className="w-full border border-[#d9c2b2] rounded-lg px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                {PERIOD_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPeriodInput(opt.value)}
                    className={`flex-1 text-xs font-bold py-2 rounded-lg border transition-colors ${
                      periodInput === opt.value
                        ? 'bg-[#f29744] text-white border-[#f29744]'
                        : 'bg-white text-[#544437] border-[#d9c2b2]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {saveError && <p className="text-[11px] font-bold text-[#ba1a1a]">{saveError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingId(null)}
                  disabled={busy}
                  className="flex-1 text-xs font-bold text-[#544437] border border-[#d9c2b2] rounded-lg py-2"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleSave(b.outletId)}
                  disabled={busy}
                  className="flex-1 text-xs font-bold text-white bg-[#701604] rounded-lg py-2 disabled:opacity-50"
                >
                  {busy ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Tulis halaman**

```tsx
// apps/stok/src/app/stok/budget-outlet/page.tsx
'use client'
import Link from 'next/link'
import { useAuth } from '@suka/auth'
import { BottomNav } from '@/components/common/BottomNav'
import { BudgetOutletList } from '@/components/permintaan/BudgetOutletList'

export default function BudgetOutletPage() {
  const { outletStaff, loading } = useAuth()

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-500">Memuat…</p></div>
  }
  if (!outletStaff || outletStaff.role !== 'owner') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 px-4 text-center">
        <p className="text-suka-brown font-bold">Halaman ini khusus owner.</p>
        <Link href="/dashboard" className="text-suka-orange font-bold underline">Kembali ke Dashboard</Link>
      </div>
    )
  }

  return (
    <div className="bg-[#fff8f1] min-h-screen pb-28">
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm"
            title="Kembali ke Dashboard"
          >
            <span className="text-base">←</span>
          </Link>
          <h1 className="text-xl font-extrabold text-[#701604] tracking-tight truncate">
            Budget Pembelian per Outlet
          </h1>
        </div>
        <BudgetOutletList />
      </main>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error baru terkait file-file di atas.

- [ ] **Step 4: Commit**

```bash
git add apps/stok/src/components/permintaan/BudgetOutletList.tsx apps/stok/src/app/stok/budget-outlet/page.tsx
git commit -m "feat(stok): halaman owner /stok/budget-outlet untuk atur plafon per outlet"
```

---

### Task 12: `BottomNav.tsx` — entry nav khusus owner ke halaman budget

**Files:**
- Modify: `apps/stok/src/components/common/BottomNav.tsx`

**Interfaces:**
- Consumes: tidak ada dependency baru — hanya field `outletStaff.role` yang sudah ada.

- [ ] **Step 1: Tambah nav item kondisional untuk owner**

Old:
```tsx
export function BottomNav() {
  const pathname = usePathname()
  const { outletStaff } = useAuth()

  const isApprover = isApproverRole(outletStaff?.role)
  const isKitchen = outletStaff?.role === 'kitchen' || outletStaff?.role === 'admin' || outletStaff?.role === 'owner'
  const { permintaan } = useApprovalList(isApprover)
  const pendingCount = permintaan.length

  const navItems = isKitchen
    ? [
        { href: '/dashboard', icon: '📊', label: 'Dashboard' },
        { href: '/stok/laporan-penjualan', icon: '📈', label: 'Penjualan' },
        { href: '/stok/ledger', icon: '📒', label: 'Ledger' },
        { href: '/stok/opname', icon: '📋', label: 'Opname' },
        { href: '/stok/permintaan', icon: '📝', label: 'Permintaan' },
        { href: '/stok/mutasi', icon: '🔄', label: 'Mutasi' },
      ]
    : ITEMS
```

New:
```tsx
export function BottomNav() {
  const pathname = usePathname()
  const { outletStaff } = useAuth()

  const isApprover = isApproverRole(outletStaff?.role)
  const isKitchen = outletStaff?.role === 'kitchen' || outletStaff?.role === 'admin' || outletStaff?.role === 'owner'
  const isOwner = outletStaff?.role === 'owner'
  const { permintaan } = useApprovalList(isApprover)
  const pendingCount = permintaan.length

  const navItems = isKitchen
    ? [
        { href: '/dashboard', icon: '📊', label: 'Dashboard' },
        { href: '/stok/laporan-penjualan', icon: '📈', label: 'Penjualan' },
        { href: '/stok/ledger', icon: '📒', label: 'Ledger' },
        { href: '/stok/opname', icon: '📋', label: 'Opname' },
        { href: '/stok/permintaan', icon: '📝', label: 'Permintaan' },
        { href: '/stok/mutasi', icon: '🔄', label: 'Mutasi' },
        ...(isOwner ? [{ href: '/stok/budget-outlet', icon: '💰', label: 'Budget' }] : []),
      ]
    : ITEMS
```

- [ ] **Step 2: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error baru terkait `BottomNav.tsx`.

- [ ] **Step 3: Jalankan seluruh test suite stok**

Run: `cd apps/stok && yarn test`
Expected: semua test lolos (termasuk `budget.test.ts` dari Task 3), tidak ada regresi di `compositeUnit.test.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/stok/src/components/common/BottomNav.tsx
git commit -m "feat(stok): entry nav Budget khusus owner di BottomNav"
```

---

## Verifikasi Akhir (manual, setelah semua task)

1. `cd apps/stok && yarn build` — pastikan sukses, route `/stok/budget-outlet` muncul di output.
2. Smoke test browser (tak ada e2e infra di repo ini):
   - Login sebagai owner → buka `/stok/budget-outlet` → set budget outlet test (misal Rp 500.000/harian) → verifikasi tersimpan & progress bar muncul.
   - Login sebagai crew outlet itu → buka `/stok/permintaan` → verifikasi tab "Target Menu" sudah tidak ada, badge "Sisa Budget Hari Ini" muncul → ajukan permintaan bahan yang totalnya melebihi Rp 500.000 → verifikasi tombol kirim TETAP bisa diklik (tidak diblokir) → submit sukses.
   - Login sebagai kitchen/admin → buka `/stok/permintaan` (mode approval) → verifikasi card permintaan tadi menampilkan badge "Melebihi Budget" → buka modal → verifikasi "Total Nilai Permintaan" & badge budget tampil → approve sebagian/penuh.
   - Kembali ke `/stok/budget-outlet` sebagai owner → verifikasi "Terpakai"/"Sisa" outlet itu sudah ter-update sesuai `qty_disetujui × harga_snapshot`.
3. Redeploy `stok.sukashawarma.com` setelah semua migration ter-apply dan kode ter-merge ke `main` (breaking bila kode baru jalan sebelum kolom/RPC ada di DB — urutan wajib: migration dulu, baru deploy kode).
