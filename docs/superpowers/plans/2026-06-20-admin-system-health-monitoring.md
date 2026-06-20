# Admin System Health Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `admin` a single page (`/dashboard/system-health` in `apps/admin-dashboard`) that shows whether each app (stok, absensi, pos-kasir, distribusi, owner-dashboard), Supabase, and the cPanel server are healthy — without admin having to open each subdomain or cPanel manually.

**Architecture:** A Supabase Edge Function (`system-health-collector`), triggered by `pg_cron` every 5 minutes, polls a new `GET /api/health` endpoint on each app plus Supabase itself plus (optionally) cPanel UAPI, and writes one row per target into a new table `system_health_log`. `apps/admin-dashboard` reads that table read-only via React Query (30s refetch) — it never calls the apps or cPanel directly.

**Tech Stack:** Supabase Postgres + pg_cron + pg_net + Edge Functions (Deno), Next.js App Router route handlers, `@tanstack/react-query`, Vitest + Testing Library, Deno's built-in test runner for the Edge Function.

**Spec:** `docs/superpowers/specs/2026-06-20-admin-system-health-monitoring-design.md`

---

## Task 1: Migration — `system_health_log` table + RLS

**Files:**
- Create: `supabase/migrations/20260620120000_create_system_health_log.sql`

This project has no automated SQL test framework (no pgTAP, no precedent in any existing migration). Verification here is a manual `psql`/Supabase SQL editor smoke check, consistent with every other migration in `supabase/migrations/`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260620120000_create_system_health_log.sql

CREATE TABLE system_health_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('app', 'supabase', 'cpanel')),
  target_name TEXT NOT NULL CHECK (target_name IN (
    'stok', 'absensi', 'pos-kasir', 'distribusi', 'owner-dashboard',
    'supabase-db', 'cpanel-server'
  )),
  status TEXT NOT NULL CHECK (status IN ('up', 'degraded', 'down', 'unconfigured')),
  db_status TEXT CHECK (db_status IN ('ok', 'error')),
  last_activity_at TIMESTAMPTZ,
  response_time_ms INT,
  detail JSONB,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_health_log_target_checked
  ON system_health_log (target_type, target_name, checked_at DESC);

ALTER TABLE system_health_log ENABLE ROW LEVEL SECURITY;

-- Hanya admin yang boleh baca (super user monitoring). Reuse helper dari
-- 20260619160000_admin_read_all_staff.sql — sudah SECURITY DEFINER, hindari rekursi RLS.
CREATE POLICY system_health_log_admin_read
  ON system_health_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Insert hanya dari service role (collector Edge Function), yang bypass RLS secara default.
-- Policy ini menutup jalur insert untuk role authenticated biasa.
CREATE POLICY system_health_log_insert_denied
  ON system_health_log FOR INSERT
  TO authenticated
  WITH CHECK (false);
```

- [ ] **Step 2: Push migration to remote and verify**

Run: `supabase db push`
Expected: migration applies cleanly (no diverged-history error; if it errors, run `supabase migration repair --status applied` for already-applied objects first, per `CLAUDE.md`).

Then in Supabase SQL editor, run:
```sql
insert into system_health_log (target_type, target_name, status)
values ('app', 'stok', 'up');

select * from system_health_log;
```
Expected: row inserted (service-role/SQL-editor context bypasses RLS), columns match schema.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260620120000_create_system_health_log.sql
git commit -m "feat(db): add system_health_log table for admin health monitoring"
```

---

## Task 2: Health endpoint — `apps/stok`

**Files:**
- Create: `apps/stok/src/app/api/health/route.ts`

Per spec §5, these endpoints get a manual curl smoke test post-deploy, not an automated unit test — logic is a thin query + timestamp, and no app in this repo has route-handler tests today.

- [ ] **Step 1: Write the route handler**

```typescript
// apps/stok/src/app/api/health/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const startedAt = Date.now()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const admin = createClient(supabaseUrl, serviceKey)

  let db: 'ok' | 'error' = 'ok'
  let lastActivity: string | null = null

  const { data, error } = await admin
    .from('ledger_stok')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    db = 'error'
  } else {
    lastActivity = data?.created_at ?? null
  }

  return NextResponse.json({
    status: 'ok',
    db,
    lastActivity,
    responseTimeMs: Date.now() - startedAt,
  })
}
```

- [ ] **Step 2: Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.example` if missing**

Check `apps/stok/.env.example` — if it has no `SUPABASE_SERVICE_ROLE_KEY` line, add it under a comment:
```
# Hanya untuk API Routes (bypass RLS). Jangan bocor ke client.
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```
Add the same real value to `apps/stok/.env.local` (not committed) so local `yarn dev` can exercise the route.

- [ ] **Step 3: Manual smoke test**

Run: `cd apps/stok && yarn dev` then `curl http://localhost:3001/api/health`
Expected: `{"status":"ok","db":"ok","lastActivity":"<ISO timestamp or null>","responseTimeMs":<number>}`

- [ ] **Step 4: Commit**

```bash
git add apps/stok/src/app/api/health/route.ts apps/stok/.env.example
git commit -m "feat(stok): add /api/health endpoint for system health monitoring"
```

---

## Task 3: Health endpoint — `apps/absensi`

**Files:**
- Create: `apps/absensi/src/app/api/health/route.ts`

- [ ] **Step 1: Write the route handler**

```typescript
// apps/absensi/src/app/api/health/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const startedAt = Date.now()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const admin = createClient(supabaseUrl, serviceKey)

  let db: 'ok' | 'error' = 'ok'
  let lastActivity: string | null = null

  const { data, error } = await admin
    .from('attendance')
    .select('ts_server')
    .order('ts_server', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    db = 'error'
  } else {
    lastActivity = data?.ts_server ?? null
  }

  return NextResponse.json({
    status: 'ok',
    db,
    lastActivity,
    responseTimeMs: Date.now() - startedAt,
  })
}
```

