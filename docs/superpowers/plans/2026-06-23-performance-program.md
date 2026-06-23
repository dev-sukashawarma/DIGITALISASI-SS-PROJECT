# Performance Improvement Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit and harden performance across all 7 SUKA apps — instrument a baseline, kill cross-cutting auth/query waste, fix database hot paths, then sweep per-app N+1s — leaving a repeatable perf guardrail.

**Architecture:** Phased (0→1→2→3). Fase 0 instruments so every later change is measurable. Fase 1 lands one-fix-helps-all-apps wins in `@suka/auth`. Fase 2 is data-driven from Fase 0's slow-query list (indexes, JS→SQL). Fase 3 is per-app cleanup + a written budget. No behavior changes — only speed.

**Tech Stack:** Next.js (app router) + TypeScript, Supabase (Postgres + RLS), `@suka/auth` shared package, vitest, Supabase migrations.

**Spec:** `docs/superpowers/specs/2026-06-23-performance-program-design.md`

---

## File Structure

- `packages/auth/src/timing.ts` (new) — `withTiming` slow-call logger, exported from `@suka/auth`.
- `packages/auth/src/timing.test.ts` (new) — unit tests for `withTiming`.
- `packages/auth/src/index.ts` (modify) — export timing.
- `packages/auth/src/middleware.ts` (modify) — loud warning on missing JWT secret in prod.
- `apps/portal/src/middleware.ts` (modify) — route through local-JWT path.
- `apps/stok/src/lib/queries/monitoring.ts` (modify) — de-dup double `getUser()`.
- `supabase/migrations/<ts>_enable_pg_stat_statements.sql` (new).
- `supabase/migrations/<ts>_attendance_outlet_ts_index.sql` (new).
- `supabase/migrations/<ts>_outlet_presence_view.sql` (new).
- `docs/PERFORMANCE.md` (new) — baseline tables, perf budget, review checklist.

---

## FASE 0 — Instrumentation & Baseline

### Task 0.1: `withTiming` slow-call logger (TDD)

**Files:**
- Create: `packages/auth/src/timing.ts`
- Test: `packages/auth/src/timing.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/auth/src/timing.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withTiming } from './timing'

describe('withTiming', () => {
  beforeEach(() => { process.env.PERF_LOG = '1' })
  afterEach(() => { delete process.env.PERF_LOG; vi.restoreAllMocks() })

  it('returns the wrapped fn result unchanged', async () => {
    const result = await withTiming('label', async () => 42)
    expect(result).toBe(42)
  })

  it('logs when duration exceeds threshold and PERF_LOG is set', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(500)
    await withTiming('slow-op', async () => 'x')
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[slow-query] slow-op'))
  })

  it('does NOT log when PERF_LOG is unset', async () => {
    delete process.env.PERF_LOG
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(500)
    await withTiming('slow-op', async () => 'x')
    expect(spy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/auth && npx vitest run src/timing.test.ts`
Expected: FAIL — `withTiming` is not defined / module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/auth/src/timing.ts

/** Threshold (ms) above which a wrapped call is logged. */
const SLOW_MS = Number(process.env.PERF_SLOW_MS ?? 300)

/**
 * Wraps an async call and logs `[slow-query] <label> <ms>ms` when it exceeds
 * the threshold AND `PERF_LOG=1`. Zero overhead when PERF_LOG is unset.
 */
