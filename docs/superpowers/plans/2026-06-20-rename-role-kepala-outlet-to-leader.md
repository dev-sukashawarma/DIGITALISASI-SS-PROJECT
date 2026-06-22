# Rename Role `kepala_outlet` → `leader` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the role value `kepala_outlet` to `leader` everywhere it is used as a literal string — database CHECK constraint, RLS policies, SQL helper functions, existing data rows, Edge Functions, and all app/package TypeScript code — without changing the role's behavior, scope, or app-access matrix.

**Architecture:** `role` is a plain `TEXT` column with a `CHECK` constraint (no native Postgres enum), so the rename is a value substitution, not a type migration. One new SQL migration handles the DB side (constraint, 2 helper functions, 6 RLS policies, existing-row backfill) in a single transaction-safe file. Each affected app/package gets its own task so test suites stay green per-package. Order matters: **DB migration first** (so `'leader'` is a valid value before any code writes it), then `packages/auth` (shared types consumed by every app), then Edge Functions, then each Next.js app, then docs last.

**Tech Stack:** Supabase Postgres (SQL migrations), Deno (Edge Functions), TypeScript, Next.js, Vitest.

---

## Pre-flight check

- [ ] **Step 1: Confirm current migration history is in sync**

Run: `supabase migration list`
Expected: remote and local timestamps match up to `20260619160000` (per [CLAUDE.md](../../../CLAUDE.md) — if diverged, run `supabase migration repair` first before continuing this plan).

- [ ] **Step 2: Snapshot current role data for rollback reference**

Run:
```bash
curl -s "https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/outlet_staff?select=id,role&role=eq.kepala_outlet" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```
Expected: JSON array of rows currently `role=kepala_outlet` (currently 1 row, "SPV Pusat", outlet_id `550e8400-e29b-41d4-a716-446655440001`). Save this output somewhere outside the repo (terminal scrollback is fine) — it's your rollback list if anything goes wrong.

---

### Task 1: Database migration (constraint, functions, policies, data)

**Files:**
- Create: `supabase/migrations/20260620000000_rename_role_kepala_outlet_to_leader.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 20260620000000_rename_role_kepala_outlet_to_leader.sql
-- Rename role value 'kepala_outlet' -> 'leader' (jobdesk Leader Outlet, ADR/docs ref: ROLE-JOBDESK.md).
-- role tetap TEXT + CHECK (bukan enum native), jadi rename = update constraint + data + semua
-- SQL literal yang bandingkan role = 'kepala_outlet'.

-- 1. Backfill existing rows BEFORE tightening the constraint.
UPDATE public.outlet_staff SET role = 'leader' WHERE role = 'kepala_outlet';

-- 2. Replace CHECK constraint (drop old name from 20260613000300, recreate with new value).
ALTER TABLE public.outlet_staff
  DROP CONSTRAINT IF EXISTS outlet_staff_role_check;

ALTER TABLE public.outlet_staff
  ADD CONSTRAINT outlet_staff_role_check
  CHECK (role IN ('admin', 'owner', 'spv', 'leader', 'kasir', 'crew', 'kiosk'));

-- 3. Helper functions (from 20260613000500_accessible_outlets_fn.sql, 20260609002000_create_surat_jalan.sql)
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
    WHERE me.role = 'leader' AND so.staff_id = me.id
  UNION
  SELECT me.outlet_id FROM me
    WHERE me.outlet_id IS NOT NULL
      AND me.role IN ('leader','kasir','crew','kiosk');
$$;

CREATE OR REPLACE FUNCTION public.auth_is_supervisor()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM outlet_staff
    WHERE id = auth.uid() AND role IN ('spv', 'leader')
  );
$$;

-- 4. RLS policies with inline 'kepala_outlet' literal — drop + recreate with 'leader'.

-- apps/stok: bahan_baku_write (20260609001700_stok_rls.sql)
DROP POLICY IF EXISTS bahan_baku_write ON public.bahan_baku;
CREATE POLICY bahan_baku_write ON public.bahan_baku FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'leader'))
  WITH CHECK (EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'leader'));

-- apps/absensi: oac_update_spv (20260610000300_m1_attendance_rls.sql)
DROP POLICY IF EXISTS oac_update_spv ON public.outlet_attendance_config;
CREATE POLICY oac_update_spv
  ON public.outlet_attendance_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outlet_staff me
      WHERE me.id = auth.uid()
        AND me.outlet_id = outlet_attendance_config.outlet_id
        AND me.role IN ('spv','leader')
    )
  );

-- apps/absensi: attendance_spv_read_outlet (20260610000600_add_signatures_to_surat_jalan.sql)
DROP POLICY IF EXISTS attendance_spv_read_outlet ON public.attendance;
CREATE POLICY attendance_spv_read_outlet
  ON public.attendance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outlet_staff me
      WHERE me.id = auth.uid()
        AND me.outlet_id = attendance.outlet_id
        AND me.role IN ('spv', 'leader')
    )
  );

-- apps/absensi: checklist_categories / checklist_items "SPV can manage..." (20260611000000_m1_absensi_checklist.sql)
DROP POLICY IF EXISTS "SPV can manage categories in their outlet" ON public.checklist_categories;
CREATE POLICY "SPV can manage categories in their outlet" ON public.checklist_categories
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM outlet_staff
    WHERE outlet_staff.id = auth.uid()
      AND outlet_staff.outlet_id = checklist_categories.outlet_id
      AND outlet_staff.role IN ('spv', 'leader')
  ));

DROP POLICY IF EXISTS "SPV can manage items in their outlet" ON public.checklist_items;
CREATE POLICY "SPV can manage items in their outlet" ON public.checklist_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM checklist_categories c
    JOIN outlet_staff s ON s.outlet_id = c.outlet_id
    WHERE c.id = checklist_items.category_id
      AND s.id = auth.uid()
      AND s.role IN ('spv', 'leader')
  ));

-- 5. Cosmetic: comment on column referenced 'kepala_outlet' in prose.
COMMENT ON COLUMN public.outlet_staff.consent_by IS 'SPV/leader yang melakukan enroll';
```