- [ ] **Step 2: Ensure `SUPABASE_SERVICE_ROLE_KEY` is in `apps/absensi/.env.example` and `.env.local`**

`apps/absensi/src/app/api/outlet-config/route.ts` already reads `process.env.SUPABASE_SERVICE_ROLE_KEY`, so it should already be set in `.env.local`. If `apps/absensi/.env.example` doesn't list it, add:
```
# Hanya untuk API Routes (bypass RLS). Jangan bocor ke client.
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

- [ ] **Step 3: Manual smoke test**

Run: `cd apps/absensi && yarn dev` then `curl http://localhost:3000/api/health`
Expected: `{"status":"ok","db":"ok","lastActivity":"<ISO timestamp or null>","responseTimeMs":<number>}`

- [ ] **Step 4: Commit**

```bash
git add apps/absensi/src/app/api/health/route.ts apps/absensi/.env.example
git commit -m "feat(absensi): add /api/health endpoint for system health monitoring"
```

---

## Task 4: Health endpoint — `apps/pos-kasir`

**Files:**
- Create: `apps/pos-kasir/app/api/health/route.ts`

Note: `pos-kasir` uses `app/` at the package root (no `src/`), unlike the other apps — confirmed by `apps/pos-kasir/app/page.tsx` and friends.

- [ ] **Step 1: Write the route handler**

```typescript
// apps/pos-kasir/app/api/health/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const startedAt = Date.now()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const admin = createClient(supabaseUrl, serviceKey)

  let db: 'ok' | 'error' = 'ok'
  let lastActivity: string | null = null

  const { data, error } = await admin
    .from('orders')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    db = 'error'
  } else {
    lastActivity = data?.created_at ?? null
  }

  return NextResponse.json({
    status: 'ok',
    db,
    lastActivity,
    responseTimeMs: Date.now() - startedAt,
  })
}
```

- [ ] **Step 2: Ensure `SUPABASE_SERVICE_ROLE_KEY` is set**

`apps/pos-kasir/.env.example` already lists `SUPABASE_SERVICE_ROLE_KEY` — confirm `apps/pos-kasir/.env.local` has a real value (it should, since other routes in this app already need it).

- [ ] **Step 3: Manual smoke test**

Run: `cd apps/pos-kasir && yarn dev` then `curl http://localhost:3004/api/health`
Expected: `{"status":"ok","db":"ok","lastActivity":"<ISO timestamp or null>","responseTimeMs":<number>}`

- [ ] **Step 4: Commit**

```bash
git add apps/pos-kasir/app/api/health/route.ts
git commit -m "feat(pos-kasir): add /api/health endpoint for system health monitoring"
```

---

## Task 5: Health endpoint — `apps/distribusi`

**Files:**
- Create: `apps/distribusi/src/app/api/health/route.ts`

- [ ] **Step 1: Write the route handler**

```typescript
// apps/distribusi/src/app/api/health/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const startedAt = Date.now()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const admin = createClient(supabaseUrl, serviceKey)

  let db: 'ok' | 'error' = 'ok'
  let lastActivity: string | null = null

  const { data, error } = await admin
    .from('surat_jalan')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    db = 'error'
  } else {
    lastActivity = data?.created_at ?? null
  }

  return NextResponse.json({
    status: 'ok',
    db,
    lastActivity,
    responseTimeMs: Date.now() - startedAt,
  })
}
```

- [ ] **Step 2: Add `SUPABASE_SERVICE_ROLE_KEY` to `apps/distribusi/.env.example` and `.env.local`**

`apps/distribusi/.env.example` currently has no service-role key (it only had `NEXT_PUBLIC_*` vars). Add:
```
# Hanya untuk API Routes (bypass RLS). Jangan bocor ke client.
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```
and put the real value in `apps/distribusi/.env.local`.

- [ ] **Step 3: Manual smoke test**

Run: `cd apps/distribusi && yarn dev` then `curl http://localhost:3002/api/health`
Expected: `{"status":"ok","db":"ok","lastActivity":"<ISO timestamp or null>","responseTimeMs":<number>}`

- [ ] **Step 4: Commit**

```bash
git add apps/distribusi/src/app/api/health/route.ts apps/distribusi/.env.example
git commit -m "feat(distribusi): add /api/health endpoint for system health monitoring"
```

---

## Task 6: Health endpoint — `apps/owner-dashboard`

**Files:**
- Create: `apps/owner-dashboard/src/app/api/health/route.ts`

Per spec §2.1, `owner-dashboard` is a read-only aggregator with no transactional table of its own — `lastActivity` is always `null` here. The db check still queries something cheap (`outlets`) to confirm connectivity.

- [ ] **Step 1: Write the route handler**

```typescript
// apps/owner-dashboard/src/app/api/health/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const startedAt = Date.now()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const admin = createClient(supabaseUrl, serviceKey)

  let db: 'ok' | 'error' = 'ok'

  const { error } = await admin.from('outlets').select('id').limit(1)
  if (error) {
    db = 'error'
  }

  return NextResponse.json({
    status: 'ok',
    db,
    lastActivity: null,
    responseTimeMs: Date.now() - startedAt,
  })
}
```

- [ ] **Step 2: Add `SUPABASE_SERVICE_ROLE_KEY` to `apps/owner-dashboard/.env.example` and `.env.local`**

Same as Task 5 — `apps/owner-dashboard/.env.example` currently has no service-role key. Add it and put the real value in `.env.local`.

- [ ] **Step 3: Manual smoke test**

