# Plan 3 — `apps/portal`: SSO Login Portal & App Launcher

**Branch:** `docs/role-jobdesk-sso`  
**Depends on:** Plan 1 (DB foundation), Plan 2 (`@suka/auth` package)  
**Tujuan:** Buat app Next.js baru `apps/portal` sebagai satu-satunya halaman login dan launcher kartu per role. Semua app lain akan me-redirect ke sini bila session tidak ada.

---

## Konteks

- **Domain:** `app.sukashawarma.com` (subdomain baru)
- **Fungsi:** Login → detect role → tampilkan kartu app yang boleh diakses → klik kartu → buka subdomain app
- **Auth:** Supabase email+password (phase 1). Cookie domain `.sukashawarma.com` agar session shared ke semua subdomain.
- **Tidak ada** fitur app di sini — hanya login, launcher, logout global.
- **Stack:** Next.js 15 (app router), TypeScript, TailwindCSS — sama seperti app lain di monorepo.

---

## Task 1: Scaffold `apps/portal`

**File yang dibuat:**

### `apps/portal/package.json`
```json
{
  "name": "@suka/portal",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3010",
    "build": "next build",
    "start": "next start -p 3010",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@suka/auth": "*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.0.0"
  }
}
```

### `apps/portal/tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### `apps/portal/next.config.ts`
```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: false },
}

export default nextConfig
```

### `apps/portal/src/app/layout.tsx`
```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Suka Shawarma — Portal',
  description: 'Login & app launcher',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-gray-50 antialiased">{children}</body>
    </html>
  )
}
```

### `apps/portal/src/app/globals.css`
```css
@import "tailwindcss";
```

### `apps/portal/tailwind.config.ts`
```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
} satisfies Config
```

**Verifikasi:** `cd apps/portal && yarn type-check` lulus tanpa error.

**Commit:**
```bash
git add apps/portal/package.json apps/portal/tsconfig.json apps/portal/next.config.ts \
  apps/portal/src/app/layout.tsx apps/portal/src/app/globals.css apps/portal/tailwind.config.ts
git commit -m "feat(portal): scaffold apps/portal — Next.js 15 + @suka/auth"
```

---

## Task 2: Halaman Login (`/`)

Login dengan email + password. Setelah berhasil, redirect ke `/launcher`.

### `apps/portal/src/app/page.tsx`
```tsx
'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@suka/auth'

const supabase = createBrowserSupabaseClient()

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    router.push('/launcher')
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Suka Shawarma</h1>
          <p className="mt-1 text-sm text-gray-500">Masuk untuk melanjutkan</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                         focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                         focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          {error && (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white
                       hover:bg-orange-600 disabled:opacity-60"
          >
            {loading ? 'Memproses…' : 'Masuk'}
          </button>
        </form>
      </div>
    </main>
  )
}
```

**Verifikasi:** Type-check lulus.

**Commit:**
```bash
git add apps/portal/src/app/page.tsx
git commit -m "feat(portal): halaman login email+password → redirect /launcher"
```

---

## Task 3: Middleware Guard

Redirect user yang belum login ke `/`, dan user yang sudah login di `/` ke `/launcher`.

### `apps/portal/src/middleware.ts`
```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@suka/auth'

export async function middleware(request: NextRequest) {
  const { supabase, response } = createServerSupabaseClient(request)
  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // Already logged in → skip login page
  if (session && pathname === '/') {
    return NextResponse.redirect(new URL('/launcher', request.url))
  }

  // Not logged in → force to login
  if (!session && pathname !== '/') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

**Verifikasi:** Type-check lulus.

**Commit:**
```bash
git add apps/portal/src/middleware.ts
git commit -m "feat(portal): middleware guard — login redirect & session protection"
```

---

## Task 4: App Launcher (`/launcher`)

Ambil profil user, tampilkan kartu app sesuai role.

### `apps/portal/src/app/launcher/page.tsx`
```tsx
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, getOutletStaff, accessibleApps } from '@suka/auth'
import type { AppName } from '@suka/auth'
import LogoutButton from '@/components/LogoutButton'
import AppCard from '@/components/AppCard'

// Metadata per app — label, url prod, deskripsi singkat
const APP_META: Record<AppName, { label: string; url: string; desc: string }> = {
  portal:          { label: 'Portal',           url: 'https://app.sukashawarma.com',          desc: 'Halaman utama' },
  stok:            { label: 'Stok',             url: 'https://stok.sukashawarma.com',          desc: 'Monitoring & ledger stok' },
  absensi:         { label: 'Absensi',          url: 'https://absensi.sukashawarma.com',       desc: 'Presensi karyawan' },
  distribusi:      { label: 'Distribusi',       url: 'https://distribusi.sukashawarma.com',    desc: 'Pengiriman & surat jalan' },
  'pos-kasir':     { label: 'POS Kasir',        url: 'https://kasir.sukashawarma.com',         desc: 'Point of Sale' },
  'owner-dashboard': { label: 'Owner Dashboard', url: 'https://owner.sukashawarma.com',        desc: 'Laporan omzet & analitik' },
}

