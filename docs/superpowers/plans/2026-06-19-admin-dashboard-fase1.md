# Admin Dashboard — Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/admin-dashboard` (admin-only) with cross-outlet Staff Management — create/edit/reset-password/suspend/delete staff of any role across all 19 outlets, including `kepala_outlet` multi-outlet assignment.

**Architecture:** New Next.js app (Node server, subdomain `admin.sukashawarma.com`) mirroring `apps/owner-dashboard` scaffold. Privileged actions go through 4 new admin-only Supabase Edge Functions (service-role, caller validated `role='admin'`). Read path uses browser client gated by a new `is_admin()` RLS policy. Existing `create-staff`/`delete-staff` (SPV/outlet-scoped) are NOT modified.

**Tech Stack:** Next.js 16 (app router), React 19, TypeScript, TailwindCSS v4, React Query (TanStack), Supabase (Postgres + Edge Functions/Deno), vitest + testing-library, deno test.

**Spec:** `docs/superpowers/specs/2026-06-19-admin-dashboard-fase1-design.md`

---

## File Structure

**New app — `apps/admin-dashboard/`:**
- `package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `vitest.config.ts`, `next-env.d.ts` — scaffold (copy owner-dashboard)
- `src/middleware.ts` — `enforceAppAccess(req, 'admin-dashboard', { rootRewritePath: '/dashboard' })`
- `src/app/layout.tsx`, `src/app/Providers.tsx`, `src/app/globals.css`, `src/app/page.tsx` — shell
- `src/app/dashboard/layout.tsx`, `src/app/dashboard/page.tsx` — dashboard shell + summary
- `src/app/dashboard/staff/page.tsx` — Staff Management page (assembles components)
- `src/components/layout/Sidebar.tsx`, `Header.tsx` — admin nav
- `src/components/StaffTable.tsx`, `StaffFilters.tsx`, `StaffForm.tsx`, `OutletMultiSelect.tsx`, `ResetPasswordDialog.tsx`, `StatusToggle.tsx`
- `src/hooks/useOutlets.ts`, `useStaff.ts`, `useStaffMutations.ts`
- `src/lib/supabase.ts`, `src/lib/adminApi.ts`, `src/lib/types.ts`, `src/lib/email-generator.ts`
- `src/test/setup.ts`

**Modified — `packages/auth/`:**
- `src/types.ts` — add `'admin-dashboard'` to `AppName`
- `src/access.ts` — add `'admin-dashboard'` to `admin` row of `ROLE_APP_ACCESS`
- `src/access.test.ts` — update admin count assertion + add admin-dashboard test

**Modified — `apps/portal/`:**
- `src/app/launcher/page.tsx` — add `admin-dashboard` to `APP_URL` + `APP_META`

**New — Supabase:**
- `supabase/migrations/<ts>_admin_read_all_staff.sql` — `is_admin()` + RLS policy
- `supabase/functions/_shared/admin-guard.ts` + `admin-guard.test.ts` — pure guard/validation helpers (deno test)
- `supabase/functions/admin-create-staff/index.ts`
- `supabase/functions/admin-update-staff/index.ts`
- `supabase/functions/admin-reset-password/index.ts`
- `supabase/functions/admin-set-status/index.ts`

---

## Task 1: Register `admin-dashboard` app in `packages/auth`

**Files:**
- Modify: `packages/auth/src/types.ts`
- Modify: `packages/auth/src/access.ts:5`
- Test: `packages/auth/src/access.test.ts`

- [ ] **Step 1: Update the failing test**

In `packages/auth/src/access.test.ts`, change the admin assertion and add a new one. Replace:

```typescript
  it('admin semua 5 app', () => {
    expect(ROLE_APP_ACCESS.admin.length).toBe(5)
  })
```

with:

```typescript
  it('admin semua 6 app termasuk admin-dashboard', () => {
    expect(ROLE_APP_ACCESS.admin.length).toBe(6)
    expect(ROLE_APP_ACCESS.admin).toContain('admin-dashboard')
  })

  it('hanya admin yang punya admin-dashboard', () => {
    const roles = ['owner', 'spv', 'kepala_outlet', 'kasir', 'crew', 'kiosk'] as const
    for (const r of roles) {
      expect(ROLE_APP_ACCESS[r]).not.toContain('admin-dashboard')
    }
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/auth && yarn vitest run src/access.test.ts`
Expected: FAIL — admin length is 5 (not 6) and `'admin-dashboard'` not present.

- [ ] **Step 3: Add `'admin-dashboard'` to the `AppName` type**

In `packages/auth/src/types.ts`, update the `AppName` union:

```typescript
export type AppName =
  | 'pos-kasir'
  | 'absensi'
  | 'stok'
  | 'distribusi'
  | 'owner-dashboard'
  | 'admin-dashboard'
```

- [ ] **Step 4: Add `admin-dashboard` to the admin access row**

In `packages/auth/src/access.ts`, update the `admin` row only:

```typescript
  admin: ['pos-kasir', 'absensi', 'stok', 'distribusi', 'owner-dashboard', 'admin-dashboard'],
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/auth && yarn vitest run src/access.test.ts`
Expected: PASS (the two new tests; pre-existing tests unchanged).

- [ ] **Step 6: Rebuild the auth package (consumers import `dist/`)**

Run: `cd packages/auth && yarn build`
Expected: build succeeds, `dist/` updated. (See suka-auth-dist-gotcha — edits to src don't reach apps until built.)

- [ ] **Step 7: Commit**

```bash
git add packages/auth/src/types.ts packages/auth/src/access.ts packages/auth/src/access.test.ts packages/auth/dist
git commit -m "feat(auth): register admin-dashboard app in access matrix"
```

---

## Task 2: Scaffold `apps/admin-dashboard` (config + shell)

**Files:**
- Create: `apps/admin-dashboard/package.json`
- Create: `apps/admin-dashboard/next.config.ts`
- Create: `apps/admin-dashboard/tsconfig.json`
- Create: `apps/admin-dashboard/postcss.config.mjs`
- Create: `apps/admin-dashboard/vitest.config.ts`
- Create: `apps/admin-dashboard/next-env.d.ts`
- Create: `apps/admin-dashboard/src/test/setup.ts`
- Create: `apps/admin-dashboard/src/middleware.ts`
- Create: `apps/admin-dashboard/src/app/globals.css`
- Create: `apps/admin-dashboard/src/app/Providers.tsx`
- Create: `apps/admin-dashboard/src/app/layout.tsx`
- Create: `apps/admin-dashboard/src/app/page.tsx`
- Create: `apps/admin-dashboard/src/lib/supabase.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@suka/admin-dashboard",
  "version": "0.0.1",
  "description": "Admin dashboard — administrasi staff, akun & sistem",
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3004",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^19.0.0-rc.0",
    "react-dom": "^19.0.0-rc.0",
    "next": "^16.1.6",
    "@supabase/supabase-js": "^2.38.0",
    "@supabase/ssr": "^0.2.0",
    "@suka/design-system": "*",
    "@suka/auth": "*",
    "@tanstack/react-query": "^5.51.0",
    "lucide-react": "^0.300.0",
    "sonner": "^1.4.0"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/node": "^20.10.6",
    "@types/react": "^18.2.45",
    "@types/react-dom": "^18.2.18",
    "tailwindcss": "^4.0.0",
    "postcss": "^8.4.32",
    "vitest": "^2.1.0",
    "jsdom": "^25.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.0"
  }
}
```

- [ ] **Step 2: Create `next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@suka/auth', '@suka/design-system'],
  typescript: {
    tsconfigPath: './tsconfig.json',
    ignoreBuildErrors: true,
  },
}