Run: `cd apps/owner-dashboard && yarn dev` then `curl http://localhost:3003/api/health`
Expected: `{"status":"ok","db":"ok","lastActivity":null,"responseTimeMs":<number>}`

- [ ] **Step 4: Commit**

```bash
git add apps/owner-dashboard/src/app/api/health/route.ts apps/owner-dashboard/.env.example
git commit -m "feat(owner-dashboard): add /api/health endpoint for system health monitoring"
```

---

## Task 7: Collector — `deriveStatus` pure function (TDD via Deno test)

**Files:**
- Create: `supabase/functions/system-health-collector/deriveStatus.ts`
- Test: `supabase/functions/system-health-collector/deriveStatus.test.ts`

This is the one piece of collector logic worth unit-testing per spec §5 — it's a pure function with no network/DB dependency. The Edge Function runtime is Deno, so it's tested with Deno's built-in test runner (`deno test`), the same runtime the function actually executes in — there's no Vitest setup for `supabase/functions/` in this repo and none is needed for one pure function.

- [ ] **Step 1: Write the failing test**

```typescript
// supabase/functions/system-health-collector/deriveStatus.test.ts
import { assertEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { deriveStatus } from './deriveStatus.ts'

Deno.test('reachable, db ok, fast response -> up', () => {
  assertEquals(deriveStatus({ reachable: true, dbStatus: 'ok', responseTimeMs: 120 }), 'up')
})

Deno.test('reachable, db error -> degraded', () => {
  assertEquals(deriveStatus({ reachable: true, dbStatus: 'error', responseTimeMs: 120 }), 'degraded')
})

Deno.test('reachable, db ok, very slow response -> degraded', () => {
  assertEquals(deriveStatus({ reachable: true, dbStatus: 'ok', responseTimeMs: 3500 }), 'degraded')
})

Deno.test('not reachable -> down regardless of db/responseTime', () => {
  assertEquals(deriveStatus({ reachable: false, dbStatus: null, responseTimeMs: null }), 'down')
})

Deno.test('reachable, no db check applicable (owner-dashboard-like), fast -> up', () => {
  assertEquals(deriveStatus({ reachable: true, dbStatus: null, responseTimeMs: 80 }), 'up')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test supabase/functions/system-health-collector/deriveStatus.test.ts`
Expected: FAIL — `deriveStatus.ts` doesn't exist yet (module not found).

- [ ] **Step 3: Write the implementation**

```typescript
// supabase/functions/system-health-collector/deriveStatus.ts
export type HealthStatus = 'up' | 'degraded' | 'down' | 'unconfigured'

export interface DeriveStatusInput {
  reachable: boolean
  dbStatus: 'ok' | 'error' | null
  responseTimeMs: number | null
}

const SLOW_RESPONSE_THRESHOLD_MS = 3000

export function deriveStatus(input: DeriveStatusInput): HealthStatus {
  if (!input.reachable) return 'down'
  if (input.dbStatus === 'error') return 'degraded'
  if (input.responseTimeMs !== null && input.responseTimeMs > SLOW_RESPONSE_THRESHOLD_MS) return 'degraded'
  return 'up'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test supabase/functions/system-health-collector/deriveStatus.test.ts`
Expected: PASS, 5 tests passed.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/system-health-collector/deriveStatus.ts supabase/functions/system-health-collector/deriveStatus.test.ts
git commit -m "feat(collector): add deriveStatus pure function with Deno tests"
```

---

## Task 8: Collector — Edge Function `index.ts`

**Files:**
- Create: `supabase/functions/system-health-collector/index.ts`
- Create: `supabase/functions/system-health-collector/deno.json`

This orchestrates the actual network calls (apps, Supabase, cPanel) and writes to `system_health_log`. It is not unit-tested (per spec §5: "tidak ada CI test untuk Edge Function di fase ini") — verification is a manual invoke in Step 4.

- [ ] **Step 1: Write `deno.json`**

```json
{
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2.39.3"
  }
}
```

- [ ] **Step 2: Write `index.ts`**

```typescript
// supabase/functions/system-health-collector/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { deriveStatus } from './deriveStatus.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(supabaseUrl, serviceKey)

const FETCH_TIMEOUT_MS = 8000

interface AppTarget {
  name: 'stok' | 'absensi' | 'pos-kasir' | 'distribusi' | 'owner-dashboard'
  urlEnv: string
}

const APP_TARGETS: AppTarget[] = [
  { name: 'stok', urlEnv: 'STOK_HEALTH_URL' },
  { name: 'absensi', urlEnv: 'ABSENSI_HEALTH_URL' },
  { name: 'pos-kasir', urlEnv: 'POS_KASIR_HEALTH_URL' },
  { name: 'distribusi', urlEnv: 'DISTRIBUSI_HEALTH_URL' },
  { name: 'owner-dashboard', urlEnv: 'OWNER_DASHBOARD_HEALTH_URL' },
]

