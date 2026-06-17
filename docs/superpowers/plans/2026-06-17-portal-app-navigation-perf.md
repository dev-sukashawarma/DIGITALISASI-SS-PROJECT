# Optimasi Perpindahan Portal → App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pangkas perpindahan portal → app dari 5–6 round-trip Supabase + redirect berantai + cold-start menjadi 1 round-trip (staff untuk gate) tanpa redirect, dengan menjaga middleware sebagai satu-satunya gerbang akses.

**Architecture:** Perubahan inti di `@suka/auth` (dipakai semua app via `enforceAppAccess`): verifikasi JWT lokal menggantikan `getUser()` (0 RT auth), staff tepercaya diteruskan ke client via request header `x-suka-staff` (hilangkan re-fetch di client), dan rewrite `/`→`/dashboard` di middleware (hilangkan redirect 307 berantai). `AuthProvider` menerima `initialStaff` dan race-nya diperbaiki. Anti cold-start ditangani lewat ops (PassengerMinInstances + keepalive cron).

**Tech Stack:** TypeScript, Next.js 15 (app router) middleware + RSC, `@supabase/ssr`, `jose` (verifikasi JWT HS256), vitest. Scope 4 app seragam: `stok`, `distribusi`, `absensi`, `owner-dashboard`. `pos-kasir` dikecualikan.

---

## File Structure

**`@suka/auth` (paket bersama):**
- Create `packages/auth/src/jwt.ts` — `verifyAccessToken(token, secret)`, verifikasi HS256 lokal.
- Create `packages/auth/src/jwt.test.ts` — unit test verifikasi token.
- Create `packages/auth/src/staff-header.ts` — `STAFF_HEADER`, `serializeStaffHeader`, `parseStaffHeader`.
- Create `packages/auth/src/staff-header.test.ts` — unit test serialisasi/parse + anti-spoof.
- Modify `packages/auth/src/middleware.ts` — JWT lokal + fallback, strip & set header staff, opsi `rootRewritePath`.
- Modify `packages/auth/src/AuthProvider.tsx` — prop `initialStaff`, skip fetch pertama, fix race.
- Modify `packages/auth/src/index.ts` — ekspor `jwt` & `staff-header`.
- Modify `packages/auth/package.json` — tambah dependency `jose`.

**Per app (×4: stok, distribusi, absensi, owner-dashboard):**
- Modify `apps/<app>/src/app/layout.tsx` — async, baca header staff → `initialStaff`.
- Modify `apps/<app>/src/app/Providers.tsx` — terima & teruskan `initialStaff`.
- Modify `apps/<app>/src/middleware.ts` — `enforceAppAccess(request, '<app>', { rootRewritePath: '/dashboard' })`.
- Delete `apps/<app>/src/app/page.tsx` — `/` kini di-rewrite ke `/dashboard` oleh middleware.
- Env `SUPABASE_JWT_SECRET` di `.env.local` + panel produksi.

**Ops:**
- Create `scripts/keepalive.sh` — cron ping anti cold-start.
- Modify `DEPLOY-CPANEL.md` — dokumentasi `SUPABASE_JWT_SECRET`, `PassengerMinInstances`, keepalive.

---

## Task 1: `verifyAccessToken` di @suka/auth

**Files:**
- Modify: `packages/auth/package.json`
- Create: `packages/auth/src/jwt.ts`
- Test: `packages/auth/src/jwt.test.ts`

- [ ] **Step 1: Tambah dependency `jose`**

Edit `packages/auth/package.json`, di blok `"dependencies"` tambahkan baris (urut alfabet setelah `@supabase/supabase-js`):

```json
    "jose": "^5.9.0",
```

- [ ] **Step 2: Install**

Run (dari root repo): `yarn install`
Expected: selesai tanpa error; `node_modules/jose/package.json` ada.

- [ ] **Step 3: Tulis test yang gagal**