export default nextConfig
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "types": ["vitest/globals", "@testing-library/jest-dom"],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `postcss.config.mjs`**

```javascript
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
export default config
```

> If owner-dashboard's `postcss.config.mjs` differs, copy that file's exact content instead — match the workspace's Tailwind v4 setup.

- [ ] **Step 5: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
```

- [ ] **Step 6: Create `next-env.d.ts`**

```typescript
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 7: Create `src/test/setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 8: Create `src/app/globals.css`** by copying owner-dashboard's globals verbatim

```bash
cp apps/owner-dashboard/src/app/globals.css apps/admin-dashboard/src/app/globals.css
```

- [ ] **Step 9: Create `src/lib/supabase.ts` (delegate to @suka/auth — avoid two-factory gotcha)**

```typescript
import { createSupabaseBrowserClient } from '@suka/auth'

export function createClient() {
  return createSupabaseBrowserClient()
}
```

- [ ] **Step 10: Create `src/app/Providers.tsx`**

```tsx
'use client'

import { useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'
import type { OutletStaffProfile } from '@suka/auth'
import { Toaster } from 'sonner'

export function Providers({
  children,
  initialStaff = null,
}: {
  children: React.ReactNode
  initialStaff?: OutletStaffProfile | null
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const queryClient = useMemo(() => new QueryClient(), [])

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider supabase={supabase} initialStaff={initialStaff}>
        {children}
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 11: Create `src/app/layout.tsx`**

```tsx
import { headers } from 'next/headers'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { Providers } from './Providers'
import './globals.css'

export const metadata = {
  title: 'Admin Dashboard — Sukashawarma',
  description: 'Administrasi staff, akun & sistem',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialStaff = parseStaffHeader((await headers()).get(STAFF_HEADER))
  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased">
        <Providers initialStaff={initialStaff}>{children}</Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 12: Create `src/app/page.tsx` (redirect root to dashboard)**

```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}
```

- [ ] **Step 13: Create `src/middleware.ts`**

```typescript
import { type NextRequest } from 'next/server'
import { enforceAppAccess } from '@suka/auth'

export function middleware(request: NextRequest) {
  if (request.nextUrl.hostname === 'localhost') {
    return undefined
  }
  return enforceAppAccess(request, 'admin-dashboard', { rootRewritePath: '/dashboard' })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login).*)'],
}
```

- [ ] **Step 14: Install dependencies and verify type-check**

Run: `yarn install` (from repo root, to link the new workspace), then `cd apps/admin-dashboard && yarn type-check`
Expected: type-check passes (0 errors). If `@tailwindcss/postcss` is missing, add it to devDependencies matching owner-dashboard, re-run `yarn install`.

- [ ] **Step 15: Commit**

```bash
git add apps/admin-dashboard yarn.lock
git commit -m "feat(admin-dashboard): scaffold app shell + config"
```

---

## Task 3: Migration — `is_admin()` helper + RLS read-all policy

**Files:**
- Create: `supabase/migrations/20260619160000_admin_read_all_staff.sql`

- [ ] **Step 1: Create the migration file**

`supabase/migrations/20260619160000_admin_read_all_staff.sql`:

```sql
-- Admin (role='admin') boleh membaca SEMUA outlet_staff lintas outlet.
-- Helper SECURITY DEFINER untuk hindari rekursi RLS (policy lain self-referencing outlet_staff).

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlet_staff
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;

-- Read: admin lihat semua staff
DROP POLICY IF EXISTS outlet_staff_admin_read_all ON public.outlet_staff;
CREATE POLICY outlet_staff_admin_read_all ON public.outlet_staff
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Read: admin lihat semua pemetaan staff_outlets (untuk render outlet binaan kepala_outlet)
DROP POLICY IF EXISTS staff_outlets_admin_read_all ON public.staff_outlets;
CREATE POLICY staff_outlets_admin_read_all ON public.staff_outlets
  FOR SELECT TO authenticated
  USING (public.is_admin());
```

- [ ] **Step 2: Apply locally / validate SQL**

Run: `supabase db push` (if remote) OR apply to local dev DB.
Expected: migration applies cleanly. If history diverged, run `supabase migration repair` first (see supabase-migration-history-drift) — do NOT force a bare push.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260619160000_admin_read_all_staff.sql
git commit -m "feat(db): is_admin() helper + admin read-all RLS on outlet_staff & staff_outlets"
```

---

## Task 4: Shared Edge Function guard + validation helpers (pure, deno-testable)

**Files:**
- Create: `supabase/functions/_shared/admin-guard.ts`
- Test: `supabase/functions/_shared/admin-guard.test.ts`

- [ ] **Step 1: Write the failing test**

`supabase/functions/_shared/admin-guard.test.ts`:

```typescript
import { assertEquals, assertThrows } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { assertAdmin, validateCreateInput, validateStatus } from "./admin-guard.ts";

Deno.test("assertAdmin throws for non-admin role", () => {
  assertThrows(() => assertAdmin({ role: "spv" }), Error, "Unauthorized");
  assertThrows(() => assertAdmin({ role: "kepala_outlet" }), Error, "Unauthorized");
  assertThrows(() => assertAdmin(null), Error, "Unauthorized");
});

Deno.test("assertAdmin passes for admin role", () => {
  assertAdmin({ role: "admin" }); // does not throw
});

Deno.test("validateCreateInput requires core fields", () => {
  assertThrows(() => validateCreateInput({ name: "", username: "u", password: "p", role: "crew", outlet_id: "o" }), Error, "Missing");
  assertThrows(() => validateCreateInput({ name: "n", username: "u", password: "p", role: "crew" }), Error, "Missing");
});

Deno.test("validateCreateInput requires outlet_ids for kepala_outlet", () => {
  assertThrows(
    () => validateCreateInput({ name: "n", username: "u", password: "p", role: "kepala_outlet", outlet_id: "o" }),
    Error,
    "outlet_ids",
  );
  // valid kepala_outlet with outlet_ids does not throw
  validateCreateInput({ name: "n", username: "u", password: "p", role: "kepala_outlet", outlet_id: "o", outlet_ids: ["a"] });
});

Deno.test("validateStatus only allows known statuses", () => {
  assertEquals(validateStatus("active"), "active");
  assertEquals(validateStatus("inactive"), "inactive");
  assertEquals(validateStatus("on_leave"), "on_leave");
  assertThrows(() => validateStatus("banned"), Error, "Invalid status");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno test supabase/functions/_shared/admin-guard.test.ts`
