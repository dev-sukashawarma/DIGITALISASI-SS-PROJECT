# Plan 4 — Integrasi 5 App Existing ke SSO

**Branch:** `docs/role-jobdesk-sso`  
**Depends on:** Plan 1 (DB), Plan 2 (`@suka/auth`), Plan 3 (portal berjalan)  
**Tujuan:** Ganti AuthContext duplikat + Supabase client ad-hoc di 5 app dengan `@suka/auth`. Tambahkan middleware guard yang redirect ke portal bila tidak ada session. Setiap app tidak lagi punya login form sendiri.

**5 app yang diintegrasikan:**
1. `apps/stok`
2. `apps/absensi`
3. `apps/distribusi`
4. `apps/owner-dashboard`
5. `apps/pos-kasir`

---

## Pola Standar (berlaku untuk semua app)

Setiap app melakukan perubahan yang sama:

### A. Tambah dependency `@suka/auth`
```json
// package.json
"dependencies": {
  "@suka/auth": "*",
  ...
}
```

### B. Ganti `AuthContext` lama dengan `AuthProvider` dari `@suka/auth`
```tsx
// src/app/layout.tsx (atau app/layout.tsx)
import { createBrowserSupabaseClient, AuthProvider } from '@suka/auth'
const supabase = createBrowserSupabaseClient()

export default function RootLayout({ children }) {
  return (
    <html><body>
      <AuthProvider supabase={supabase}>{children}</AuthProvider>
    </body></html>
  )
}
```

### C. Ganti semua `useAuth` / `useSupabase` / context lokal
```tsx
// Sebelum
import { useAuth } from '@/context/AuthContext'
// Sesudah
import { useAuth } from '@suka/auth'
```

### D. Tambah / perbarui `middleware.ts`
```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@suka/auth'

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.sukashawarma.com'

export async function middleware(request: NextRequest) {
  const { supabase, response } = createServerSupabaseClient(request)
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.redirect(new URL(PORTAL_URL, request.url))
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login).*)'],
}
```

### E. Hapus / redirect halaman `/login` lama
```tsx
// src/app/login/page.tsx
import { redirect } from 'next/navigation'
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.sukashawarma.com'
export default function LoginPage() { redirect(PORTAL_URL) }
```

### F. Tambah env var
```env
NEXT_PUBLIC_PORTAL_URL=https://app.sukashawarma.com
NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com
```

---

## Task 1: `apps/stok` — integrasi `@suka/auth`

**File yang diubah:**
- `apps/stok/package.json` — tambah `@suka/auth: "*"`
- `apps/stok/src/app/layout.tsx` — pakai `AuthProvider`
- `apps/stok/src/middleware.ts` — buat / perbarui redirect ke portal
- `apps/stok/src/app/login/page.tsx` — redirect ke portal (bila ada)
- Setiap file yang import `useAuth` dari context lokal → ganti ke `@suka/auth`

**Cek file context lama:**
```bash
grep -r "AuthContext\|useAuth\|useSupabase" apps/stok/src --include="*.ts" --include="*.tsx" -l
```

**Verifikasi:** `cd apps/stok && yarn type-check` lulus.

**Commit:**
```bash
git add apps/stok/
git commit -m "feat(stok): integrasi @suka/auth — AuthProvider + middleware SSO guard"
```

---

## Task 2: `apps/absensi` — integrasi `@suka/auth`

**Konteks khusus:** `absensi` punya `AuthContext.tsx` sendiri (terlihat di gitStatus). Hapus file ini setelah semua consumer diganti.

**File yang diubah:**
- `apps/absensi/package.json`
- `apps/absensi/src/app/layout.tsx`
- `apps/absensi/src/context/AuthContext.tsx` — **hapus** setelah tidak ada import
- `apps/absensi/src/app/login/page.tsx` — redirect ke portal
- `apps/absensi/src/middleware.ts` atau buat baru
- Semua consumer `useAuth` lokal