Create `packages/auth/src/jwt.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { SignJWT } from 'jose'
import { verifyAccessToken } from './jwt'

const SECRET = 'super-secret-jwt-key-for-tests-only'
const key = new TextEncoder().encode(SECRET)

async function makeToken(sub: string, expiresIn = '1h'): Promise<string> {
  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key)
}

describe('verifyAccessToken', () => {
  it('mengembalikan sub untuk token valid', async () => {
    const token = await makeToken('user-123')
    expect(await verifyAccessToken(token, SECRET)).toEqual({ sub: 'user-123' })
  })

  it('null untuk signature salah', async () => {
    const token = await makeToken('user-123')
    expect(await verifyAccessToken(token, 'secret-yang-salah')).toBeNull()
  })

  it('null untuk token kedaluwarsa', async () => {
    const token = await makeToken('user-123', '-1s')
    expect(await verifyAccessToken(token, SECRET)).toBeNull()
  })

  it('null untuk string sampah', async () => {
    expect(await verifyAccessToken('bukan.jwt', SECRET)).toBeNull()
  })
})
```

- [ ] **Step 4: Jalankan test, pastikan gagal**

Run: `cd packages/auth && yarn vitest run src/jwt.test.ts`
Expected: FAIL — `verifyAccessToken` belum ada.

- [ ] **Step 5: Implementasi**

Create `packages/auth/src/jwt.ts`:

```ts
import { jwtVerify } from 'jose'

/**
 * Verifikasi tanda tangan access token Supabase secara LOKAL (HS256) tanpa
 * panggilan jaringan ke Auth server. `exp` dicek otomatis oleh jose.
 * Kembalikan { sub } bila valid, null bila invalid/kedaluwarsa/sampah.
 */
export async function verifyAccessToken(
  token: string,
  secret: string
): Promise<{ sub: string } | null> {
  try {
    const key = new TextEncoder().encode(secret)
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] })
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null
    return { sub: payload.sub }
  } catch {
    return null
  }
}
```

- [ ] **Step 6: Jalankan test, pastikan lulus**

Run: `cd packages/auth && yarn vitest run src/jwt.test.ts`
Expected: PASS (4 test).

- [ ] **Step 7: Commit**

```bash
git add packages/auth/package.json packages/auth/src/jwt.ts packages/auth/src/jwt.test.ts yarn.lock
git commit -m "feat(auth): verifyAccessToken untuk verifikasi JWT lokal"
```

---

## Task 2: Helper header staff (`staff-header.ts`)

**Files:**
- Create: `packages/auth/src/staff-header.ts`
- Test: `packages/auth/src/staff-header.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

Create `packages/auth/src/staff-header.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { serializeStaffHeader, parseStaffHeader } from './staff-header'
import type { OutletStaffProfile } from './types'

const staff: OutletStaffProfile = {
  id: 'u1',
  outlet_id: 'o1',
  name: 'Andi Empang',
  role: 'crew',
  status: 'active',
  username: 'andi',
  ref_photo_url: null,
  outlets: { name: 'Outlet Empang' },
}