interface HealthLogRow {
  target_type: 'app' | 'supabase' | 'cpanel'
  target_name: string
  status: 'up' | 'degraded' | 'down' | 'unconfigured'
  db_status: 'ok' | 'error' | null
  last_activity_at: string | null
  response_time_ms: number | null
  detail: Record<string, unknown> | null
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function checkApp(target: AppTarget): Promise<HealthLogRow> {
  const url = Deno.env.get(target.urlEnv)
  if (!url) {
    return {
      target_type: 'app',
      target_name: target.name,
      status: 'unconfigured',
      db_status: null,
      last_activity_at: null,
      response_time_ms: null,
      detail: { reason: `${target.urlEnv} not set` },
    }
  }

  const startedAt = Date.now()
  try {
    const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS)
    const responseTimeMs = Date.now() - startedAt
    if (!res.ok) {
      return {
        target_type: 'app',
        target_name: target.name,
        status: 'down',
        db_status: null,
        last_activity_at: null,
        response_time_ms: responseTimeMs,
        detail: { httpStatus: res.status },
      }
    }
    const body = await res.json() as { db: 'ok' | 'error'; lastActivity: string | null }
    const status = deriveStatus({ reachable: true, dbStatus: body.db, responseTimeMs })
    return {
      target_type: 'app',
      target_name: target.name,
      status,
      db_status: body.db,
      last_activity_at: body.lastActivity,
      response_time_ms: responseTimeMs,
      detail: null,
    }
  } catch (err) {
    return {
      target_type: 'app',
      target_name: target.name,
      status: 'down',
      db_status: null,
      last_activity_at: null,
      response_time_ms: Date.now() - startedAt,
      detail: { error: err instanceof Error ? err.message : String(err) },
    }
  }
}

async function checkSupabase(): Promise<HealthLogRow> {
  const startedAt = Date.now()
  try {
    const res = await fetchWithTimeout(`${supabaseUrl}/rest/v1/`, FETCH_TIMEOUT_MS)
    const responseTimeMs = Date.now() - startedAt
    const status = deriveStatus({ reachable: res.ok, dbStatus: 'ok', responseTimeMs })
    return {
      target_type: 'supabase',
      target_name: 'supabase-db',
      status,
      db_status: null,
      last_activity_at: null,
      response_time_ms: responseTimeMs,
      detail: res.ok ? null : { httpStatus: res.status },
    }
  } catch (err) {
    return {
      target_type: 'supabase',
      target_name: 'supabase-db',
      status: 'down',
      db_status: null,
      last_activity_at: null,
      response_time_ms: Date.now() - startedAt,
      detail: { error: err instanceof Error ? err.message : String(err) },
    }
  }
}

async function checkCpanel(): Promise<HealthLogRow> {
  const token = Deno.env.get('CPANEL_UAPI_TOKEN')
  const host = Deno.env.get('CPANEL_HOST')
  const user = Deno.env.get('CPANEL_USER')
  if (!token || !host || !user) {
    return {
      target_type: 'cpanel',
      target_name: 'cpanel-server',
      status: 'unconfigured',
      db_status: null,
      last_activity_at: null,
      response_time_ms: null,
      detail: { reason: 'CPANEL_UAPI_TOKEN / CPANEL_HOST / CPANEL_USER not all set' },
    }
  }

  const startedAt = Date.now()
  try {
    const res = await fetchWithTimeout(
      `https://${host}:2083/execute/Quota/get_quota_info`,
      FETCH_TIMEOUT_MS,
    )
    const responseTimeMs = Date.now() - startedAt
    if (!res.ok) {
      return {
        target_type: 'cpanel',
        target_name: 'cpanel-server',
        status: 'down',
        db_status: null,
        last_activity_at: null,
        response_time_ms: responseTimeMs,
        detail: { httpStatus: res.status },
      }
    }
    const body = await res.json()
    return {
      target_type: 'cpanel',
      target_name: 'cpanel-server',
      status: 'up',
      db_status: null,
      last_activity_at: null,
      response_time_ms: responseTimeMs,
      detail: body,
    }
  } catch (err) {
    return {
      target_type: 'cpanel',
      target_name: 'cpanel-server',
      status: 'down',
      db_status: null,
      last_activity_at: null,
      response_time_ms: Date.now() - startedAt,
      detail: { error: err instanceof Error ? err.message : String(err) },
    }
  }
}

