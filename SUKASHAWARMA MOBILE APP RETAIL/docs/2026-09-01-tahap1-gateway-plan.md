# SukaShawarma APP — Rencana Implementasi Tahap 1a: Database & Retail Gateway

> **Untuk pekerja agentik:** SUB-SKILL WAJIB: pakai superpowers:subagent-driven-development (disarankan) atau superpowers:executing-plans untuk mengeksekusi rencana ini per-task. Langkah memakai checkbox (`- [ ]`) untuk pelacakan.

**Goal:** Membangun Retail Gateway di `apps/retail-gateway` plus perubahan database aditif, sehingga aplikasi Android nanti punya satu pintu API yang lengkap: login, katalog, validasi pra-bayar, pembayaran Xendit, dan pesanan yang benar-benar masuk ke layar kasir.

**Architecture:** Gateway adalah Next.js App Router yang berbicara ke Supabase produksi dengan service role. Aplikasi tidak pernah memegang kredensial database. Katalog disajikan dari cache dalam proses; database produksi hanya diketuk saat checkout, pembuatan pesanan, dan pembacaan status. Pesanan ditulis lewat RPC `atomic_insert_order` yang sudah dipakai POS kasir, sehingga bentuk pesanan aplikasi identik dengan pesanan kasir.

**Tech Stack:** Next.js 15 (App Router), TypeScript, `@supabase/supabase-js`, `jose` (JWT sesi), Xendit REST API, Vitest.

**Spec:** `SUKASHAWARMA MOBILE APP RETAIL/docs/2026-09-01-sukashawarma-app-design.md`

**Desain layar:** `SUKASHAWARMA MOBILE APP RETAIL/design/` (kanvas 16 layar)

## Global Constraints

- **Aplikasi tidak boleh memegang kredensial database apa pun.** Seluruh akses lewat Gateway dengan service role. Tidak ada anon key di APK.
- **Pesanan hanya ditulis lewat RPC `atomic_insert_order`.** Jangan `INSERT` langsung ke `orders`/`order_items` — RPC itu yang menjamin atomisitas order+item dan fallback saat `menu_item_id` hilang.
- **`order_number` tidak pernah dikirim dari kode kita.** Trigger database yang menetapkannya secara atomik.
- **Idempotensi lewat `orders.client_order_id`** (uuid, berkendala unik). Error Postgres `23505` pada kolom ini bukan kegagalan — itu tanda percobaan kembar, ambil pemenangnya.
- **`client_order_id` adalah kunci SEKALI PAKAI, bukan id keranjang.** Kontrak untuk aplikasi Android (Tahap 1b): buat UUID baru setiap kali pelanggan menekan bayar. Bila gateway membalas 409 `pesanan_kadaluarsa`, aplikasi **wajib** membuat id baru sebelum mencoba lagi. Bila membalas 409 `pesanan_sedang_diproses`, aplikasi menunggu sebentar lalu mengulang dengan id **yang sama**. Memakai satu id seumur hidup keranjang akan mengunci pelanggan begitu draft pertamanya kedaluwarsa — dan cron menghanguskan draft tak dibayar tiap 15 menit, jadi itu kejadian rutin.
- **Catatan per item ditulis dengan konvensi yang sudah ada:** `menu_item_name` = `` `${nama}|NOTE|${catatan}` `` bila ada catatan. Jangan menciptakan format baru — struk dapur membacanya begitu.
- **Pesanan hanya dikirim ke kasir setelah webhook Xendit mengonfirmasi pembayaran.** Klaim dari aplikasi tidak pernah dipercaya.
- **Total yang dihitung Gateway adalah yang mengikat.** Total dari aplikasi hanya untuk ditampilkan.
- **Semua perubahan database bersifat aditif.** Tidak boleh mengubah atau menghapus kolom, policy, trigger, atau fungsi yang sudah dipakai POS/stok/absensi.
- **Secret server-only WAJIB di-`ARG`+`ENV` ulang di stage `runner` Dockerfile**, bukan hanya di `builder`. Docker tidak membawa env lintas stage; ini penyebab insiden "supabaseKey is required" 2026-08-13.
- **Cache mount BuildKit wajib ber-`id` eksplisit** (`id=yarn-cache-v3,sharing=locked`) agar build konkuren di Coolify tidak saling merusak cache.
- Semua teks yang mungkin sampai ke pengguna berbahasa **Indonesia**.
- Jangan pakai `.single()` pada query yang bisa kosong — pakai `.maybeSingle()`.

---

## Struktur File

| File | Tanggung jawab |
|---|---|
| `apps/retail-gateway/package.json` | Manifest workspace; setiap dependency yang dipakai WAJIB dideklarasikan di sini (build Docker hanya menyalin manifest app ini) |
| `apps/retail-gateway/Dockerfile` | Build 2 tahap; secret server-only di-declare ulang di stage runner |
| `apps/retail-gateway/src/lib/supabase.ts` | Satu-satunya pembuat client service-role |
| `apps/retail-gateway/src/lib/session.ts` | Menerbitkan & memverifikasi token sesi pelanggan (fungsi murni + jose) |
| `apps/retail-gateway/src/lib/auth.ts` | `requireCustomer(request)` — gerbang setiap endpoint privat |
| `apps/retail-gateway/src/lib/catalog.ts` | Cache katalog dalam proses + pengambilan dari database |
| `apps/retail-gateway/src/lib/pricing.ts` | **Murni.** Hitung subtotal, diskon, total. Tidak menyentuh jaringan |
| `apps/retail-gateway/src/lib/pickupCode.ts` | **Murni.** Bentuk kode ambil 4 digit dari uuid |
| `apps/retail-gateway/src/lib/orderPayload.ts` | **Murni.** Susun `p_order`/`p_items` untuk `atomic_insert_order` |
| `apps/retail-gateway/src/lib/xendit.ts` | Adapter pembayaran; satu-satunya tempat yang tahu Xendit |
| `apps/retail-gateway/src/app/api/v1/auth/google/route.ts` | Tukar Google ID token jadi sesi |
| `apps/retail-gateway/src/app/api/v1/catalog/route.ts` | Katalog per outlet dari cache |
| `apps/retail-gateway/src/app/api/v1/outlets/route.ts` | Daftar outlet yang ikut program app |
| `apps/retail-gateway/src/app/api/v1/checkout/validate/route.ts` | Validasi pra-bayar (4 pemeriksaan) |
| `apps/retail-gateway/src/app/api/v1/orders/route.ts` | Buat draft + tagihan Xendit |
| `apps/retail-gateway/src/app/api/v1/orders/[id]/route.ts` | Status pesanan + kode ambil |
| `apps/retail-gateway/src/app/api/webhooks/xendit/route.ts` | Terima konfirmasi bayar, dorong ke kasir |
| `apps/retail-gateway/src/app/api/cron/expire-drafts/route.ts` | Hanguskan draft yang tidak dibayar |
| `supabase/migrations/20300119000000_retail_app_tahap1.sql` | Seluruh perubahan database aditif |

**Catatan penomoran migration:** repo ini punya migration bertimestamp 2030 yang selalu jalan paling akhir. Migration baru **harus** bernomor setelahnya (`20300107...`) agar tidak ditimpa. Sebelum menyentuh fungsi database apa pun, jalankan `grep -rn "<nama_fungsi>" supabase/migrations/`.

---

## Task 1: Migration database aditif

**Files:**
- Create: `supabase/migrations/20300119000000_retail_app_tahap1.sql`

**Interfaces:**
- Consumes: tabel existing `orders`, `menu_items`, `outlets`
- Produces: skema `retail` dengan tabel `retail.customers` dan `retail.order_drafts`; kolom `menu_items.tampil_di_app`, `menu_items.foto_app`, `menu_items.deskripsi_app`, `outlets.app_enabled`, `orders.pickup_code`

- [ ] **Step 1: Tulis migration**

```sql
-- supabase/migrations/20300119000000_retail_app_tahap1.sql
-- Tahap 1 SukaShawarma APP. SELURUHNYA ADITIF.
-- Tidak mengubah kolom, policy, trigger, atau fungsi yang sudah dipakai
-- POS kasir, stok, atau absensi.

-- 1. Kolom tampilan aplikasi di menu_items -------------------------------
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS tampil_di_app boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS foto_app text,
  ADD COLUMN IF NOT EXISTS deskripsi_app text;

COMMENT ON COLUMN public.menu_items.tampil_di_app IS
  'Item muncul di SukaShawarma APP. Default false: item baru tidak otomatis terbit ke publik.';

-- 2. Penanda keikutsertaan outlet ---------------------------------------
ALTER TABLE public.outlets
  ADD COLUMN IF NOT EXISTS app_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.outlets.app_enabled IS
  'Outlet melayani pesanan dari aplikasi pelanggan. Pilot: nyalakan 2-3 outlet saja.';

-- 3. Kode pengambilan di orders -----------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_code text;

CREATE INDEX IF NOT EXISTS orders_pickup_code_idx
  ON public.orders (outlet_id, pickup_code)
  WHERE pickup_code IS NOT NULL;

-- 4. Skema retail --------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS retail;

CREATE TABLE IF NOT EXISTS retail.customers (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name text,
  email text,
  phone text,
  phone_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS retail.order_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_order_id uuid NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES retail.customers (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.outlets (id),
  items jsonb NOT NULL,
  subtotal numeric NOT NULL,
  discount_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL,
  pickup_code text NOT NULL,
  status text NOT NULL DEFAULT 'menunggu_bayar'
    CHECK (status IN ('menunggu_bayar', 'dibayar', 'kadaluarsa', 'gagal')),
  payment_ref text,
  payment_url text,
  pos_order_id uuid,
  pos_order_number int,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS order_drafts_customer_idx
  ON retail.order_drafts (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS order_drafts_payment_ref_idx
  ON retail.order_drafts (payment_ref);
CREATE INDEX IF NOT EXISTS order_drafts_expiry_idx
  ON retail.order_drafts (status, expires_at);

-- 5. RLS: tutup rapat. Hanya service role (Gateway) yang boleh masuk. ----
ALTER TABLE retail.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail.order_drafts ENABLE ROW LEVEL SECURITY;

-- Tanpa policy sama sekali = default deny untuk anon & authenticated.
-- service_role melewati RLS. Ini disengaja: publik tidak pernah
-- menyentuh tabel ini secara langsung, semuanya lewat Gateway.

REVOKE ALL ON SCHEMA retail FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA retail FROM anon, authenticated;

-- Gateway berbicara ke skema ini lewat PostgREST dengan service_role.
-- Skema baru TIDAK otomatis memberi hak apa pun: tanpa blok ini, setiap
-- panggilan ke tabel retail gagal dan seluruh produk mati.
GRANT USAGE ON SCHEMA retail TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA retail TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA retail TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA retail
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA retail
  GRANT ALL ON SEQUENCES TO service_role;

-- Minta PostgREST memuat ulang cache skemanya.
NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Terapkan ke database dan verifikasi ground-truth**

Jangan mengandalkan `supabase migration list` — riwayat di database bersama ini terbukti berubah karena aktivitas developer lain. Verifikasi objeknya benar-benar ada:

```bash
supabase db push
```

Kalau `db push` terhalang migration remote-only milik developer lain, **jangan** jalankan `migration repair` sepihak. Terapkan SQL di atas lewat SQL Editor Supabase, lalu tandai applied hanya untuk timestamp milik kita sendiri.

- [ ] **Step 3: Verifikasi objek nyata ada di database**

```bash
supabase db query "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema='retail' ORDER BY table_name;" --linked
```
Expected: dua baris — `retail.customers`, `retail.order_drafts`

```bash
supabase db query "SELECT column_name FROM information_schema.columns WHERE table_name='menu_items' AND column_name IN ('tampil_di_app','foto_app','deskripsi_app');" --linked
```
Expected: tiga baris

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20300119000000_retail_app_tahap1.sql
git commit -m "feat(retail): migration aditif untuk SukaShawarma APP tahap 1"
```

---