describe('staff-header', () => {
  it('round-trip serialize → parse', () => {
    expect(parseStaffHeader(serializeStaffHeader(staff))).toEqual(staff)
  })

  it('parse mengembalikan null untuk null/undefined/kosong', () => {
    expect(parseStaffHeader(null)).toBeNull()
    expect(parseStaffHeader(undefined)).toBeNull()
    expect(parseStaffHeader('')).toBeNull()
  })

  it('parse mengembalikan null untuk JSON rusak (anti-spoof sampah)', () => {
    expect(parseStaffHeader('%7Bbukan-json')).toBeNull()
  })

  it('hasil serialize aman sebagai nilai header (tanpa newline)', () => {
    const out = serializeStaffHeader({ ...staff, name: 'Baris\nBaru' })
    expect(out).not.toMatch(/[\r\n]/)
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd packages/auth && yarn vitest run src/staff-header.test.ts`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Implementasi**

Create `packages/auth/src/staff-header.ts`:

```ts
import type { OutletStaffProfile } from './types'

/** Nama header tempat middleware menaruh staff tepercaya untuk RSC/client. */
export const STAFF_HEADER = 'x-suka-staff'

/** Serialize staff menjadi nilai header yang aman (URI-encoded, tanpa newline). */
export function serializeStaffHeader(staff: OutletStaffProfile): string {
  return encodeURIComponent(JSON.stringify(staff))
}

/** Parse nilai header menjadi staff; null bila kosong/rusak. */
export function parseStaffHeader(
  value: string | null | undefined
): OutletStaffProfile | null {
  if (!value) return null
  try {
    return JSON.parse(decodeURIComponent(value)) as OutletStaffProfile
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `cd packages/auth && yarn vitest run src/staff-header.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/staff-header.ts packages/auth/src/staff-header.test.ts
git commit -m "feat(auth): helper serialize/parse header staff (anti-spoof)"
```

---

## Task 3: Ekspor modul baru dari index

**Files:**
- Modify: `packages/auth/src/index.ts`

- [ ] **Step 1: Tambah ekspor**

Edit `packages/auth/src/index.ts`, tambahkan dua baris setelah `export * from './staff'`:

```ts
export * from './jwt'
export * from './staff-header'
```

- [ ] **Step 2: Type-check**

Run: `cd packages/auth && yarn type-check`
Expected: 0 error.

- [ ] **Step 3: Commit**

```bash
git add packages/auth/src/index.ts
git commit -m "chore(auth): ekspor jwt & staff-header dari index"
```

---

## Task 4: Refactor `enforceAppAccess`

**Files:**
- Modify: `packages/auth/src/middleware.ts`

- [ ] **Step 1: Ganti seluruh isi `enforceAppAccess`**

Replace seluruh isi `packages/auth/src/middleware.ts` dengan:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from './supabase-server'
import { getOutletStaff } from './staff'
import { hasAppAccess } from './access'
import { verifyAccessToken } from './jwt'
import { STAFF_HEADER, serializeStaffHeader } from './staff-header'
import type { AppName } from './types'

/** URL portal untuk redirect saat akses ditolak; override via env per-app. */
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.sukashawarma.com'

/**
 * Gerbang akses tunggal untuk middleware sub-app SUKA.
 * Menolak (redirect ke portal) jika: belum login, role tak punya akses app,
 * atau status staff bukan `active`.
 *
 * Optimasi (lihat docs/.../2026-06-17-portal-app-navigation-perf):
 * - Identitas diverifikasi via JWT lokal (`SUPABASE_JWT_SECRET`) tanpa network;
 *   fallback ke `getUser()` bila secret belum di-set (lokal/dev).
 * - Staff tepercaya diteruskan ke RSC/client lewat header `x-suka-staff`
 *   (klien tidak bisa memalsukan: header dari request klien dihapus dulu).
 * - `rootRewritePath` me-rewrite `/` → mis. `/dashboard` (internal, tanpa 307)
 *   agar tak ada redirect berantai yang menggandakan middleware.
 */
export async function enforceAppAccess(
  request: NextRequest,
  app: AppName,
  options?: { rootRewritePath?: string }
): Promise<NextResponse> {
  // Anti-spoof: JANGAN pernah percaya header staff yang datang dari klien.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete(STAFF_HEADER)

  // Response sementara untuk menampung cookie yang di-refresh @supabase/ssr.
  const response = NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createSupabaseServerClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookies) => {
      cookies.forEach(({ name, value, options }) =>
        response.cookies.set(
          name,
          value,
          options as Parameters<typeof response.cookies.set>[2]
        )
      )
    },
  })

  const getRedirect = (url: string | URL) => {
    const redirectResponse = NextResponse.redirect(new URL(url, request.url))
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set({ ...cookie })
    })
    return redirectResponse
  }

  // --- Identitas: JWT lokal bila secret ada, fallback getUser() ---
  const jwtSecret = process.env.SUPABASE_JWT_SECRET
  let userId: string | null = null
  if (jwtSecret) {
    const { data: { session } } = await supabase.auth.getSession()
    const claims = session?.access_token
      ? await verifyAccessToken(session.access_token, jwtSecret)
      : null
    userId = claims?.sub ?? null
  } else {
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  }
  if (!userId) {
    return getRedirect(PORTAL_URL)
  }

  // --- Gate: role + status (1 RT DB; tetap dibutuhkan) ---
  const { staff } = await getOutletStaff(supabase, userId)
  if (!staff || !hasAppAccess(staff.role, app) || staff.status !== 'active') {
    return getRedirect(PORTAL_URL)
  }

  // Teruskan staff tepercaya ke RSC/client.
  requestHeaders.set(STAFF_HEADER, serializeStaffHeader(staff))

  // Rewrite root → dashboard (tanpa 307) bila diminta.
  const pass =
    options?.rootRewritePath && request.nextUrl.pathname === '/'
      ? NextResponse.rewrite(new URL(options.rootRewritePath, request.url), {
          request: { headers: requestHeaders },
        })
      : NextResponse.next({ request: { headers: requestHeaders } })

  // Salin cookie yang sempat di-refresh ke response final.
  response.cookies.getAll().forEach((cookie) => {
    pass.cookies.set({ ...cookie })
  })
  return pass
}
```

- [ ] **Step 2: Type-check**

Run: `cd packages/auth && yarn type-check`
Expected: 0 error.

- [ ] **Step 3: Commit**

```bash
git add packages/auth/src/middleware.ts
git commit -m "feat(auth): enforceAppAccess pakai JWT lokal + teruskan staff via header + rewrite root"
```

---

## Task 5: `AuthProvider` terima `initialStaff` & fix race

**Files:**
- Modify: `packages/auth/src/AuthProvider.tsx`

- [ ] **Step 1: Tambah prop `initialStaff` pada signature & state**

Edit `packages/auth/src/AuthProvider.tsx`. Ganti deklarasi komponen:

```tsx
export const AuthProvider: React.FC<{
  supabase: SupabaseClient
  children: React.ReactNode
}> = ({ supabase, children }) => {
```

menjadi:

```tsx
export const AuthProvider: React.FC<{
  supabase: SupabaseClient
  initialStaff?: OutletStaffProfile | null
  children: React.ReactNode
}> = ({ supabase, initialStaff = null, children }) => {
```

Lalu ganti inisialisasi state `outletStaff`:

```tsx
  const [outletStaff, setOutletStaff] = useState<OutletStaffProfile | null>(null)
```

menjadi:

```tsx
  const [outletStaff, setOutletStaff] = useState<OutletStaffProfile | null>(initialStaff)
```

- [ ] **Step 2: Skip fetch pertama bila staff sudah disuplai server**

Di dalam `init()`, ganti:

```tsx
        setSession(session)
        setUser(session?.user ?? null)
        await loadStaff(session?.user?.id)
        setLoading(false)
        initialised = true
```

menjadi:

```tsx
        setSession(session)
        setUser(session?.user ?? null)
        // Staff sudah disuplai server (header x-suka-staff) → hindari fetch ulang.
        if (!initialStaff) {
          await loadStaff(session?.user?.id)
        }
        setLoading(false)
        initialised = true
```

- [ ] **Step 3: Fix race — skip semua `INITIAL_SESSION`**

Ganti callback `onAuthStateChange`:

```tsx
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION' && initialised) return
        if (abortController.signal.aborted) return
        setSession(session)
        setUser(session?.user ?? null)
        await loadStaff(session?.user?.id)
      }
    )
```

menjadi:

```tsx
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // init() sudah menangani sesi awal; INITIAL_SESSION selalu di-skip
        // agar tak ada fetch staff ganda (race `initialised`).
        if (event === 'INITIAL_SESSION') return
        if (abortController.signal.aborted) return
        setSession(session)
        setUser(session?.user ?? null)
        await loadStaff(session?.user?.id)
      }
    )