- [ ] **Step 2: Push migration to remote**

Run: `supabase db push`
Expected: migration `20260620000000` applies cleanly with no errors.

- [ ] **Step 3: Verify constraint and data**

Run:
```bash
curl -s "https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/outlet_staff?select=role,name&role=eq.leader" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```
Expected: the "SPV Pusat" row now shows `role: "leader"`.

Run:
```bash
curl -s "https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/outlet_staff?select=role&role=eq.kepala_outlet" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```
Expected: `[]` (empty — no rows left with the old value).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260620000000_rename_role_kepala_outlet_to_leader.sql
git commit -m "feat(db): rename role kepala_outlet to leader"
```

---

### Task 2: `packages/auth` — shared Role type and access matrix

**Files:**
- Modify: `packages/auth/src/types.ts:5`
- Modify: `packages/auth/src/access.ts:8`
- Modify: `packages/auth/src/access.test.ts:19,35,36`

- [ ] **Step 1: Update the failing tests first**

In `packages/auth/src/access.test.ts`, replace lines 19, 35-37:

```ts
  it('hanya admin yang punya admin-dashboard', () => {
    const roles: Array<keyof typeof ROLE_APP_ACCESS> = ['owner', 'spv', 'leader', 'kasir', 'crew', 'kiosk']
    roles.forEach(role => {
      expect(ROLE_APP_ACCESS[role]).not.toContain('admin-dashboard')
    })
  })