Expected: FAIL — `admin-guard.ts` not found.

- [ ] **Step 3: Write the implementation**

`supabase/functions/_shared/admin-guard.ts`:

```typescript
const VALID_ROLES = ["admin", "owner", "spv", "kepala_outlet", "kasir", "crew", "kiosk"];
const VALID_STATUSES = ["active", "inactive", "on_leave"];

export function assertAdmin(caller: { role: string } | null): void {
  if (!caller || caller.role !== "admin") {
    throw new Error("Unauthorized: Only admin can perform this action");
  }
}

export function validateCreateInput(body: {
  name?: string;
  username?: string;
  password?: string;
  role?: string;
  outlet_id?: string;
  outlet_ids?: string[];
}): void {
  const { name, username, password, role, outlet_id, outlet_ids } = body;
  if (!name || !username || !password || !role || !outlet_id) {
    throw new Error("Missing required fields");
  }
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`Invalid role: ${role}`);
  }
  if (role === "kepala_outlet" && (!outlet_ids || outlet_ids.length === 0)) {
    throw new Error("kepala_outlet requires outlet_ids (minimal 1 outlet binaan)");
  }
}

export function validateStatus(status: string): string {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  return status;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno test supabase/functions/_shared/admin-guard.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/admin-guard.ts supabase/functions/_shared/admin-guard.test.ts
git commit -m "feat(edge): shared admin-guard + input validation helpers (TDD)"
```

---

## Task 5: Edge Function `admin-create-staff`

**Files:**
- Create: `supabase/functions/admin-create-staff/index.ts`

- [ ] **Step 1: Write the function**

`supabase/functions/admin-create-staff/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { assertAdmin, validateCreateInput } from "../_shared/admin-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) throw new Error("Invalid token");

    const { data: caller } = await admin
      .from("outlet_staff").select("role").eq("id", user.id).single();
    assertAdmin(caller);

    const body = await req.json();
    validateCreateInput(body);
    const { name, username, password, role, outlet_id, outlet_ids } = body;
    const email = `${String(username).toLowerCase().replace(/[^a-z0-9_]/g, "")}@outlet.local`;

    // 1. Buat auth user
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { role, name, outlet_id },
    });
    if (createError) throw createError;

    // 2. Insert outlet_staff dengan id = auth user id
    const { error: insertError } = await admin.from("outlet_staff").insert({
      id: newUser.user.id, outlet_id, name, role, username, status: "active",
    });
    if (insertError) {
      await admin.auth.admin.deleteUser(newUser.user.id); // rollback
      throw insertError;
    }

    // 3. staff_outlets untuk kepala_outlet
    if (role === "kepala_outlet" && Array.isArray(outlet_ids)) {
      const rows = outlet_ids.map((oid: string) => ({ staff_id: newUser.user.id, outlet_id: oid }));
      const { error: soError } = await admin.from("staff_outlets").insert(rows);
      if (soError) {
        await admin.from("outlet_staff").delete().eq("id", newUser.user.id);
        await admin.auth.admin.deleteUser(newUser.user.id);
        throw soError;
      }
    }

    return new Response(JSON.stringify({ ok: true, staff_id: newUser.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Type-check the function with Deno**

Run: `deno check supabase/functions/admin-create-staff/index.ts`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/admin-create-staff/index.ts
git commit -m "feat(edge): admin-create-staff (any role/outlet + kepala_outlet mapping)"
```

---

## Task 6: Edge Function `admin-update-staff`

**Files:**
- Create: `supabase/functions/admin-update-staff/index.ts`

- [ ] **Step 1: Write the function**

`supabase/functions/admin-update-staff/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { assertAdmin } from "../_shared/admin-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) throw new Error("Invalid token");

    const { data: caller } = await admin
      .from("outlet_staff").select("role").eq("id", user.id).single();
    assertAdmin(caller);

    const { staff_id, name, role, outlet_id, outlet_ids } = await req.json();
    if (!staff_id) throw new Error("Missing staff_id");

    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (role !== undefined) patch.role = role;
    if (outlet_id !== undefined) patch.outlet_id = outlet_id;

    if (Object.keys(patch).length > 0) {
      const { error } = await admin.from("outlet_staff").update(patch).eq("id", staff_id);
      if (error) throw error;
    }

    // Sinkronkan staff_outlets bila kepala_outlet (delete-insert)
    if (role === "kepala_outlet" && Array.isArray(outlet_ids)) {
      await admin.from("staff_outlets").delete().eq("staff_id", staff_id);
      if (outlet_ids.length > 0) {
        const rows = outlet_ids.map((oid: string) => ({ staff_id, outlet_id: oid }));
        const { error: soError } = await admin.from("staff_outlets").insert(rows);
        if (soError) throw soError;
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Type-check**

Run: `deno check supabase/functions/admin-update-staff/index.ts`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/admin-update-staff/index.ts
git commit -m "feat(edge): admin-update-staff (+ staff_outlets sync)"
```

---

## Task 7: Edge Functions `admin-reset-password` + `admin-set-status`

**Files:**
- Create: `supabase/functions/admin-reset-password/index.ts`
- Create: `supabase/functions/admin-set-status/index.ts`

- [ ] **Step 1: Write `admin-reset-password/index.ts`**

```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { assertAdmin } from "../_shared/admin-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) throw new Error("Invalid token");

    const { data: caller } = await admin
      .from("outlet_staff").select("role").eq("id", user.id).single();
    assertAdmin(caller);

    const { staff_id, new_password } = await req.json();
    if (!staff_id || !new_password) throw new Error("Missing staff_id or new_password");
    if (String(new_password).length < 6) throw new Error("Password minimal 6 karakter");

    const { error } = await admin.auth.admin.updateUserById(staff_id, { password: new_password });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Write `admin-set-status/index.ts`**

```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { assertAdmin, validateStatus } from "../_shared/admin-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) throw new Error("Invalid token");

    const { data: caller } = await admin
      .from("outlet_staff").select("role").eq("id", user.id).single();
    assertAdmin(caller);

    const { staff_id, status } = await req.json();
    if (!staff_id) throw new Error("Missing staff_id");
    const validStatus = validateStatus(status);

    const { error } = await admin.from("outlet_staff").update({ status: validStatus }).eq("id", staff_id);
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 3: Type-check both**