```

Catatan: variabel `initialised` kini tak dipakai lagi di callback — biarkan deklarasinya (masih dipakai di `init()`), atau hapus jika linter mengeluh. Tidak wajib.

- [ ] **Step 4: Type-check**

Run: `cd packages/auth && yarn type-check`
Expected: 0 error.

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/AuthProvider.tsx
git commit -m "feat(auth): AuthProvider terima initialStaff + fix race INITIAL_SESSION"
```

---

## Task 6: Wiring per app — stok

**Files:**
- Modify: `apps/stok/src/app/layout.tsx`
- Modify: `apps/stok/src/app/Providers.tsx`
- Modify: `apps/stok/src/middleware.ts`
- Delete: `apps/stok/src/app/page.tsx`

- [ ] **Step 1: layout.tsx baca header staff**

Replace seluruh isi `apps/stok/src/app/layout.tsx` dengan:

```tsx
import { headers } from 'next/headers'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { Providers } from './Providers'
import './globals.css'

export const metadata = {
  title: 'Stok Bahan Baku — Sukashawarma',
  description: 'Opname, ledger, monitoring stok bahan baku',
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

- [ ] **Step 2: Providers.tsx teruskan initialStaff**

Replace seluruh isi `apps/stok/src/app/Providers.tsx` dengan:

```tsx
'use client'