```

```ts
describe('hasAppAccess', () => {
  it('leader boleh stok', () => {
    expect(hasAppAccess('leader', 'stok')).toBe(true)
  })
  it('crew tidak boleh pos-kasir', () => {
    expect(hasAppAccess('crew', 'pos-kasir')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail (type error / undefined role)**

Run: `cd packages/auth && yarn test`
Expected: FAIL — `'leader'` is not assignable to `Role`, or `ROLE_APP_ACCESS.leader` is undefined.

- [ ] **Step 3: Update the type and access matrix**

In `packages/auth/src/types.ts`, line 5:
```ts
export type Role =
  | 'admin'
  | 'owner'
  | 'spv'
  | 'leader'
  | 'kasir'
  | 'crew'
  | 'kiosk'
```

In `packages/auth/src/access.ts`, line 8:
```ts
  leader: ['pos-kasir', 'absensi', 'stok', 'distribusi'],
```
(keep key order as-is otherwise; only rename the key from `kepala_outlet` to `leader`)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/auth && yarn test`
Expected: PASS, all green.

- [ ] **Step 5: Rebuild the package (consumers import `dist/`, not `src/` — see memory note `suka-auth-dist-gotcha`)**

Run: `cd packages/auth && yarn build`
Expected: build succeeds, `dist/types.js` / `dist/access.js` contain `leader` not `kepala_outlet`.

- [ ] **Step 6: Commit**

```bash
git add packages/auth/src/types.ts packages/auth/src/access.ts packages/auth/src/access.test.ts packages/auth/dist
git commit -m "feat(auth): rename Role kepala_outlet to leader"
```

---

### Task 3: Edge Functions (`supabase/functions`)

**Files:**
- Modify: `supabase/functions/_shared/admin-guard.ts:1,25,26`
- Modify: `supabase/functions/_shared/admin-guard.test.ts:7,20,22,26,27`
- Modify: `supabase/functions/admin-create-staff/index.ts:51,52`
- Modify: `supabase/functions/admin-update-staff/index.ts:43,44`
- Modify: `supabase/functions/create-staff/index.ts:31`
- Modify: `supabase/functions/delete-staff/index.ts:31`

- [ ] **Step 1: Update the test file first**

In `supabase/functions/_shared/admin-guard.test.ts`, replace each `kepala_outlet` literal with `leader`:
- Line 7: `assertThrows(() => assertAdmin({ role: "leader" }), Error, "Unauthorized");`
- Line 20: `Deno.test("validateCreateInput requires outlet_ids for leader", () => {`
- Line 22: `() => validateCreateInput({ name: "n", username: "u", password: "p", role: "leader", outlet_id: "o" }),`
- Line 26: `// valid leader with outlet_ids does not throw`
- Line 27: `validateCreateInput({ name: "n", username: "u", password: "p", role: "leader", outlet_id: "o", outlet_ids: ["a"] });`

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd supabase/functions/_shared && deno test admin-guard.test.ts`
Expected: FAIL — `Invalid role: leader` thrown because `VALID_ROLES` doesn't include it yet.

- [ ] **Step 3: Update `admin-guard.ts`**

```ts
const VALID_ROLES = ["admin", "owner", "spv", "leader", "kasir", "crew", "kiosk"];
```
And:
```ts
  if (role === "leader" && (!outlet_ids || outlet_ids.length === 0)) {
    throw new Error("leader requires outlet_ids (minimal 1 outlet binaan)");
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd supabase/functions/_shared && deno test admin-guard.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the remaining Edge Functions**

In `supabase/functions/admin-create-staff/index.ts` (lines 51-52):
```ts
    // 3. staff_outlets untuk leader
    if (role === "leader" && Array.isArray(outlet_ids)) {
```

In `supabase/functions/admin-update-staff/index.ts` (lines 43-44):
```ts
    // Sinkronkan staff_outlets bila leader (delete-insert)
    if (role === "leader" && Array.isArray(outlet_ids)) {
```

In `supabase/functions/create-staff/index.ts` (line 31):
```ts
    if (!callerProfile || !["spv", "leader"].includes(callerProfile.role)) {
```

In `supabase/functions/delete-staff/index.ts` (line 31):
```ts
    if (!callerProfile || !["spv", "leader"].includes(callerProfile.role)) {
```

- [ ] **Step 6: Deploy the changed functions**

Run:
```bash
supabase functions deploy admin-create-staff
supabase functions deploy admin-update-staff
supabase functions deploy create-staff
supabase functions deploy delete-staff
```
Expected: each deploys without error.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions
git commit -m "feat(functions): rename role kepala_outlet to leader"
```

---

### Task 4: `apps/admin-dashboard`

**Files:**
- Modify: `apps/admin-dashboard/src/lib/types.ts:39`
- Modify: `apps/admin-dashboard/src/components/StaffForm.tsx:7,59`
- Modify: `apps/admin-dashboard/src/components/StaffFilters.tsx:4`
- Modify: `apps/admin-dashboard/src/components/StaffForm.test.tsx:12,16,17`

- [ ] **Step 1: Update the test file first**

In `apps/admin-dashboard/src/components/StaffForm.test.tsx`:
```ts
  it('shows OutletMultiSelect only when role is leader', () => {
    render(<StaffForm outlets={outlets} onSubmit={vi.fn()} submitting={false} />)
    expect(screen.queryByText('Outlet Binaan')).toBeNull()
    // switch to leader
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'leader' } })
    expect(screen.getByText('Outlet Binaan')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/admin-dashboard && yarn test StaffForm.test.tsx`
Expected: FAIL — `<option value="leader">` doesn't exist yet, "Outlet Binaan" never renders.

- [ ] **Step 3: Update `StaffForm.tsx`**

Line 7:
```ts
const ROLES: Role[] = ['admin', 'owner', 'spv', 'leader', 'kasir', 'crew', 'kiosk']
```
Line 59:
```ts
      {role === 'leader' && (
```

- [ ] **Step 4: Update `StaffFilters.tsx`**

Line 4:
```ts
const ROLES = ['admin', 'owner', 'spv', 'leader', 'kasir', 'crew', 'kiosk']
```

- [ ] **Step 5: Update `lib/types.ts` comment**

Line 39:
```ts
  outlet_ids: string[] // dari staff_outlets (leader)
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/admin-dashboard && yarn test StaffForm.test.tsx`
Expected: PASS.

- [ ] **Step 7: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add apps/admin-dashboard
git commit -m "feat(admin-dashboard): rename role kepala_outlet to leader"
```

---

### Task 5: `apps/distribusi`

**Files:**
- Modify: `apps/distribusi/src/app/dashboard/page.tsx:14`
- Modify: `apps/distribusi/src/components/distribusi/SuratJalanDetail.tsx:69,166,361`
- Modify: `apps/distribusi/src/components/distribusi/PengirimanList.tsx:34`
- Modify: `apps/distribusi/src/components/distribusi/BottomNav.tsx:17`

- [x] **Step 1: Replace all 5 occurrences**

`apps/distribusi/src/app/dashboard/page.tsx:14`:
```ts
  const isPusat = outletStaff?.role === 'leader'
```

`apps/distribusi/src/components/distribusi/SuratJalanDetail.tsx:69`:
```ts
      if (data && outletStaff?.role !== 'leader') {
```
Line 166:
```ts
  if (outletStaff?.role !== 'leader') {
```
Line 361:
```ts
          {outletStaff?.role === 'leader' && (data.status === 'diterima_lengkap' || data.status === 'diterima_sebagian') && (
```

`apps/distribusi/src/components/distribusi/PengirimanList.tsx:34`:
```ts
  if (outletStaff?.role !== 'leader') {
```

`apps/distribusi/src/components/distribusi/BottomNav.tsx:17`:
```ts
  const isPusat = outletStaff.role === 'leader'
```

- [x] **Step 2: Type-check**

Run: `cd apps/distribusi && yarn type-check`
Expected: 0 errors.

- [x] **Step 3: Commit**

```bash
git add apps/distribusi
git commit -m "feat(distribusi): rename role kepala_outlet to leader"
```

---

### Task 6: `apps/absensi`

**Files:**
- Modify: `apps/absensi/src/app/dashboard/layout.tsx:18`
- Modify: `apps/absensi/src/app/dashboard/manajemen-kru/page.tsx:228,315`

- [x] **Step 1: Replace occurrences**

`apps/absensi/src/app/dashboard/layout.tsx:18`:
```ts
  const isSPV = outletStaff?.role === "spv" || outletStaff?.role === "leader";
```

`apps/absensi/src/app/dashboard/manajemen-kru/page.tsx` lines 228 and 315 (both identical `<option>`):
```tsx
                    <option value="leader">Leader Outlet</option>
```

- [x] **Step 2: Type-check**

Run: `cd apps/absensi && yarn type-check`
Expected: 0 errors.

- [x] **Step 3: Commit**

```bash
git add apps/absensi
git commit -m "feat(absensi): rename role kepala_outlet to leader"
```

---

### Task 7: `apps/pos-kasir`

**Files:**
- Modify: `apps/pos-kasir/middleware.ts:60,87,99`

- [x] **Step 1: Replace occurrences**

Line 60:
```ts
    if (!user || !['kasir', 'leader'].includes(role as string) || !hasAppAccess(role as any, 'pos-kasir') || status !== 'active') {
```
Line 87:
```ts
      if (role === 'kasir' || role === 'leader') return getRedirect('/kasir')
```
Line 99:
```ts
    if (role === 'kasir' || role === 'leader') return getRedirect('/kasir')
```

- [x] **Step 2: Type-check**

Run: `cd apps/pos-kasir && yarn type-check`
Expected: 0 errors.

- [x] **Step 3: Commit**

```bash
git add apps/pos-kasir
git commit -m "feat(pos-kasir): rename role kepala_outlet to leader"
```

---

### Task 8: `apps/stok` test fixture

**Files:**
- Modify: `apps/stok/src/components/monitoring/__tests__/integration.test.tsx:132,140`

- [x] **Step 1: Update test fixture**

Line 132:
```ts
  it('renders Crew dashboard for leader role', async () => {
```
Line 140:
```ts
        role: 'leader',
```

- [x] **Step 2: Run test to verify it still passes**

Run: `cd apps/stok && yarn test integration.test.tsx`
Expected: PASS (this fixture doesn't gate on the literal string for behavior, just labels a test case — confirm no assertion depends on the old string elsewhere in the file).

- [x] **Step 3: Commit**

```bash
git add apps/stok
git commit -m "test(stok): rename role kepala_outlet to leader in fixture"
```

---

### Task 9: Docs (CLAUDE.md, ROLE-JOBDESK.md, CONTEXT.md)

**Files:**
- Modify: `CLAUDE.md` — role list mention: `admin, owner, spv, kepala_outlet, kasir, crew, kiosk`
- Modify: `docs/ROLE-JOBDESK.md` — all `kepala_outlet` references (role table, hierarchy diagram, access matrix)
- Modify: `CONTEXT.md` — if it mentions the role

- [x] **Step 1: Update `CLAUDE.md`**

Replace the line under "Outlet Model":
```
**Multi-outlet:** `kepala_outlet` bisa membina beberapa outlet via tabel `staff_outlets` (many-to-many).
```
with:
```
**Multi-outlet:** `leader` (dulu `kepala_outlet`) bisa membina beberapa outlet via tabel `staff_outlets` (many-to-many).
```
And update the role list:
```
Role: admin, owner, spv, leader, kasir, crew, kiosk.
```

- [x] **Step 2: Update `docs/ROLE-JOBDESK.md`**

Replace every `kepala_outlet` with `leader` in the role table, hierarchy diagram, and access matrix (the doc text itself, e.g. "Leader Outlet" label already matches — only the `role` column value `kepala_outlet` needs to become `leader`).

- [x] **Step 3: Grep for any remaining references outside docs/specs already covered**

Run: `grep -rn "kepala_outlet" --include="*.ts" --include="*.tsx" --include="*.sql" .`
Expected: no matches in active code/migrations (historical plan/spec/ADR docs under `docs/superpowers/specs` and `docs/superpowers/plans` are a historical record — leave them as-is, they describe what was true when written).

- [x] **Step 4: Commit**

```bash
git add CLAUDE.md docs/ROLE-JOBDESK.md
git commit -m "docs: rename role kepala_outlet to leader"
```

---

## Final verification

- [x] **Step 1: Full type-check across monorepo**

Run: `yarn type-check`
Expected: 0 errors.

- [x] **Step 2: Full test suite**

Run: `yarn test` (or per-app `yarn test` if no root script)
Expected: all green.

- [ ] **Step 3: Smoke test in browser**

Log in as the "SPV Pusat" user (now role `leader`) on `stok`, `absensi`, and `distribusi` — confirm dashboard renders, outlet-binaan access still works (no RLS lockout), and admin-dashboard's StaffForm shows "Outlet Binaan" picker when role is set to `leader`.