export async function withTiming<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (process.env.PERF_LOG !== '1') return fn()
  const start = Date.now()
  try {
    return await fn()
  } finally {
    const ms = Date.now() - start
    if (ms >= SLOW_MS) console.warn(`[slow-query] ${label} ${ms}ms`)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/auth && npx vitest run src/timing.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Export from package + build**

Add to `packages/auth/src/index.ts`:

```ts
export * from './timing'
```

Then build (consumers import from `dist/`, per memory `suka-auth-dist-gotcha`):

Run: `cd packages/auth && yarn build`
Expected: build succeeds, `dist/timing.js` present.

- [ ] **Step 6: Commit**

```bash
git add packages/auth/src/timing.ts packages/auth/src/timing.test.ts packages/auth/src/index.ts packages/auth/dist
git commit -m "feat(auth): add withTiming slow-query logger (PERF_LOG gated)"
```

### Task 0.2: Enable `pg_stat_statements`

**Files:**
- Create: `supabase/migrations/<timestamp>_enable_pg_stat_statements.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Enable query statistics collection for baseline + slow-query discovery.
create extension if not exists pg_stat_statements;
```

- [ ] **Step 2: Reconcile history then push** (memory `supabase-migration-history-drift` — never push polos)

Run: `supabase migration list`
Expected: local & remote in sync up to latest. If diverged, `supabase migration repair --status applied <id>` first.

Run: `supabase db push`
Expected: migration applied, no error.

- [ ] **Step 3: Verify extension active**

Run (Supabase SQL editor or psql): `select count(*) from pg_stat_statements;`
Expected: returns a row count (extension live).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations
git commit -m "chore(db): enable pg_stat_statements for perf baseline"
```

### Task 0.3: Capture baseline into `docs/PERFORMANCE.md`

**Files:**
- Create: `docs/PERFORMANCE.md`

- [ ] **Step 1: Pull top-20 slowest/most-frequent queries**

Run in SQL editor:

```sql
select substring(query, 1, 120) as query, calls, round(mean_exec_time::numeric, 1) as mean_ms,
       round(total_exec_time::numeric, 1) as total_ms
from pg_stat_statements
order by total_exec_time desc
limit 20;
```

- [ ] **Step 2: Record per-app cold-load TTFB**

For each app (absensi, admin-dashboard, distribusi, owner-dashboard, portal, pos-kasir, stok), `yarn dev` and note dashboard TTFB from browser devtools Network tab (or `curl -w '%{time_starttransfer}\n' -o /dev/null -s <url>`).

- [ ] **Step 3: Write the doc**

```markdown
# Performance — Baseline & Budget

## Before (captured 2026-06-23)

### Top-20 queries (pg_stat_statements)
| query | calls | mean_ms | total_ms |
|---|---|---|---|
| <paste rows> | | | |

### Per-app cold load TTFB
| app | TTFB (ms) |
|---|---|
| absensi | |
| admin-dashboard | |
| distribusi | |
| owner-dashboard | |
| portal | |
| pos-kasir | |
| stok | |

## How to read pg_stat_statements
- `total_exec_time` = where the DB spends real time (fix these first).
- `mean_exec_time` high + low `calls` = a slow one-off; high `calls` + modest mean = a hot path worth caching/indexing.
- Reset between experiments: `select pg_stat_statements_reset();`
```

- [ ] **Step 4: Commit**

```bash
git add docs/PERFORMANCE.md
git commit -m "docs(perf): capture pre-optimization baseline"
```

---

## FASE 1 — Cross-cutting wins

### Task 1.1: Route portal middleware through local-JWT path

**Files:**
- Modify: `apps/portal/src/middleware.ts`

> Portal currently calls network `auth.getUser()` on every request. `@suka/auth` already has `enforceAppAccess` with the JWT-local fast path, but portal's gate logic differs (redirect `/`→`/launcher` for active staff, `/`-only login). Keep portal's logic but replace the identity fetch with the JWT-local pattern used in `packages/auth/src/middleware.ts:58-70`.

- [ ] **Step 1: Replace the identity block**

Replace this:

```ts
  const { data: { user } } = await supabase.auth.getUser()
```

With:

```ts
  // Identitas via JWT lokal (tanpa network); fallback getUser() bila secret kosong (dev).
  const jwtSecret = process.env.SUPABASE_JWT_SECRET
  let userId: string | null = null
  if (jwtSecret) {
    const { data: { session } } = await supabase.auth.getSession()
    const { verifyAccessToken } = await import('@suka/auth')
    const claims = session?.access_token
      ? await verifyAccessToken(session.access_token, jwtSecret)
      : null
    userId = claims?.sub ?? null
  } else {
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  }
```

Then update the two `user` usages below: `if (user && pathname === '/')` → `if (userId && pathname === '/')`, `.eq('id', user.id)` → `.eq('id', userId)`, and `if (!user && pathname !== '/')` → `if (!userId && pathname !== '/')`.

- [ ] **Step 2: Type-check**

Run: `cd apps/portal && yarn type-check`
Expected: 0 errors.

- [ ] **Step 3: Manual smoke (dev)**

Run: `cd apps/portal && yarn dev` — log in, confirm redirect `/`→`/launcher` still works, logout forces `/`.
Expected: identical behavior, no auth regression.

- [ ] **Step 4: Commit**

```bash
git add apps/portal/src/middleware.ts
git commit -m "perf(portal): verify identity via local JWT, drop network getUser per request"
```

### Task 1.2: Loud warning when `SUPABASE_JWT_SECRET` missing in prod

**Files:**
- Modify: `packages/auth/src/middleware.ts:67-70`

- [ ] **Step 1: Add the warning in the fallback branch**

In the `else` branch (line 67), before `getUser()`:

```ts
  } else {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[perf] SUPABASE_JWT_SECRET unset in production — falling back to slow network getUser() per request')
    }
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  }
```

- [ ] **Step 2: Build**

Run: `cd packages/auth && yarn build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/auth/src/middleware.ts packages/auth/dist
git commit -m "perf(auth): warn loudly on missing SUPABASE_JWT_SECRET in prod"
```

### Task 1.3: De-dup double `getUser()` in stok monitoring

**Files:**
- Modify: `apps/stok/src/lib/queries/monitoring.ts:18,104`

- [ ] **Step 1: Read the two call sites**

Run: `sed -n '10,30p;95,115p' apps/stok/src/lib/queries/monitoring.ts`
Identify the function boundaries — line 18 resolves the user in one fetch fn, line 104 re-resolves via `userId || (await supabase.auth.getUser())...`.

- [ ] **Step 2: Thread the resolved userId through**

Make the function owning line 18 resolve `userId` once and pass it as a parameter to the function at line 104 (or hoist a single `const userId = (await supabase.auth.getUser()).data.user?.id` shared by both code paths). Remove the second `getUser()` call.

- [ ] **Step 3: Run tests**

Run: `cd apps/stok && npx vitest run src/lib/queries/__tests__/monitoring-detail-access.test.ts`
Expected: PASS (access test still green — behavior unchanged).

- [ ] **Step 4: Type-check + commit**

Run: `cd apps/stok && yarn type-check` → 0 errors.

```bash
git add apps/stok/src/lib/queries/monitoring.ts
git commit -m "perf(stok): resolve auth user once in monitoring queries"
```

### Task 1.4: Audit Supabase client creation (one per request)

**Files:**
- Inspect: all `createSupabaseBrowserClient` / `createSupabaseServerClient` / `createClient` call sites.

- [ ] **Step 1: Enumerate client creations**

Run: `grep -rn "createSupabaseBrowserClient\|createSupabaseServerClient\|createClient(" apps/*/src --include=*.ts --include=*.tsx`
Flag any component that creates a client in render (not memoized/module-scope) — these handshake repeatedly. Cross-check against memory `two-factory-browser-client-gotcha`.

- [ ] **Step 2: Fix offenders**

For each per-render client creation, move to module scope or `useMemo`/shared hook delegating to `@suka/auth`. Document each fix in the commit body.

- [ ] **Step 3: Type-check affected apps + commit**

```bash
git add -A
git commit -m "perf: ensure single Supabase client per request, drop per-render clients"
```

### Task 1.5: Cache read-mostly reference data (outlets / bahan_baku / outlet_staff)

**Files:**
- Inspect/modify: shared data helpers in each app that fetch `outlets`, `bahan_baku`.

- [ ] **Step 1: Find repeat reads**

Run: `grep -rn "from('outlets')\|from('bahan_baku')" apps/*/src --include=*.ts --include=*.tsx`

- [ ] **Step 2: Wrap server-side reads in React `cache()`**

For RSC fetchers of slow-changing tables, wrap in `import { cache } from 'react'` so repeated calls within one request dedupe, and add `export const revalidate = 60` (or appropriate) on pages that read them. Do NOT cache per-outlet stock/ledger (live data).

- [ ] **Step 3: Verify no stale-data regression in dev + commit**

```bash
git add -A
git commit -m "perf: dedupe reference-data reads with React cache + revalidate"
```

---

## FASE 2 — Database layer (data-driven from Fase 0)

### Task 2.1: `attendance(outlet_id, ts_server DESC)` index (confirmed candidate)

**Files:**
- Create: `supabase/migrations/<timestamp>_attendance_outlet_ts_index.sql`

> The `outlet-presence` route filters `attendance` by `outlet_id` + `ts_server >= ...` ordered desc. Verify no covering index exists first.

- [ ] **Step 1: EXPLAIN before**

Run in SQL editor:

```sql
explain analyze
select outlet_staff_id, type from attendance
where outlet_id = '<real-outlet-id>' and ts_server >= now() - interval '18 hours'
order by ts_server desc;
```

Record plan (expect Seq Scan or filter) into `docs/PERFORMANCE.md`.

- [ ] **Step 2: Write the index migration**

```sql
create index if not exists idx_attendance_outlet_ts
  on attendance (outlet_id, ts_server desc);
