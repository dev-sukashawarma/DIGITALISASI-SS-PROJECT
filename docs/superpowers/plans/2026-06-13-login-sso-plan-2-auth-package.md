# Login SSO — Plan 2: `packages/auth` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat package bersama `@suka/auth` berisi konstanta akses role, klien Supabase dengan cookie-domain configurable (mekanisme SSO), helper identitas/scope, dan `AuthProvider/useAuth` terpadu — sumber tunggal untuk semua app.

**Architecture:** Workspace package mengikuti pola `@suka/design-system` (`type: module`, `main: ./src/index.ts`). Logika murni (matriks akses) diuji dengan Vitest (TDD). Klien Supabase membaca `NEXT_PUBLIC_COOKIE_DOMAIN` untuk berbagi cookie lintas subdomain; kosong di lokal = perilaku per-port lama.

**Tech Stack:** TypeScript, `@supabase/ssr`, React 19 (peer), Vitest.

**Prasyarat:** Plan 1 (schema `outlet_staff` 7 role, `staff_outlets`, fungsi `accessible_outlet_ids()`) sudah di-push & terverifikasi.

---

## File Structure

```
packages/auth/
├── package.json            # @suka/auth, deps @supabase/ssr, devDeps vitest/typescript
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── index.ts            # barrel export
    ├── types.ts            # Role, AppName, OutletStaffProfile
    ├── access.ts           # ROLE_APP_ACCESS + hasAppAccess (logika murni, diuji)
    ├── access.test.ts      # unit test access
    ├── supabase-client.ts  # createBrowserClient (cookie domain configurable)
    ├── supabase-server.ts  # createServerClient untuk middleware/RSC
    ├── staff.ts            # getOutletStaff, getAccessibleOutletIds
    └── AuthProvider.tsx     # AuthProvider + useAuth terpadu
```

---

### Task 1: Scaffold package `@suka/auth`

**Files:**
- Create: `packages/auth/package.json`
- Create: `packages/auth/tsconfig.json`
- Create: `packages/auth/vitest.config.ts`

- [ ] **Step 1: Tulis `package.json`**

```json
{
  "name": "@suka/auth",
  "version": "0.0.1",
  "description": "SSO identity, role access matrix, and Supabase clients for SUKA suite",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "files": ["src"],
  "scripts": {
    "test": "vitest run",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.45.0"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "vitest": "^2.0.0",
    "@types/react": "^18.2.45"
  },
  "peerDependencies": {
    "react": "^19.0.0"
  }
}
```

> Versi `@supabase/ssr`/`supabase-js`: samakan dengan yang dipakai app existing. Cek `apps/pos-kasir/package.json` dan selaraskan bila berbeda.

- [ ] **Step 2: Tulis `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Tulis `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Install deps di root workspace**

Run: `yarn install`
Expected: `@suka/auth` ter-link sebagai workspace; tidak ada error resolusi.

- [ ] **Step 5: Commit**

```bash
git add packages/auth/package.json packages/auth/tsconfig.json packages/auth/vitest.config.ts
git commit -m "feat(auth): scaffold package @suka/auth"
```

---

### Task 2: Tipe & matriks akses (TDD)

**Files:**
- Create: `packages/auth/src/types.ts`
- Create: `packages/auth/src/access.ts`
- Test: `packages/auth/src/access.test.ts`

- [ ] **Step 1: Tulis tipe**

`packages/auth/src/types.ts`:
```ts
export type Role =
  | 'admin'
  | 'owner'
  | 'spv'
  | 'kepala_outlet'
  | 'kasir'
  | 'crew'
  | 'kiosk'

export type AppName =
  | 'pos-kasir'
  | 'absensi'
  | 'stok'
  | 'distribusi'
  | 'owner-dashboard'

export type StaffStatus = 'active' | 'inactive' | 'on_leave'

export interface OutletStaffProfile {
  id: string
  outlet_id: string | null
  name: string
  role: Role
  status: StaffStatus
  outlets?: { name: string } | null
}
```

- [ ] **Step 2: Tulis test akses (failing)**

`packages/auth/src/access.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { ROLE_APP_ACCESS, hasAppAccess, accessibleApps } from './access'

describe('ROLE_APP_ACCESS', () => {
  it('kasir hanya pos-kasir & absensi', () => {
    expect([...ROLE_APP_ACCESS.kasir].sort()).toEqual(['absensi', 'pos-kasir'])
  })

  it('crew hanya absensi', () => {
    expect([...ROLE_APP_ACCESS.crew]).toEqual(['absensi'])
  })

  it('admin semua 5 app', () => {
    expect(ROLE_APP_ACCESS.admin.length).toBe(5)
  })

  it('owner hanya owner-dashboard', () => {
    expect([...ROLE_APP_ACCESS.owner]).toEqual(['owner-dashboard'])
  })

  it('spv tidak punya pos-kasir', () => {
    expect(ROLE_APP_ACCESS.spv).not.toContain('pos-kasir')
  })
})

describe('hasAppAccess', () => {
  it('kepala_outlet boleh stok', () => {
    expect(hasAppAccess('kepala_outlet', 'stok')).toBe(true)
  })
  it('crew tidak boleh pos-kasir', () => {
    expect(hasAppAccess('crew', 'pos-kasir')).toBe(false)
  })
})

describe('accessibleApps', () => {
  it('mengembalikan daftar app utk role', () => {
    expect(accessibleApps('owner')).toEqual(['owner-dashboard'])
  })
})
```