export default async function LauncherPage() {
  const cookieStore = await cookies()

  // Build a minimal request-like adapter for server client
  const supabaseServer = createServerSupabaseClient({
    get: (name: string) => ({ name, value: cookieStore.get(name)?.value ?? '' }),
    getAll: () => cookieStore.getAll(),
    set: () => {},
    delete: () => {},
  } as any)

  const { data: { user } } = await supabaseServer.auth.getUser()
  if (!user) redirect('/')

  const staff = await getOutletStaff(supabaseServer, user.id)
  if (!staff) redirect('/')

  const apps = accessibleApps(staff.role).filter(a => a !== 'portal')

  return (
    <main className="min-h-screen p-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Selamat datang, {staff.name}</h1>
          <p className="text-sm text-gray-500 capitalize">{staff.role.replace('_', ' ')}</p>
        </div>
        <LogoutButton />
      </header>

      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-gray-400">
          Aplikasi kamu
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map(appName => {
            const meta = APP_META[appName]
            return <AppCard key={appName} label={meta.label} url={meta.url} desc={meta.desc} />
          })}
        </div>
      </section>
    </main>
  )
}
```

### `apps/portal/src/components/AppCard.tsx`
```tsx
interface Props {
  label: string
  url:   string
  desc:  string
}

export default function AppCard({ label, url, desc }: Props) {
  return (
    <a
      href={url}
      className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm
                 transition hover:border-orange-400 hover:shadow-md"
    >
      <p className="font-semibold text-gray-900">{label}</p>
      <p className="mt-1 text-sm text-gray-500">{desc}</p>
    </a>
  )
}
```

### `apps/portal/src/components/LogoutButton.tsx`
```tsx
'use client'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@suka/auth'

const supabase = createBrowserSupabaseClient()

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700
                 hover:border-gray-400 hover:bg-gray-50"
    >
      Keluar
    </button>
  )
}
```

**Verifikasi:** `yarn type-check` lulus.

**Commit:**
```bash
git add apps/portal/src/app/launcher/page.tsx \
  apps/portal/src/components/AppCard.tsx \
  apps/portal/src/components/LogoutButton.tsx
git commit -m "feat(portal): launcher page — kartu app per role + logout global"
```

---

## Task 5: `.env.local` template & README deploy

### `apps/portal/.env.local.example`
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com
# Kosongkan NEXT_PUBLIC_COOKIE_DOMAIN untuk dev lokal (cookie per-port)
```

### `apps/portal/README.md`
```markdown
# Portal — Suka Shawarma

Login tunggal + app launcher per role.

## Dev lokal

```bash
cp .env.local.example .env.local
# Isi NEXT_PUBLIC_SUPABASE_URL & ANON_KEY
# Biarkan NEXT_PUBLIC_COOKIE_DOMAIN kosong saat lokal
yarn dev   # http://localhost:3010
```

## Deploy (cPanel)

1. Buat subdomain `app.sukashawarma.com` → docroot otomatis
2. Setup Node.js App: root = subdomain folder, startup = `server.cjs`
3. Upload `.env.local` (berisi service key — jangan echo di terminal)
4. Install + build dari monorepo root:
   ```bash
   cd /home/sukashaw/suka-app && npm install
   cd apps/portal && npm run build
   ```
5. Buat `server.cjs` di docroot (lihat CLAUDE.md pola deploy cPanel)
6. Set env `NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com` di panel Node app
7. SAVE → RESTART
```

**Commit:**
```bash
git add apps/portal/.env.local.example apps/portal/README.md
git commit -m "docs(portal): env template & README deploy cPanel"
```

---

## Task 6: Daftarkan portal di workspace root

Tambahkan `apps/portal` ke `workspaces` di `package.json` root (atau `pnpm-workspace.yaml` / `turbo.json`) supaya `yarn dev` bisa jalankan semua sekaligus.

### Edit `package.json` (root) — tambah entry
```json
"workspaces": [
  "apps/*",
  "packages/*"
]
```
*(kalau sudah pakai glob `apps/*` ini sudah covered — verifikasi dulu)*

### Edit `turbo.json` (bila ada) — tidak perlu perubahan (pipeline sudah catch semua `apps/*`)

**Verifikasi:**
```bash
yarn workspaces info | grep portal
# → @suka/portal: "apps/portal"
```

**Commit:**
```bash
git add package.json   # hanya bila ada perubahan
git commit -m "chore(workspace): register apps/portal di monorepo"
```

---

## Ringkasan Deliverable

| File | Keterangan |
|------|-----------|
| `apps/portal/package.json` | App `@suka/portal`, dep `@suka/auth` |
| `apps/portal/next.config.ts` | Config standar |
| `apps/portal/src/app/layout.tsx` | Root layout |
| `apps/portal/src/app/page.tsx` | Halaman login (email+pw) |
| `apps/portal/src/middleware.ts` | Guard: belum login → `/`, sudah login di `/` → `/launcher` |
| `apps/portal/src/app/launcher/page.tsx` | Launcher kartu per role (server component) |
| `apps/portal/src/components/AppCard.tsx` | Kartu app |
| `apps/portal/src/components/LogoutButton.tsx` | Logout global (client) |
| `apps/portal/.env.local.example` | Template env |

**Cookie domain** dikontrol oleh `NEXT_PUBLIC_COOKIE_DOMAIN` dari `@suka/auth` — kosong = lokal, `.sukashawarma.com` = produksi SSO aktif.

---

## Pre-deploy Checklist

- [ ] Plan 1 migrations sudah di-push ke Supabase
- [ ] `packages/auth` (Plan 2) sudah di-install di workspace (`yarn`)
- [ ] `NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com` di-set di panel Node app
- [ ] DNS A record `app` → `103.77.106.237` sudah dibuat di Zone Editor cPanel
- [ ] Test via `curl -sk --resolve app.sukashawarma.com:443:103.77.106.237 https://app.sukashawarma.com/`