```

- [ ] **Step 3: Push (repair history if needed) + EXPLAIN after**

Run: `supabase migration list` → repair if diverged → `supabase db push`.
Re-run the EXPLAIN ANALYZE; confirm Index Scan and lower exec time. Record "after" in `docs/PERFORMANCE.md`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations docs/PERFORMANCE.md
git commit -m "perf(db): index attendance(outlet_id, ts_server) for presence queries"
```

### Task 2.2: Replace `outlet-presence` JS dedup with a SQL view/RPC

**Files:**
- Create: `supabase/migrations/<timestamp>_outlet_presence_view.sql`
- Modify: `apps/absensi/src/app/api/outlet-presence/route.ts`

- [ ] **Step 1: Write a `DISTINCT ON` view (latest status per staff)**

```sql
-- Latest attendance type per staff within trailing window, for presence checks.
create or replace view attendance_latest_per_staff
with (security_barrier) as
select distinct on (outlet_id, outlet_staff_id)
  outlet_id, outlet_staff_id, type, ts_server
from attendance
order by outlet_id, outlet_staff_id, ts_server desc;
```

- [ ] **Step 2: Push migration** (`migration list` → repair → `db push`).

- [ ] **Step 3: Simplify the route to a single boolean query**

Replace the fetch-all + double JS loop in `route.ts` with:

```ts
const eighteenHoursAgo = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString()
const { data, error } = await supabase
  .from('attendance_latest_per_staff')
  .select('outlet_staff_id')
  .eq('outlet_id', outlet_id)
  .eq('type', 'in')
  .gte('ts_server', eighteenHoursAgo)
  .limit(1)
if (error) throw error
const hasPresence = !!(data && data.length > 0)
```

- [ ] **Step 4: Smoke test the endpoint**

Run: `cd apps/absensi && yarn dev` then `curl 'http://localhost:<port>/api/outlet-presence?outlet_id=<id>'`
Expected: `{"hasPresence":true|false}` identical to before for the same data.

- [ ] **Step 5: Type-check + commit**

```bash
git add apps/absensi/src/app/api/outlet-presence/route.ts supabase/migrations
git commit -m "perf(absensi): compute outlet presence in SQL via DISTINCT ON view"
```

### Task 2.3: Triage remaining top-20 (repeatable, per finding)

> Repeat this loop for each remaining slow query from Fase 0's `docs/PERFORMANCE.md` top-20, in `total_exec_time` order. Each finding = its own commit.

- [ ] **Step 1:** `EXPLAIN ANALYZE` the query; classify: missing index / over-fetch (`select('*')`) / JS aggregation / N+1.
- [ ] **Step 2:** Apply the matching fix — index migration, narrowed `select(...)`, view/RPC, or batch. For monitoring views & `accessible_outlet_ids()`, confirm no seq-scan and that RLS scope is preserved (view definer still bypasses RLS for cross-outlet — do not break this).
- [ ] **Step 3:** `EXPLAIN ANALYZE` after; record before/after in `docs/PERFORMANCE.md`.
- [ ] **Step 4:** Commit per finding: `perf(db): <what> — <before>ms → <after>ms`.