## Task 2: Scaffold apps/retail-gateway

**Files:**
- Create: `apps/retail-gateway/package.json`
- Create: `apps/retail-gateway/tsconfig.json`
- Create: `apps/retail-gateway/next.config.ts`
- Create: `apps/retail-gateway/vitest.config.ts`
- Create: `apps/retail-gateway/Dockerfile`
- Create: `apps/retail-gateway/src/lib/supabase.ts`
- Create: `apps/retail-gateway/src/app/api/health/route.ts`
- Test: `apps/retail-gateway/src/app/api/health/route.test.ts`

**Interfaces:**
- Produces: `createServiceClient(): SupabaseClient` dan `createRetailClient()` dari `src/lib/supabase.ts`

- [ ] **Step 1: Tulis test yang gagal**

```typescript
// apps/retail-gateway/src/app/api/health/route.test.ts
import { describe, it, expect } from 'vitest'
import { GET } from './route'

describe('GET /api/health', () => {
  it('mengembalikan status ok', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ status: 'ok', service: 'retail-gateway' })
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd apps/retail-gateway && ../../node_modules/.bin/vitest run src/app/api/health/route.test.ts`
Expected: FAIL — `Cannot find module './route'`

> Catatan: `npx` rusak di repo ini (path `node_modules/node_modules` ganda). Selalu panggil binary lewat `./node_modules/.bin/<tool>` dari root.

- [ ] **Step 3: Tulis manifest & konfigurasi**

```json
// apps/retail-gateway/package.json
{
  "name": "@suka/retail-gateway",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3020",
    "build": "next build",
    "start": "next start",
    "type-check": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.110.7",
    "jose": "^6.1.0",
    "next": "^16.1.6",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.2.18",
    "typescript": "^5",
    "vitest": "^2.0.0"
  }
}
```

> **Gotcha dependency:** setiap paket yang di-`import` app ini WAJIB ada di daftar atas. Build Docker hanya menyalin `package.json` app ini — paket yang cuma "kebetulan ada" di `node_modules` root karena app lain mendeklarasikannya akan lolos build lokal tapi gagal di Coolify dengan `Module not found`.

```json
// apps/retail-gateway/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "types": ["vitest/globals", "node"],
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

> `baseUrl` wajib ada. Tanpa itu alias `@/*` tidak resolve dan `type-check` meledak ratusan error — pelajaran dari hardening apps/stok.

```typescript
// apps/retail-gateway/next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
}

export default nextConfig
```

```typescript
// apps/retail-gateway/vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 4: Tulis client Supabase dan health route**

```typescript
// apps/retail-gateway/src/lib/supabase.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

/**
 * Client service-role. Satu-satunya jalan Gateway menyentuh database.
 * Melewati RLS -- karena itu setiap endpoint WAJIB menurunkan identitas
 * pelanggan dari token sesi, tidak pernah dari isi permintaan.
 */
export function createServiceClient(): SupabaseClient {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL belum di-set')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY belum di-set')

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  })
  return cached
}

/** Client yang menargetkan skema `retail`. */
export function createRetailClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Kredensial Supabase belum lengkap')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'retail' },
  })
}
```

```typescript
// apps/retail-gateway/src/app/api/health/route.ts
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({ status: 'ok', service: 'retail-gateway' })
}
```

- [ ] **Step 5: Jalankan test, pastikan lulus**

Run: `cd apps/retail-gateway && ../../node_modules/.bin/vitest run`
Expected: PASS 1/1

- [ ] **Step 6: Tulis Dockerfile**

```dockerfile
# apps/retail-gateway/Dockerfile
FROM node:24-bookworm-slim AS builder
WORKDIR /app

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG SUPABASE_SERVICE_ROLE_KEY
ARG SESSION_SECRET
ARG SUPABASE_JWT_SECRET
ARG GOOGLE_ANDROID_CLIENT_ID
ARG XENDIT_SECRET_KEY
ARG XENDIT_WEBHOOK_TOKEN
ARG CRON_SECRET
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

COPY package.json yarn.lock ./
COPY packages ./packages
COPY apps/retail-gateway/package.json ./apps/retail-gateway/package.json
RUN --mount=type=cache,id=yarn-cache-v3,sharing=locked,target=/usr/local/share/.cache/yarn/v6 \
    yarn install --frozen-lockfile --ignore-engines

COPY . .
RUN NEXT_TURBOPACK=0 yarn workspace @suka/retail-gateway build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# WAJIB di-declare ULANG di stage ini. Docker tidak membawa ARG/ENV
# lintas stage; tanpa blok ini seluruh secret jadi undefined di runtime.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG SUPABASE_SERVICE_ROLE_KEY
ARG SESSION_SECRET
ARG SUPABASE_JWT_SECRET
ARG GOOGLE_ANDROID_CLIENT_ID
ARG XENDIT_SECRET_KEY
ARG XENDIT_WEBHOOK_TOKEN
ARG CRON_SECRET
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
    SESSION_SECRET=$SESSION_SECRET \
    SUPABASE_JWT_SECRET=$SUPABASE_JWT_SECRET \
    GOOGLE_ANDROID_CLIENT_ID=$GOOGLE_ANDROID_CLIENT_ID \
    XENDIT_SECRET_KEY=$XENDIT_SECRET_KEY \
    XENDIT_WEBHOOK_TOKEN=$XENDIT_WEBHOOK_TOKEN \
    CRON_SECRET=$CRON_SECRET

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/retail-gateway/.next ./apps/retail-gateway/.next
COPY --from=builder /app/apps/retail-gateway/public ./apps/retail-gateway/public
COPY --from=builder /app/apps/retail-gateway/package.json ./apps/retail-gateway/package.json

WORKDIR /app/apps/retail-gateway
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
```

- [ ] **Step 7: Verifikasi lockfile tidak kotor**

```bash
git diff --stat yarn.lock
```
Expected: 0 atau beberapa baris saja. Kalau ratusan baris berubah, itu drift workspace `SUKASHAWARMA` (astro) yang tidak terkait — pisahkan commit lockfile-nya.

- [ ] **Step 8: Commit**

```bash
git add apps/retail-gateway package.json yarn.lock
git commit -m "feat(retail-gateway): scaffold app, client supabase, health check"
```

---

## Task 3: Token sesi pelanggan

**Files:**
- Create: `apps/retail-gateway/src/lib/session.ts`
- Test: `apps/retail-gateway/src/lib/session.test.ts`

**Interfaces:**
- Produces:
  - `issueSession(customerId: string): Promise<{ token: string; expiresAt: string }>`
  - `verifySession(token: string): Promise<{ customerId: string } | null>`

- [ ] **Step 1: Tulis test yang gagal**

```typescript
// apps/retail-gateway/src/lib/session.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { issueSession, verifySession } from './session'

beforeAll(() => {
  process.env.SESSION_SECRET = 'rahasia-uji-panjang-minimal-32-karakter-ok'
})