- [ ] **Step 3: Jalankan test (harus gagal)**

Run: `yarn workspace @suka/auth test`
Expected: FAIL — `Cannot find module './access'`.

- [ ] **Step 4: Implementasi `access.ts`**

`packages/auth/src/access.ts`:
```ts
import type { AppName, Role } from './types'

/** Sumber tunggal matriks akses role -> daftar app. Ref: docs/ROLE-JOBDESK.md */
export const ROLE_APP_ACCESS: Record<Role, AppName[]> = {
  admin: ['pos-kasir', 'absensi', 'stok', 'distribusi', 'owner-dashboard'],
  owner: ['owner-dashboard'],
  spv: ['absensi', 'stok', 'distribusi'],
  kepala_outlet: ['pos-kasir', 'absensi', 'stok', 'distribusi'],
  kasir: ['pos-kasir', 'absensi'],
  crew: ['absensi'],
  kiosk: ['pos-kasir'],
}

export function hasAppAccess(role: Role, app: AppName): boolean {
  return ROLE_APP_ACCESS[role]?.includes(app) ?? false
}

export function accessibleApps(role: Role): AppName[] {
  return ROLE_APP_ACCESS[role] ?? []
}
```

- [ ] **Step 5: Jalankan test (harus lulus)**

Run: `yarn workspace @suka/auth test`
Expected: PASS — semua test hijau.

- [ ] **Step 6: Commit**

```bash
git add packages/auth/src/types.ts packages/auth/src/access.ts packages/auth/src/access.test.ts
git commit -m "feat(auth): tipe role/app + matriks ROLE_APP_ACCESS (tested)"
```

---

### Task 3: Klien Supabase dengan cookie-domain configurable

**Files:**
- Create: `packages/auth/src/supabase-client.ts`
- Create: `packages/auth/src/supabase-server.ts`

Mekanisme SSO: cookie sesi di-scope ke `NEXT_PUBLIC_COOKIE_DOMAIN` (mis. `.sukashawarma.com`). Kosong → per-port (lokal).

- [ ] **Step 1: Tulis browser client**

`packages/auth/src/supabase-client.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr'

/** Domain cookie sesi; kosong di lokal (per-port), '.sukashawarma.com' di prod. */
const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        domain: cookieDomain,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 31536000,
      },
    }
  )
}
```

- [ ] **Step 2: Tulis server/middleware client**

`packages/auth/src/supabase-server.ts`:
```ts
import { createServerClient } from '@supabase/ssr'

const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

/**
 * Buat server client untuk middleware / RSC.
 * `getAll`/`setAll` di-inject oleh pemanggil (next/headers cookies, atau request/response middleware).
 */
export function createSupabaseServerClient(cookieAdapter: {
  getAll: () => { name: string; value: string }[]
  setAll: (cookies: CookieToSet[]) => void
}) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        domain: cookieDomain,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 31536000,
      },
      cookies: {
        getAll: cookieAdapter.getAll,
        setAll: cookieAdapter.setAll,
      },
    }
  )
}
```

- [ ] **Step 3: Type-check**

Run: `yarn workspace @suka/auth type-check`
Expected: tidak ada error.

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/supabase-client.ts packages/auth/src/supabase-server.ts
git commit -m "feat(auth): klien Supabase dgn cookie-domain configurable (SSO)"
```

---

### Task 4: Helper identitas & scope

**Files:**
- Create: `packages/auth/src/staff.ts`

- [ ] **Step 1: Tulis `getOutletStaff` & `getAccessibleOutletIds`**

`packages/auth/src/staff.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { OutletStaffProfile } from './types'

/** Ambil profil outlet_staff kanonik untuk user id. null jika tidak ada. */
export async function getOutletStaff(
  supabase: SupabaseClient,
  userId: string
): Promise<{ staff: OutletStaffProfile | null; error: string | null }> {
  const { data, error } = await supabase
    .from('outlet_staff')
    .select('id, outlet_id, name, role, status, outlets(name)')
    .eq('id', userId)
    .maybeSingle()

  if (error) return { staff: null, error: error.message }
  return { staff: (data as OutletStaffProfile) ?? null, error: null }
}

/** Outlet yang boleh diakses user (resolusi role) via fungsi DB accessible_outlet_ids(). */
export async function getAccessibleOutletIds(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data, error } = await supabase.rpc('accessible_outlet_ids')
  if (error || !data) return []
  // RPC SETOF uuid -> array of { accessible_outlet_ids: uuid } atau array uuid
  return (data as unknown[]).map((row) =>
    typeof row === 'string' ? row : (row as { accessible_outlet_ids: string }).accessible_outlet_ids
  )
}
```

- [ ] **Step 2: Type-check**

Run: `yarn workspace @suka/auth type-check`
Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add packages/auth/src/staff.ts
git commit -m "feat(auth): getOutletStaff & getAccessibleOutletIds"
```