serve(async (_req) => {
  const results = await Promise.allSettled([
    ...APP_TARGETS.map(checkApp),
    checkSupabase(),
    checkCpanel(),
  ])

  const rows: HealthLogRow[] = results
    .filter((r): r is PromiseFulfilledResult<HealthLogRow> => r.status === 'fulfilled')
    .map((r) => r.value)

  const { error } = await admin.from('system_health_log').insert(rows)

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, inserted: rows.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
```

Note: `checkCpanel` calls cPanel's account-level UAPI (`Quota::get_quota_info` for disk usage). A shared-hosting cPanel account has no WHM/root access, so server-wide "uptime" (as originally scoped in the design's mockup) isn't obtainable this way — only disk quota is. This is the honest, working scope; if server-wide uptime is needed later, it requires a different access tier and is out of scope here.

- [ ] **Step 3: Deploy the function**

Run: `supabase functions deploy system-health-collector`
Expected: deploy succeeds.

- [ ] **Step 4: Set secrets and manually invoke to verify**

Run (replace with real production URLs once each app is deployed — per `CLAUDE.md` only `stok` and `distribusi` are confirmed LIVE today; set the others once their subdomains exist):
```bash
supabase secrets set STOK_HEALTH_URL=https://stok.sukashawarma.com/api/health
supabase secrets set DISTRIBUSI_HEALTH_URL=https://distribusi.sukashawarma.com/api/health
```
Then invoke manually:
```bash
curl -X POST https://<project-ref>.functions.supabase.co/system-health-collector \
  -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>"
```
Expected: `{"ok":true,"inserted":7}`. Verify in Supabase SQL editor: `select * from system_health_log order by checked_at desc limit 10;` — should show 7 fresh rows, with `stok`/`distribusi` as `up` (or `down` if their `/api/health` isn't deployed yet) and the unconfigured app targets/`cpanel-server` as `unconfigured`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/system-health-collector/index.ts supabase/functions/system-health-collector/deno.json
git commit -m "feat(collector): add system-health-collector Edge Function"
```

---

## Task 9: pg_cron schedule (manual Vault setup + migration)

**Files:**
- Create: `supabase/migrations/20260620121000_schedule_system_health_collector.sql`

Invoking an Edge Function from `pg_cron` requires `pg_net` plus the project URL and service-role key available to the cron job. Per Supabase's documented pattern, those secrets go into **Supabase Vault** (`vault.create_secret`), never into a migration file — a migration is committed to git and would leak the key. The `vault.create_secret` calls below are a **one-time manual step in the Supabase SQL editor**, not part of the migration.

- [ ] **Step 1: Manually store secrets in Vault (Supabase SQL editor, NOT committed to git)**

```sql
select vault.create_secret('https://khpkoreaaucvyqfhynfq.supabase.co', 'project_url');
select vault.create_secret('<paste real SUPABASE_SERVICE_ROLE_KEY here>', 'service_role_key');
```
Run this once directly in the Supabase Dashboard SQL editor against the production project. Do not put the real key in any file that gets committed.

- [ ] **Step 2: Write the migration (references Vault by name, no secret in the file)**

```sql
-- supabase/migrations/20260620121000_schedule_system_health_collector.sql

CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'system-health-collector',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
             || '/functions/v1/system-health-collector',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
-- DOWN: SELECT cron.unschedule('system-health-collector');
```

- [ ] **Step 3: Push and verify**

Run: `supabase db push`
Expected: applies cleanly (assumes Step 1 was already run against the same project, otherwise the cron job will run but get NULL secrets and fail silently — check with Step 4 below).

Wait 5+ minutes, then in SQL editor:
```sql
select * from system_health_log order by checked_at desc limit 10;
```
Expected: fresh rows appear roughly every 5 minutes without manual invocation.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260620121000_schedule_system_health_collector.sql
git commit -m "feat(db): schedule system-health-collector via pg_cron + pg_net"
```

---

## Task 10: Admin-dashboard — types + `useSystemHealth` hook

**Files:**
- Modify: `apps/admin-dashboard/src/lib/types.ts`
- Create: `apps/admin-dashboard/src/hooks/useSystemHealth.ts`
- Test: `apps/admin-dashboard/src/hooks/useSystemHealth.test.tsx`

- [ ] **Step 1: Add types**

Append to `apps/admin-dashboard/src/lib/types.ts`:

```typescript
export type HealthTargetType = 'app' | 'supabase' | 'cpanel'
export type HealthStatus = 'up' | 'degraded' | 'down' | 'unconfigured'

export interface SystemHealthLogRow {
  id: number
  target_type: HealthTargetType
  target_name: string
  status: HealthStatus
  db_status: 'ok' | 'error' | null
  last_activity_at: string | null
  response_time_ms: number | null
  detail: Record<string, unknown> | null
  checked_at: string
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// apps/admin-dashboard/src/hooks/useSystemHealth.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type { SystemHealthLogRow } from '@/lib/types'

const rows: SystemHealthLogRow[] = [
  { id: 1, target_type: 'app', target_name: 'stok', status: 'up', db_status: 'ok', last_activity_at: null, response_time_ms: 50, detail: null, checked_at: '2026-06-20T10:00:00Z' },
]

const order = vi.fn().mockResolvedValue({ data: rows, error: null })
const gte = vi.fn().mockReturnValue({ order })
const select = vi.fn().mockReturnValue({ gte })

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({ select }),
  }),
}))

import { useSystemHealth } from './useSystemHealth'

function wrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('useSystemHealth', () => {
  it('fetches rows from system_health_log ordered by checked_at desc', async () => {
    const client = new QueryClient()
    const { result } = renderHook(() => useSystemHealth(), { wrapper: wrapper(client) })
    await waitFor(() => expect(result.current.data).toEqual(rows))
    expect(select).toHaveBeenCalledWith('*')
    expect(order).toHaveBeenCalledWith('checked_at', { ascending: false })
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/admin-dashboard && yarn vitest run src/hooks/useSystemHealth.test.tsx`
Expected: FAIL — `./useSystemHealth` module not found.

- [ ] **Step 4: Write the implementation**

```typescript
// apps/admin-dashboard/src/hooks/useSystemHealth.ts
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { SystemHealthLogRow } from '@/lib/types'

export function useSystemHealth() {
  const supabase = createClient()
  return useQuery<SystemHealthLogRow[]>({
    queryKey: ['system-health'],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('system_health_log')
        .select('*')
        .gte('checked_at', since)
        .order('checked_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    refetchInterval: 30_000,
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/admin-dashboard && yarn vitest run src/hooks/useSystemHealth.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-dashboard/src/lib/types.ts apps/admin-dashboard/src/hooks/useSystemHealth.ts apps/admin-dashboard/src/hooks/useSystemHealth.test.tsx
git commit -m "feat(admin-dashboard): add useSystemHealth hook"
```

---

## Task 11: Admin-dashboard — `healthStatus.ts` (latest-per-target + incident transitions)

**Files:**
- Create: `apps/admin-dashboard/src/lib/healthStatus.ts`
- Test: `apps/admin-dashboard/src/lib/healthStatus.test.ts`

Two pure functions derived from the raw 24h row list: `latestPerTarget` (one row per `target_name` for the status cards) and `detectTransitions` (incident timeline — only entries where status changed from the previous check for that target).

- [ ] **Step 1: Write the failing test**

```typescript
// apps/admin-dashboard/src/lib/healthStatus.test.ts
import { describe, it, expect } from 'vitest'
import { latestPerTarget, detectTransitions } from './healthStatus'
import type { SystemHealthLogRow } from './types'

const make = (p: Partial<SystemHealthLogRow>): SystemHealthLogRow => ({
  id: 1, target_type: 'app', target_name: 'stok', status: 'up', db_status: 'ok',
  last_activity_at: null, response_time_ms: 50, detail: null, checked_at: '2026-06-20T10:00:00Z',
  ...p,
})

describe('latestPerTarget', () => {
  it('keeps only the newest row per target_name (rows are checked_at desc)', () => {
    const rows = [
      make({ id: 3, target_name: 'stok', checked_at: '2026-06-20T10:10:00Z', status: 'down' }),
      make({ id: 2, target_name: 'stok', checked_at: '2026-06-20T10:05:00Z', status: 'up' }),
      make({ id: 1, target_name: 'absensi', checked_at: '2026-06-20T10:05:00Z', status: 'up' }),
    ]
    const result = latestPerTarget(rows)
    expect(result).toHaveLength(2)
    expect(result.find(r => r.target_name === 'stok')?.id).toBe(3)
  })
})

describe('detectTransitions', () => {
  it('returns an event only when status changes between consecutive checks for the same target', () => {
    const rows = [
      make({ id: 3, target_name: 'stok', checked_at: '2026-06-20T10:10:00Z', status: 'down' }),
      make({ id: 2, target_name: 'stok', checked_at: '2026-06-20T10:05:00Z', status: 'up' }),
      make({ id: 1, target_name: 'stok', checked_at: '2026-06-20T10:00:00Z', status: 'up' }),
    ]
    const events = detectTransitions(rows)
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({
      target_name: 'stok',
      from: 'up',
      to: 'down',
      checked_at: '2026-06-20T10:10:00Z',
    })
  })

  it('returns no events when a target never changes status', () => {
    const rows = [
      make({ id: 2, target_name: 'absensi', checked_at: '2026-06-20T10:05:00Z', status: 'up' }),
      make({ id: 1, target_name: 'absensi', checked_at: '2026-06-20T10:00:00Z', status: 'up' }),
    ]
    expect(detectTransitions(rows)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/admin-dashboard && yarn vitest run src/lib/healthStatus.test.ts`
Expected: FAIL — `./healthStatus` module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/admin-dashboard/src/lib/healthStatus.ts
import type { HealthStatus, SystemHealthLogRow } from './types'

export function latestPerTarget(rows: SystemHealthLogRow[]): SystemHealthLogRow[] {
  const seen = new Map<string, SystemHealthLogRow>()
  for (const row of rows) {
    const existing = seen.get(row.target_name)
    if (!existing || new Date(row.checked_at) > new Date(existing.checked_at)) {
      seen.set(row.target_name, row)
    }
  }
  return Array.from(seen.values())
}

export interface HealthTransition {
  target_name: string
  from: HealthStatus
  to: HealthStatus
  checked_at: string
}

export function detectTransitions(rows: SystemHealthLogRow[]): HealthTransition[] {
  const byTarget = new Map<string, SystemHealthLogRow[]>()
  for (const row of rows) {
    const list = byTarget.get(row.target_name) ?? []
    list.push(row)
    byTarget.set(row.target_name, list)
  }

  const events: HealthTransition[] = []
  for (const list of byTarget.values()) {
    const sorted = [...list].sort((a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime())
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const curr = sorted[i]
      if (prev.status !== curr.status) {
        events.push({
          target_name: curr.target_name,
          from: prev.status,
          to: curr.status,
          checked_at: curr.checked_at,
        })
      }
    }
  }
  return events.sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime())
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/admin-dashboard && yarn vitest run src/lib/healthStatus.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/healthStatus.ts apps/admin-dashboard/src/lib/healthStatus.test.ts
git commit -m "feat(admin-dashboard): add latestPerTarget and detectTransitions helpers"
```

---

## Task 12: Admin-dashboard — `AppHealthCard` and `InfraHealthCard` components

**Files:**
- Create: `apps/admin-dashboard/src/components/AppHealthCard.tsx`
- Create: `apps/admin-dashboard/src/components/InfraHealthCard.tsx`
- Test: `apps/admin-dashboard/src/components/AppHealthCard.test.tsx`

Both cards render the same status badge, so the badge styling lives in one shared `STATUS_STYLES` map inside `AppHealthCard.tsx` and is re-exported for `InfraHealthCard.tsx` — two components, one source of truth for color mapping (DRY, no shared design-system change needed since `StatusPill`'s `kind` union doesn't include `up`/`degraded`/`down`/`unconfigured`).

- [ ] **Step 1: Write the failing test**

```typescript
// apps/admin-dashboard/src/components/AppHealthCard.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppHealthCard } from './AppHealthCard'
import type { SystemHealthLogRow } from '@/lib/types'

const make = (p: Partial<SystemHealthLogRow>): SystemHealthLogRow => ({
  id: 1, target_type: 'app', target_name: 'stok', status: 'up', db_status: 'ok',
  last_activity_at: null, response_time_ms: 50, detail: null, checked_at: '2026-06-20T10:00:00Z',
  ...p,
})

describe('AppHealthCard', () => {
  it('shows up status with db ok', () => {
    render(<AppHealthCard row={make({ target_name: 'stok', status: 'up', db_status: 'ok' })} />)
    expect(screen.getByText('stok')).toBeInTheDocument()
    expect(screen.getByText(/up/i)).toBeInTheDocument()
    expect(screen.getByText(/db: ok/i)).toBeInTheDocument()
  })

  it('shows degraded status with db error', () => {
    render(<AppHealthCard row={make({ target_name: 'pos-kasir', status: 'degraded', db_status: 'error' })} />)
    expect(screen.getByText(/degraded/i)).toBeInTheDocument()
    expect(screen.getByText(/db: error/i)).toBeInTheDocument()
  })

  it('shows "n/a" for last activity when null', () => {
    render(<AppHealthCard row={make({ last_activity_at: null })} />)
    expect(screen.getByText(/n\/a/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/admin-dashboard && yarn vitest run src/components/AppHealthCard.test.tsx`
Expected: FAIL — `./AppHealthCard` module not found.

- [ ] **Step 3: Write `AppHealthCard.tsx`**

```typescript
// apps/admin-dashboard/src/components/AppHealthCard.tsx
import { Card } from '@suka/design-system'
import type { HealthStatus, SystemHealthLogRow } from '@/lib/types'

export const STATUS_STYLES: Record<HealthStatus, string> = {
  up: 'bg-[#e1f5ee] text-[#085041]',
  degraded: 'bg-[#faeeda] text-[#854f0b]',
  down: 'bg-[#fcebeb] text-[#a32d2d]',
  unconfigured: 'bg-[#f1efe8] text-[#5f5e5a]',
}

export const STATUS_LABELS: Record<HealthStatus, string> = {
  up: 'up',
  degraded: 'degraded',
  down: 'down',
  unconfigured: 'belum dikonfigurasi',
}

function formatLastActivity(iso: string | null): string {
  if (!iso) return 'n/a'
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'baru saja'
  if (diffMin < 60) return `${diffMin}m lalu`
  const diffHour = Math.floor(diffMin / 60)
  return `${diffHour}h lalu`
}

export function AppHealthCard({ row }: { row: SystemHealthLogRow }) {
  return (
    <Card className="space-y-2">
      <div className="font-semibold text-suka-ink">{row.target_name}</div>
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[row.status]}`}>
        {STATUS_LABELS[row.status]}
      </span>
      <div className="text-sm text-gray-500">db: {row.db_status ?? '-'}</div>
      <div className="text-sm text-gray-500">last: {formatLastActivity(row.last_activity_at)}</div>
      {row.response_time_ms !== null && (
        <div className="text-xs text-gray-400">{row.response_time_ms}ms</div>
      )}
    </Card>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/admin-dashboard && yarn vitest run src/components/AppHealthCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write `InfraHealthCard.tsx` (no separate test — same rendering rules as `AppHealthCard`, just without `db_status`/`last_activity_at` rows)**

```typescript
// apps/admin-dashboard/src/components/InfraHealthCard.tsx
import { Card } from '@suka/design-system'
import { STATUS_STYLES, STATUS_LABELS } from './AppHealthCard'
import type { SystemHealthLogRow } from '@/lib/types'

export function InfraHealthCard({ row }: { row: SystemHealthLogRow }) {
  return (
    <Card className="space-y-2">
      <div className="font-semibold text-suka-ink">
        {row.target_name === 'supabase-db' ? 'Supabase' : 'cPanel Server'}
      </div>
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[row.status]}`}>
        {STATUS_LABELS[row.status]}
      </span>
      {row.response_time_ms !== null && (
        <div className="text-xs text-gray-400">{row.response_time_ms}ms</div>
      )}
    </Card>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/admin-dashboard/src/components/AppHealthCard.tsx apps/admin-dashboard/src/components/AppHealthCard.test.tsx apps/admin-dashboard/src/components/InfraHealthCard.tsx
git commit -m "feat(admin-dashboard): add AppHealthCard and InfraHealthCard components"
```

---

## Task 13: Admin-dashboard — `IncidentTimeline` component

**Files:**
- Create: `apps/admin-dashboard/src/components/IncidentTimeline.tsx`
- Test: `apps/admin-dashboard/src/components/IncidentTimeline.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/admin-dashboard/src/components/IncidentTimeline.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IncidentTimeline } from './IncidentTimeline'
import { EmptyState } from '@suka/design-system'
import type { HealthTransition } from '@/lib/healthStatus'

describe('IncidentTimeline', () => {
  it('renders one row per transition with target, from->to, and time', () => {
    const events: HealthTransition[] = [
      { target_name: 'pos-kasir', from: 'up', to: 'degraded', checked_at: '2026-06-20T14:32:00Z' },
    ]
    render(<IncidentTimeline events={events} />)
    expect(screen.getByText(/pos-kasir/)).toBeInTheDocument()
    expect(screen.getByText(/up/)).toBeInTheDocument()
    expect(screen.getByText(/degraded/)).toBeInTheDocument()
  })

  it('shows empty state when there are no transitions', () => {
    render(<IncidentTimeline events={[]} />)
    expect(screen.getByText(/tidak ada insiden/i)).toBeInTheDocument()
  })
})
```

`EmptyState` is imported in the test only to confirm it's the right component name to assert against indirectly via its rendered title text — the assertion itself just checks the rendered text, so no separate mock is needed.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/admin-dashboard && yarn vitest run src/components/IncidentTimeline.test.tsx`
Expected: FAIL — `./IncidentTimeline` module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/admin-dashboard/src/components/IncidentTimeline.tsx
import { EmptyState } from '@suka/design-system'
import type { HealthTransition } from '@/lib/healthStatus'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

export function IncidentTimeline({ events }: { events: HealthTransition[] }) {
  if (events.length === 0) {
    return <EmptyState title="Tidak ada insiden dalam 24 jam terakhir" />
  }

  return (
    <ul className="divide-y divide-suka-gray-200">
      {events.map((e, i) => (
        <li key={`${e.target_name}-${e.checked_at}-${i}`} className="flex items-center gap-3 py-2 text-sm">
          <span className="font-mono text-gray-400">{formatTime(e.checked_at)}</span>
          <span className="font-medium text-suka-ink">{e.target_name}</span>
          <span className="text-gray-500">{e.from} &rarr; {e.to}</span>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/admin-dashboard && yarn vitest run src/components/IncidentTimeline.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/components/IncidentTimeline.tsx apps/admin-dashboard/src/components/IncidentTimeline.test.tsx
git commit -m "feat(admin-dashboard): add IncidentTimeline component"
```

---

## Task 14: Admin-dashboard — `/dashboard/system-health` page + sidebar nav

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/system-health/page.tsx`
- Modify: `apps/admin-dashboard/src/components/layout/Sidebar.tsx`

This page composes Tasks 10-13. It's a thin composition layer (data fetching + grouping + rendering already-tested pieces), consistent with how `apps/admin-dashboard/src/app/dashboard/outlets/page.tsx` composes its own hooks/components without its own dedicated test file.

- [ ] **Step 1: Write the page**

```typescript
// apps/admin-dashboard/src/app/dashboard/system-health/page.tsx
'use client'
import { Spinner, EmptyState } from '@suka/design-system'
import { useSystemHealth } from '@/hooks/useSystemHealth'
import { latestPerTarget, detectTransitions } from '@/lib/healthStatus'
import { AppHealthCard } from '@/components/AppHealthCard'
import { InfraHealthCard } from '@/components/InfraHealthCard'
import { IncidentTimeline } from '@/components/IncidentTimeline'

export const dynamic = 'force-dynamic'

const APP_ORDER = ['stok', 'absensi', 'pos-kasir', 'distribusi', 'owner-dashboard']
const INFRA_ORDER = ['supabase-db', 'cpanel-server']

export default function SystemHealthPage() {
  const { data: rows = [], isLoading } = useSystemHealth()

  if (isLoading) return <Spinner />
  if (rows.length === 0) {
    return <EmptyState title="Belum ada data health check" description="Collector belum pernah berjalan." />
  }

  const latest = latestPerTarget(rows)
  const apps = APP_ORDER.map((name) => latest.find((r) => r.target_name === name)).filter((r) => r !== undefined)
  const infra = INFRA_ORDER.map((name) => latest.find((r) => r.target_name === name)).filter((r) => r !== undefined)
  const transitions = detectTransitions(rows)

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-suka-ink">System Health</h2>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-500">Apps</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {apps.map((row) => <AppHealthCard key={row.target_name} row={row} />)}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-500">Infrastructure</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {infra.map((row) => <InfraHealthCard key={row.target_name} row={row} />)}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-500">Riwayat Insiden (24 jam terakhir)</h3>
        <IncidentTimeline events={transitions} />
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Add sidebar nav item**

In `apps/admin-dashboard/src/components/layout/Sidebar.tsx`, change:

```typescript
import { LayoutDashboard, Users, Store } from 'lucide-react'

const NAV = [
  { href: '/dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { href: '/dashboard/outlets', label: 'Outlet', icon: Store },
  { href: '/dashboard/staff', label: 'Staff', icon: Users },
]
```

to:

```typescript
import { LayoutDashboard, Users, Store, Activity } from 'lucide-react'

const NAV = [
  { href: '/dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { href: '/dashboard/outlets', label: 'Outlet', icon: Store },
  { href: '/dashboard/staff', label: 'Staff', icon: Users },
  { href: '/dashboard/system-health', label: 'System Health', icon: Activity },
]
```

- [ ] **Step 3: Manual smoke test in dev**

Run: `cd apps/admin-dashboard && yarn dev`, log in as an `admin` user, navigate to `/dashboard/system-health`.
Expected: sidebar shows "System Health" link; page shows either the empty state (if Task 1/8/9 haven't run against this Supabase project yet) or app/infra cards + incident list.

- [ ] **Step 4: Run full admin-dashboard test suite**

Run: `cd apps/admin-dashboard && yarn vitest run`
Expected: all tests pass, including the new ones from Tasks 10-13.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/system-health/page.tsx apps/admin-dashboard/src/components/layout/Sidebar.tsx
git commit -m "feat(admin-dashboard): add /dashboard/system-health page and sidebar nav"
```

---

## Task 15: Type-check and build verification

**Files:** none (verification only)

- [ ] **Step 1: Type-check the whole monorepo**

Run: `yarn type-check`
Expected: 0 errors. If `apps/distribusi` or `apps/owner-dashboard` complain about a missing `SUPABASE_SERVICE_ROLE_KEY` type/env reference, that's expected until `.env.local` is filled in per Tasks 5/6 — type-check itself doesn't read `.env.local` values, so this should not surface as a type error.

- [ ] **Step 2: Build admin-dashboard**

Run: `cd apps/admin-dashboard && yarn build`
Expected: build succeeds.

- [ ] **Step 3: Build each app with a new health route**

Run for each of `stok`, `absensi`, `pos-kasir`, `distribusi`, `owner-dashboard`: `cd apps/<app> && yarn build`
Expected: build succeeds for all five.

No commit for this task — it's a verification gate before moving to deployment.

---

## Post-implementation: manual deployment checklist (not code)

These cannot be scripted as plan steps because they depend on infrastructure access this plan can't verify on its own (per spec §6):

1. Confirm `pg_cron` extension is enabled on this Supabase project's tier (Database → Extensions in the dashboard). If unavailable, Task 9's migration will fail to apply — the collector (Task 8) still works via manual/external invocation in the meantime.
2. Confirm whether a cPanel UAPI token can be issued for the connectindo hosting account (cPanel → Manage API Tokens). If not available, leave `CPANEL_UAPI_TOKEN`/`CPANEL_HOST`/`CPANEL_USER` unset — Task 8's `checkCpanel` already degrades gracefully to `'unconfigured'`.
3. Once `absensi`, `pos-kasir`, and `owner-dashboard` get real subdomains (per `CLAUDE.md`, only `stok` and `distribusi` are LIVE today), set their `*_HEALTH_URL` secrets on the collector (Task 8, Step 4) — until then those targets will show `'unconfigured'` or `'down'`, which is accurate, not a bug.