import { ReactNode, useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'
import type { OutletStaffProfile } from '@suka/auth'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

export function Providers({
  children,
  initialStaff = null,
}: {
  children: ReactNode
  initialStaff?: OutletStaffProfile | null
}) {
  const queryClient = useMemo(() => new QueryClient(), [])
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AuthProvider supabase={supabase} initialStaff={initialStaff}>
          {children}
        </AuthProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 3: middleware.ts aktifkan rewrite root**

Replace isi `apps/stok/src/middleware.ts` bagian fungsi menjadi:

```ts
import { type NextRequest } from 'next/server'
import { enforceAppAccess } from '@suka/auth'

export function middleware(request: NextRequest) {
  return enforceAppAccess(request, 'stok', { rootRewritePath: '/dashboard' })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login).*)'],
}
```

- [ ] **Step 4: Hapus page.tsx (root kini di-rewrite ke /dashboard)**

Run: `git rm apps/stok/src/app/page.tsx`

- [ ] **Step 5: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error.

- [ ] **Step 6: Commit**

```bash
git add apps/stok/src/app/layout.tsx apps/stok/src/app/Providers.tsx apps/stok/src/middleware.ts
git commit -m "feat(stok): konsumsi initialStaff + rewrite root, hapus redirect"
```

---

## Task 7: Wiring per app — distribusi

**Files:**
- Modify: `apps/distribusi/src/app/layout.tsx`
- Modify: `apps/distribusi/src/app/Providers.tsx`
- Modify: `apps/distribusi/src/middleware.ts`
- Delete: `apps/distribusi/src/app/page.tsx`

- [ ] **Step 1: layout.tsx baca header staff**

Replace seluruh isi `apps/distribusi/src/app/layout.tsx` dengan:

```tsx
import { headers } from 'next/headers'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { Providers } from './Providers'
import './globals.css'

export const metadata = {
  title: 'Distribusi — Sukashawarma',
  description: 'Surat Jalan & verifikasi penerimaan dari gudang',
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
        <Providers initialStaff={initialStaff}>
          {children}
        </Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Providers.tsx teruskan initialStaff**

Replace seluruh isi `apps/distribusi/src/app/Providers.tsx` dengan:

```tsx
'use client'

import { useMemo } from 'react'
import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'
import type { OutletStaffProfile } from '@suka/auth'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

export function Providers({
  children,
  initialStaff = null,
}: {
  children: React.ReactNode
  initialStaff?: OutletStaffProfile | null
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  return (
    <ErrorBoundary>
      <AuthProvider supabase={supabase} initialStaff={initialStaff}>
        {children}
      </AuthProvider>
    </ErrorBoundary>
  )
}
```

- [ ] **Step 3: middleware.ts aktifkan rewrite root**

Replace isi `apps/distribusi/src/middleware.ts` dengan (sesuaikan matcher jika berbeda — periksa file asli dulu, pertahankan `config.matcher` yang ada):

```ts
import { type NextRequest } from 'next/server'
import { enforceAppAccess } from '@suka/auth'

export function middleware(request: NextRequest) {
  return enforceAppAccess(request, 'distribusi', { rootRewritePath: '/dashboard' })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login).*)'],
}
```

- [ ] **Step 4: Hapus page.tsx**

Run: `git rm apps/distribusi/src/app/page.tsx`

- [ ] **Step 5: Type-check**

Run: `cd apps/distribusi && yarn type-check`
Expected: 0 error.

- [ ] **Step 6: Commit**

```bash
git add apps/distribusi/src/app/layout.tsx apps/distribusi/src/app/Providers.tsx apps/distribusi/src/middleware.ts
git commit -m "feat(distribusi): konsumsi initialStaff + rewrite root, hapus redirect"
```

---

## Task 8: Wiring per app — absensi

**Files:**
- Modify: `apps/absensi/src/app/layout.tsx`
- Modify: `apps/absensi/src/app/Providers.tsx`
- Modify: `apps/absensi/src/middleware.ts`
- Delete: `apps/absensi/src/app/page.tsx`

- [ ] **Step 1: layout.tsx baca header staff**

Replace seluruh isi `apps/absensi/src/app/layout.tsx` dengan:

```tsx
import { headers } from 'next/headers'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { Providers } from './Providers'
import './globals.css'

export const metadata = {
  title: 'Absensi Outlet — Sukashawarma',
  description: 'Clock-in/out dengan face recognition untuk staff outlet',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialStaff = parseStaffHeader((await headers()).get(STAFF_HEADER))
  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased bg-slate-50 text-slate-900 selection:bg-suka-orange selection:text-white min-h-screen">
        <Providers initialStaff={initialStaff}>
          {children}
        </Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Providers.tsx teruskan initialStaff**

Replace seluruh isi `apps/absensi/src/app/Providers.tsx` dengan:

```tsx
'use client'

import { useMemo } from 'react'
import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'
import type { OutletStaffProfile } from '@suka/auth'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { ToastProvider } from '@/lib/feedback/toast'

export function Providers({
  children,
  initialStaff = null,
}: {
  children: React.ReactNode
  initialStaff?: OutletStaffProfile | null
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  return (
    <ErrorBoundary>
      <AuthProvider supabase={supabase} initialStaff={initialStaff}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
```

- [ ] **Step 3: middleware.ts aktifkan rewrite root**

Periksa `apps/absensi/src/middleware.ts` asli, pertahankan `config.matcher` yang ada, dan set pemanggilan menjadi:

```ts
import { type NextRequest } from 'next/server'
import { enforceAppAccess } from '@suka/auth'

export function middleware(request: NextRequest) {
  return enforceAppAccess(request, 'absensi', { rootRewritePath: '/dashboard' })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login).*)'],
}
```

- [ ] **Step 4: Hapus page.tsx**

Run: `git rm apps/absensi/src/app/page.tsx`

- [ ] **Step 5: Type-check**

Run: `cd apps/absensi && yarn type-check`
Expected: 0 error.

- [ ] **Step 6: Commit**

```bash
git add apps/absensi/src/app/layout.tsx apps/absensi/src/app/Providers.tsx apps/absensi/src/middleware.ts
git commit -m "feat(absensi): konsumsi initialStaff + rewrite root, hapus redirect"
```

---

## Task 9: Wiring per app — owner-dashboard

**Files:**
- Modify: `apps/owner-dashboard/src/app/layout.tsx`
- Modify: `apps/owner-dashboard/src/app/Providers.tsx`
- Modify: `apps/owner-dashboard/src/middleware.ts`
- Delete: `apps/owner-dashboard/src/app/page.tsx`

- [ ] **Step 1: layout.tsx baca header staff**

Replace seluruh isi `apps/owner-dashboard/src/app/layout.tsx` dengan:

```tsx
import { headers } from 'next/headers'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { Providers } from './Providers'
import './globals.css'

export const metadata = {
  title: 'Dashboard Owner — Sukashawarma',
  description: 'Reporting hub dengan analytics outlet',
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
        <Providers initialStaff={initialStaff}>
          {children}
        </Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Providers.tsx teruskan initialStaff**

Replace seluruh isi `apps/owner-dashboard/src/app/Providers.tsx` dengan:

```tsx
'use client'

import { useMemo } from 'react'
import { AuthProvider, createSupabaseBrowserClient } from '@suka/auth'
import type { OutletStaffProfile } from '@suka/auth'

export function Providers({
  children,
  initialStaff = null,
}: {
  children: React.ReactNode
  initialStaff?: OutletStaffProfile | null
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  return (
    <AuthProvider supabase={supabase} initialStaff={initialStaff}>
      {children}
    </AuthProvider>
  )
}
```

- [ ] **Step 3: middleware.ts aktifkan rewrite root**

Periksa `apps/owner-dashboard/src/middleware.ts` asli, pertahankan `config.matcher` yang ada, dan set pemanggilan menjadi:

```ts
import { type NextRequest } from 'next/server'
import { enforceAppAccess } from '@suka/auth'

export function middleware(request: NextRequest) {
  return enforceAppAccess(request, 'owner-dashboard', { rootRewritePath: '/dashboard' })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login).*)'],
}
```

- [ ] **Step 4: Hapus page.tsx**

Run: `git rm apps/owner-dashboard/src/app/page.tsx`

- [ ] **Step 5: Type-check**

Run: `cd apps/owner-dashboard && yarn type-check`
Expected: 0 error.

- [ ] **Step 6: Commit**

```bash
git add apps/owner-dashboard/src/app/layout.tsx apps/owner-dashboard/src/app/Providers.tsx apps/owner-dashboard/src/middleware.ts
git commit -m "feat(owner-dashboard): konsumsi initialStaff + rewrite root, hapus redirect"
```

---

## Task 10: Env `SUPABASE_JWT_SECRET` + dokumentasi

**Files:**
- Modify (lokal, tak di-commit): `apps/<app>/.env.local` ×4
- Modify: `DEPLOY-CPANEL.md`

- [ ] **Step 1: Set env lokal di tiap app**

Untuk tiap app (`stok`, `distribusi`, `absensi`, `owner-dashboard`), tambahkan ke `apps/<app>/.env.local` (JANGAN commit; nilai diambil dari Supabase Dashboard → Project Settings → API → JWT Secret):

```
SUPABASE_JWT_SECRET=<jwt-secret-dari-supabase>
```

Catatan: bila baris ini belum ada, `enforceAppAccess` otomatis fallback ke `getUser()` (aman, tetap berfungsi) — jadi langkah ini boleh menyusul tanpa memecah app.

- [ ] **Step 2: Dokumentasikan di DEPLOY-CPANEL.md**

Tambahkan section ke `DEPLOY-CPANEL.md` (di bagian env per-app):

```markdown
### Env optimasi auth (wajib untuk performa, opsional untuk fungsi)
- `SUPABASE_JWT_SECRET` — JWT Secret dari Supabase Dashboard (Project Settings → API).
  Membuat middleware memverifikasi token secara lokal (0 round-trip auth) alih-alih
  memanggil `getUser()` tiap request. Bila tidak di-set, app tetap jalan (fallback
  `getUser()`), hanya lebih lambat. Set di panel Node app tiap subdomain → SAVE → RESTART.
```

- [ ] **Step 3: Commit dokumentasi**

```bash
git add DEPLOY-CPANEL.md
git commit -m "docs(deploy): SUPABASE_JWT_SECRET untuk verifikasi JWT lokal"
```

---

## Task 11: Anti cold-start (keepalive + PassengerMinInstances)

**Files:**
- Create: `scripts/keepalive.sh`
- Modify: `DEPLOY-CPANEL.md`

- [ ] **Step 1: Buat skrip keepalive**

Create `scripts/keepalive.sh`:

```bash
#!/usr/bin/env bash
# Ping tiap subdomain SUKA agar instance Passenger tetap panas (hindari cold-start).
# Pakai --resolve ke IP publik: loopback server cPanel selalu balik defaultwebpage.
# Pasang sebagai cron tiap 5 menit:
#   */5 * * * * /home/sukashaw/suka-app/scripts/keepalive.sh >/dev/null 2>&1
set -u

IP="103.77.106.237"
DOMAINS=(
  "app.sukashawarma.com"
  "stok.sukashawarma.com"
  "distribusi.sukashawarma.com"
  "absensi.sukashawarma.com"
  "owner.sukashawarma.com"
)

for d in "${DOMAINS[@]}"; do
  curl -sk -o /dev/null --max-time 20 --resolve "${d}:443:${IP}" "https://${d}/" || true
done
```

- [ ] **Step 2: Set executable bit**

Run: `chmod +x scripts/keepalive.sh && git update-index --chmod=+x scripts/keepalive.sh`

- [ ] **Step 3: Dokumentasikan anti cold-start**

Tambahkan ke `DEPLOY-CPANEL.md`:

```markdown
### Anti cold-start
Passenger spawn on-demand → klik pertama ke app idle harus spawn Node (lambat).
Dua lapis pencegahan:
1. **PassengerMinInstances 1** — di `.htaccess` docroot tiap subdomain tambahkan
   `PassengerMinInstances 1` agar minimal 1 instance tetap hidup.
2. **Cron keepalive** — `scripts/keepalive.sh` ping tiap subdomain tiap 5 menit
   (cron: `*/5 * * * * /home/sukashaw/suka-app/scripts/keepalive.sh >/dev/null 2>&1`).
   Test via IP publik, bukan loopback.
```

- [ ] **Step 4: Commit**

```bash
git add scripts/keepalive.sh DEPLOY-CPANEL.md
git commit -m "ops: keepalive cron + PassengerMinInstances anti cold-start"
```

---

## Task 12: Verifikasi end-to-end

**Files:** —

- [ ] **Step 1: Test paket auth**

Run: `cd packages/auth && yarn vitest run`
Expected: semua test lulus (termasuk `access.test.ts`, `jwt.test.ts`, `staff-header.test.ts`).

- [ ] **Step 2: Type-check semua workspace**

Run (dari root): `yarn type-check`
Expected: 0 error di semua workspace.

- [ ] **Step 3: Build smoke per app**

Run untuk tiap app: `cd apps/stok && yarn build` (ulangi untuk distribusi, absensi, owner-dashboard).
Expected: build sukses; tidak ada error "page.tsx missing" untuk `/` (route `/` dilayani via rewrite middleware).

- [ ] **Step 4: Smoke test manual (dev)**

Untuk satu app (mis. stok), set `SUPABASE_JWT_SECRET` di `.env.local`, jalankan `yarn dev`, login lewat portal lalu klik kartu app. Verifikasi:
- Tidak ada respons 307 redirect `/` → `/dashboard` (cek tab Network).
- Dashboard ter-render tanpa flash "loading" panjang (staff sudah ter-seed dari header).
- Di Network, query `outlet_staff` dari client TIDAK terjadi saat load pertama (hanya yang dari middleware/server).
- Logout tetap berfungsi (memicu `onAuthStateChange` → state ter-reset).

- [ ] **Step 5: Commit (bila ada perbaikan dari smoke test)**

```bash
git add -A
git commit -m "test: verifikasi e2e optimasi perpindahan portal -> app"
```

---

## Catatan Eksekusi

- **Risiko `getSession()` refresh:** `getSession()` membaca cookie lokal; bila token kedaluwarsa SDK bisa memicu satu refresh jaringan. Ini normal dan jarang (sekali per masa token), bukan tiap request seperti `getUser()`.
- **`@suka/auth` di-impor sebagai TS source** (`main` → `src/index.ts`), jadi edit `src/` langsung berlaku tanpa `yarn build`. Bila ternyata ada app yang meng-impor dari `dist/`, jalankan `cd packages/auth && yarn build` setelah perubahan.
- **Urutan deploy produksi:** deploy `@suka/auth` + 4 app bersamaan (header `x-suka-staff` & rewrite bersifat self-contained per app). Set `SUPABASE_JWT_SECRET` di panel tiap subdomain → RESTART. Pasang `PassengerMinInstances 1` + cron keepalive.
- **pos-kasir:** tidak disentuh; gate absensi + optimasi pos-kasir = pekerjaan terpisah.
```