**Cek consumer:**
```bash
grep -r "AuthContext\|useAuth" apps/absensi/src --include="*.ts" --include="*.tsx" -l
```

**Perhatian:** `absensi` punya mode kiosk (face recognition). Kiosk role sudah terdaftar di `ROLE_APP_ACCESS`. Middleware absensi boleh izinkan path `/kiosk` tanpa redirect portal (kiosk login sendiri via PIN/QR di dalam app).

**Middleware khusus absensi:**
```ts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|kiosk).*)'],
}
```

**Verifikasi:** `cd apps/absensi && yarn type-check` lulus.

**Commit:**
```bash
git add apps/absensi/
git commit -m "feat(absensi): integrasi @suka/auth — hapus AuthContext lokal, kiosk path dikecualikan"
```

---

## Task 3: `apps/distribusi` — integrasi `@suka/auth`

**Konteks khusus:** `distribusi` punya `AuthContext.tsx` dan `Header.tsx` / `Sidebar.tsx` (terlihat di gitStatus — mungkin menampilkan info user). Pastikan `useAuth` di layout komponen diganti ke `@suka/auth`.

**File yang diubah:**
- `apps/distribusi/package.json`
- `apps/distribusi/src/app/layout.tsx`
- `apps/distribusi/src/context/AuthContext.tsx` — **hapus**
- `apps/distribusi/src/app/login/page.tsx` — redirect ke portal
- `apps/distribusi/src/components/layout/Header.tsx` — ganti import `useAuth`
- `apps/distribusi/src/components/layout/Sidebar.tsx` — ganti import `useAuth`
- `apps/distribusi/src/middleware.ts` atau buat baru

**Cek consumer:**
```bash
grep -r "AuthContext\|useAuth" apps/distribusi/src --include="*.ts" --include="*.tsx" -l
```

**Verifikasi:** `cd apps/distribusi && yarn type-check` lulus.

**Commit:**
```bash
git add apps/distribusi/
git commit -m "feat(distribusi): integrasi @suka/auth — AuthProvider + SSO guard"
```

---

## Task 4: `apps/owner-dashboard` — integrasi `@suka/auth`

**Konteks khusus:** `owner-dashboard` akses khusus role `owner` + `admin`. Setelah SSO guard, tambahkan role guard di middleware atau di page:

```ts
// middleware.ts
import { getOutletStaff } from '@suka/auth'

export async function middleware(request: NextRequest) {
  const { supabase, response } = createServerSupabaseClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return NextResponse.redirect(new URL(PORTAL_URL, request.url))
  
  const staff = await getOutletStaff(supabase, user.id)
  if (!staff || !['owner', 'admin'].includes(staff.role)) {
    return NextResponse.redirect(new URL(PORTAL_URL, request.url))
  }
  
  return response
}
```

**File yang diubah:**
- `apps/owner-dashboard/package.json`
- `apps/owner-dashboard/src/app/layout.tsx`
- `apps/owner-dashboard/src/middleware.ts` — buat dengan role guard
- Semua consumer `useAuth` lokal

**Verifikasi:** `cd apps/owner-dashboard && yarn type-check` lulus.

**Commit:**
```bash
git add apps/owner-dashboard/
git commit -m "feat(owner-dashboard): integrasi @suka/auth — SSO guard + role guard owner/admin"
```

---

## Task 5: `apps/pos-kasir` — integrasi `@suka/auth` + migrasi `profiles → outlet_staff`

**Konteks khusus (paling kompleks):**
- pos-kasir sebelumnya pakai tabel `profiles` langsung
- Setelah Plan 1 migration: `profiles` sudah jadi VIEW di atas `outlet_staff`
- Query `profiles` masih kompatibel via compat view — tidak perlu ganti semua query sekarang
- Yang harus diganti: Supabase client (`lib/supabase/client.ts`, `lib/supabase/server.ts`) → pakai `@suka/auth`
- Cookie domain wajib di-set: SSO butuh `.sukashawarma.com`