---

### Task 5: `AuthProvider` + `useAuth` terpadu

**Files:**
- Create: `packages/auth/src/AuthProvider.tsx`

Menggantikan 4 AuthContext duplikat. Memuat sesi + profil staff, expose `staffError` (pola dari `apps/absensi`).

- [ ] **Step 1: Tulis provider**

`packages/auth/src/AuthProvider.tsx`:
```tsx
'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { OutletStaffProfile } from './types'
import { getOutletStaff } from './staff'

interface AuthContextType {
  session: Session | null
  user: Session['user'] | null
  outletStaff: OutletStaffProfile | null
  loading: boolean
  staffError: string | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{
  supabase: SupabaseClient
  children: React.ReactNode
}> = ({ supabase, children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<Session['user'] | null>(null)
  const [outletStaff, setOutletStaff] = useState<OutletStaffProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [staffError, setStaffError] = useState<string | null>(null)

  useEffect(() => {
    let initialised = false

    async function loadStaff(userId: string | undefined) {
      if (!userId) {
        setOutletStaff(null)
        setStaffError(null)
        return
      }
      const { staff, error } = await getOutletStaff(supabase, userId)
      if (error) {
        setStaffError(`Gagal memuat data staff: ${error}`)
        setOutletStaff(null)
      } else if (!staff) {
        setStaffError('Akun Anda belum terhubung dengan data staff. Hubungi admin / SPV.')
        setOutletStaff(null)
      } else {
        setStaffError(null)
        setOutletStaff(staff)
      }
    }

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
      await loadStaff(session?.user?.id)
      setLoading(false)
      initialised = true
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION' && initialised) return
        setSession(session)
        setUser(session?.user ?? null)
        await loadStaff(session?.user?.id)
      }
    )
    return () => subscription.unsubscribe()
  }, [supabase])

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setOutletStaff(null)
    setStaffError(null)
  }

  return (
    <AuthContext.Provider
      value={{ session, user, outletStaff, loading, staffError, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

- [ ] **Step 2: Type-check**

Run: `yarn workspace @suka/auth type-check`
Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add packages/auth/src/AuthProvider.tsx
git commit -m "feat(auth): AuthProvider & useAuth terpadu (supabase di-inject)"
```

---

### Task 6: Barrel export & verifikasi penuh

**Files:**
- Create: `packages/auth/src/index.ts`

- [ ] **Step 1: Tulis barrel**

`packages/auth/src/index.ts`:
```ts
export * from './types'
export * from './access'
export * from './staff'
export { createSupabaseBrowserClient } from './supabase-client'
export { createSupabaseServerClient } from './supabase-server'
export { AuthProvider, useAuth } from './AuthProvider'
```

- [ ] **Step 2: Jalankan test + type-check package**

Run:
```bash
yarn workspace @suka/auth test
yarn workspace @suka/auth type-check
```
Expected: test PASS, type-check tanpa error.

- [ ] **Step 3: Commit**

```bash
git add packages/auth/src/index.ts
git commit -m "feat(auth): barrel export @suka/auth"
```

---

## Self-Review

**Spec coverage (Bagian 7 spec — `packages/auth`):**
- `AuthProvider`/`useAuth` terpadu → Task 5 ✅
- `getOutletStaff` → Task 4 ✅
- `ROLE_APP_ACCESS` (satu sumber) → Task 2 ✅
- `requireRole`/`hasAppAccess` → Task 2 (`hasAppAccess`/`accessibleApps`) ✅
- `getAccessibleOutlets` (scope) → Task 4 (`getAccessibleOutletIds`) ✅
- `createSupabaseBrowserClient`/`createSupabaseServerClient` cookie-domain configurable → Task 3 ✅

**Placeholder scan:** tidak ada TBD. Versi dependency ditandai eksplisit "selaraskan dgn app existing" (Task 1 Step 1) — bukan placeholder, instruksi konkret.

**Type consistency:** `Role`, `AppName`, `OutletStaffProfile` didefinisikan di `types.ts` (Task 2) dan dipakai konsisten di `access.ts`, `staff.ts`, `AuthProvider.tsx`. `getOutletStaff(supabase, userId)` signature sama di Task 4 (definisi) & Task 5 (pemakaian). `accessible_outlet_ids` (DB, Plan 1) dipanggil via `.rpc('accessible_outlet_ids')` di Task 4.

---

## Catatan Eksekusi

- **Nama fungsi RPC** harus persis `accessible_outlet_ids` (Plan 1 Task 3). Bentuk return SETOF uuid ditangani fleksibel di `getAccessibleOutletIds`.
- **`AuthProvider` meng-inject `supabase`** (tidak membuat client sendiri) agar tiap app pakai instance-nya — penting untuk konsistensi cookie domain.
- Jangan import komponen React di file yang diuji Vitest `node` environment (`access.test.ts` hanya logika murni) agar test ringan tanpa jsdom.