describe('session', () => {
  it('token yang diterbitkan bisa diverifikasi kembali', async () => {
    const { token } = await issueSession('11111111-1111-1111-1111-111111111111')
    const claims = await verifySession(token)
    expect(claims).toEqual({ customerId: '11111111-1111-1111-1111-111111111111' })
  })

  it('token asal-asalan ditolak', async () => {
    expect(await verifySession('bukan-token')).toBeNull()
  })

  it('token dengan tanda tangan salah ditolak', async () => {
    const { token } = await issueSession('11111111-1111-1111-1111-111111111111')
    const rusak = token.slice(0, -3) + 'aaa'
    expect(await verifySession(rusak)).toBeNull()
  })

  it('masa berlaku 30 hari', async () => {
    const { expiresAt } = await issueSession('11111111-1111-1111-1111-111111111111')
    const selisihHari = (new Date(expiresAt).getTime() - Date.now()) / 86_400_000
    expect(selisihHari).toBeGreaterThan(29.9)
    expect(selisihHari).toBeLessThan(30.1)
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd apps/retail-gateway && ../../node_modules/.bin/vitest run src/lib/session.test.ts`
Expected: FAIL — `Cannot find module './session'`

- [ ] **Step 3: Implementasi**

```typescript
// apps/retail-gateway/src/lib/session.ts
import { SignJWT, jwtVerify } from 'jose'

const MASA_BERLAKU_HARI = 30
const ISSUER = 'suka-retail-gateway'
const AUDIENCE = 'sukashawarma-app'

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET belum di-set atau kurang dari 32 karakter')
  }
  return new TextEncoder().encode(s)
}

export async function issueSession(
  customerId: string
): Promise<{ token: string; expiresAt: string }> {
  const kedaluwarsa = new Date(Date.now() + MASA_BERLAKU_HARI * 86_400_000)

  const token = await new SignJWT({ sub: customerId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(kedaluwarsa)
    .sign(secret())

  return { token, expiresAt: kedaluwarsa.toISOString() }
}

export async function verifySession(
  token: string
): Promise<{ customerId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    })
    if (typeof payload.sub !== 'string') return null
    return { customerId: payload.sub }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `cd apps/retail-gateway && ../../node_modules/.bin/vitest run src/lib/session.test.ts`
Expected: PASS 4/4

- [ ] **Step 5: Commit**

```bash
git add apps/retail-gateway/src/lib/session.ts apps/retail-gateway/src/lib/session.test.ts
git commit -m "feat(retail-gateway): token sesi pelanggan berumur 30 hari"
```

---

## Task 4: Login Google

**Files:**
- Create: `apps/retail-gateway/src/lib/auth.ts`
- Create: `apps/retail-gateway/src/app/api/v1/auth/google/route.ts`
- Test: `apps/retail-gateway/src/lib/auth.test.ts`

**Interfaces:**
- Consumes: `issueSession`, `verifySession` (Task 3); `createRetailClient` (Task 2)
- Produces:
  - `requireCustomer(request: Request): Promise<{ customerId: string } | null>`
  - `POST /api/v1/auth/google` menerima `{ id_token: string }`, mengembalikan `{ token, expires_at, customer: { id, name, email, phone } }`

- [ ] **Step 1: Tulis test yang gagal**

```typescript
// apps/retail-gateway/src/lib/auth.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { requireCustomer } from './auth'
import { issueSession } from './session'

beforeAll(() => {
  process.env.SESSION_SECRET = 'rahasia-uji-panjang-minimal-32-karakter-ok'
})

function permintaan(header?: string): Request {
  return new Request('https://contoh.test/api/v1/catalog', {
    headers: header ? { authorization: header } : {},
  })
}

describe('requireCustomer', () => {
  it('menerima Bearer token yang sah', async () => {
    const { token } = await issueSession('22222222-2222-2222-2222-222222222222')
    const hasil = await requireCustomer(permintaan(`Bearer ${token}`))
    expect(hasil).toEqual({ customerId: '22222222-2222-2222-2222-222222222222' })
  })

  it('menolak permintaan tanpa header', async () => {
    expect(await requireCustomer(permintaan())).toBeNull()
  })

  it('menolak skema selain Bearer', async () => {
    const { token } = await issueSession('22222222-2222-2222-2222-222222222222')
    expect(await requireCustomer(permintaan(`Basic ${token}`))).toBeNull()
  })

  it('menolak token yang tidak sah', async () => {
    expect(await requireCustomer(permintaan('Bearer palsu'))).toBeNull()
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd apps/retail-gateway && ../../node_modules/.bin/vitest run src/lib/auth.test.ts`
Expected: FAIL — `Cannot find module './auth'`

- [ ] **Step 3: Implementasi gerbang**

```typescript
// apps/retail-gateway/src/lib/auth.ts
import { verifySession } from './session'

/**
 * Gerbang setiap endpoint privat. Identitas pelanggan SELALU diturunkan
 * dari token, tidak pernah dari isi permintaan -- Gateway memakai service
 * role, jadi percaya pada body sama dengan membuka seluruh database.
 */
export async function requireCustomer(
  request: Request
): Promise<{ customerId: string } | null> {
  const header = request.headers.get('authorization')
  if (!header) return null

  const [skema, token] = header.split(' ')
  if (skema !== 'Bearer' || !token) return null

  return verifySession(token)
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `cd apps/retail-gateway && ../../node_modules/.bin/vitest run src/lib/auth.test.ts`
Expected: PASS 4/4

- [ ] **Step 5: Implementasi endpoint login Google**

```typescript
// apps/retail-gateway/src/app/api/v1/auth/google/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createRetailClient } from '@/lib/supabase'
import { issueSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: { id_token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 })
  }

  if (!body.id_token) {
    return NextResponse.json({ error: 'id_token wajib diisi' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    return NextResponse.json({ error: 'Konfigurasi server belum lengkap' }, { status: 500 })
  }

  // Supabase Auth yang memvalidasi ID token ke Google. Anon key dipakai di
  // SERVER, tidak pernah dikirim ke aplikasi.
  const authClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await authClient.auth.signInWithIdToken({
    provider: 'google',
    token: body.id_token,
  })

  if (error || !data.user) {
    return NextResponse.json({ error: 'Login Google gagal' }, { status: 401 })
  }

  const user = data.user
  const retail = createRetailClient()

  // Baca profil lama dulu. Upsert polos akan menimpa `name` dengan null pada
  // login berikutnya bila Google tidak mengirim `full_name` -- pelanggan
  // kehilangan namanya diam-diam. Nilai dari Google hanya MENGISI yang kosong,
  // tidak pernah menghapus yang sudah ada.
  const { data: lama } = await retail
    .from('customers')
    .select('name, email')
    .eq('id', user.id)
    .maybeSingle()

  const namaGoogle = (user.user_metadata?.full_name as string | undefined) ?? null

  const { data: profil, error: profilError } = await retail
    .from('customers')
    .upsert(
      {
        id: user.id,
        email: user.email ?? lama?.email ?? null,
        name: namaGoogle ?? lama?.name ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select('id, name, email, phone')
    .maybeSingle()

  if (profilError || !profil) {
    return NextResponse.json({ error: 'Gagal menyiapkan profil' }, { status: 500 })
  }

  const { token, expiresAt } = await issueSession(user.id)

  return NextResponse.json({
    token,
    expires_at: expiresAt,
    customer: profil,
  })
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/retail-gateway/src/lib/auth.ts apps/retail-gateway/src/lib/auth.test.ts apps/retail-gateway/src/app/api/v1/auth/google/route.ts
git commit -m "feat(retail-gateway): login Google lewat gateway, aplikasi tanpa kunci database"
```

---

## Task 5: Perhitungan harga (murni)

**Files:**
- Create: `apps/retail-gateway/src/lib/pricing.ts`
- Test: `apps/retail-gateway/src/lib/pricing.test.ts`

**Interfaces:**
- Produces:
  - `type ItemPesanan = { menu_item_id: string; name: string; unit_price: number; quantity: number; note?: string }`
  - `hitungTotal(items: ItemPesanan[], diskonPersen: number): { subtotal: number; discountAmount: number; total: number }`

- [ ] **Step 1: Tulis test yang gagal**

```typescript
// apps/retail-gateway/src/lib/pricing.test.ts
import { describe, it, expect } from 'vitest'
import { hitungTotal, type ItemPesanan } from './pricing'

const item = (harga: number, qty: number): ItemPesanan => ({
  menu_item_id: '33333333-3333-3333-3333-333333333333',
  name: 'Shawarma Ayam Original',
  unit_price: harga,
  quantity: qty,
})

describe('hitungTotal', () => {
  it('menjumlahkan subtotal tanpa diskon', () => {
    expect(hitungTotal([item(25000, 2), item(15000, 1)], 0)).toEqual({
      subtotal: 65000,
      discountAmount: 0,
      total: 65000,
    })
  })

  it('menerapkan diskon persen dan membulatkan ke rupiah utuh', () => {
    expect(hitungTotal([item(25000, 1)], 20)).toEqual({
      subtotal: 25000,
      discountAmount: 5000,
      total: 20000,
    })
  })

  it('tidak menghasilkan pecahan rupiah', () => {
    const hasil = hitungTotal([item(8333, 1)], 15)
    expect(Number.isInteger(hasil.discountAmount)).toBe(true)
    expect(Number.isInteger(hasil.total)).toBe(true)
    expect(hasil.subtotal - hasil.discountAmount).toBe(hasil.total)
  })

  it('membatasi potongan maksimal 50 persen dari subtotal', () => {
    const hasil = hitungTotal([item(20000, 1)], 80)
    expect(hasil.discountAmount).toBe(10000)
    expect(hasil.total).toBe(10000)
  })

  it('menolak keranjang kosong dengan total nol', () => {
    expect(hitungTotal([], 20)).toEqual({ subtotal: 0, discountAmount: 0, total: 0 })
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd apps/retail-gateway && ../../node_modules/.bin/vitest run src/lib/pricing.test.ts`
Expected: FAIL — `Cannot find module './pricing'`

- [ ] **Step 3: Implementasi**

```typescript
// apps/retail-gateway/src/lib/pricing.ts

/** Batas potongan. Rem darurat untuk kombinasi promo yang tidak terduga. */
export const MAKS_POTONGAN_PERSEN = 50

export type ItemPesanan = {
  menu_item_id: string
  name: string
  unit_price: number
  quantity: number
  note?: string
}

export type RincianHarga = {
  subtotal: number
  discountAmount: number
  total: number
}

export function hitungTotal(
  items: ItemPesanan[],
  diskonPersen: number
): RincianHarga {
  const subtotal = items.reduce(
    (jumlah, it) => jumlah + it.unit_price * it.quantity,
    0
  )

  const persenEfektif = Math.min(Math.max(diskonPersen, 0), MAKS_POTONGAN_PERSEN)
  const discountAmount = Math.round((subtotal * persenEfektif) / 100)

  return { subtotal, discountAmount, total: subtotal - discountAmount }
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `cd apps/retail-gateway && ../../node_modules/.bin/vitest run src/lib/pricing.test.ts`
Expected: PASS 5/5

- [ ] **Step 5: Commit**

```bash
git add apps/retail-gateway/src/lib/pricing.ts apps/retail-gateway/src/lib/pricing.test.ts
git commit -m "feat(retail-gateway): perhitungan harga dengan batas potongan 50 persen"
```

---

## Task 6: Kode pengambilan (murni)

**Files:**
- Create: `apps/retail-gateway/src/lib/pickupCode.ts`
- Test: `apps/retail-gateway/src/lib/pickupCode.test.ts`

**Interfaces:**
- Produces: `buatKodeAmbil(clientOrderId: string): string` — 4 digit, deterministik

- [ ] **Step 1: Tulis test yang gagal**

```typescript
// apps/retail-gateway/src/lib/pickupCode.test.ts
import { describe, it, expect } from 'vitest'
import { buatKodeAmbil } from './pickupCode'

describe('buatKodeAmbil', () => {
  it('selalu menghasilkan tepat 4 digit', () => {
    const kode = buatKodeAmbil('9197d153-2a29-4ca8-a123-a4a6ff8e1cbf')
    expect(kode).toMatch(/^\d{4}$/)
  })

  it('deterministik untuk id yang sama', () => {
    const id = '9197d153-2a29-4ca8-a123-a4a6ff8e1cbf'
    expect(buatKodeAmbil(id)).toBe(buatKodeAmbil(id))
  })

  it('menghasilkan kode berbeda untuk id berbeda', () => {
    const a = buatKodeAmbil('9197d153-2a29-4ca8-a123-a4a6ff8e1cbf')
    const b = buatKodeAmbil('11111111-2222-4333-8444-555555555555')
    expect(a).not.toBe(b)
  })

  it('tidak pernah menghasilkan 0000', () => {
    const kode = buatKodeAmbil('00000000-0000-4000-8000-000000000000')
    expect(kode).not.toBe('0000')
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd apps/retail-gateway && ../../node_modules/.bin/vitest run src/lib/pickupCode.test.ts`
Expected: FAIL — `Cannot find module './pickupCode'`

- [ ] **Step 3: Implementasi**

```typescript
// apps/retail-gateway/src/lib/pickupCode.ts

/**
 * Kode 4 digit yang diucapkan pelanggan ke kasir.
 * Deterministik dari client_order_id supaya percobaan kirim ulang
 * menghasilkan kode yang sama, bukan kode baru yang membingungkan.
 * Rentang 1000-9999: tidak pernah berawalan nol, tidak pernah 0000.
 */
export function buatKodeAmbil(clientOrderId: string): string {
  let hash = 0
  for (let i = 0; i < clientOrderId.length; i++) {
    hash = (hash * 31 + clientOrderId.charCodeAt(i)) >>> 0
  }
  return String(1000 + (hash % 9000))
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `cd apps/retail-gateway && ../../node_modules/.bin/vitest run src/lib/pickupCode.test.ts`
Expected: PASS 4/4

- [ ] **Step 5: Commit**

```bash
git add apps/retail-gateway/src/lib/pickupCode.ts apps/retail-gateway/src/lib/pickupCode.test.ts
git commit -m "feat(retail-gateway): kode pengambilan 4 digit deterministik"
```

---

## Task 7: Katalog & outlet

**Files:**
- Create: `apps/retail-gateway/src/lib/catalog.ts`
- Create: `apps/retail-gateway/src/app/api/v1/catalog/route.ts`
- Create: `apps/retail-gateway/src/app/api/v1/outlets/route.ts`
- Test: `apps/retail-gateway/src/lib/catalog.test.ts`

**Interfaces:**
- Consumes: `createServiceClient` (Task 2)
- Produces:
  - `type MenuApp = { id: string; name: string; description: string | null; price: number; image_url: string | null; is_available: boolean; category_id: string | null; sort_order: number | null }`
  - `bersihkanKatalog(rows: unknown[]): MenuApp[]`
  - `ambilKatalog(outletId: string, paksaSegar = false): Promise<MenuApp[]>` (cache 5 menit; `paksaSegar` melewati cache HANYA untuk outlet itu)
  - `kosongkanCacheKatalog(): void`
  - `GET /api/v1/catalog?outlet_id=<uuid>`
  - `GET /api/v1/outlets`

- [ ] **Step 1: Tulis test yang gagal**

```typescript
// apps/retail-gateway/src/lib/catalog.test.ts
import { describe, it, expect } from 'vitest'
import { bersihkanKatalog } from './catalog'

describe('bersihkanKatalog', () => {
  it('memakai deskripsi_app bila ada, jatuh ke description bila tidak', () => {
    const hasil = bersihkanKatalog([
      {
        id: 'a', name: 'Shawarma Ayam Original', price: 25000,
        description: 'deskripsi kasir', deskripsi_app: 'Ayam panggang, sayur segar, saus khas',
        image_url: null, foto_app: null, is_available: true, category_id: 'c1', sort_order: 1,
      },
      {
        id: 'b', name: 'Kebab Mini', price: 15000,
        description: 'deskripsi kasir', deskripsi_app: null,
        image_url: null, foto_app: null, is_available: true, category_id: 'c1', sort_order: 2,
      },
    ])
    expect(hasil[0].description).toBe('Ayam panggang, sayur segar, saus khas')
    expect(hasil[1].description).toBe('deskripsi kasir')
  })

  it('memakai foto_app bila ada, jatuh ke image_url bila tidak', () => {
    const hasil = bersihkanKatalog([
      {
        id: 'a', name: 'Shawarma Ayam Original', price: 25000, description: null,
        deskripsi_app: null, image_url: 'kasir.jpg', foto_app: 'app.jpg',
        is_available: true, category_id: null, sort_order: null,
      },
      {
        id: 'b', name: 'Es Teh Manis', price: 8000, description: null,
        deskripsi_app: null, image_url: 'kasir.jpg', foto_app: null,
        is_available: true, category_id: null, sort_order: null,
      },
    ])
    expect(hasil[0].image_url).toBe('app.jpg')
    expect(hasil[1].image_url).toBe('kasir.jpg')
  })

  it('memaksa harga jadi angka', () => {
    const hasil = bersihkanKatalog([
      {
        id: 'a', name: 'Shawarma Ayam Original', price: '25000', description: null,
        deskripsi_app: null, image_url: null, foto_app: null,
        is_available: true, category_id: null, sort_order: null,
      },
    ])
    expect(hasil[0].price).toBe(25000)
  })

  it('memperlakukan ketersediaan yang tidak diketahui sebagai habis', () => {
    const hasil = bersihkanKatalog([
      {
        id: 'a', name: 'Shawarma Ayam Original', price: 25000, description: null,
        deskripsi_app: null, image_url: null, foto_app: null,
        is_available: null, category_id: null, sort_order: null,
      },
      {
        id: 'b', name: 'Kebab Mini', price: 15000, description: null,
        deskripsi_app: null, image_url: null, foto_app: null,
        category_id: null, sort_order: null,
      },
    ])
    expect(hasil[0].is_available).toBe(false)
    expect(hasil[1].is_available).toBe(false)
  })

  it('membuang baris dengan harga tak sah alih-alih mengirim NaN', () => {
    const hasil = bersihkanKatalog([
      { id: 'a', name: 'Harga huruf', price: 'abc', is_available: true },
      { id: 'b', name: 'Harga negatif', price: -500, is_available: true },
      { id: 'c', name: 'Tanpa harga', is_available: true },
      {
        id: 'd', name: 'Sah', price: 12000, description: null, deskripsi_app: null,
        image_url: null, foto_app: null, is_available: true, category_id: null, sort_order: null,
      },
    ])
    expect(hasil).toHaveLength(1)
    expect(hasil[0].id).toBe('d')
    expect(hasil[0].price).toBe(12000)
  })

  it('membuang baris tanpa id atau nama', () => {
    const hasil = bersihkanKatalog([
      { id: null, name: 'Tanpa id', price: 1000 },
      { id: 'a', name: null, price: 1000 },
      {
        id: 'b', name: 'Sah', price: 1000, description: null, deskripsi_app: null,
        image_url: null, foto_app: null, is_available: true, category_id: null, sort_order: null,
      },
    ])
    expect(hasil).toHaveLength(1)
    expect(hasil[0].id).toBe('b')
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd apps/retail-gateway && ../../node_modules/.bin/vitest run src/lib/catalog.test.ts`
Expected: FAIL — `Cannot find module './catalog'`

- [ ] **Step 3: Implementasi katalog**

```typescript
// apps/retail-gateway/src/lib/catalog.ts
import { createServiceClient } from './supabase'

const UMUR_CACHE_MS = 5 * 60 * 1000

/** Batas seberapa basi cache boleh disajikan saat database tak terjangkau. */
const UMUR_BASI_MAKS_MS = 30 * 60 * 1000

export type MenuApp = {
  id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  is_available: boolean
  category_id: string | null
  sort_order: number | null
}

type Baris = Record<string, unknown>

/**
 * Menurunkan baris mentah menjadi bentuk yang dikonsumsi aplikasi.
 * Kolom khusus app menang atas kolom kasir; kalau kosong, jatuh ke kolom kasir.
 */
export function bersihkanKatalog(rows: unknown[]): MenuApp[] {
  const hasil: MenuApp[] = []

  for (const mentah of rows) {
    const r = mentah as Baris
    if (typeof r.id !== 'string' || typeof r.name !== 'string') continue

    // Harga tak sah = item tidak boleh muncul sama sekali. `Number('abc')`
    // menghasilkan NaN, dan JSON.stringify mengubah NaN jadi null diam-diam --
    // harga hilang tanpa satu pun error tercatat.
    const harga = Number(r.price)
    if (!Number.isFinite(harga) || harga < 0) continue

    hasil.push({
      id: r.id,
      name: r.name,
      description:
        (r.deskripsi_app as string | null) ?? (r.description as string | null) ?? null,
      price: harga,
      image_url: (r.foto_app as string | null) ?? (r.image_url as string | null) ?? null,
      // Gagal-tertutup. Ketersediaan yang tidak diketahui diperlakukan sebagai
      // habis: menyembunyikan item yang sebenarnya ada masih bisa diperbaiki
      // admin, sedangkan menjual item yang habis sudah terlanjur diterima
      // uangnya. Fungsi ini juga dipakai validasi checkout, jadi kelonggaran
      // di sini merambat sampai ke titik pembayaran.
      is_available: r.is_available === true,
      category_id: (r.category_id as string | null) ?? null,
      sort_order: (r.sort_order as number | null) ?? null,
    })
  }

  return hasil
}

const cache = new Map<string, { pada: number; data: MenuApp[] }>()

export function kosongkanCacheKatalog(): void {
  cache.clear()
}

export async function ambilKatalog(
  outletId: string,
  paksaSegar = false
): Promise<MenuApp[]> {
  const tersimpan = cache.get(outletId)
  if (!paksaSegar && tersimpan && Date.now() - tersimpan.pada < UMUR_CACHE_MS) {
    return tersimpan.data
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('menu_items')
    .select(
      'id, name, description, deskripsi_app, price, image_url, foto_app, is_available, category_id, sort_order'
    )
    .eq('outlet_id', outletId)
    .eq('tampil_di_app', true)
    .order('sort_order', { ascending: true })

  if (error) {
    // Cache basi lebih baik daripada layar kosong -- TAPI ada batasnya.
    // Kalau database tak terjangkau berjam-jam, menyajikan harga dan
    // ketersediaan seusia itu lebih berbahaya daripada gagal terang-terangan,
    // karena data yang sama dipakai di titik pembayaran.
    if (tersimpan && Date.now() - tersimpan.pada < UMUR_BASI_MAKS_MS) {
      return tersimpan.data
    }
    throw new Error(`Gagal mengambil katalog: ${error.message}`)
  }

  const bersih = bersihkanKatalog(data ?? [])
  cache.set(outletId, { pada: Date.now(), data: bersih })
  return bersih
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `cd apps/retail-gateway && ../../node_modules/.bin/vitest run src/lib/catalog.test.ts`
Expected: PASS 4/4

- [ ] **Step 5: Implementasi endpoint**

```typescript
// apps/retail-gateway/src/app/api/v1/catalog/route.ts
import { NextResponse } from 'next/server'
import { ambilKatalog } from '@/lib/catalog'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const outletId = new URL(request.url).searchParams.get('outlet_id')
  if (!outletId) {
    return NextResponse.json({ error: 'outlet_id wajib diisi' }, { status: 400 })
  }

  try {
    const items = await ambilKatalog(outletId)
    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ error: 'Gagal memuat menu' }, { status: 502 })
  }
}
```

```typescript
// apps/retail-gateway/src/app/api/v1/outlets/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('outlets')
    .select('id, name, address, lat, lng, is_active')
    .eq('app_enabled', true)
    .neq('type', 'marketplace')
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Gagal memuat outlet' }, { status: 502 })
  }

  return NextResponse.json({ outlets: data ?? [] })
}
```

> **Kolom sudah diverifikasi** terhadap `supabase/migrations/20260609000000_create_outlets.sql`.
> Tabel `outlets` memiliki: `id, slug, name, address, lat, lng, type, is_active`.
>
> **Tidak ada kolom `is_open`.** Rencana versi awal memakai nama itu. Kalau dibiarkan,
> `outlet.is_open === false` selalu membaca `undefined`, sehingga gerbang "outlet tutup"
> mati total dan pelanggan bisa membayar pesanan ke outlet yang tidak melayani.
> `is_active` adalah penanda operasional yang benar-benar tersedia.
>
> **Keterbatasan yang diketahui:** `is_active` berarti "outlet ini beroperasi", bukan
> "outlet sedang buka jam sekarang". Jam buka-tutup harian tidak tersimpan di tabel
> `outlets`. Untuk Tahap 1, gerbang database hanya memakai `is_active`; keadaan
> "belum buka jam 14:00" ditangani di sisi aplikasi. Penjagaan jam operasional di sisi
> server adalah pekerjaan Tahap 1b/1c dan butuh sumber data jam buka yang belum ada.

- [ ] **Step 6: Commit**

```bash
git add apps/retail-gateway/src/lib/catalog.ts apps/retail-gateway/src/lib/catalog.test.ts apps/retail-gateway/src/app/api/v1/catalog apps/retail-gateway/src/app/api/v1/outlets
git commit -m "feat(retail-gateway): katalog ter-cache dan daftar outlet peserta app"
```

---

## Task 8: Validasi pra-bayar

**Files:**
- Create: `apps/retail-gateway/src/app/api/v1/checkout/validate/route.ts`
- Create: `apps/retail-gateway/src/lib/validateCart.ts`
- Test: `apps/retail-gateway/src/lib/validateCart.test.ts`

**Interfaces:**
- Consumes: `MenuApp` (Task 7), `hitungTotal` (Task 5)
- Produces:
  - `type MasalahKeranjang = { menu_item_id: string; name: string; jenis: 'habis' | 'harga_berubah' | 'tidak_ada'; harga_baru?: number }`
  - `periksaKeranjang(items: ItemPesanan[], katalog: MenuApp[]): MasalahKeranjang[]`
  - `jumlahWajar(items: ItemPesanan[]): boolean`
  - `POST /api/v1/checkout/validate`

- [ ] **Step 1: Tulis test yang gagal**

```typescript
// apps/retail-gateway/src/lib/validateCart.test.ts
import { describe, it, expect } from 'vitest'
import { periksaKeranjang, jumlahWajar } from './validateCart'
import type { MenuApp } from './catalog'
import type { ItemPesanan } from './pricing'

const menu = (over: Partial<MenuApp> = {}): MenuApp => ({
  id: 'm1',
  name: 'Shawarma Ayam Original',
  description: null,
  price: 25000,
  image_url: null,
  is_available: true,
  category_id: null,
  sort_order: null,
  ...over,
})

const keranjang = (over: Partial<ItemPesanan> = {}): ItemPesanan => ({
  menu_item_id: 'm1',
  name: 'Shawarma Ayam Original',
  unit_price: 25000,
  quantity: 1,
  ...over,
})

describe('periksaKeranjang', () => {
  it('tidak melaporkan masalah saat semuanya cocok', () => {
    expect(periksaKeranjang([keranjang()], [menu()])).toEqual([])
  })

  it('melaporkan item yang sudah habis', () => {
    const masalah = periksaKeranjang([keranjang()], [menu({ is_available: false })])
    expect(masalah).toEqual([
      { menu_item_id: 'm1', name: 'Shawarma Ayam Original', jenis: 'habis' },
    ])
  })

  it('melaporkan harga yang berubah beserta harga barunya', () => {
    const masalah = periksaKeranjang([keranjang()], [menu({ price: 28000 })])
    expect(masalah).toEqual([
      {
        menu_item_id: 'm1',
        name: 'Shawarma Ayam Original',
        jenis: 'harga_berubah',
        harga_baru: 28000,
      },
    ])
  })

  it('melaporkan item yang sudah tidak ada di katalog', () => {
    const masalah = periksaKeranjang([keranjang({ menu_item_id: 'hilang' })], [menu()])
    expect(masalah).toEqual([
      { menu_item_id: 'hilang', name: 'Shawarma Ayam Original', jenis: 'tidak_ada' },
    ])
  })

  it('menerima jumlah bulat wajar', () => {
    expect(jumlahWajar([keranjang({ quantity: 1 }), keranjang({ quantity: 99 })])).toBe(true)
  })

  it('menolak jumlah nol, negatif, pecahan, NaN, dan di atas 99', () => {
    expect(jumlahWajar([keranjang({ quantity: 0 })])).toBe(false)
    expect(jumlahWajar([keranjang({ quantity: -5 })])).toBe(false)
    expect(jumlahWajar([keranjang({ quantity: 1.5 })])).toBe(false)
    expect(jumlahWajar([keranjang({ quantity: NaN })])).toBe(false)
    expect(jumlahWajar([keranjang({ quantity: 100 })])).toBe(false)
  })

  it('menolak kalau SATU item saja tidak wajar', () => {
    expect(jumlahWajar([keranjang({ quantity: 2 }), keranjang({ quantity: -1 })])).toBe(false)
  })

  it('melaporkan setiap item bermasalah, bukan hanya yang pertama', () => {
    const masalah = periksaKeranjang(
      [keranjang(), keranjang({ menu_item_id: 'm2', name: 'Es Teh Manis', unit_price: 8000 })],
      [menu({ is_available: false }), menu({ id: 'm2', name: 'Es Teh Manis', price: 9000 })]
    )
    expect(masalah).toHaveLength(2)
    expect(masalah[0].jenis).toBe('habis')
    expect(masalah[1].jenis).toBe('harga_berubah')
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd apps/retail-gateway && ../../node_modules/.bin/vitest run src/lib/validateCart.test.ts`
Expected: FAIL — `Cannot find module './validateCart'`

- [ ] **Step 3: Implementasi**

```typescript
// apps/retail-gateway/src/lib/validateCart.ts
import type { MenuApp } from './catalog'
import type { ItemPesanan } from './pricing'

export const JUMLAH_MAKS_PER_ITEM = 99

export type MasalahKeranjang = {
  menu_item_id: string
  name: string
  jenis: 'habis' | 'harga_berubah' | 'tidak_ada'
  harga_baru?: number
}

/**
 * Menjaga jumlah pesanan tetap masuk akal SEBELUM harga dihitung.
 * Tanpa ini, klien yang dibongkar bisa mengirim jumlah negatif atau pecahan
 * dan menghasilkan total yang aneh -- modul harga sengaja murni dan tidak
 * memvalidasi masukan, jadi penjagaan itu tugas lapisan ini.
 */
export function jumlahWajar(items: ItemPesanan[]): boolean {
  return items.every(
    (it) =>
      Number.isInteger(it.quantity) &&
      it.quantity >= 1 &&
      it.quantity <= JUMLAH_MAKS_PER_ITEM
  )
}

/**
 * Membandingkan keranjang aplikasi dengan katalog yang baru dibaca dari
 * produksi. Mengembalikan SEMUA masalah, bukan berhenti di yang pertama --
 * pelanggan harus melihat seluruhnya sekaligus, bukan satu per satu.
 */
export function periksaKeranjang(
  items: ItemPesanan[],
  katalog: MenuApp[]
): MasalahKeranjang[] {
  const peta = new Map(katalog.map((m) => [m.id, m]))
  const masalah: MasalahKeranjang[] = []

  for (const it of items) {
    const menu = peta.get(it.menu_item_id)

    if (!menu) {
      masalah.push({ menu_item_id: it.menu_item_id, name: it.name, jenis: 'tidak_ada' })
      continue
    }
    if (!menu.is_available) {
      masalah.push({ menu_item_id: it.menu_item_id, name: menu.name, jenis: 'habis' })
      continue
    }
    if (menu.price !== it.unit_price) {
      masalah.push({
        menu_item_id: it.menu_item_id,
        name: menu.name,
        jenis: 'harga_berubah',
        harga_baru: menu.price,
      })
    }
  }

  return masalah
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `cd apps/retail-gateway && ../../node_modules/.bin/vitest run src/lib/validateCart.test.ts`
Expected: PASS 5/5

- [ ] **Step 5: Implementasi endpoint**

```typescript
// apps/retail-gateway/src/app/api/v1/checkout/validate/route.ts
import { NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { ambilKatalog } from '@/lib/catalog'
import { periksaKeranjang, jumlahWajar } from '@/lib/validateCart'
import { hitungTotal, type ItemPesanan } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

const DISKON_PILOT_PERSEN = 0

export async function POST(request: Request) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })

  let body: { outlet_id?: string; items?: ItemPesanan[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 })
  }

  if (!body.outlet_id || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'outlet_id dan items wajib diisi' }, { status: 400 })
  }

  if (!jumlahWajar(body.items)) {
    return NextResponse.json({ error: 'Jumlah pesanan tidak wajar' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: outlet, error: outletError } = await db
    .from('outlets')
    .select('id, name, app_enabled, is_active')
    .eq('id', body.outlet_id)
    .maybeSingle()

  // Kegagalan database TIDAK boleh menyamar jadi "outlet tidak melayani".
  // Ini gerbang terakhir sebelum tagihan: insiden nyata harus terlihat,
  // bukan tersembunyi di balik pesan bisnis yang salah.
  if (outletError) {
    console.error('gagal membaca outlet', outletError)
    return NextResponse.json({ error: 'Gagal memeriksa outlet' }, { status: 502 })
  }

  if (!outlet || outlet.app_enabled !== true) {
    return NextResponse.json(
      { ok: false, alasan: 'outlet_tidak_melayani', pesan: 'Outlet ini belum melayani pesanan aplikasi' },
      { status: 200 }
    )
  }

  if (outlet.is_active === false) {
    return NextResponse.json(
      { ok: false, alasan: 'outlet_tutup', pesan: 'Outlet sedang tutup' },
      { status: 200 }
    )
  }

  // Ketersediaan & harga SELALU dibaca segar di titik ini, tidak dari cache.
  // `true` hanya melewati cache outlet ini -- jangan buang cache outlet lain.
  let katalog
  try {
    katalog = await ambilKatalog(body.outlet_id, true)
  } catch (e) {
    console.error('gagal memuat katalog segar', e)
    return NextResponse.json({ error: 'Gagal memeriksa menu' }, { status: 502 })
  }
  const masalah = periksaKeranjang(body.items, katalog)

  if (masalah.length > 0) {
    return NextResponse.json({ ok: false, alasan: 'keranjang_berubah', masalah }, { status: 200 })
  }

  const rincian = hitungTotal(body.items, DISKON_PILOT_PERSEN)
  return NextResponse.json({ ok: true, ...rincian })
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/retail-gateway/src/lib/validateCart.ts apps/retail-gateway/src/lib/validateCart.test.ts apps/retail-gateway/src/app/api/v1/checkout
git commit -m "feat(retail-gateway): validasi pra-bayar outlet, ketersediaan, dan harga"
```

---

## Task 9: Adapter pembayaran Xendit

**Files:**
- Create: `apps/retail-gateway/src/lib/xendit.ts`
- Test: `apps/retail-gateway/src/lib/xendit.test.ts`

**Interfaces:**
- Produces:
  - `type Tagihan = { ref: string; url: string; status: 'menunggu' | 'lunas' | 'gagal' }`
  - `buatTagihan(input: { externalId: string; amount: number; description: string; customerName: string }): Promise<Tagihan>`
  - `bacaStatusWebhook(payload: unknown): { externalId: string; status: 'lunas' | 'gagal' } | null`
  - `rahasiaCocok(diberikan: string | null, diharapkan: string): boolean` — perbandingan tahan-waktu

- [ ] **Step 1: Tulis test yang gagal**

```typescript
// apps/retail-gateway/src/lib/xendit.test.ts
import { describe, it, expect } from 'vitest'
import { bacaStatusWebhook } from './xendit'

describe('bacaStatusWebhook', () => {
  it('membaca pembayaran lunas', () => {
    expect(
      bacaStatusWebhook({ external_id: 'ord-123', status: 'PAID', amount: 47000 })
    ).toEqual({ externalId: 'ord-123', status: 'lunas' })
  })

  it('memperlakukan SETTLED sama dengan lunas', () => {
    expect(
      bacaStatusWebhook({ external_id: 'ord-123', status: 'SETTLED', amount: 47000 })
    ).toEqual({ externalId: 'ord-123', status: 'lunas' })
  })

  it('membaca pembayaran kadaluarsa sebagai gagal', () => {
    expect(
      bacaStatusWebhook({ external_id: 'ord-123', status: 'EXPIRED' })
    ).toEqual({ externalId: 'ord-123', status: 'gagal' })
  })

  it('mengembalikan null untuk payload tanpa external_id', () => {
    expect(bacaStatusWebhook({ status: 'PAID' })).toBeNull()
  })

  it('mengembalikan null untuk status yang tidak dikenal', () => {
    expect(bacaStatusWebhook({ external_id: 'ord-123', status: 'PENDING' })).toBeNull()
  })

  it('mengembalikan null untuk payload bukan objek', () => {
    expect(bacaStatusWebhook('bukan objek')).toBeNull()
    expect(bacaStatusWebhook(null)).toBeNull()
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd apps/retail-gateway && ../../node_modules/.bin/vitest run src/lib/xendit.test.ts`
Expected: FAIL — `Cannot find module './xendit'`

- [ ] **Step 3: Implementasi**

```typescript
// apps/retail-gateway/src/lib/xendit.ts

import { timingSafeEqual } from 'node:crypto'

export type Tagihan = {
  ref: string
  url: string
  status: 'menunggu' | 'lunas' | 'gagal'
}

/**
 * Perbandingan rahasia tahan-waktu.
 * Preseden proyek: P8 di pos-kasir (2026-07-21) — perbandingan string biasa
 * membocorkan rahasia sedikit demi sedikit lewat selisih waktu balasan.
 * Dipakai oleh webhook Xendit dan cron.
 */
export function rahasiaCocok(diberikan: string | null, diharapkan: string): boolean {
  if (!diberikan) return false
  const a = Buffer.from(diberikan)
  const b = Buffer.from(diharapkan)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

const BATAS_BAYAR_DETIK = 15 * 60

export async function buatTagihan(input: {
  externalId: string
  amount: number
  description: string
  customerName: string
}): Promise<Tagihan> {
  const key = process.env.XENDIT_SECRET_KEY
  if (!key) throw new Error('XENDIT_SECRET_KEY belum di-set')

  // Penjagaan di batas pembayaran. Tagihan nol atau negatif adalah tanda ada
  // yang salah di hulu; tolak di sini daripada menunggu Xendit menolaknya
  // setelah satu perjalanan jaringan.
  if (!Number.isInteger(input.amount) || input.amount < 1) {
    throw new Error('Nilai tagihan tidak sah')
  }

  const res = await fetch('https://api.xendit.co/v2/invoices', {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      external_id: input.externalId,
      amount: input.amount,
      description: input.description,
      customer: { given_names: input.customerName },
      invoice_duration: BATAS_BAYAR_DETIK,
      currency: 'IDR',
      payment_methods: ['QRIS', 'OVO', 'DANA', 'SHOPEEPAY', 'LINKAJA', 'BCA', 'BNI', 'BRI', 'MANDIRI'],
    }),
  })

  if (!res.ok) {
    const teks = await res.text()
    throw new Error(`Xendit menolak pembuatan tagihan (${res.status}): ${teks}`)
  }

  const data = (await res.json()) as { id?: string; invoice_url?: string }
  if (!data.id || !data.invoice_url) {
    throw new Error('Balasan Xendit tidak memuat id atau invoice_url')
  }

  return { ref: data.id, url: data.invoice_url, status: 'menunggu' }
}

/**
 * Menurunkan payload webhook menjadi keputusan yang bisa ditindak.
 * Status di luar daftar dikembalikan null: kita hanya bertindak pada
 * peristiwa yang benar-benar final.
 */
export function bacaStatusWebhook(
  payload: unknown
): { externalId: string; status: 'lunas' | 'gagal' } | null {
  if (typeof payload !== 'object' || payload === null) return null

  const p = payload as Record<string, unknown>
  const externalId = p.external_id
  const status = p.status

  if (typeof externalId !== 'string' || typeof status !== 'string') return null

  if (status === 'PAID' || status === 'SETTLED') {
    return { externalId, status: 'lunas' }
  }
  if (status === 'EXPIRED' || status === 'FAILED') {
    return { externalId, status: 'gagal' }
  }
  return null
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `cd apps/retail-gateway && ../../node_modules/.bin/vitest run src/lib/xendit.test.ts`
Expected: PASS 6/6

- [ ] **Step 5: Commit**

```bash
git add apps/retail-gateway/src/lib/xendit.ts apps/retail-gateway/src/lib/xendit.test.ts
git commit -m "feat(retail-gateway): adapter pembayaran Xendit"
```

---

## Task 10: Buat pesanan (draft + tagihan)

**Files:**
- Create: `apps/retail-gateway/src/app/api/v1/orders/route.ts`
- Create: `apps/retail-gateway/src/app/api/v1/orders/[id]/route.ts`

**Interfaces:**
- Consumes: `requireCustomer` (Task 4), `hitungTotal` (Task 5), `buatKodeAmbil` (Task 6), `ambilKatalog` + `kosongkanCacheKatalog` (Task 7), `periksaKeranjang` (Task 8), `buatTagihan` (Task 9)
- Produces:
  - `POST /api/v1/orders` menerima `{ client_order_id, outlet_id, items, customer_phone? }`, mengembalikan `{ order_id, pickup_code, payment_url, total_amount, expires_at }`
  - `GET /api/v1/orders/:id` mengembalikan `{ id, status, pickup_code, total_amount, pos_order_number, outlet_name }`

- [ ] **Step 1: Implementasi pembuatan pesanan**

```typescript
// apps/retail-gateway/src/app/api/v1/orders/route.ts
import { NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/auth'
import { createServiceClient, createRetailClient } from '@/lib/supabase'
import { ambilKatalog } from '@/lib/catalog'
import { periksaKeranjang, jumlahWajar } from '@/lib/validateCart'
import { hitungTotal, type ItemPesanan } from '@/lib/pricing'
import { buatKodeAmbil } from '@/lib/pickupCode'
import { buatTagihan } from '@/lib/xendit'

export const dynamic = 'force-dynamic'

const DISKON_PILOT_PERSEN = 0
const BATAS_BAYAR_MS = 15 * 60 * 1000

/** Bentuk nomor HP Indonesia yang wajar: 08xxx, 62xxx, atau +62xxx. */
function nomorHpWajar(nomor: string): boolean {
  return /^(\+62|62|0)8\d{7,12}$/.test(nomor.replace(/[\s-]/g, ''))
}

export async function POST(request: Request) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })

  let body: {
    client_order_id?: string
    outlet_id?: string
    items?: ItemPesanan[]
    customer_phone?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 })
  }

  if (!body.client_order_id || !body.outlet_id || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: 'client_order_id, outlet_id, dan items wajib diisi' },
      { status: 400 }
    )
  }

  if (!jumlahWajar(body.items)) {
    return NextResponse.json({ error: 'Jumlah pesanan tidak wajar' }, { status: 400 })
  }

  const retail = createRetailClient()

  // Idempotensi: percobaan kedua untuk client_order_id yang sama
  // mengembalikan draft yang sudah ada, bukan membuat tagihan baru.
  const { data: sudahAda } = await retail
    .from('order_drafts')
    .select('id, pickup_code, payment_url, total_amount, expires_at, status')
    .eq('client_order_id', body.client_order_id)
    .maybeSingle()

  if (sudahAda) {
    // `client_order_id` adalah kunci sekali-pakai, BUKAN id keranjang.
    // Draft yang sudah mati tidak boleh dikembalikan sebagai sukses: pelanggan
    // akan menerima tautan bayar yang tidak berlaku dan terkunci selamanya
    // pada id itu. Cron menghanguskan draft tak dibayar tiap 15 menit, jadi
    // ini kejadian rutin, bukan kasus tepi.
    if (sudahAda.status === 'kadaluarsa' || sudahAda.status === 'gagal') {
      return NextResponse.json(
        {
          error: 'pesanan_kadaluarsa',
          pesan: 'Pesanan sebelumnya sudah kedaluwarsa. Silakan buat pesanan baru.',
        },
        { status: 409 }
      )
    }

    // Draft hidup tapi tagihannya belum tercatat: proses mati di tengah, atau
    // permintaan kembar yang pemenangnya belum selesai membuat tagihan.
    if (!sudahAda.payment_url) {
      return NextResponse.json(
        {
          error: 'pesanan_sedang_diproses',
          pesan: 'Pesanan sedang diproses, coba lagi sebentar.',
        },
        { status: 409 }
      )
    }

    return NextResponse.json({
      order_id: sudahAda.id,
      pickup_code: sudahAda.pickup_code,
      payment_url: sudahAda.payment_url,
      total_amount: sudahAda.total_amount,
      expires_at: sudahAda.expires_at,
      duplicate: true,
    })
  }

  const db = createServiceClient()
  const { data: outlet, error: outletError } = await db
    .from('outlets')
    .select('id, name, app_enabled, is_active')
    .eq('id', body.outlet_id)
    .maybeSingle()

  // Kegagalan database TIDAK boleh menyamar jadi "outlet tidak melayani".
  // Ini gerbang terakhir sebelum tagihan: insiden nyata harus terlihat,
  // bukan tersembunyi di balik pesan bisnis yang salah.
  if (outletError) {
    console.error('gagal membaca outlet', outletError)
    return NextResponse.json({ error: 'Gagal memeriksa outlet' }, { status: 502 })
  }

  if (!outlet || outlet.app_enabled !== true || outlet.is_active === false) {
    return NextResponse.json(
      { error: 'Outlet sedang tidak bisa menerima pesanan' },
      { status: 409 }
    )
  }

  // Pemeriksaan terakhir sebelum tagihan dibuat, langsung ke produksi.
  let katalog
  try {
    katalog = await ambilKatalog(body.outlet_id, true)
  } catch (e) {
    console.error('gagal memuat katalog segar', e)
    return NextResponse.json({ error: 'Gagal memeriksa menu' }, { status: 502 })
  }
  const masalah = periksaKeranjang(body.items, katalog)
  if (masalah.length > 0) {
    return NextResponse.json({ error: 'keranjang_berubah', masalah }, { status: 409 })
  }

  // Nama item diambil dari KATALOG, bukan dari klien. `periksaKeranjang`
  // hanya mencocokkan id, ketersediaan, dan harga — nama tidak pernah
  // dibandingkan. Nama dari klien berakhir di `nama|NOTE|catatan` yang dibaca
  // struk dapur, jadi nama karangan (atau yang memuat `|NOTE|` sendiri) bisa
  // merusak cetakan dapur.
  const petaMenu = new Map(katalog.map((m) => [m.id, m]))
  const itemsTepercaya: ItemPesanan[] = body.items.map((it) => ({
    menu_item_id: it.menu_item_id,
    name: petaMenu.get(it.menu_item_id)?.name ?? it.name,
    unit_price: it.unit_price,
    quantity: it.quantity,
    note: it.note ? String(it.note).slice(0, 200).replace(/\|NOTE\|/g, ' ') : undefined,
  }))

  const rincian = hitungTotal(itemsTepercaya, DISKON_PILOT_PERSEN)
  const kodeAmbil = buatKodeAmbil(body.client_order_id)
  const kedaluwarsa = new Date(Date.now() + BATAS_BAYAR_MS)

  // URUTAN INI PENTING. Draft dipesan LEBIH DULU, sebelum tagihan dibuat.
  // Kendala unik pada `client_order_id` adalah satu-satunya penjaga yang
  // benar-benar atomik. Kalau tagihan dibuat duluan, dua permintaan yang
  // benar-benar bersamaan menghasilkan DUA tagihan Xendit sebelum kendala itu
  // sempat menangkapnya -- dan pelanggan yang tertagih dua kali adalah
  // kegagalan yang paling merusak kepercayaan.
  const { data: draft, error: draftError } = await retail
    .from('order_drafts')
    .insert({
      client_order_id: body.client_order_id,
      customer_id: sesi.customerId,
      outlet_id: body.outlet_id,
      items: itemsTepercaya,
      subtotal: rincian.subtotal,
      discount_amount: rincian.discountAmount,
      total_amount: rincian.total,
      pickup_code: kodeAmbil,
      expires_at: kedaluwarsa.toISOString(),
    })
    .select('id')
    .maybeSingle()

  if (draftError || !draft) {
    // 23505 = dua permintaan berlomba untuk client_order_id yang sama.
    if ((draftError as { code?: string } | null)?.code === '23505') {
      const { data: pemenang } = await retail
        .from('order_drafts')
        .select('id, pickup_code, payment_url, total_amount, expires_at')
        .eq('client_order_id', body.client_order_id)
        .maybeSingle()

      // Pemenang mungkin belum selesai membuat tagihannya. Jangan kembalikan
      // payment_url kosong -- suruh aplikasi mencoba lagi sebentar lagi.
      if (pemenang && !pemenang.payment_url) {
        // Bentuk balasan SAMA dengan jalur pemeriksaan awal. Aplikasi Android
        // mencocokkan kode mesin `error`, bukan kalimatnya.
        return NextResponse.json(
          {
            error: 'pesanan_sedang_diproses',
            pesan: 'Pesanan sedang diproses, coba lagi sebentar.',
          },
          { status: 409 }
        )
      }

      if (pemenang) {
        return NextResponse.json({
          order_id: pemenang.id,
          pickup_code: pemenang.pickup_code,
          payment_url: pemenang.payment_url,
          total_amount: pemenang.total_amount,
          expires_at: pemenang.expires_at,
          duplicate: true,
        })
      }
    }
    console.error('Gagal menyimpan draft pesanan:', draftError)
    return NextResponse.json({ error: 'Gagal menyimpan pesanan' }, { status: 500 })
  }

  const { data: pelanggan } = await retail
    .from('customers')
    .select('name')
    .eq('id', sesi.customerId)
    .maybeSingle()

  let tagihan
  try {
    tagihan = await buatTagihan({
      externalId: body.client_order_id,
      amount: rincian.total,
      description: `Pesanan SukaShawarma di ${outlet.name}`,
      customerName: pelanggan?.name ?? 'Pelanggan',
    })
  } catch (e) {
    console.error('Gagal membuat tagihan Xendit:', e)
    // Draft sudah terlanjur ada. Tandai gagal supaya tidak menggantung sebagai
    // `menunggu_bayar` yang tak akan pernah bisa dibayar, dan supaya percobaan
    // ulang dengan client_order_id yang sama tidak tersandung draft mati ini.
    const { error: tandaiGagalError } = await retail
      .from('order_drafts')
      .update({ status: 'gagal' })
      .eq('id', draft.id)
    if (tandaiGagalError) {
      console.error('GAGAL MENANDAI DRAFT GAGAL', {
        client_order_id: body.client_order_id,
        error: tandaiGagalError,
      })
    }
    return NextResponse.json({ error: 'Gagal membuat tagihan pembayaran' }, { status: 502 })
  }

  const { error: updateError } = await retail
    .from('order_drafts')
    .update({ payment_ref: tagihan.ref, payment_url: tagihan.url })
    .eq('id', draft.id)

  // Tagihan sudah ada di Xendit tapi tidak tercatat di draft. Pelanggan tetap
  // menerima tautannya dari balasan ini, tapi percobaan ulang akan melihat
  // draft tanpa payment_url. Harus terlihat, bukan ditelan.
  if (updateError) {
    console.error('GAGAL MENCATAT TAGIHAN KE DRAFT', {
      client_order_id: body.client_order_id,
      payment_ref: tagihan.ref,
      error: updateError,
    })
  }

  // Nomor hanya ditulis bila bentuknya wajar. Tanpa saringan ini, string
  // sembarang dari klien langsung mendarat di profil pelanggan, dan kasir
  // yang menelepon saat pesanan bermasalah menghubungi nomor yang tidak ada.
  if (body.customer_phone && nomorHpWajar(body.customer_phone)) {
    await retail
      .from('customers')
      .update({ phone: body.customer_phone, updated_at: new Date().toISOString() })
      .eq('id', sesi.customerId)
  }

  return NextResponse.json({
    order_id: draft.id,
    pickup_code: kodeAmbil,
    payment_url: tagihan.url,
    total_amount: rincian.total,
    expires_at: kedaluwarsa.toISOString(),
  })
}
```

- [ ] **Step 2: Implementasi pembacaan status**

```typescript
// apps/retail-gateway/src/app/api/v1/orders/[id]/route.ts
import { NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/auth'
import { createServiceClient, createRetailClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })

  const { id } = await params
  const retail = createRetailClient()

  // Selalu dibatasi ke customer_id dari token. Tanpa ini, siapa pun yang
  // menebak id pesanan bisa membaca pesanan orang lain.
  const { data: draft } = await retail
    .from('order_drafts')
    .select('id, status, pickup_code, total_amount, outlet_id, pos_order_id, pos_order_number, created_at')
    .eq('id', id)
    .eq('customer_id', sesi.customerId)
    .maybeSingle()

  if (!draft) {
    return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
  }

  const db = createServiceClient()
  const { data: outlet } = await db
    .from('outlets')
    .select('name')
    .eq('id', draft.outlet_id)
    .maybeSingle()

  let statusDapur: string | null = null
  if (draft.pos_order_id) {
    const { data: pos } = await db
      .from('orders')
      .select('status')
      .eq('id', draft.pos_order_id)
      .maybeSingle()
    statusDapur = pos?.status ?? null
  }

  return NextResponse.json({
    id: draft.id,
    status: draft.status,
    status_dapur: statusDapur,
    pickup_code: draft.pickup_code,
    total_amount: draft.total_amount,
    pos_order_number: draft.pos_order_number,
    outlet_name: outlet?.name ?? null,
    created_at: draft.created_at,
  })
}
```

- [ ] **Step 3: Type-check**

Run: `cd apps/retail-gateway && ../../node_modules/.bin/tsc --noEmit`
Expected: 0 error

- [ ] **Step 4: Commit**

```bash
git add apps/retail-gateway/src/app/api/v1/orders
git commit -m "feat(retail-gateway): pembuatan pesanan idempoten dan pembacaan status"
```

---

## Task 11: Webhook Xendit dan dorong pesanan ke kasir

**Files:**
- Create: `apps/retail-gateway/src/lib/orderPayload.ts`
- Create: `apps/retail-gateway/src/app/api/webhooks/xendit/route.ts`
- Test: `apps/retail-gateway/src/lib/orderPayload.test.ts`

**Interfaces:**
- Consumes: `bacaStatusWebhook` (Task 9), `ItemPesanan` (Task 5)
- Produces:
  - `susunPayloadPos(input: { clientOrderId, outletId, customerName, customerPhone, items, subtotal, discountAmount, total, pickupCode }): { p_order: Record<string, unknown>; p_items: Record<string, unknown>[] }`
  - `POST /api/webhooks/xendit`

- [ ] **Step 1: Tulis test yang gagal**

```typescript
// apps/retail-gateway/src/lib/orderPayload.test.ts
import { describe, it, expect } from 'vitest'
import { susunPayloadPos } from './orderPayload'

const dasar = {
  clientOrderId: '9197d153-2a29-4ca8-a123-a4a6ff8e1cbf',
  outletId: '44444444-4444-4444-4444-444444444444',
  customerName: 'Rizky Ananda',
  customerPhone: '+6281234567890',
  subtotal: 65000,
  discountAmount: 0,
  total: 65000,
  pickupCode: '4821',
  items: [
    { menu_item_id: 'm1', name: 'Shawarma Ayam Original', unit_price: 25000, quantity: 2 },
    { menu_item_id: 'm2', name: 'Es Kopi Susu', unit_price: 15000, quantity: 1, note: 'Kurangi gula' },
  ],
}

describe('susunPayloadPos', () => {
  it('tidak pernah mengirim order_number', () => {
    const { p_order } = susunPayloadPos(dasar)
    expect(p_order).not.toHaveProperty('order_number')
  })

  it('menandai sumber sebagai aplikasi pelanggan', () => {
    const { p_order } = susunPayloadPos(dasar)
    expect(p_order.source).toBe('app')
    expect(p_order.channel).toBe('app')
    expect(p_order.sales_source).toBe('app')
  })

  it('memakai client_order_id sebagai kunci idempotensi', () => {
    const { p_order } = susunPayloadPos(dasar)
    expect(p_order.client_order_id).toBe('9197d153-2a29-4ca8-a123-a4a6ff8e1cbf')
  })

  it('masuk sebagai preparing dengan struk dapur belum tercetak', () => {
    const { p_order } = susunPayloadPos(dasar)
    expect(p_order.status).toBe('preparing')
    expect(p_order.kitchen_receipt_printed).toBe(false)
  })

  it('menuliskan catatan item dengan konvensi pipe NOTE yang sudah ada', () => {
    const { p_items } = susunPayloadPos(dasar)
    expect(p_items[0].menu_item_name).toBe('Shawarma Ayam Original')
    expect(p_items[1].menu_item_name).toBe('Es Kopi Susu|NOTE|Kurangi gula')
  })

  it('menghitung subtotal per baris', () => {
    const { p_items } = susunPayloadPos(dasar)
    expect(p_items[0].subtotal).toBe(50000)
    expect(p_items[1].subtotal).toBe(15000)
  })

  it('menyertakan kode ambil di catatan pesanan', () => {
    const { p_order } = susunPayloadPos(dasar)
    expect(String(p_order.notes)).toContain('4821')
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd apps/retail-gateway && ../../node_modules/.bin/vitest run src/lib/orderPayload.test.ts`
Expected: FAIL — `Cannot find module './orderPayload'`

- [ ] **Step 3: Implementasi**

```typescript
// apps/retail-gateway/src/lib/orderPayload.ts
import type { ItemPesanan } from './pricing'

/**
 * Menyusun argumen untuk RPC atomic_insert_order.
 *
 * Aturan yang tidak boleh dilanggar:
 * - order_number TIDAK disertakan; trigger database yang menetapkannya.
 * - Catatan item ditulis `nama|NOTE|catatan`, konvensi yang sudah dipakai
 *   struk dapur. Format baru akan mengacaukan cetakan dapur.
 */
export function susunPayloadPos(input: {
  clientOrderId: string
  outletId: string
  customerName: string
  customerPhone: string | null
  items: ItemPesanan[]
  subtotal: number
  discountAmount: number
  total: number
  pickupCode: string
}): { p_order: Record<string, unknown>; p_items: Record<string, unknown>[] } {
  const sekarang = new Date().toISOString()

  const p_order: Record<string, unknown> = {
    outlet_id: input.outletId,
    client_order_id: input.clientOrderId,
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    cashier_name: null,
    notes: `Pesanan aplikasi. Kode ambil: ${input.pickupCode}`,
    payment_method: 'qris',
    total_amount: input.total,
    discount_amount: input.discountAmount,
    promo_subsidy: 0,
    status: 'preparing',
    kitchen_receipt_printed: false,
    source: 'app',
    channel: 'app',
    sales_source: 'app',
    // `external_order_id` SENGAJA TIDAK DIISI. Trigger BOM punya penjaga
    // `IF NEW.external_order_id IS NOT NULL THEN RETURN NEW` (tiga migration:
    // 20260725000000, 20300103000008, 20300103000010) untuk melewati impor
    // historis Pawoon. Mengisinya di sini membuat SETIAP pesanan aplikasi
    // dilewati trigger, sehingga stok bahan baku tidak pernah terpotong —
    // uang masuk, makanan keluar, sistem tidak tahu. Idempotensi tidak
    // membutuhkannya: `orders.client_order_id` sudah berkendala UNIQUE dan
    // itulah yang dipakai jalur 23505 di webhook.
    created_at: sekarang,
    updated_at: sekarang,
  }

  const p_items = input.items.map((it) => ({
    menu_item_id: it.menu_item_id,
    menu_item_name: it.note ? `${it.name}|NOTE|${it.note}` : it.name,
    quantity: it.quantity,
    unit_price: it.unit_price,
    subtotal: it.unit_price * it.quantity,
    package_choices: null,
  }))

  return { p_order, p_items }
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `cd apps/retail-gateway && ../../node_modules/.bin/vitest run src/lib/orderPayload.test.ts`
Expected: PASS 7/7

- [ ] **Step 5: Implementasi webhook**

```typescript
// apps/retail-gateway/src/app/api/webhooks/xendit/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient, createRetailClient } from '@/lib/supabase'
import { bacaStatusWebhook, rahasiaCocok } from '@/lib/xendit'
import { susunPayloadPos } from '@/lib/orderPayload'
import type { ItemPesanan } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  // Token diperiksa PALING AWAL, sebelum apa pun dibaca dari payload.
  // Memeriksanya belakangan membuat endpoint jadi oracle yang membocorkan
  // keberadaan pesanan kepada pemanggil yang tidak berhak.
  const token = request.headers.get('x-callback-token')
  const diharapkan = process.env.XENDIT_WEBHOOK_TOKEN
  // Perbandingan tahan-waktu, bukan `!==`. Lihat catatan di `rahasiaCocok`.
  if (!diharapkan || !rahasiaCocok(token, diharapkan)) {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload tidak valid' }, { status: 400 })
  }

  const peristiwa = bacaStatusWebhook(payload)
  if (!peristiwa) {
    // Status yang tidak final: akui saja supaya Xendit tidak mengirim ulang.
    return NextResponse.json({ diabaikan: true })
  }

  const retail = createRetailClient()
  const { data: draft } = await retail
    .from('order_drafts')
    .select('id, client_order_id, customer_id, outlet_id, items, subtotal, discount_amount, total_amount, pickup_code, status, pos_order_id')
    .eq('client_order_id', peristiwa.externalId)
    .maybeSingle()

  if (!draft) {
    console.error('Webhook untuk pesanan yang tidak dikenal:', peristiwa.externalId)
    return NextResponse.json({ diabaikan: true })
  }

  if (peristiwa.status === 'gagal') {
    if (draft.status === 'menunggu_bayar') {
      await retail.from('order_drafts').update({ status: 'gagal' }).eq('id', draft.id)
    }
    return NextResponse.json({ ok: true })
  }

  // Sudah pernah didorong ke kasir. Webhook kembar itu lumrah -- abaikan,
  // jangan membuat pesanan kedua.
  if (draft.pos_order_id) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  const { data: pelanggan } = await retail
    .from('customers')
    .select('name, phone')
    .eq('id', draft.customer_id)
    .maybeSingle()

  const { p_order, p_items } = susunPayloadPos({
    clientOrderId: draft.client_order_id,
    outletId: draft.outlet_id,
    customerName: pelanggan?.name ?? 'Pelanggan Aplikasi',
    customerPhone: pelanggan?.phone ?? null,
    items: draft.items as ItemPesanan[],
    subtotal: Number(draft.subtotal),
    discountAmount: Number(draft.discount_amount),
    total: Number(draft.total_amount),
    pickupCode: draft.pickup_code,
  })

  const db = createServiceClient()
  const { data: hasil, error } = await db.rpc('atomic_insert_order', {
    p_order,
    p_items,
  })

  if (error) {
    // 23505 pada client_order_id: percobaan kembar sudah menang duluan.
    if ((error as { code?: string }).code === '23505') {
      const { data: pemenang } = await db
        .from('orders')
        .select('id, order_number')
        .eq('client_order_id', draft.client_order_id)
        .maybeSingle()
      if (pemenang) {
        const { error: sinkronError } = await retail
          .from('order_drafts')
          .update({
            status: 'dibayar',
            paid_at: new Date().toISOString(),
            pos_order_id: pemenang.id,
            pos_order_number: pemenang.order_number,
          })
          .eq('id', draft.id)

        // Sama seperti jalur utama: kalau draft gagal diselaraskan, balas 500
        // supaya Xendit mengirim ulang dan percobaan berikutnya mencobanya lagi.
        if (sinkronError) {
          console.error('GAGAL MENYELARASKAN DRAFT DENGAN PESANAN PEMENANG', {
            client_order_id: draft.client_order_id,
            pos_order_id: pemenang.id,
            error: sinkronError,
          })
          return NextResponse.json({ error: 'Gagal menyelesaikan pesanan' }, { status: 500 })
        }

        return NextResponse.json({ ok: true, duplicate: true })
      }
    }

    // Uang pelanggan sudah masuk tapi pesanan gagal sampai ke kasir.
    // Ini WAJIB terlihat, bukan ditelan diam-diam.
    console.error('GAGAL DORONG PESANAN BERBAYAR KE KASIR', {
      client_order_id: draft.client_order_id,
      error,
    })
    return NextResponse.json({ error: 'Gagal meneruskan ke kasir' }, { status: 500 })
  }

  const posOrder = hasil as { id: string; order_number: number }

  const { error: kodeError } = await db
    .from('orders')
    .update({ pickup_code: draft.pickup_code })
    .eq('id', posOrder.id)

  // Kode ambil gagal tercatat: pesanan tetap masuk dapur, tapi kasir tidak
  // bisa mencarinya lewat kolom kode. Terdegradasi, bukan fatal — kodenya
  // masih tertulis di `notes`. Tetap harus terlihat.
  if (kodeError) {
    console.error('GAGAL MENCATAT KODE AMBIL', {
      order_id: posOrder.id,
      pickup_code: draft.pickup_code,
      error: kodeError,
    })
  }

  const { error: draftUpdateError } = await retail
    .from('order_drafts')
    .update({
      status: 'dibayar',
      paid_at: new Date().toISOString(),
      pos_order_id: posOrder.id,
      pos_order_number: posOrder.order_number,
    })
    .eq('id', draft.id)

  // Pesanan sudah di dapur dan uang sudah masuk, tapi draft tidak tahu.
  // Balas 500 supaya Xendit mengirim ulang: percobaan berikutnya menemukan
  // pesanan lewat jalur 23505 dan menyembuhkan draft ini sendiri. Membalas
  // 200 di sini akan menghentikan pengiriman ulang dan mengunci draft
  // selamanya di `menunggu_bayar`.
  if (draftUpdateError) {
    console.error('GAGAL MENANDAI DRAFT DIBAYAR', {
      client_order_id: draft.client_order_id,
      pos_order_id: posOrder.id,
      error: draftUpdateError,
    })
    return NextResponse.json({ error: 'Gagal menyelesaikan pesanan' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, order_number: posOrder.order_number })
}
```

- [ ] **Step 6: Jalankan seluruh test**

Run: `cd apps/retail-gateway && ../../node_modules/.bin/vitest run`
Expected: PASS semua (40 test dari Task 2-11)

- [ ] **Step 7: Commit**

```bash
git add apps/retail-gateway/src/lib/orderPayload.ts apps/retail-gateway/src/lib/orderPayload.test.ts apps/retail-gateway/src/app/api/webhooks
git commit -m "feat(retail-gateway): webhook Xendit mendorong pesanan berbayar ke kasir secara idempoten"
```

---

## Task 12: Cron kadaluarsa draft

**Files:**
- Create: `apps/retail-gateway/src/app/api/cron/expire-drafts/route.ts`

**Interfaces:**
- Consumes: `createRetailClient` (Task 2)
- Produces: `POST /api/cron/expire-drafts` dengan header `authorization: Bearer <CRON_SECRET>`

- [ ] **Step 1: Implementasi**

```typescript
// apps/retail-gateway/src/app/api/cron/expire-drafts/route.ts
import { NextResponse } from 'next/server'
import { createRetailClient } from '@/lib/supabase'
import { rahasiaCocok } from '@/lib/xendit'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const rahasia = process.env.CRON_SECRET
  // Perbandingan tahan-waktu, bukan `!==`. Lihat catatan di `rahasiaCocok`.
  if (!rahasia || !rahasiaCocok(request.headers.get('authorization'), `Bearer ${rahasia}`)) {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 })
  }

  const retail = createRetailClient()

  // Hanya draft yang belum dibayar. Draft yang sudah dibayar tapi belum
  // terdorong ke kasir TIDAK boleh dihanguskan -- itu uang pelanggan yang
  // butuh penanganan manusia, bukan penghapusan otomatis.
  const { data, error } = await retail
    .from('order_drafts')
    .update({ status: 'kadaluarsa' })
    .eq('status', 'menunggu_bayar')
    .lt('expires_at', new Date().toISOString())
    .select('id')

  if (error) {
    console.error('Gagal menghanguskan draft:', error)
    return NextResponse.json({ error: 'Gagal memproses' }, { status: 500 })
  }

  return NextResponse.json({ dihanguskan: data?.length ?? 0 })
}
```

- [ ] **Step 2: Type-check dan build**

Run: `cd apps/retail-gateway && ../../node_modules/.bin/tsc --noEmit && yarn build`
Expected: 0 error, build sukses, seluruh route muncul di keluaran

- [ ] **Step 3: Commit**

```bash
git add apps/retail-gateway/src/app/api/cron
git commit -m "feat(retail-gateway): cron penghangusan draft yang tidak dibayar"
```

---

## Task 13: Deploy dan verifikasi ujung-ke-ujung

**Files:**
- Modify: konfigurasi Coolify (di panel, bukan di repo)

- [ ] **Step 0: Expose skema `retail` ke PostgREST**

Migration memberi hak ke `service_role`, tapi PostgREST hanya melayani skema yang terdaftar. Di Supabase Dashboard → **Settings → API → Exposed schemas**, tambahkan `retail` di samping `public` dan `graphql_public`, lalu simpan.

Verifikasi bahwa skemanya benar-benar terlayani sebelum melangkah:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Accept-Profile: retail" \
  "<SUPABASE_URL>/rest/v1/customers?limit=1"
```
Expected: `200`. Kalau `404` atau `406`, skemanya belum ter-expose dan **seluruh gateway akan mati** — jangan lanjut sebelum ini hijau.

- [ ] **Step 0b: Jadwalkan cron penghangusan draft**

Endpoint `/api/cron/expire-drafts` tidak memanggil dirinya sendiri. Tanpa penjadwal, draft tak dibayar tidak pernah hangus, dan seluruh kontrak `pesanan_kadaluarsa` di Global Constraints tidak pernah berlaku.

Buat scheduled task di Coolify (atau cron sistem) yang menjalankan tiap 5 menit:

```bash
curl -s -X POST https://<domain-gateway>/api/cron/expire-drafts \
  -H "authorization: Bearer <CRON_SECRET>"
```

Verifikasi sekali secara manual dan pastikan balasannya `{"dihanguskan":<angka>}`, bukan `401`.

- [ ] **Step 1: Set env var di panel Coolify**

App baru `retail-gateway`, semua variabel berikut WAJIB ada. Coolify tidak mengirim build-arg untuk variabel yang tidak dideklarasikan di panelnya, jadi variabel yang lupa di-set akan `undefined` di runtime tanpa pesan apa pun.

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SESSION_SECRET              (acak, minimal 32 karakter)
GOOGLE_ANDROID_CLIENT_ID
XENDIT_SECRET_KEY
XENDIT_WEBHOOK_TOKEN
CRON_SECRET
```

- [ ] **Step 2: Deploy dan cek health**

```bash
curl -s https://<domain-gateway>/api/health
```
Expected: `{"status":"ok","service":"retail-gateway"}`

- [ ] **Step 3: Nyalakan outlet pilot**

```bash
supabase db query "UPDATE outlets SET app_enabled = true WHERE name IN ('<Outlet Pilot 1>','<Outlet Pilot 2>');" --linked
```

Ganti nama outlet dengan outlet pilot yang dipilih pemilik. Verifikasi:

```bash
supabase db query "SELECT name, app_enabled FROM outlets WHERE app_enabled = true;" --linked
```

- [ ] **Step 4: Terbitkan menu ke aplikasi**

```bash
supabase db query "UPDATE menu_items SET tampil_di_app = true WHERE outlet_id IN (SELECT id FROM outlets WHERE app_enabled = true) AND is_available = true;" --linked
```

> `menu_items` mungkin memuat lebih dari 1.000 baris. PostgREST membatasi hasil di 1.000 baris, tapi `UPDATE` lewat `db query` berjalan langsung di database sehingga tidak terkena batas itu. Kalau memakai klien PostgREST, lakukan berulang dan verifikasi sisanya.

- [ ] **Step 5: Uji katalog dari luar**

```bash
curl -s "https://<domain-gateway>/api/v1/catalog?outlet_id=<uuid-outlet-pilot>"
```
Expected: JSON berisi `items` tidak kosong

- [ ] **Step 6: Daftarkan webhook di dashboard Xendit**

URL: `https://<domain-gateway>/api/webhooks/xendit`
Callback token: nilai yang sama dengan `XENDIT_WEBHOOK_TOKEN`

- [ ] **Step 7: Uji tolak webhook tanpa token**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<domain-gateway>/api/webhooks/xendit -H "content-type: application/json" -d '{"external_id":"uji","status":"PAID"}'
```
Expected: `401`

- [ ] **Step 8: Uji ujung-ke-ujung dengan uang sungguhan bernilai kecil**

Pakai mode uji Xendit lebih dulu. Setelah lolos, lakukan satu transaksi nyata bernilai kecil di outlet pilot dan verifikasi berurutan:

1. `POST /api/v1/orders` mengembalikan `payment_url` dan `pickup_code`
2. Setelah dibayar, baris muncul di `orders` dengan `source = 'app'` dan `pickup_code` terisi
3. Pesanan tampil di layar POS kasir outlet tersebut
4. `order_items` berisi item yang benar, catatan memakai format `|NOTE|`
5. Stok bahan baku terpotong oleh trigger BOM
6. Mengirim ulang webhook yang sama **tidak** membuat pesanan kedua

```bash
supabase db query "SELECT order_number, source, pickup_code, total_amount, status FROM orders WHERE source = 'app' ORDER BY created_at DESC LIMIT 5;" --linked
```

- [ ] **Step 9: Commit catatan operasional**

Tambahkan ringkasan sesi ke `CLAUDE.md` (bagian Session) yang mencatat: app baru `retail-gateway`, daftar env var wajibnya, outlet pilot yang dinyalakan, dan bahwa `source = 'app'` adalah penanda pesanan aplikasi.

```bash
git add CLAUDE.md
git commit -m "docs: catat retail-gateway dan penanda source=app di panduan proyek"
```

---

## Rencana Lanjutan

Setelah rencana ini selesai dan terverifikasi:

| Rencana | Isi |
|---|---|
| **Tahap 1b** | Aplikasi Android Kotlin/Compose — 16 layar, mengonsumsi API di rencana ini |
| **Tahap 1c** | Sisi kasir — penanda "APP", bunyi notifikasi, papan pesanan aplikasi, pencarian kode ambil |

Tahap 1b tidak bisa dimulai sebelum rencana ini lulus Task 13, karena aplikasi butuh API yang benar-benar hidup untuk diuji.

---

## Catatan Verifikasi Mandiri

Cakupan terhadap spesifikasi Tahap 1:

| Bagian spesifikasi | Task |
|---|---|
| §2.1 Pola satu pintu, aplikasi tanpa kunci DB | 2, 4 |
| §3.1 Login Google lewat gateway | 4 |
| §3.2 Nomor HP opsional | 10 (disimpan saat membuat pesanan) |
| §4.2 Validasi pra-bayar empat pemeriksaan | 8 |
| §4.3 Aturan uang: webhook, idempotensi, harga terkunci | 10, 11 |
| §4.4 Draft hangus 15 menit | 12 |
| §5.1 Kolom aditif menu | 1 |
| §5.2 Cache 5 menit | 7 |
| §5.6 Bentuk pesanan tidak berubah | 11 |
| §6.1 Batas potongan 50 persen | 5 |
| §7.2 Kode pengambilan | 6, 11 |
| §8.1 Perubahan tabel existing aditif | 1 |
| §8.3 Identitas selalu dari token | 4, 10 |
| §10 Kriteria pilot | 13 |

**Belum tercakup di rencana ini, sengaja:** verifikasi WhatsApp (menunggu akun Meta), poin & tier (Tahap 2), bundle & referral (Tahap 3), notifikasi push (Tahap 1b, sisi aplikasi), papan pesanan kasir (Tahap 1c).