---

## FASE 3 — Per-app cleanup & guardrails

### Task 3.1: N+1 / waterfall sweep (worst-offenders first)

> Order: absensi → distribusi → stok → admin-dashboard → owner-dashboard. Suspect files already located (Fase 0 grep): chart components, `rekap`, `checklist-monitor`, `papan-kehadiran`, `useSuratJalan`, `leaderboard`, `healthStatus`.

For each app, repeat:

- [ ] **Step 1:** With `PERF_LOG=1`, exercise each heavy screen; collect `[slow-query]` lines. Wrap suspect fetchers in `withTiming('<app>:<screen>', ...)` to attribute time.
- [ ] **Step 2:** For each `await`-in-loop or sequential-fetch waterfall, convert to a single batched query (`in(...)` / join / embed) or `Promise.all` parallelization where independent.
- [ ] **Step 3:** Re-run the screen; confirm fewer/faster `[slow-query]` lines. Existing vitest suite for that app stays green: `cd apps/<app> && npx vitest run`.
- [ ] **Step 4:** Commit per app: `perf(<app>): batch N+1 queries on <screens>`.

### Task 3.2: Perf budget + review checklist

**Files:**
- Modify: `docs/PERFORMANCE.md`

- [ ] **Step 1: Append the budget + checklist + After table**

```markdown
## After (post-optimization)
| metric | before | after |
|---|---|---|
| <fill from baseline> | | |

## Perf Budget
- Dashboard TTFB target: < 800ms cold, < 200ms warm.
- No single screen issues > 4 sequential DB round-trips.

## Review Checklist (every PR touching data)
- [ ] No `select('*')` on hot paths — list explicit columns.
- [ ] No `await` inside a render/JS loop over rows — batch with `in(...)`/join.
- [ ] Every new filtered/ordered column has a supporting index.
- [ ] New cross-outlet reads go through a definer view/RPC, not raw ledger_stok.
- [ ] Identity in middleware uses local-JWT path (SUPABASE_JWT_SECRET set in prod).
```

- [ ] **Step 2: Commit**

```bash
git add docs/PERFORMANCE.md
git commit -m "docs(perf): add perf budget, review checklist, after-metrics"
```

---

## Self-Review Notes

- **Spec coverage:** Fase 0 (0.1–0.3) ✓ instrumentation/baseline. Fase 1 (1.1–1.5) ✓ all five cross-cutting rows in spec table. Fase 2 (2.1–2.3) ✓ index + JS→SQL + view/RPC + `accessible_outlet_ids` review. Fase 3 (3.1–3.2) ✓ N+1 sweep + budget/checklist. Risks (migration drift, RLS, distribusi LIVE) embedded in relevant steps.
- **Note on TDD:** Only `withTiming` (0.1) is pure logic suited to red-green TDD. DB/perf tasks are measure-driven (EXPLAIN before/after) — the analogous discipline. Behavior-preserving app changes are guarded by existing vitest suites.
- **Distribusi LIVE:** Fase 3 touches distribusi source in repo only; production re-upload follows the existing deploy playbook — not part of this plan's commits.