Run: `deno check supabase/functions/admin-reset-password/index.ts supabase/functions/admin-set-status/index.ts`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/admin-reset-password supabase/functions/admin-set-status
git commit -m "feat(edge): admin-reset-password + admin-set-status"
```

---

## Task 8: App types + admin API client wrapper

**Files:**
- Create: `apps/admin-dashboard/src/lib/types.ts`
- Create: `apps/admin-dashboard/src/lib/email-generator.ts`
- Create: `apps/admin-dashboard/src/lib/adminApi.ts`

- [ ] **Step 1: Create `src/lib/types.ts`**

```typescript
import type { Role, StaffStatus } from '@suka/auth'

export type { Role, StaffStatus }

export interface Outlet {
  id: string
  name: string
}

export interface StaffRow {
  id: string
  name: string
  role: Role
  status: StaffStatus
  username: string | null
  outlet_id: string | null
  outlets: { name: string } | null
  outlet_ids: string[] // dari staff_outlets (kepala_outlet)
}

export interface StaffFormValues {
  name: string
  username: string
  password: string
  role: Role
  outlet_id: string
  outlet_ids: string[]
}

export interface StaffFilterValues {
  search: string
  outletId: string // '' = semua
  role: string // '' = semua
  status: string // '' = semua
}
```

- [ ] **Step 2: Create `src/lib/email-generator.ts`**

```typescript
export function generateStaffEmail(username: string): string {
  const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, '')
  return `${clean}@outlet.local`
}
```

- [ ] **Step 3: Create `src/lib/adminApi.ts` (thin fetch wrappers to Edge Functions)**

```typescript
const FN_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`

async function callFn(fn: string, token: string, body: unknown) {
  const res = await fetch(`${FN_BASE}/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const result = await res.json()
  if (!res.ok || !result.ok) throw new Error(result.error || `Gagal memanggil ${fn}`)
  return result
}

export const adminApi = {
  createStaff: (token: string, body: unknown) => callFn('admin-create-staff', token, body),
  updateStaff: (token: string, body: unknown) => callFn('admin-update-staff', token, body),
  resetPassword: (token: string, staff_id: string, new_password: string) =>
    callFn('admin-reset-password', token, { staff_id, new_password }),
  setStatus: (token: string, staff_id: string, status: string) =>
    callFn('admin-set-status', token, { staff_id, status }),
  deleteStaff: (token: string, staff_id: string) =>
    callFn('delete-staff', token, { staff_id }),
}
```

> Note: `delete-staff` rejects non-SPV callers today. Hard-delete from admin is included for API completeness but the UI surfaces it as a guarded secondary action; if it fails for admin, that is acceptable for Fase 1 (soft-delete via `setStatus` is the primary path). A dedicated `admin-delete-staff` is deferred to a later task if needed.

- [ ] **Step 4: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib
git commit -m "feat(admin-dashboard): app types + admin API client"
```

---

## Task 9: Hooks — `useOutlets`, `useStaff`

**Files:**
- Create: `apps/admin-dashboard/src/hooks/useOutlets.ts`
- Create: `apps/admin-dashboard/src/hooks/useStaff.ts`

- [ ] **Step 1: Create `src/hooks/useOutlets.ts`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { Outlet } from '@/lib/types'

export function useOutlets() {
  const supabase = createClient()
  return useQuery<Outlet[]>({
    queryKey: ['outlets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('outlets').select('id, name').order('name')
      if (error) throw error
      return data ?? []
    },
  })
}
```

- [ ] **Step 2: Create `src/hooks/useStaff.ts`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { StaffRow } from '@/lib/types'

export function useStaff() {
  const supabase = createClient()
  return useQuery<StaffRow[]>({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outlet_staff')
        .select('id, name, role, status, username, outlet_id, outlets(name), staff_outlets(outlet_id)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r: any) => ({
        ...r,
        outlet_ids: (r.staff_outlets ?? []).map((s: any) => s.outlet_id),
      })) as StaffRow[]
    },
  })
}
```

- [ ] **Step 3: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-dashboard/src/hooks/useOutlets.ts apps/admin-dashboard/src/hooks/useStaff.ts
git commit -m "feat(admin-dashboard): useOutlets + useStaff read hooks"
```

---

## Task 10: Hook — `useStaffMutations` (with invalidation test)

**Files:**
- Create: `apps/admin-dashboard/src/hooks/useStaffMutations.ts`
- Test: `apps/admin-dashboard/src/hooks/useStaffMutations.test.tsx`

- [ ] **Step 1: Write the failing test**

`apps/admin-dashboard/src/hooks/useStaffMutations.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@suka/auth', () => ({
  useAuth: () => ({ session: { access_token: 'tok' } }),
}))
const createStaff = vi.fn().mockResolvedValue({ ok: true })
vi.mock('@/lib/adminApi', () => ({ adminApi: { createStaff: (...a: unknown[]) => createStaff(...a) } }))

import { useStaffMutations } from './useStaffMutations'

function wrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('useStaffMutations', () => {
  beforeEach(() => createStaff.mockClear())

  it('invalidates ["staff"] after a successful create', async () => {
    const client = new QueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useStaffMutations(), { wrapper: wrapper(client) })

    await result.current.create.mutateAsync({
      name: 'A', username: 'a', password: 'secret', role: 'crew', outlet_id: 'o1', outlet_ids: [],
    })

    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['staff'] }))
    expect(createStaff).toHaveBeenCalledWith('tok', expect.objectContaining({ name: 'A' }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/admin-dashboard && yarn vitest run src/hooks/useStaffMutations.test.tsx`
Expected: FAIL — module `./useStaffMutations` not found.

- [ ] **Step 3: Implement the hook**

`apps/admin-dashboard/src/hooks/useStaffMutations.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@suka/auth'
import { adminApi } from '@/lib/adminApi'
import type { StaffFormValues } from '@/lib/types'

export function useStaffMutations() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const token = () => {
    const t = session?.access_token
    if (!t) throw new Error('Sesi tidak ditemukan')
    return t
  }
  const invalidate = () => qc.invalidateQueries({ queryKey: ['staff'] })

  const create = useMutation({
    mutationFn: (values: StaffFormValues) => adminApi.createStaff(token(), values),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: (vars: { staff_id: string } & Partial<StaffFormValues>) =>
      adminApi.updateStaff(token(), vars),
    onSuccess: invalidate,
  })
  const resetPassword = useMutation({
    mutationFn: (vars: { staff_id: string; new_password: string }) =>
      adminApi.resetPassword(token(), vars.staff_id, vars.new_password),
  })
  const setStatus = useMutation({
    mutationFn: (vars: { staff_id: string; status: string }) =>
      adminApi.setStatus(token(), vars.staff_id, vars.status),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (staff_id: string) => adminApi.deleteStaff(token(), staff_id),
    onSuccess: invalidate,
  })

  return { create, update, resetPassword, setStatus, remove }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/admin-dashboard && yarn vitest run src/hooks/useStaffMutations.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/hooks/useStaffMutations.ts apps/admin-dashboard/src/hooks/useStaffMutations.test.tsx
git commit -m "feat(admin-dashboard): useStaffMutations hook (TDD)"
```

---

## Task 11: `StaffFilters` component (with filtering test)

**Files:**
- Create: `apps/admin-dashboard/src/lib/filterStaff.ts`
- Test: `apps/admin-dashboard/src/lib/filterStaff.test.ts`
- Create: `apps/admin-dashboard/src/components/StaffFilters.tsx`

- [ ] **Step 1: Write the failing test for the pure filter**

`apps/admin-dashboard/src/lib/filterStaff.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { filterStaff } from './filterStaff'
import type { StaffRow } from './types'

const rows: StaffRow[] = [
  { id: '1', name: 'Andi', role: 'crew', status: 'active', username: 'andi', outlet_id: 'o1', outlets: { name: 'Empang' }, outlet_ids: [] },
  { id: '2', name: 'Budi', role: 'kasir', status: 'inactive', username: 'budi', outlet_id: 'o2', outlets: { name: 'Sudirman' }, outlet_ids: [] },
  { id: '3', name: 'Citra', role: 'crew', status: 'active', username: 'citra', outlet_id: 'o2', outlets: { name: 'Sudirman' }, outlet_ids: [] },
]

describe('filterStaff', () => {
  it('filters by search (case-insensitive, name)', () => {
    expect(filterStaff(rows, { search: 'an', outletId: '', role: '', status: '' }).map(r => r.id)).toEqual(['1'])
  })
  it('filters by outletId', () => {
    expect(filterStaff(rows, { search: '', outletId: 'o2', role: '', status: '' }).map(r => r.id)).toEqual(['2', '3'])
  })
  it('filters by role', () => {
    expect(filterStaff(rows, { search: '', outletId: '', role: 'crew', status: '' }).map(r => r.id)).toEqual(['1', '3'])
  })
  it('filters by status', () => {
    expect(filterStaff(rows, { search: '', outletId: '', role: '', status: 'inactive' }).map(r => r.id)).toEqual(['2'])
  })
  it('combines filters (AND)', () => {
    expect(filterStaff(rows, { search: '', outletId: 'o2', role: 'crew', status: 'active' }).map(r => r.id)).toEqual(['3'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/admin-dashboard && yarn vitest run src/lib/filterStaff.test.ts`
Expected: FAIL — `filterStaff` not found.

- [ ] **Step 3: Implement `filterStaff`**

`apps/admin-dashboard/src/lib/filterStaff.ts`:

```typescript
import type { StaffRow, StaffFilterValues } from './types'

export function filterStaff(rows: StaffRow[], f: StaffFilterValues): StaffRow[] {
  const q = f.search.trim().toLowerCase()
  return rows.filter((r) => {
    if (q && !r.name.toLowerCase().includes(q) && !(r.username ?? '').toLowerCase().includes(q)) return false
    if (f.outletId && r.outlet_id !== f.outletId) return false
    if (f.role && r.role !== f.role) return false
    if (f.status && r.status !== f.status) return false
    return true
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/admin-dashboard && yarn vitest run src/lib/filterStaff.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `StaffFilters.tsx` (presentational)**

`apps/admin-dashboard/src/components/StaffFilters.tsx`:

```tsx
'use client'
import type { Outlet, StaffFilterValues } from '@/lib/types'

const ROLES = ['admin', 'owner', 'spv', 'kepala_outlet', 'kasir', 'crew', 'kiosk']

export function StaffFilters({
  value, onChange, outlets,
}: {
  value: StaffFilterValues
  onChange: (v: StaffFilterValues) => void
  outlets: Outlet[]
}) {
  const set = (patch: Partial<StaffFilterValues>) => onChange({ ...value, ...patch })
  const inputCls = 'rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange'
  return (
    <div className="flex flex-wrap gap-2">
      <input
        className={inputCls} placeholder="Cari nama / username"
        value={value.search} onChange={(e) => set({ search: e.target.value })}
      />
      <select className={inputCls} value={value.outletId} onChange={(e) => set({ outletId: e.target.value })}>
        <option value="">Semua Outlet</option>
        {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <select className={inputCls} value={value.role} onChange={(e) => set({ role: e.target.value })}>
        <option value="">Semua Role</option>
        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <select className={inputCls} value={value.status} onChange={(e) => set({ status: e.target.value })}>
        <option value="">Semua Status</option>
        <option value="active">Aktif</option>
        <option value="inactive">Nonaktif</option>
        <option value="on_leave">Cuti</option>
      </select>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/admin-dashboard/src/lib/filterStaff.ts apps/admin-dashboard/src/lib/filterStaff.test.ts apps/admin-dashboard/src/components/StaffFilters.tsx
git commit -m "feat(admin-dashboard): StaffFilters + filterStaff (TDD)"
```

---

## Task 12: `OutletMultiSelect` + `StaffForm` (with conditional test)

**Files:**
- Create: `apps/admin-dashboard/src/components/OutletMultiSelect.tsx`
- Create: `apps/admin-dashboard/src/components/StaffForm.tsx`
- Test: `apps/admin-dashboard/src/components/StaffForm.test.tsx`

- [ ] **Step 1: Implement `OutletMultiSelect.tsx`**

`apps/admin-dashboard/src/components/OutletMultiSelect.tsx`:

```tsx
'use client'
import type { Outlet } from '@/lib/types'

export function OutletMultiSelect({
  outlets, selected, onChange,
}: {
  outlets: Outlet[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  return (
    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-xl border border-suka-gray-200 p-2">
      {outlets.map((o) => (
        <label key={o.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} />
          {o.name}
        </label>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Write the failing test for `StaffForm`**

`apps/admin-dashboard/src/components/StaffForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StaffForm } from './StaffForm'
import type { Outlet } from '@/lib/types'

const outlets: Outlet[] = [
  { id: 'o1', name: 'Empang' },
  { id: 'o2', name: 'Sudirman' },
]

describe('StaffForm', () => {
  it('shows OutletMultiSelect only when role is kepala_outlet', () => {
    render(<StaffForm outlets={outlets} onSubmit={vi.fn()} submitting={false} />)
    // default role crew → no multi-select label
    expect(screen.queryByText('Outlet Binaan')).toBeNull()
    // switch to kepala_outlet
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'kepala_outlet' } })
    expect(screen.getByText('Outlet Binaan')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/admin-dashboard && yarn vitest run src/components/StaffForm.test.tsx`
Expected: FAIL — `StaffForm` not found.

- [ ] **Step 4: Implement `StaffForm.tsx`**

`apps/admin-dashboard/src/components/StaffForm.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { Button } from '@suka/design-system'
import { OutletMultiSelect } from './OutletMultiSelect'
import type { Outlet, StaffFormValues, Role } from '@/lib/types'

const ROLES: Role[] = ['admin', 'owner', 'spv', 'kepala_outlet', 'kasir', 'crew', 'kiosk']

export function StaffForm({
  outlets, onSubmit, submitting, initial,
}: {
  outlets: Outlet[]
  onSubmit: (values: StaffFormValues) => void
  submitting: boolean
  initial?: Partial<StaffFormValues>
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [username, setUsername] = useState(initial?.username ?? '')
  const [password, setPassword] = useState(initial?.password ?? 'sukashawarma123')
  const [role, setRole] = useState<Role>(initial?.role ?? 'crew')
  const [outletId, setOutletId] = useState(initial?.outlet_id ?? (outlets[0]?.id ?? ''))
  const [outletIds, setOutletIds] = useState<string[]>(initial?.outlet_ids ?? [])

  const inputCls = 'w-full rounded-xl border border-suka-gray-200 px-3 py-2.5 outline-none focus:border-suka-orange'
  const labelCls = 'mb-1 block text-sm font-medium text-gray-700'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({ name, username, password, role, outlet_id: outletId, outlet_ids: outletIds })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="sf-name" className={labelCls}>Nama Lengkap</label>
        <input id="sf-name" className={inputCls} required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label htmlFor="sf-username" className={labelCls}>Username</label>
        <input id="sf-username" className={inputCls} required value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
      </div>
      <div>
        <label htmlFor="sf-password" className={labelCls}>Password Sementara</label>
        <input id="sf-password" className={inputCls} required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <label htmlFor="sf-role" className={labelCls}>Role</label>
        <select id="sf-role" className={inputCls} value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="sf-outlet" className={labelCls}>Outlet Home</label>
        <select id="sf-outlet" className={inputCls} value={outletId} onChange={(e) => setOutletId(e.target.value)}>
          {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
      {role === 'kepala_outlet' && (
        <div>
          <label className={labelCls}>Outlet Binaan</label>
          <OutletMultiSelect outlets={outlets} selected={outletIds} onChange={setOutletIds} />
        </div>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="submit" disabled={submitting} className="rounded-xl">
          {submitting ? 'Menyimpan...' : 'Simpan'}
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/admin-dashboard && yarn vitest run src/components/StaffForm.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-dashboard/src/components/OutletMultiSelect.tsx apps/admin-dashboard/src/components/StaffForm.tsx apps/admin-dashboard/src/components/StaffForm.test.tsx
git commit -m "feat(admin-dashboard): StaffForm + OutletMultiSelect (conditional, TDD)"
```

---

## Task 13: `ResetPasswordDialog`, `StatusToggle`, `StaffTable`

**Files:**
- Create: `apps/admin-dashboard/src/components/ResetPasswordDialog.tsx`
- Create: `apps/admin-dashboard/src/components/StatusToggle.tsx`
- Create: `apps/admin-dashboard/src/components/StaffTable.tsx`

- [ ] **Step 1: Implement `ResetPasswordDialog.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { Button } from '@suka/design-system'

export function ResetPasswordDialog({
  staffName, onSubmit, onClose, submitting,
}: {
  staffName: string
  onSubmit: (newPassword: string) => void
  onClose: () => void
  submitting: boolean
}) {
  const [pw, setPw] = useState('sukashawarma123')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 space-y-4">
        <h3 className="font-bold text-suka-ink">Reset Password — {staffName}</h3>
        <input
          className="w-full rounded-xl border border-suka-gray-200 px-3 py-2.5 outline-none focus:border-suka-orange"
          value={pw} onChange={(e) => setPw(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">Batal</Button>
          <Button type="button" disabled={submitting || pw.length < 6} onClick={() => onSubmit(pw)} className="rounded-xl">
            {submitting ? 'Menyimpan...' : 'Simpan Password'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement `StatusToggle.tsx`**

```tsx
'use client'
import { Power } from 'lucide-react'
import type { StaffStatus } from '@/lib/types'

export function StatusToggle({
  status, onToggle,
}: {
  status: StaffStatus
  onToggle: (next: StaffStatus) => void
}) {
  const active = status === 'active'
  return (
    <button
      onClick={() => onToggle(active ? 'inactive' : 'active')}
      className={`rounded-lg p-2 ${active ? 'text-amber-600 hover:bg-amber-50' : 'text-suka-green hover:bg-green-50'}`}
      title={active ? 'Nonaktifkan' : 'Aktifkan'}
    >
      <Power size={16} />
    </button>
  )
}
```

- [ ] **Step 3: Implement `StaffTable.tsx`**

```tsx
'use client'
import { Avatar } from '@suka/design-system'
import { Edit, KeyRound, Trash2 } from 'lucide-react'
import { StatusToggle } from './StatusToggle'
import type { StaffRow, StaffStatus } from '@/lib/types'

function statusBadge(status: StaffStatus) {
  const map: Record<StaffStatus, string> = {
    active: 'bg-[#e1f5ee] text-[#085041]',
    inactive: 'bg-[#fcebeb] text-[#a32d2d]',
    on_leave: 'bg-amber-50 text-amber-700',
  }
  const label: Record<StaffStatus, string> = { active: 'Aktif', inactive: 'Nonaktif', on_leave: 'Cuti' }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${map[status]}`}>{label[status]}</span>
}

export function StaffTable({
  rows, onEdit, onResetPassword, onToggleStatus, onDelete,
}: {
  rows: StaffRow[]
  onEdit: (s: StaffRow) => void
  onResetPassword: (s: StaffRow) => void
  onToggleStatus: (s: StaffRow, next: StaffStatus) => void
  onDelete: (s: StaffRow) => void
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-suka-gray-200 bg-suka-gray-50/60 text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">Nama</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Outlet</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-suka-gray-200/70">
          {rows.map((s) => (
            <tr key={s.id} className="hover:bg-suka-gray-50/50">
              <td className="px-4 py-3 font-medium text-suka-ink">
                <div className="flex items-center gap-2.5">
                  <Avatar name={s.name} size={32} />
                  <div>
                    <div>{s.name}</div>
                    <div className="text-xs text-gray-400">@{s.username ?? '-'}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 capitalize text-gray-500">{s.role}</td>
              <td className="px-4 py-3 text-gray-500">{s.outlets?.name ?? '-'}</td>
              <td className="px-4 py-3">{statusBadge(s.status)}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-1">
                  <button onClick={() => onEdit(s)} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50" title="Edit"><Edit size={16} /></button>
                  <button onClick={() => onResetPassword(s)} className="rounded-lg p-2 text-suka-brown hover:bg-suka-cream" title="Reset Password"><KeyRound size={16} /></button>
                  <StatusToggle status={s.status} onToggle={(next) => onToggleStatus(s, next)} />
                  <button onClick={() => onDelete(s)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" title="Hapus Permanen"><Trash2 size={16} /></button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Tidak ada staff yang cocok.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/components/ResetPasswordDialog.tsx apps/admin-dashboard/src/components/StatusToggle.tsx apps/admin-dashboard/src/components/StaffTable.tsx
git commit -m "feat(admin-dashboard): ResetPasswordDialog, StatusToggle, StaffTable"
```

---

## Task 14: Dashboard shell (Sidebar, Header, layout, summary page)

**Files:**
- Create: `apps/admin-dashboard/src/components/layout/Sidebar.tsx`
- Create: `apps/admin-dashboard/src/components/layout/Header.tsx`
- Create: `apps/admin-dashboard/src/app/dashboard/layout.tsx`
- Create: `apps/admin-dashboard/src/app/dashboard/page.tsx`

- [ ] **Step 1: Implement `Sidebar.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users } from 'lucide-react'

const NAV = [
  { href: '/dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { href: '/dashboard/staff', label: 'Staff', icon: Users },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="hidden w-56 shrink-0 border-r border-suka-gray-200 bg-white md:block">
      <div className="p-4 text-lg font-extrabold text-suka-brown">Admin</div>
      <nav className="space-y-1 px-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium ${active ? 'bg-suka-orange/10 text-suka-orange' : 'text-gray-600 hover:bg-suka-gray-50'}`}>
              <Icon size={18} /> {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: Implement `Header.tsx`**

```tsx
'use client'
import { useAuth } from '@suka/auth'
import { Avatar } from '@suka/design-system'

export function Header() {
  const { outletStaff, signOut } = useAuth()
  return (
    <header className="flex items-center justify-between border-b border-suka-gray-200 bg-white px-4 py-3">
      <h1 className="text-sm font-bold text-suka-ink">Dashboard Administrasi</h1>
      <div className="flex items-center gap-3">
        {outletStaff && (
          <div className="flex items-center gap-2">
            <Avatar name={outletStaff.name} size={32} />
            <span className="text-sm font-medium text-suka-ink">{outletStaff.name}</span>
          </div>
        )}
        <button onClick={() => signOut()} className="text-sm font-medium text-red-600 hover:underline">Keluar</button>
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Implement `dashboard/layout.tsx`**

```tsx
import React from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-suka-cream">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement `dashboard/page.tsx` (summary)**

```tsx
'use client'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { useStaff } from '@/hooks/useStaff'
import { useOutlets } from '@/hooks/useOutlets'

export default function DashboardHome() {
  const { data: staff = [] } = useStaff()
  const { data: outlets = [] } = useOutlets()
  const activeCount = staff.filter((s) => s.status === 'active').length
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-suka-ink">Ringkasan</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-suka-gray-200 bg-white p-4">
          <div className="text-3xl font-extrabold text-suka-brown">{staff.length}</div>
          <div className="text-sm text-gray-500">Total Staff</div>
        </div>
        <div className="rounded-2xl border border-suka-gray-200 bg-white p-4">
          <div className="text-3xl font-extrabold text-suka-green">{activeCount}</div>
          <div className="text-sm text-gray-500">Aktif</div>
        </div>
        <div className="rounded-2xl border border-suka-gray-200 bg-white p-4">
          <div className="text-3xl font-extrabold text-suka-brown">{outlets.length}</div>
          <div className="text-sm text-gray-500">Outlet</div>
        </div>
      </div>
      <Link href="/dashboard/staff" className="inline-flex items-center gap-2 rounded-xl bg-suka-orange px-4 py-2.5 font-semibold text-white">
        <Users size={18} /> Kelola Staff
      </Link>
    </div>
  )
}
```

- [ ] **Step 5: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-dashboard/src/components/layout apps/admin-dashboard/src/app/dashboard/layout.tsx apps/admin-dashboard/src/app/dashboard/page.tsx
git commit -m "feat(admin-dashboard): dashboard shell (sidebar, header, summary)"
```

---

## Task 15: Assemble Staff Management page

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/staff/page.tsx`

- [ ] **Step 1: Implement the page**

`apps/admin-dashboard/src/app/dashboard/staff/page.tsx`:

```tsx
'use client'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { useStaff } from '@/hooks/useStaff'
import { useOutlets } from '@/hooks/useOutlets'
import { useStaffMutations } from '@/hooks/useStaffMutations'
import { filterStaff } from '@/lib/filterStaff'
import { StaffFilters } from '@/components/StaffFilters'
import { StaffTable } from '@/components/StaffTable'
import { StaffForm } from '@/components/StaffForm'
import { ResetPasswordDialog } from '@/components/ResetPasswordDialog'
import type { StaffRow, StaffFilterValues, StaffStatus, StaffFormValues } from '@/lib/types'

const EMPTY_FILTER: StaffFilterValues = { search: '', outletId: '', role: '', status: '' }

export default function StaffPage() {
  const { data: staff = [], isLoading } = useStaff()
  const { data: outlets = [] } = useOutlets()
  const { create, update, resetPassword, setStatus, remove } = useStaffMutations()

  const [filter, setFilter] = useState<StaffFilterValues>(EMPTY_FILTER)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<StaffRow | null>(null)
  const [resetting, setResetting] = useState<StaffRow | null>(null)

  const rows = useMemo(() => filterStaff(staff, filter), [staff, filter])

  function handleCreate(values: StaffFormValues) {
    create.mutate(values, {
      onSuccess: () => { toast.success(`Staff ${values.name} dibuat`); setShowForm(false) },
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleUpdate(values: StaffFormValues) {
    if (!editing) return
    update.mutate({ staff_id: editing.id, ...values }, {
      onSuccess: () => { toast.success('Perubahan disimpan'); setEditing(null) },
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleToggleStatus(s: StaffRow, next: StaffStatus) {
    setStatus.mutate({ staff_id: s.id, status: next }, {
      onSuccess: () => toast.success(`Status ${s.name} → ${next}`),
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleDelete(s: StaffRow) {
    if (!confirm(`HAPUS PERMANEN staff ${s.name}? Akun login ikut terhapus. Tindakan ini tidak bisa dibatalkan.`)) return
    remove.mutate(s.id, {
      onSuccess: () => toast.success(`Staff ${s.name} dihapus`),
      onError: (e: any) => toast.error(e.message),
    })
  }

  function handleReset(newPassword: string) {
    if (!resetting) return
    resetPassword.mutate({ staff_id: resetting.id, new_password: newPassword }, {
      onSuccess: () => { toast.success('Password direset'); setResetting(null) },
      onError: (e: any) => toast.error(e.message),
    })
  }

  if (isLoading) return <div className="flex justify-center p-8"><Spinner /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-suka-ink">Manajemen Staff</h2>
        <Button onClick={() => { setEditing(null); setShowForm((v) => !v) }} className="flex items-center gap-2 rounded-xl">
          <UserPlus size={18} /> Tambah Staff
        </Button>
      </div>

      {showForm && !editing && (
        <div className="rounded-2xl border-2 border-suka-orange/40 bg-white p-4 sm:p-6">
          <h3 className="mb-4 font-bold text-suka-ink">Form Staff Baru</h3>
          <StaffForm outlets={outlets} onSubmit={handleCreate} submitting={create.isPending} />
        </div>
      )}

      {editing && (
        <div className="rounded-2xl border-2 border-blue-300 bg-white p-4 sm:p-6">
          <h3 className="mb-4 font-bold text-suka-ink">Edit — {editing.name}</h3>
          <StaffForm
            outlets={outlets}
            submitting={update.isPending}
            onSubmit={handleUpdate}
            initial={{
              name: editing.name, username: editing.username ?? '', password: '',
              role: editing.role, outlet_id: editing.outlet_id ?? (outlets[0]?.id ?? ''),
              outlet_ids: editing.outlet_ids,
            }}
          />
        </div>
      )}

      <StaffFilters value={filter} onChange={setFilter} outlets={outlets} />

      <StaffTable
        rows={rows}
        onEdit={(s) => { setShowForm(false); setEditing(s) }}
        onResetPassword={(s) => setResetting(s)}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDelete}
      />

      {resetting && (
        <ResetPasswordDialog
          staffName={resetting.name}
          submitting={resetPassword.isPending}
          onSubmit={handleReset}
          onClose={() => setResetting(null)}
        />
      )}
    </div>
  )
}
```

> Note on edit: `StaffForm` always collects a password field, but `admin-update-staff` ignores `password`. The edit form's password is unused on update (kept simple); password changes go through the dedicated Reset Password action. This is intentional for Fase 1.

- [ ] **Step 2: Type-check**

Run: `cd apps/admin-dashboard && yarn type-check`
Expected: passes.

- [ ] **Step 3: Run the full app test suite**

Run: `cd apps/admin-dashboard && yarn test`
Expected: all tests pass (useStaffMutations, filterStaff, StaffForm).

- [ ] **Step 4: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/staff/page.tsx
git commit -m "feat(admin-dashboard): assemble Staff Management page"
```

---

## Task 16: Wire admin-dashboard into portal launcher

**Files:**
- Modify: `apps/portal/src/app/launcher/page.tsx:11-26`

- [ ] **Step 1: Add `admin-dashboard` to `APP_URL`**

In `apps/portal/src/app/launcher/page.tsx`, add to the `APP_URL` record:

```typescript
  'admin-dashboard':  process.env.NEXT_PUBLIC_APP_URL_ADMIN_DASHBOARD  ?? 'https://admin.sukashawarma.com',
```

- [ ] **Step 2: Add `admin-dashboard` to `APP_META`**

In the same file, add to the `APP_META` record:

```typescript
  'admin-dashboard': { label: 'Admin', url: APP_URL['admin-dashboard'], desc: 'Administrasi staff, akun & sistem' },
```

- [ ] **Step 3: Type-check portal**

Run: `cd apps/portal && yarn type-check`
Expected: passes (records now exhaustive over the updated `AppName`).

- [ ] **Step 4: Commit**

```bash
git add apps/portal/src/app/launcher/page.tsx
git commit -m "feat(portal): surface admin-dashboard in launcher for admin role"
```

---

## Task 17: Final verification

- [ ] **Step 1: Root type-check**

Run: `yarn type-check` (repo root)
Expected: 0 errors across all workspaces.

- [ ] **Step 2: Build admin-dashboard**

Run: `cd apps/admin-dashboard && yarn build`
Expected: build succeeds.

- [ ] **Step 3: Run all admin-dashboard + auth tests**

Run: `cd apps/admin-dashboard && yarn test` then `cd packages/auth && yarn vitest run` then `deno test supabase/functions/_shared/admin-guard.test.ts`
Expected: all pass.

- [ ] **Step 4: Manual smoke test (dev)**

Run: `cd apps/admin-dashboard && yarn dev` (port 3004). Log in as an `admin` user (via portal SSO, or directly).
Verify:
- `/dashboard` shows staff/outlet counts.
- `/dashboard/staff` lists staff across multiple outlets (not just one).
- Create a `crew` at a chosen outlet → appears in table.
- Create a `kepala_outlet` → `Outlet Binaan` multi-select appears → select 2 outlets → saved; verify rows in `staff_outlets`.
- Edit a staff's role/outlet → persists.
- Reset password → succeeds.
- Toggle status active↔inactive → badge updates.
- Filters (outlet, role, status, search) narrow the table.

- [ ] **Step 5: Deploy notes (no code change)**

Record for production rollout (do NOT execute here): new subdomain `admin.sukashawarma.com` (Node app, `server.cjs`, port via panel), `.env.local` with `NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com`, deploy the 4 new Edge Functions (`supabase functions deploy admin-create-staff admin-update-staff admin-reset-password admin-set-status`), and push the migration. See CLAUDE.md Deployment section + sso-cookie-domain-gotcha.

---

## Self-Review Notes

- **Spec coverage:** scaffold (T2), auth wiring (T1, T16), 4 Edge Functions (T5–T7), RLS migration (T3), all UI components (T11–T14), staff_outlets multi-outlet (T5/T6/T12/T15), soft-delete default + hard-delete secondary (T13/T15), testing (T1, T4, T10, T11, T12), verification (T17). ✅
- **Hard-delete caveat:** existing `delete-staff` blocks non-SPV; documented in T8 as acceptable for Fase 1 (primary path is soft-delete). A dedicated `admin-delete-staff` can be added later if hard-delete-by-admin becomes required.
- **Type consistency:** `StaffFormValues`, `StaffRow`, `StaffFilterValues` defined in T8 and used consistently in T9–T15. `adminApi` method names match `useStaffMutations` calls.