**File yang diubah:**
- `apps/pos-kasir/package.json` — tambah `@suka/auth: "*"`
- `apps/pos-kasir/lib/supabase/client.ts` — ganti dengan `createBrowserSupabaseClient` dari `@suka/auth`
- `apps/pos-kasir/lib/supabase/server.ts` — ganti dengan `createServerSupabaseClient` dari `@suka/auth`
- `apps/pos-kasir/middleware.ts` — tambah redirect ke portal bila tidak ada session
- `apps/pos-kasir/app/login/page.tsx` — redirect ke portal

**Contoh `lib/supabase/client.ts` baru:**
```ts
// Re-export from @suka/auth untuk backward compat internal pos-kasir
export { createBrowserSupabaseClient as createClient } from '@suka/auth'
```

**Contoh `lib/supabase/server.ts` baru:**
```ts
export { createServerSupabaseClient as createClient } from '@suka/auth'
```

**Middleware pos-kasir (kiosk dikecualikan):**
```ts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|kiosk).*)'],
}
```

**Catatan:** Query yang masih pakai `profiles` table akan tetap bekerja via compat VIEW dari Plan 1. Migrasi penuh `profiles → outlet_staff` di seluruh codebase pos-kasir adalah task terpisah (backlog).

**Verifikasi:** `cd apps/pos-kasir && yarn type-check` lulus.

**Commit:**
```bash
git add apps/pos-kasir/package.json apps/pos-kasir/lib/supabase/ \
  apps/pos-kasir/middleware.ts apps/pos-kasir/app/login/
git commit -m "feat(pos-kasir): integrasi @suka/auth — cookie domain + SSO guard, profiles compat view"
```

---

## Task 6: Root `package.json` — env var dokumentasi

Tambahkan ke `.env.local.example` root (bila ada) atau dokumentasikan env yang perlu di-set per app:

```env
# Wajib di semua apps untuk SSO
NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com
NEXT_PUBLIC_PORTAL_URL=https://app.sukashawarma.com

# Per-app (tidak berubah)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

**Verifikasi akhir — type-check semua:**
```bash
yarn type-check
```

**Commit:**
```bash
git add .env.local.example  # bila ada
git commit -m "chore: dokumentasi env SSO wajib (NEXT_PUBLIC_COOKIE_DOMAIN, PORTAL_URL)"
```

---

## Ringkasan Perubahan Per App

| App | AuthContext dihapus | Login redirect | Middleware | Role guard |
|-----|---------------------|---------------|------------|------------|
| `stok` | Ya (bila ada) | Ya → portal | SSO | Tidak (semua authenticated) |
| `absensi` | Ya | Ya → portal | SSO (kiosk dikecualikan) | Tidak |
| `distribusi` | Ya | Ya → portal | SSO | Tidak |
| `owner-dashboard` | Ya (bila ada) | Ya → portal | SSO + role owner/admin | Ya |
| `pos-kasir` | Supabase client re-export | Ya → portal | SSO (kiosk dikecualikan) | Tidak |

---

## Checklist Pre-Merge

- [ ] Semua 5 app `yarn type-check` lulus
- [ ] `yarn type-check` root lulus
- [ ] Plan 1 migrations sudah di-push ke Supabase
- [ ] `packages/auth` (Plan 2) ter-install di workspace
- [ ] Portal (Plan 3) sudah deploy di `app.sukashawarma.com`
- [ ] Test manual: buka `stok.sukashawarma.com` tanpa login → redirect ke portal → login → kembali ke stok ✓
- [ ] Test manual: logout dari portal → semua app ikut logout (cookie dihapus) ✓
- [ ] `pos-kasir` kiosk flow masih bekerja (path `/kiosk` tidak ter-intercept) ✓

---

## Pasca Plan 4 — Backlog

- Migrasi penuh pos-kasir dari `profiles` ke `outlet_staff` langsung (hapus compat view)
- Face recognition absensi: kiosk login flow disesuaikan dengan role `kiosk` di `outlet_staff`
- SPV penjualan: akses `owner-dashboard` sub-set read-only (FoodApps integration)
