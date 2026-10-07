# Webapp Bot (`bot.sukashawarma.com`) Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner/admin/developer bisa membuka `bot.sukashawarma.com`, login SSO, lalu bertanya ke Bot CEO (Hermes profil `ceo`) dengan jawaban streaming dan riwayat tersimpan.

**Architecture:** App Next.js baru `apps/bot`. Server app memeriksa sesi + `is_owner_or_admin()`, memetakan role → profil Hermes, memanggil API server Hermes (`/p/<profil>/v1/chat/completions`, OpenAI-compatible, SSE) lewat jaringan internal VPS dengan kunci profil server-only, meneruskan teks ke browser sebagai stream, dan menyimpan percakapan di Supabase (RLS milik sendiri). Tanpa middleware & tanpa mengubah `@suka/auth`: gerbang di halaman & route (pola SUKA Bot).

**Tech Stack:** Next.js 16 app router, React 19, TypeScript, Tailwind v4, `@suka/auth`, `@suka/design-system`, Supabase, vitest (node env), Docker/Coolify, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-07-webapp-bot-design.md` · API Hermes: `docs/superpowers/specs/2026-10-07-hermes-api-design.md` · VPS: `docs/RUNBOOK-HERMES-VPS.md`

## Global Constraints

- Fase 1: role `owner`, `admin`, `developer` → profil `ceo`; role lain **ditolak** (403/halaman "tidak punya akses").
- **Jangan ubah `packages/auth`** (`AppName`, `ROLE_APP_ACCESS`) — gerbang lokal app ini.
- **Jangan tambah dependency baru** di luar yang sudah ada di `yarn.lock` dengan **range persis sama** (lihat Task 1). Jangan jalankan `yarn install` polos di root (drift `SUKASHAWARMA`, CLAUDE.md). Verifikasi: `yarn install --frozen-lockfile --ignore-engines` lolos tanpa mengubah `yarn.lock`.
- Kunci Hermes (`HERMES_KEY_CEO`) & `HERMES_API_URL` **server-only**: tidak pernah di respons, HTML, atau bundle browser; wajib `ARG`+`ENV` di stage **runner** Dockerfile.
- Batas: pesan 1–2.000 karakter; 60 pesan user/orang/jam; 50 percakapan/orang; timeout Hermes 120 dtk.
- Teks galat standar: `Bot sedang tidak bisa dihubungi. Coba lagi sebentar lagi.` — tak pernah jawaban kosong.
- Port dev: **3050**. Workspace: `@suka/bot`.
- Migration timestamp `YYYYMMDDHHMMSS` hari kerja; cek `schema_migrations` dulu; `apply_migration` menstempel versi = waktu apply → rename berkas mengikuti stempel sebelum commit.
- Kerja di branch `feat/webapp-bot`; cek `git branch --show-current` sebelum commit (otomasi repo bisa memindah branch).
- Commit diakhiri `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (bila dikerjakan Claude).

## File Structure

| File | Tanggung jawab |
|---|---|
| `apps/bot/package.json`, `next.config.mjs`, `tsconfig.json`, `postcss.config.mjs`, `vitest.config.ts`, `public/.gitkeep` | Kerangka app |
| `apps/bot/src/app/{layout.tsx,globals.css}` | Shell + palet |
| `apps/bot/src/app/api/health/route.ts` | Health check |
| `apps/bot/src/lib/peran.ts` | role → profil |
| `apps/bot/src/lib/batas.ts` | konstanta & aturan batas |
| `apps/bot/src/lib/hermes.ts` | klien API server Hermes + parser SSE |
| `apps/bot/src/lib/teks.ts` | render teks (tebal/baris) tanpa HTML mentah |
| `apps/bot/src/lib/server/sesi.ts` | gerbang sesi + role |
| `apps/bot/src/lib/server/percakapan.ts` | akses tabel (buat, pangkas, hitung, simpan) |
| `apps/bot/src/app/api/chat/route.ts` | POST chat streaming |
| `apps/bot/src/app/api/percakapan/route.ts`, `[id]/route.ts` | daftar, isi, hapus |
| `apps/bot/src/app/page.tsx`, `src/components/ChatApp.tsx` | UI |
| `supabase/migrations/<ts>_bot_percakapan.sql`, `supabase/verifikasi/bot/t1_rls.sql` | Data + uji RLS |
| `apps/portal/src/app/launcher/page.tsx` | Tile "Bot CEO" |
| `apps/bot/Dockerfile`, `.github/workflows/deploy-bot-coolify.yml`, `.github/workflows/ci.yml` | Deploy & CI |
| `docs/RUNBOOK-HERMES-VPS.md` | API server Hermes + jaringan |

---

### Task 1: Kerangka `apps/bot`

**Files:** Create `apps/bot/package.json`, `apps/bot/next.config.mjs`, `apps/bot/tsconfig.json`, `apps/bot/postcss.config.mjs`, `apps/bot/vitest.config.ts`, `apps/bot/public/.gitkeep`, `apps/bot/src/app/layout.tsx`, `apps/bot/src/app/globals.css`, `apps/bot/src/app/page.tsx` (sementara), `apps/bot/src/app/api/health/route.ts`, `apps/bot/src/lib/smoke.test.ts`; Modify `.claude/launch.json`.

**Interfaces:** Produces workspace `@suka/bot`, alias `@/*` → `src/*`, script `test`/`type-check`/`build`.

- [ ] **Step 1: Cek range dependency yang sudah ada di lockfile**

Run (root):
```bash
for p in next react react-dom @supabase/ssr @supabase/supabase-js lucide-react zod typescript @types/node @types/react @types/react-dom tailwindcss @tailwindcss/postcss postcss vitest; do grep -m1 -E "^\"?$p@" yarn.lock || echo "TIDAK ADA: $p"; done
```
Catat range persis (mis. `next@^16.1.6`). Pakai range yang **tercetak** di sini pada `package.json` Step 2; bila sebuah range di Step 2 tidak muncul, ganti dengan range yang ada.

- [ ] **Step 2: `package.json`**

```json
{
  "name": "@suka/bot",
  "version": "0.0.1",
  "private": true,
  "description": "Webapp Bot Suka Shawarma — meja depan Hermes (bot.sukashawarma.com)",
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3050",
    "build": "next build",
    "start": "next start",
    "type-check": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@suka/auth": "*",
    "@suka/design-system": "*",
    "@supabase/ssr": "^0.5.1",
    "@supabase/supabase-js": "^2.38.0",
    "lucide-react": "^0.300.0",
    "next": "^16.1.6",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.3.3",
    "@types/node": "^20.10.6",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "postcss": "^8.4.32",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.3.3",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Konfigurasi**

```js
// apps/bot/next.config.mjs
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(__dirname, '../../')

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@suka/auth', '@suka/design-system'],
  outputFileTracingRoot: workspaceRoot,
  turbopack: { root: workspaceRoot },
  typescript: { tsconfigPath: './tsconfig.json' },
}

export default nextConfig
```

```json
// apps/bot/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "jsx": "preserve",
    "incremental": true,
    "noEmit": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "types": ["vitest/globals"],
    "paths": {
      "@/*": ["./src/*"],
      "@suka/auth": ["../../packages/auth/src/index.ts"],
      "@suka/design-system": ["../../packages/design-system/src/index.ts"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

```js
// apps/bot/postcss.config.mjs
export default { plugins: { '@tailwindcss/postcss': {} } }
```

```ts
// apps/bot/vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: { globals: true, environment: 'node', include: ['src/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
```

`apps/bot/public/.gitkeep` — berkas kosong (runner Dockerfile menyalin `public/`).

- [ ] **Step 4: Shell app**

```css
/* apps/bot/src/app/globals.css */
@import url('https://fonts.googleapis.com/css2?family=Lilita+One&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
@import "tailwindcss";

@source "../../../../packages";

@theme {
  --color-suka-orange: #f29744;
  --color-suka-brown: #701604;
  --color-suka-ink: #400a07;
  --color-suka-cream: #fff7ed;
  --color-suka-green: #0a7d2c;
  --font-display: 'Lilita One', system-ui, sans-serif;
  --font-sans: 'Plus Jakarta Sans', system-ui, sans-serif;
}

html, body { height: 100%; }
body { font-family: var(--font-sans); background: var(--color-suka-cream); color: var(--color-suka-ink); }
```

```tsx
// apps/bot/src/app/layout.tsx
import './globals.css'

export const metadata = {
  title: 'Bot CEO — Suka Shawarma',
  description: 'Tanya data operasional Suka Shawarma',
}
export const viewport = { themeColor: '#f29744', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  )
}
```

```tsx
// apps/bot/src/app/page.tsx  (sementara — diganti di Task 7)
export default function Halaman() {
  return <main className="p-6">Bot CEO — sedang disiapkan.</main>
}
```

```ts
// apps/bot/src/app/api/health/route.ts
export const dynamic = 'force-dynamic'
export function GET() {
  return Response.json({ ok: true })
}
```

```ts
// apps/bot/src/lib/smoke.test.ts
describe('kerangka', () => {
  it('vitest jalan', () => expect(1 + 1).toBe(2))
})
```

- [ ] **Step 5: Verifikasi lockfile tidak berubah & app jalan**

Run (root): `yarn install --frozen-lockfile --ignore-engines && git diff --stat yarn.lock`
Expected: install lolos; `git diff --stat yarn.lock` **kosong**. Bila gagal karena range, kembali ke Step 1 dan samakan range — jangan memperbarui lockfile.
Run: `cd apps/bot && yarn test && yarn type-check && yarn build`
Expected: test PASS, tsc 0 error, build sukses (`/`, `/api/health`).

- [ ] **Step 6: Entri dev server**

Tambahkan ke array `configurations` di `.claude/launch.json`:
```json
{ "name": "bot", "runtimeExecutable": "yarn", "runtimeArgs": ["workspace", "@suka/bot", "dev"], "port": 3050 }
```

- [ ] **Step 7: Commit**

```bash
git add apps/bot .claude/launch.json
git commit -m "feat(bot): kerangka app Next.js apps/bot (@suka/bot, port 3050)"
```

---

### Task 2: Tabel percakapan & pesan

**Files:** Create `supabase/migrations/<ts>_bot_percakapan.sql`, `supabase/verifikasi/bot/t1_rls.sql`.

**Interfaces:** Produces `public.bot_percakapan(id uuid, staff_id uuid default auth.uid(), profil text, judul text, hermes_session_id uuid, dibuat_at, diperbarui_at)` dan `public.bot_pesan(id bigint, percakapan_id uuid, peran 'user'|'bot', isi text, meta jsonb, dibuat_at)`; RLS milik sendiri.

- [ ] **Step 1: Cek timestamp bebas**

```sql
SELECT version FROM supabase_migrations.schema_migrations WHERE version >= to_char(now() AT TIME ZONE 'UTC','YYYYMMDD') ORDER BY 1;
```
Pilih `<ts>` = tanggal hari ini + jam yang belum dipakai.

- [ ] **Step 2: Uji RLS (gagal sebelum migration)**

```sql
-- supabase/verifikasi/bot/t1_rls.sql — selalu ROLLBACK. Lulus = tanpa error.
BEGIN;
DO $$
DECLARE a uuid; b uuid; pa uuid; n int; v_ok boolean;
BEGIN
  IF to_regclass('public.bot_percakapan') IS NULL THEN RAISE EXCEPTION 'tabel bot belum ada'; END IF;
  SELECT id INTO a FROM outlet_staff WHERE role IN ('admin','owner') AND status='active' ORDER BY id LIMIT 1;
  SELECT id INTO b FROM outlet_staff WHERE role IN ('admin','owner','developer') AND status='active' AND id <> a ORDER BY id LIMIT 1;
  IF a IS NULL OR b IS NULL THEN RAISE EXCEPTION 'fixture kurang'; END IF;

  -- (a) A membuat percakapan + pesan
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO bot_percakapan (profil, judul) VALUES ('ceo', 'uji') RETURNING id INTO pa;
  INSERT INTO bot_pesan (percakapan_id, peran, isi) VALUES (pa, 'user', 'halo');
  RESET ROLE;

  -- (b) B tidak melihat & tidak bisa menghapus milik A
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM bot_percakapan WHERE id = pa;
  IF n <> 0 THEN RAISE EXCEPTION '(b) B melihat percakapan A'; END IF;
  SELECT count(*) INTO n FROM bot_pesan WHERE percakapan_id = pa;
  IF n <> 0 THEN RAISE EXCEPTION '(b) B melihat pesan A'; END IF;
  DELETE FROM bot_percakapan WHERE id = pa;
  RESET ROLE;
  SELECT count(*) INTO n FROM bot_percakapan WHERE id = pa;
  IF n <> 1 THEN RAISE EXCEPTION '(b) B menghapus percakapan A'; END IF;

  -- (c) B tidak bisa menulis pesan ke percakapan A
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN INSERT INTO bot_pesan (percakapan_id, peran, isi) VALUES (pa, 'user', 'nyusup');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION '(c) B menulis ke percakapan A'; END IF;
  RESET ROLE;

  -- (d) anon nol akses
  SET LOCAL ROLE anon;
  v_ok := false;
  BEGIN PERFORM 1 FROM bot_percakapan LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION '(d) anon membaca bot_percakapan'; END IF;
  RESET ROLE;
END $$;
ROLLBACK;
-- Kontrol negatif (terpisah, harus GAGAL): di (b) ganti klaim sub B menjadi A.
```
Run: Expected ERROR `tabel bot belum ada`.

- [ ] **Step 3: Migration**

```sql
-- supabase/migrations/<ts>_bot_percakapan.sql
-- Riwayat percakapan webapp Bot (apps/bot). Spec: docs/superpowers/specs/2026-10-07-webapp-bot-design.md §6.

CREATE TABLE IF NOT EXISTS public.bot_percakapan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.outlet_staff(id) ON DELETE CASCADE,
  profil text NOT NULL CHECK (profil IN ('ceo','gudang','hrd','finance')),
  judul text NOT NULL CHECK (char_length(judul) BETWEEN 1 AND 120),
  hermes_session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  dibuat_at timestamptz NOT NULL DEFAULT now(),
  diperbarui_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bot_pesan (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  percakapan_id uuid NOT NULL REFERENCES public.bot_percakapan(id) ON DELETE CASCADE,
  peran text NOT NULL CHECK (peran IN ('user','bot')),
  isi text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  dibuat_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bot_percakapan_staff_idx ON public.bot_percakapan (staff_id, diperbarui_at DESC);
CREATE INDEX IF NOT EXISTS bot_pesan_percakapan_idx ON public.bot_pesan (percakapan_id, dibuat_at);

ALTER TABLE public.bot_percakapan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_pesan ENABLE ROW LEVEL SECURITY;

CREATE POLICY bot_percakapan_milik_sendiri ON public.bot_percakapan
  FOR ALL TO authenticated
  USING (staff_id = auth.uid())
  WITH CHECK (staff_id = auth.uid());

CREATE POLICY bot_pesan_milik_sendiri ON public.bot_pesan
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bot_percakapan p WHERE p.id = percakapan_id AND p.staff_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bot_percakapan p WHERE p.id = percakapan_id AND p.staff_id = auth.uid()));

REVOKE ALL ON TABLE public.bot_percakapan FROM anon;
REVOKE ALL ON TABLE public.bot_pesan FROM anon;
REVOKE ALL ON SEQUENCE public.bot_pesan_id_seq FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_percakapan TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.bot_pesan TO authenticated;
GRANT USAGE ON SEQUENCE public.bot_pesan_id_seq TO authenticated;
```

- [ ] **Step 4: Terapkan (izin owner/dev dulu!) & verifikasi katalog**

Minta persetujuan sebelum apply ke DB produksi bersama. Setelah apply:
```sql
SELECT relname, relrowsecurity, has_table_privilege('anon', oid, 'SELECT') AS anon_select
FROM pg_class WHERE relname IN ('bot_percakapan','bot_pesan') AND relnamespace = 'public'::regnamespace;
SELECT policyname, tablename FROM pg_policies WHERE tablename IN ('bot_percakapan','bot_pesan');
SELECT version, name FROM supabase_migrations.schema_migrations WHERE name ILIKE '%bot_percakapan%';
```
Expected: RLS true, anon_select false, 2 policy; bila versi stempel ≠ `<ts>`, rename berkas mengikuti stempel.

- [ ] **Step 5: Jalankan uji + kontrol negatif** — uji lulus; kontrol negatif gagal dengan `(b)`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/*_bot_percakapan.sql supabase/verifikasi/bot/t1_rls.sql
git commit -m "feat(bot): tabel bot_percakapan & bot_pesan (RLS milik sendiri)"
```

---

### Task 3: Peran & batas (fungsi murni)

**Files:** Create `apps/bot/src/lib/peran.ts`, `apps/bot/src/lib/batas.ts`; Test `apps/bot/src/lib/peran.test.ts`, `apps/bot/src/lib/batas.test.ts`; Delete `apps/bot/src/lib/smoke.test.ts`.

**Interfaces:**
- Produces `type Profil = 'ceo' | 'gudang' | 'hrd' | 'finance'`, `profilUntukPeran(role: string | null | undefined): Profil | null`, `LABEL_PROFIL: Record<Profil, string>`.
- Produces `BATAS = { panjangPesan: 2000, pesanPerJam: 60, percakapanMaks: 50, timeoutMs: 120_000 }`, `validasiPesan(x: unknown): { ok: true; pesan: string } | { ok: false; galat: string }`, `judulDari(pesan: string): string`, `idUntukDipangkas(idsTerbaruDulu: string[]): string[]`, `GALAT_STANDAR: string`.

- [ ] **Step 1: Test (gagal)**

```ts
// apps/bot/src/lib/peran.test.ts
import { profilUntukPeran, LABEL_PROFIL } from './peran'

describe('peran → profil (fase 1)', () => {
  it('owner, admin, developer → ceo', () => {
    for (const r of ['owner', 'admin', 'developer']) expect(profilUntukPeran(r)).toBe('ceo')
  })
  it('role lain & kosong → null', () => {
    for (const r of ['crew', 'kitchen', 'admin_hr', 'admin_finance', 'mitra', 'spv', '', null, undefined]) {
      expect(profilUntukPeran(r as any)).toBeNull()
    }
  })
  it('label profil', () => {
    expect(LABEL_PROFIL.ceo).toBe('Bot CEO')
  })
})
```

```ts
// apps/bot/src/lib/batas.test.ts
import { BATAS, validasiPesan, judulDari, idUntukDipangkas, GALAT_STANDAR } from './batas'

describe('batas', () => {
  it('validasiPesan: trim, 1–2000 karakter', () => {
    expect(validasiPesan('  omzet kemarin  ')).toEqual({ ok: true, pesan: 'omzet kemarin' })
    expect(validasiPesan('   ').ok).toBe(false)
    expect(validasiPesan(123).ok).toBe(false)
    expect(validasiPesan('a'.repeat(2001)).ok).toBe(false)
    expect(validasiPesan('a'.repeat(2000)).ok).toBe(true)
  })
  it('judulDari: 60 karakter pertama, satu baris', () => {
    expect(judulDari('omzet\nkemarin')).toBe('omzet kemarin')
    expect(judulDari('x'.repeat(100))).toHaveLength(60)
  })
  it('idUntukDipangkas: semua setelah 50 terbaru', () => {
    const ids = Array.from({ length: 53 }, (_, i) => `id${i}`)
    expect(idUntukDipangkas(ids)).toEqual(['id50', 'id51', 'id52'])
    expect(idUntukDipangkas(ids.slice(0, 50))).toEqual([])
  })
  it('konstanta', () => {
    expect(BATAS).toEqual({ panjangPesan: 2000, pesanPerJam: 60, percakapanMaks: 50, timeoutMs: 120_000 })
    expect(GALAT_STANDAR).toBe('Bot sedang tidak bisa dihubungi. Coba lagi sebentar lagi.')
  })
})
```
Run: `cd apps/bot && yarn test` → FAIL (modul tak ada).

- [ ] **Step 2: Implementasi**

```ts
// apps/bot/src/lib/peran.ts
// Satu-satunya peta role → profil Hermes. Tambah baris saat agen divisi siap (spec W3).
export type Profil = 'ceo' | 'gudang' | 'hrd' | 'finance'

const PETA: Record<string, Profil> = {
  owner: 'ceo',
  admin: 'ceo',
  developer: 'ceo',
}

export const LABEL_PROFIL: Record<Profil, string> = {
  ceo: 'Bot CEO',
  gudang: 'Bot Gudang',
  hrd: 'Bot HRD',
  finance: 'Bot Finance',
}

export function profilUntukPeran(role: string | null | undefined): Profil | null {
  if (!role) return null
  return PETA[role] ?? null
}
```

```ts
// apps/bot/src/lib/batas.ts
export const BATAS = { panjangPesan: 2000, pesanPerJam: 60, percakapanMaks: 50, timeoutMs: 120_000 } as const

export const GALAT_STANDAR = 'Bot sedang tidak bisa dihubungi. Coba lagi sebentar lagi.'

export function validasiPesan(x: unknown): { ok: true; pesan: string } | { ok: false; galat: string } {
  if (typeof x !== 'string') return { ok: false, galat: 'Pesan tidak valid.' }
  const pesan = x.trim()
  if (!pesan) return { ok: false, galat: 'Pesan kosong.' }
  if (pesan.length > BATAS.panjangPesan) return { ok: false, galat: `Pesan maksimal ${BATAS.panjangPesan} karakter.` }
  return { ok: true, pesan }
}

export function judulDari(pesan: string): string {
  return pesan.replace(/\s+/g, ' ').trim().slice(0, 60)
}

/** `idsTerbaruDulu` diurut diperbarui_at DESC; kembalikan yang melewati batas. */
export function idUntukDipangkas(idsTerbaruDulu: string[]): string[] {
  return idsTerbaruDulu.slice(BATAS.percakapanMaks)
}
```

- [ ] **Step 3: Test lulus + hapus smoke test**

Run: `rm src/lib/smoke.test.ts && yarn test` → PASS.

- [ ] **Step 4: Commit** — `git add apps/bot/src/lib && git commit -m "feat(bot): peta peran→profil & aturan batas"`

---

### Task 4: Klien Hermes + parser SSE

**Files:** Create `apps/bot/src/lib/hermes.ts`; Test `apps/bot/src/lib/hermes.test.ts`.

**Interfaces:**
- Consumes `Profil` (Task 3), `BATAS` (Task 3).
- Produces `urlChat(baseUrl: string, profil: Profil): string`, `kunciProfil(profil: Profil, env?: Record<string, string | undefined>): string | null`, `buatPengurai(): { masukkan(potongan: string): string[]; selesai: boolean }`, `class GalatHermes extends Error { alasan: 'konfigurasi' | 'http' | 'timeout' | 'jaringan' | 'kosong' }`, `async function* tanyaHermes(o: { baseUrl: string; kunci: string; profil: Profil; sesiId: string; pesan: string; signal?: AbortSignal; fetchFn?: typeof fetch }): AsyncGenerator<string>`.

Format stream OpenAI chat completions: baris `data: {json}` dipisah baris kosong; teks di `choices[0].delta.content`; akhir `data: [DONE]`. Baris lain (komentar `:`, `event:`) diabaikan.

- [ ] **Step 1: Test (gagal)**

```ts
// apps/bot/src/lib/hermes.test.ts
import { urlChat, kunciProfil, buatPengurai, tanyaHermes, GalatHermes } from './hermes'

const delta = (t: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`

function respons(potongan: string[], status = 200) {
  const enc = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(c) { for (const p of potongan) c.enqueue(enc.encode(p)); c.close() },
  })
  return new Response(body, { status, headers: { 'content-type': 'text/event-stream' } })
}

describe('hermes', () => {
  it('urlChat memakai prefix profil', () => {
    expect(urlChat('http://10.0.1.1:8643/', 'ceo')).toBe('http://10.0.1.1:8643/p/ceo/v1/chat/completions')
  })
  it('kunciProfil membaca HERMES_KEY_<PROFIL>', () => {
    expect(kunciProfil('ceo', { HERMES_KEY_CEO: 'k' })).toBe('k')
    expect(kunciProfil('ceo', {})).toBeNull()
  })
  it('pengurai: potongan terbelah, komentar, [DONE]', () => {
    const p = buatPengurai()
    const satu = delta('Omzet ')
    expect(p.masukkan(satu.slice(0, 10))).toEqual([])
    expect(p.masukkan(satu.slice(10) + ': ping\n\n' + delta('Rp 1'))).toEqual(['Omzet ', 'Rp 1'])
    expect(p.masukkan('data: [DONE]\n\n')).toEqual([])
    expect(p.selesai).toBe(true)
  })
  it('tanyaHermes: kirim header benar & hasilkan potongan teks', async () => {
    const fetchFn = vi.fn(async () => respons([delta('Halo '), delta('Bos'), 'data: [DONE]\n\n']))
    const keluar: string[] = []
    for await (const t of tanyaHermes({ baseUrl: 'http://h:8643', kunci: 'rahasia', profil: 'ceo', sesiId: 's-1', pesan: 'hai', fetchFn: fetchFn as any })) keluar.push(t)
    expect(keluar.join('')).toBe('Halo Bos')
    const [url, init] = fetchFn.mock.calls[0] as any
    expect(url).toBe('http://h:8643/p/ceo/v1/chat/completions')
    expect(init.headers.Authorization).toBe('Bearer rahasia')
    expect(init.headers['X-Hermes-Session-Id']).toBe('s-1')
    expect(JSON.parse(init.body)).toMatchObject({ stream: true, messages: [{ role: 'user', content: 'hai' }] })
  })
  it('HTTP gagal → GalatHermes http', async () => {
    const fetchFn = vi.fn(async () => new Response('x', { status: 401 }))
    const g = tanyaHermes({ baseUrl: 'http://h', kunci: 'k', profil: 'ceo', sesiId: 's', pesan: 'p', fetchFn: fetchFn as any })
    await expect(g.next()).rejects.toMatchObject({ alasan: 'http' })
  })
  it('stream tanpa teks → GalatHermes kosong', async () => {
    const fetchFn = vi.fn(async () => respons(['data: [DONE]\n\n']))
    const g = tanyaHermes({ baseUrl: 'http://h', kunci: 'k', profil: 'ceo', sesiId: 's', pesan: 'p', fetchFn: fetchFn as any })
    await expect(g.next()).rejects.toBeInstanceOf(GalatHermes)
  })
  it('fetch melempar → GalatHermes jaringan', async () => {
    const fetchFn = vi.fn(async () => { throw new TypeError('fetch failed') })
    const g = tanyaHermes({ baseUrl: 'http://h', kunci: 'k', profil: 'ceo', sesiId: 's', pesan: 'p', fetchFn: fetchFn as any })
    await expect(g.next()).rejects.toMatchObject({ alasan: 'jaringan' })
  })
})
```
Run → FAIL.

- [ ] **Step 2: Implementasi**

```ts
// apps/bot/src/lib/hermes.ts
// Klien API server Hermes (OpenAI-compatible). SERVER-ONLY: kunci tak boleh ke browser.
import type { Profil } from './peran'
import { BATAS } from './batas'

export class GalatHermes extends Error {
  constructor(public alasan: 'konfigurasi' | 'http' | 'timeout' | 'jaringan' | 'kosong', pesan: string) {
    super(pesan)
    this.name = 'GalatHermes'
  }
}

export function urlChat(baseUrl: string, profil: Profil): string {
  return `${baseUrl.replace(/\/+$/, '')}/p/${profil}/v1/chat/completions`
}

export function kunciProfil(profil: Profil, env: Record<string, string | undefined> = process.env): string | null {
  return env[`HERMES_KEY_${profil.toUpperCase()}`] || null
}

/** Pengurai SSE bertahap: menerima potongan teks apa adanya, mengembalikan delta konten. */
export function buatPengurai() {
  let sisa = ''
  const st = {
    selesai: false,
    masukkan(potongan: string): string[] {
      sisa += potongan.replace(/\r\n/g, '\n')
      const keluar: string[] = []
      let i: number
      while ((i = sisa.indexOf('\n\n')) >= 0) {
        const blok = sisa.slice(0, i)
        sisa = sisa.slice(i + 2)
        const data = blok.split('\n').filter((b) => b.startsWith('data:')).map((b) => b.slice(5).trimStart()).join('\n')
        if (!data) continue
        if (data === '[DONE]') { st.selesai = true; continue }
        try {
          const t = JSON.parse(data)?.choices?.[0]?.delta?.content
          if (typeof t === 'string' && t) keluar.push(t)
        } catch { /* blok bukan JSON — abaikan */ }
      }
      return keluar
    },
  }
  return st
}

export async function* tanyaHermes(o: {
  baseUrl: string; kunci: string; profil: Profil; sesiId: string; pesan: string
  signal?: AbortSignal; fetchFn?: typeof fetch
}): AsyncGenerator<string> {
  const f = o.fetchFn ?? fetch
  const batasWaktu = AbortSignal.timeout(BATAS.timeoutMs)
  const signal = o.signal ? AbortSignal.any([o.signal, batasWaktu]) : batasWaktu
  let res: Response
  try {
    res = await f(urlChat(o.baseUrl, o.profil), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${o.kunci}`,
        'X-Hermes-Session-Id': o.sesiId,
      },
      body: JSON.stringify({ model: o.profil, stream: true, messages: [{ role: 'user', content: o.pesan }] }),
      signal,
    })
  } catch (e) {
    throw new GalatHermes(batasWaktu.aborted ? 'timeout' : 'jaringan', String((e as Error)?.message ?? e))
  }
  if (!res.ok || !res.body) throw new GalatHermes('http', `HTTP ${res.status}`)

  const pengurai = buatPengurai()
  const dekoder = new TextDecoder()
  const pembaca = res.body.getReader()
  let adaTeks = false
  try {
    for (;;) {
      const { value, done } = await pembaca.read()
      if (done) break
      for (const t of pengurai.masukkan(dekoder.decode(value, { stream: true }))) {
        adaTeks = true
        yield t
      }
    }
  } catch (e) {
    throw new GalatHermes(batasWaktu.aborted ? 'timeout' : 'jaringan', String((e as Error)?.message ?? e))
  }
  if (!adaTeks) throw new GalatHermes('kosong', 'Hermes tidak mengirim teks')
}
```

- [ ] **Step 3: Test lulus** — `yarn test` → PASS.
- [ ] **Step 4: Commit** — `git commit -m "feat(bot): klien API server Hermes + parser SSE"`

---

### Task 5: Gerbang sesi & akses data percakapan

**Files:** Create `apps/bot/src/lib/server/sesi.ts`, `apps/bot/src/lib/server/percakapan.ts`; Test `apps/bot/src/lib/server/percakapan.test.ts`.

**Interfaces:**
- Consumes `profilUntukPeran`, `Profil` (Task 3); `BATAS`, `judulDari`, `idUntukDipangkas` (Task 3).
- Produces `type Sesi = { supabase: any; userId: string; nama: string; profil: Profil }`, `ambilSesi(): Promise<{ ok: true; sesi: Sesi } | { ok: false; status: 401 | 403 }>`.
- Produces `hitungPesanSejamTerakhir(supabase): Promise<number>`, `buatPercakapan(supabase, profil, pesan): Promise<{ id: string; hermes_session_id: string }>`, `ambilPercakapan(supabase, id): Promise<{ id: string; profil: Profil; hermes_session_id: string } | null>`, `pangkasPercakapan(supabase): Promise<void>`, `simpanPesan(supabase, percakapanId, peran: 'user' | 'bot', isi: string, meta?: Record<string, unknown>): Promise<void>`, `sentuhPercakapan(supabase, id): Promise<void>`.

- [ ] **Step 1: Gerbang**

```ts
// apps/bot/src/lib/server/sesi.ts
// Gerbang tunggal app ini (spec W2): sesi SSO + is_owner_or_admin() + staf aktif + role terpetakan.
import { cookies } from 'next/headers'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'
import { profilUntukPeran, type Profil } from '@/lib/peran'

export type Sesi = { supabase: any; userId: string; nama: string; profil: Profil }

export async function ambilSesi(): Promise<{ ok: true; sesi: Sesi } | { ok: false; status: 401 | 403 }> {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({ getAll: () => cookieStore.getAll(), setAll: () => {} })
  const userId = await getVerifiedUserId(supabase)
  if (!userId) return { ok: false, status: 401 }
  const [{ data: boleh, error }, { data: staff }] = await Promise.all([
    supabase.rpc('is_owner_or_admin'),
    supabase.from('outlet_staff').select('name, role, status').eq('id', userId).maybeSingle(),
  ])
  const profil = profilUntukPeran(staff?.role)
  if (error || boleh !== true || staff?.status !== 'active' || !profil) return { ok: false, status: 403 }
  return { ok: true, sesi: { supabase, userId, nama: (staff?.name as string) || 'Bos', profil } }
}
```

- [ ] **Step 2: Test akses data (gagal)**

```ts
// apps/bot/src/lib/server/percakapan.test.ts
import { pangkasPercakapan, buatPercakapan } from './percakapan'

function palsu(hasil: Record<string, any>) {
  const panggilan: any[] = []
  const q: any = new Proxy({}, {
    get(_t, k) {
      if (k === 'then') return (res: any) => res(hasil[panggilan.at(-1)?.op] ?? { data: null, error: null })
      return (...a: any[]) => { panggilan.push({ op: String(k), a }); return q }
    },
  })
  return { from: vi.fn((t: string) => { panggilan.push({ op: 'from', a: [t] }); return q }), panggilan }
}

describe('percakapan', () => {
  it('pangkasPercakapan menghapus yang lewat 50', async () => {
    const ids = Array.from({ length: 52 }, (_, i) => ({ id: `p${i}` }))
    const s = palsu({ order: { data: ids, error: null }, in: { data: null, error: null } })
    await pangkasPercakapan(s)
    const hapus = s.panggilan.find((p) => p.op === 'in')
    expect(hapus.a).toEqual(['id', ['p50', 'p51']])
  })
  it('pangkasPercakapan tak menghapus apa pun bila ≤ 50', async () => {
    const s = palsu({ order: { data: [{ id: 'a' }], error: null } })
    await pangkasPercakapan(s)
    expect(s.panggilan.some((p) => p.op === 'delete')).toBe(false)
  })
  it('buatPercakapan memakai judul 60 karakter', async () => {
    const s = palsu({ single: { data: { id: 'x', hermes_session_id: 'h' }, error: null } })
    await expect(buatPercakapan(s, 'ceo', 'omzet\nkemarin')).resolves.toEqual({ id: 'x', hermes_session_id: 'h' })
    const ins = s.panggilan.find((p) => p.op === 'insert')
    expect(ins.a[0]).toEqual({ profil: 'ceo', judul: 'omzet kemarin' })
  })
})
```
Run → FAIL.

- [ ] **Step 3: Implementasi**

```ts
// apps/bot/src/lib/server/percakapan.ts
// Semua query memakai klien SESI USER — RLS (staff_id = auth.uid()) yang menjaga kepemilikan.
import type { Profil } from '@/lib/peran'
import { BATAS, judulDari, idUntukDipangkas } from '@/lib/batas'

export async function hitungPesanSejamTerakhir(supabase: any): Promise<number> {
  const sejak = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error } = await supabase
    .from('bot_pesan').select('id', { count: 'exact', head: true })
    .eq('peran', 'user').gte('dibuat_at', sejak)
  if (error) throw new Error(`hitung pesan: ${error.message}`)
  return count ?? 0
}

export async function buatPercakapan(supabase: any, profil: Profil, pesan: string) {
  const { data, error } = await supabase
    .from('bot_percakapan').insert({ profil, judul: judulDari(pesan) })
    .select('id, hermes_session_id').single()
  if (error) throw new Error(`buat percakapan: ${error.message}`)
  return data as { id: string; hermes_session_id: string }
}

export async function ambilPercakapan(supabase: any, id: string) {
  const { data, error } = await supabase
    .from('bot_percakapan').select('id, profil, hermes_session_id').eq('id', id).maybeSingle()
  if (error) throw new Error(`ambil percakapan: ${error.message}`)
  return data as { id: string; profil: Profil; hermes_session_id: string } | null
}

export async function pangkasPercakapan(supabase: any): Promise<void> {
  const { data, error } = await supabase
    .from('bot_percakapan').select('id').order('diperbarui_at', { ascending: false })
  if (error) throw new Error(`daftar percakapan: ${error.message}`)
  const buang = idUntukDipangkas((data ?? []).map((r: { id: string }) => r.id))
  if (buang.length === 0) return
  const { error: e2 } = await supabase.from('bot_percakapan').delete().in('id', buang)
  if (e2) throw new Error(`pangkas percakapan: ${e2.message}`)
}

export async function simpanPesan(
  supabase: any, percakapanId: string, peran: 'user' | 'bot', isi: string, meta: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase.from('bot_pesan').insert({ percakapan_id: percakapanId, peran, isi, meta })
  if (error) throw new Error(`simpan pesan: ${error.message}`)
}

export async function sentuhPercakapan(supabase: any, id: string): Promise<void> {
  await supabase.from('bot_percakapan').update({ diperbarui_at: new Date().toISOString() }).eq('id', id)
}

export { BATAS }
```

- [ ] **Step 4: Test lulus + type-check** — `yarn test && yarn type-check` → PASS. (Bila mock Proxy rumit di runner, sederhanakan test dengan objek berantai eksplisit — perilaku yang diuji tetap: id yang dihapus & isi insert.)
- [ ] **Step 5: Commit** — `git commit -m "feat(bot): gerbang sesi & akses data percakapan"`

---

### Task 6: Route API

**Files:** Create `apps/bot/src/app/api/chat/route.ts`, `apps/bot/src/app/api/percakapan/route.ts`, `apps/bot/src/app/api/percakapan/[id]/route.ts`; Test `apps/bot/src/app/api/kunci.test.ts`.

**Interfaces:**
- `POST /api/chat` body `{ percakapanId?: string(uuid), pesan: string }` → 200 `text/plain; charset=utf-8` stream + header `X-Percakapan-Id`; 400 `{galat}`; 401/403 `{galat}`; 429 `{galat}`.
- `GET /api/percakapan` → `{ percakapan: { id, judul, profil, diperbarui_at }[] }` (maks 50, terbaru dulu).
- `GET /api/percakapan/[id]` → `{ pesan: { id, peran, isi, dibuat_at }[] }`; `DELETE` → `{ ok: true }`.

- [ ] **Step 1: Route chat**

```ts
// apps/bot/src/app/api/chat/route.ts
import { NextResponse } from 'next/server'
import { ambilSesi } from '@/lib/server/sesi'
import { validasiPesan, BATAS, GALAT_STANDAR } from '@/lib/batas'
import { tanyaHermes, kunciProfil, GalatHermes } from '@/lib/hermes'
import {
  hitungPesanSejamTerakhir, buatPercakapan, ambilPercakapan, pangkasPercakapan, simpanPesan, sentuhPercakapan,
} from '@/lib/server/percakapan'

export const dynamic = 'force-dynamic'
export const maxDuration = 150

const UUID = /^[0-9a-f-]{36}$/i
const galat = (status: number, pesan: string) => NextResponse.json({ galat: pesan }, { status })

export async function POST(req: Request) {
  const g = await ambilSesi()
  if (!g.ok) return galat(g.status, g.status === 401 ? 'Silakan login dulu.' : 'Anda tidak punya akses ke bot ini.')
  const { supabase, profil } = g.sesi

  const body = await req.json().catch(() => ({}))
  const v = validasiPesan(body?.pesan)
  if (!v.ok) return galat(400, v.galat)
  const idDiminta = typeof body?.percakapanId === 'string' && UUID.test(body.percakapanId) ? body.percakapanId : null

  if ((await hitungPesanSejamTerakhir(supabase)) >= BATAS.pesanPerJam) {
    return galat(429, `Batas ${BATAS.pesanPerJam} pesan per jam tercapai. Coba lagi nanti.`)
  }

  let percakapan = idDiminta ? await ambilPercakapan(supabase, idDiminta) : null
  if (idDiminta && !percakapan) return galat(404, 'Percakapan tidak ditemukan.')
  if (!percakapan) {
    const baru = await buatPercakapan(supabase, profil, v.pesan)
    percakapan = { ...baru, profil }
    await pangkasPercakapan(supabase)
  }
  await simpanPesan(supabase, percakapan.id, 'user', v.pesan)

  const baseUrl = process.env.HERMES_API_URL
  const kunci = kunciProfil(percakapan.profil)
  const mulai = Date.now()
  const enc = new TextEncoder()
  const pc = percakapan

  const stream = new ReadableStream<Uint8Array>({
    async start(c) {
      let jawaban = ''
      try {
        if (!baseUrl || !kunci) throw new GalatHermes('konfigurasi', 'HERMES_API_URL / kunci profil kosong')
        for await (const t of tanyaHermes({ baseUrl, kunci, profil: pc.profil, sesiId: pc.hermes_session_id, pesan: v.pesan, signal: req.signal })) {
          jawaban += t
          c.enqueue(enc.encode(t))
        }
        await simpanPesan(supabase, pc.id, 'bot', jawaban, { durasi_ms: Date.now() - mulai, status: 'ok' })
      } catch (e) {
        const alasan = e instanceof GalatHermes ? e.alasan : 'lain'
        console.error('[bot] Hermes gagal:', alasan, (e as Error)?.message)
        const teks = jawaban ? `\n\n${GALAT_STANDAR}` : GALAT_STANDAR
        c.enqueue(enc.encode(teks))
        await simpanPesan(supabase, pc.id, 'bot', jawaban + teks, { durasi_ms: Date.now() - mulai, status: 'galat', alasan })
          .catch((e2) => console.error('[bot] gagal simpan galat:', e2))
      } finally {
        await sentuhPercakapan(supabase, pc.id).catch(() => {})
        c.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Percakapan-Id': pc.id },
  })
}
```

- [ ] **Step 2: Route percakapan**

```ts
// apps/bot/src/app/api/percakapan/route.ts
import { NextResponse } from 'next/server'
import { ambilSesi } from '@/lib/server/sesi'
import { BATAS } from '@/lib/batas'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await ambilSesi()
  if (!g.ok) return NextResponse.json({ galat: 'Tidak punya akses.' }, { status: g.status })
  const { data, error } = await g.sesi.supabase
    .from('bot_percakapan').select('id, judul, profil, diperbarui_at')
    .order('diperbarui_at', { ascending: false }).limit(BATAS.percakapanMaks)
  if (error) return NextResponse.json({ galat: 'Gagal memuat percakapan.' }, { status: 500 })
  return NextResponse.json({ percakapan: data ?? [] })
}
```

```ts
// apps/bot/src/app/api/percakapan/[id]/route.ts
import { NextResponse } from 'next/server'
import { ambilSesi } from '@/lib/server/sesi'

export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f-]{36}$/i

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const g = await ambilSesi()
  if (!g.ok) return NextResponse.json({ galat: 'Tidak punya akses.' }, { status: g.status })
  if (!UUID.test(id)) return NextResponse.json({ galat: 'ID tidak valid.' }, { status: 400 })
  const { data, error } = await g.sesi.supabase
    .from('bot_pesan').select('id, peran, isi, dibuat_at')
    .eq('percakapan_id', id).order('dibuat_at', { ascending: true }).limit(500)
  if (error) return NextResponse.json({ galat: 'Gagal memuat pesan.' }, { status: 500 })
  return NextResponse.json({ pesan: data ?? [] })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  const g = await ambilSesi()
  if (!g.ok) return NextResponse.json({ galat: 'Tidak punya akses.' }, { status: g.status })
  if (!UUID.test(id)) return NextResponse.json({ galat: 'ID tidak valid.' }, { status: 400 })
  const { error } = await g.sesi.supabase.from('bot_percakapan').delete().eq('id', id)
  if (error) return NextResponse.json({ galat: 'Gagal menghapus.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Test kunci tak bocor**

```ts
// apps/bot/src/app/api/kunci.test.ts
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function semuaBerkas(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? semuaBerkas(p) : [p]
  })
}
const src = join(__dirname, '..', '..')

describe('kunci Hermes server-only', () => {
  it("berkas 'use client' tidak menyentuh HERMES_* atau lib/hermes", () => {
    for (const f of semuaBerkas(src).filter((f) => /\.(ts|tsx)$/.test(f))) {
      const isi = readFileSync(f, 'utf8')
      if (!/^['"]use client['"]/m.test(isi)) continue
      expect(isi, f).not.toMatch(/HERMES_|lib\/hermes|NEXT_PUBLIC_HERMES/)
    }
  })
  it('tidak ada NEXT_PUBLIC_HERMES_* di mana pun', () => {
    for (const f of semuaBerkas(src)) expect(readFileSync(f, 'utf8'), f).not.toMatch(/NEXT_PUBLIC_HERMES/)
  })
})
```

- [ ] **Step 4: Test + type-check + build** — `yarn test && yarn type-check && yarn build` → PASS; build memuat `ƒ /api/chat`, `ƒ /api/percakapan`, `ƒ /api/percakapan/[id]`.
- [ ] **Step 5: Commit** — `git commit -m "feat(bot): route chat streaming & percakapan"`

---

### Task 7: Antarmuka chat

**Files:** Create `apps/bot/src/lib/teks.ts`, test `apps/bot/src/lib/teks.test.ts`, `apps/bot/src/components/ChatApp.tsx`; Replace `apps/bot/src/app/page.tsx`.

**Interfaces:** Consumes `ambilSesi` (Task 5), `LABEL_PROFIL` (Task 3), routes (Task 6). Produces `pecahTeks(isi: string): { tebal: boolean; teks: string }[][]` (baris → segmen).

- [ ] **Step 1: Test render teks (gagal)**

```ts
// apps/bot/src/lib/teks.test.ts
import { pecahTeks } from './teks'

describe('pecahTeks', () => {
  it('memecah baris dan **tebal**', () => {
    expect(pecahTeks('Omzet: **Rp 1**\n- a')).toEqual([
      [{ tebal: false, teks: 'Omzet: ' }, { tebal: true, teks: 'Rp 1' }],
      [{ tebal: false, teks: '- a' }],
    ])
  })
  it('tanpa penanda → satu segmen; HTML tetap teks', () => {
    expect(pecahTeks('<b>x</b>')).toEqual([[{ tebal: false, teks: '<b>x</b>' }]])
  })
})
```

- [ ] **Step 2: Implementasi teks**

```ts
// apps/bot/src/lib/teks.ts
// Render Markdown minimal (tebal + baris) sebagai data — TANPA HTML mentah (anti-XSS).
export function pecahTeks(isi: string): { tebal: boolean; teks: string }[][] {
  return isi.split('\n').map((baris) =>
    baris.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((s) =>
      s.startsWith('**') && s.endsWith('**') && s.length > 4 ? { tebal: true, teks: s.slice(2, -2) } : { tebal: false, teks: s },
    ),
  )
}
```

- [ ] **Step 3: Halaman (server) dengan gerbang**

```tsx
// apps/bot/src/app/page.tsx
import { redirect } from 'next/navigation'
import { ambilSesi } from '@/lib/server/sesi'
import { LABEL_PROFIL } from '@/lib/peran'
import ChatApp from '@/components/ChatApp'

export const dynamic = 'force-dynamic'

export default async function Halaman() {
  const g = await ambilSesi()
  if (!g.ok && g.status === 401) redirect(process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com')
  if (!g.ok) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-bold">Tidak punya akses</h1>
        <p className="mt-2 text-sm">Bot ini saat ini hanya untuk owner dan admin.</p>
      </main>
    )
  }
  return <ChatApp nama={g.sesi.nama} judulBot={LABEL_PROFIL[g.sesi.profil]} />
}
```

- [ ] **Step 4: Komponen chat (client)**

```tsx
// apps/bot/src/components/ChatApp.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Menu, Plus, Send, Trash2, X } from 'lucide-react'
import { pecahTeks } from '@/lib/teks'

type Percakapan = { id: string; judul: string; diperbarui_at: string }
type Pesan = { id: string | number; peran: 'user' | 'bot'; isi: string }

const CEPAT = ['Omzet kemarin berapa?', 'Peringkat outlet minggu ini', 'Menu terlaris bulan ini', 'Laporan pagi hari ini']

function Isi({ isi }: { isi: string }) {
  return (
    <>
      {pecahTeks(isi).map((baris, i) => (
        <p key={i} className="min-h-[1em]">
          {baris.map((s, j) => (s.tebal ? <strong key={j}>{s.teks}</strong> : <span key={j}>{s.teks}</span>))}
        </p>
      ))}
    </>
  )
}

export default function ChatApp({ nama, judulBot }: { nama: string; judulBot: string }) {
  const [daftar, setDaftar] = useState<Percakapan[]>([])
  const [aktif, setAktif] = useState<string | null>(null)
  const [pesan, setPesan] = useState<Pesan[]>([])
  const [input, setInput] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [menunggu, setMenunggu] = useState(false)
  const [laci, setLaci] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const bawah = useRef<HTMLDivElement>(null)

  const muatDaftar = async () => {
    const r = await fetch('/api/percakapan', { cache: 'no-store' })
    if (r.ok) setDaftar((await r.json()).percakapan)
  }
  useEffect(() => { muatDaftar() }, [])
  useEffect(() => { bawah.current?.scrollIntoView({ behavior: 'smooth' }) }, [pesan])

  const buka = async (id: string) => {
    setLaci(false); setGalat(null); setAktif(id); setPesan([])
    const r = await fetch(`/api/percakapan/${id}`, { cache: 'no-store' })
    if (r.ok) setPesan((await r.json()).pesan)
  }
  const baru = () => { setAktif(null); setPesan([]); setLaci(false); setGalat(null) }
  const hapus = async (id: string) => {
    if (!confirm('Hapus percakapan ini?')) return
    await fetch(`/api/percakapan/${id}`, { method: 'DELETE' })
    if (aktif === id) baru()
    muatDaftar()
  }

  const kirim = async (teks: string) => {
    const isi = teks.trim()
    if (!isi || sibuk) return
    setSibuk(true); setMenunggu(true); setGalat(null); setInput('')
    setPesan((p) => [...p, { id: `u${Date.now()}`, peran: 'user', isi }, { id: `b${Date.now()}`, peran: 'bot', isi: '' }])
    try {
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pesan: isi, percakapanId: aktif ?? undefined }),
      })
      if (!r.ok || !r.body) {
        const b = await r.json().catch(() => ({}))
        throw new Error(b.galat || 'Bot sedang tidak bisa dihubungi. Coba lagi sebentar lagi.')
      }
      const id = r.headers.get('X-Percakapan-Id')
      if (id) setAktif(id)
      const pembaca = r.body.getReader()
      const dek = new TextDecoder()
      for (;;) {
        const { value, done } = await pembaca.read()
        if (done) break
        const t = dek.decode(value, { stream: true })
        setMenunggu(false)
        setPesan((p) => { const s = [...p]; s[s.length - 1] = { ...s[s.length - 1], isi: s[s.length - 1].isi + t }; return s })
      }
      muatDaftar()
    } catch (e) {
      setPesan((p) => p.slice(0, -1))
      setGalat((e as Error).message)
    } finally {
      setSibuk(false); setMenunggu(false)
    }
  }

  return (
    <div className="flex h-dvh">
      <aside className={`${laci ? 'fixed inset-0 z-20 flex' : 'hidden'} w-full flex-col bg-white md:static md:flex md:w-72 md:border-r`}>
        <div className="flex items-center justify-between border-b p-3">
          <span className="font-semibold">Percakapan</span>
          <button className="md:hidden" onClick={() => setLaci(false)} aria-label="Tutup"><X size={20} /></button>
        </div>
        <button onClick={baru} className="m-3 flex items-center gap-2 rounded-lg bg-suka-orange px-3 py-2 text-white">
          <Plus size={16} /> Percakapan baru
        </button>
        <ul className="flex-1 overflow-y-auto px-2">
          {daftar.map((d) => (
            <li key={d.id} className={`group flex items-center gap-1 rounded-lg px-2 py-2 ${aktif === d.id ? 'bg-suka-cream' : ''}`}>
              <button className="flex-1 truncate text-left text-sm" onClick={() => buka(d.id)}>{d.judul}</button>
              <button onClick={() => hapus(d.id)} aria-label="Hapus" className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
            </li>
          ))}
          {daftar.length === 0 && <li className="px-2 py-3 text-sm text-gray-500">Belum ada percakapan.</li>}
        </ul>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-white p-3">
          <button className="md:hidden" onClick={() => setLaci(true)} aria-label="Daftar percakapan"><Menu size={22} /></button>
          <div>
            <h1 className="font-display text-xl text-suka-brown">{judulBot}</h1>
            <p className="text-xs text-gray-500">Halo, {nama}</p>
          </div>
        </header>

        <section className="flex-1 space-y-3 overflow-y-auto p-4">
          {pesan.length === 0 && (
            <div className="mx-auto max-w-md pt-8 text-center">
              <p className="mb-4 text-sm text-gray-600">Tanya data penjualan Suka Shawarma. Contoh:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {CEPAT.map((q) => (
                  <button key={q} onClick={() => kirim(q)} disabled={sibuk} className="rounded-full border border-suka-orange px-3 py-1 text-sm text-suka-brown">{q}</button>
                ))}
              </div>
            </div>
          )}
          {pesan.map((m, i) => (
            <div key={m.id} className={`flex ${m.peran === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.peran === 'user' ? 'bg-suka-orange text-white' : 'bg-white shadow-sm'}`}>
                {m.peran === 'bot' && i === pesan.length - 1 && menunggu ? (
                  <span className="italic text-gray-500">Sedang mengambil data…</span>
                ) : (
                  <Isi isi={m.isi} />
                )}
              </div>
            </div>
          ))}
          {galat && <p className="text-center text-sm text-red-600">{galat}</p>}
          <div ref={bawah} />
        </section>

        <form onSubmit={(e) => { e.preventDefault(); kirim(input) }} className="flex gap-2 border-t bg-white p-3">
          <input
            value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000}
            placeholder="Tanya sesuatu…" className="flex-1 rounded-full border px-4 py-2 text-sm" disabled={sibuk}
          />
          <button type="submit" disabled={sibuk || !input.trim()} className="rounded-full bg-suka-orange p-2 text-white disabled:opacity-50" aria-label="Kirim">
            <Send size={18} />
          </button>
        </form>
      </main>
    </div>
  )
}
```

- [ ] **Step 5: Test + type-check + build** — PASS.
- [ ] **Step 6: Uji visual lokal tanpa Hermes** — `preview_start bot`; tanpa login → redirect portal (lokal: `http://localhost:3010`). Login lewat portal lokal sebagai owner/admin dev, kembali ke `http://localhost:3050`: daftar kosong, 4 tombol cepat tampil; kirim pesan → karena `HERMES_API_URL` kosong muncul **teks galat standar** di gelembung bot (bukan kosong), dan percakapan tersimpan di daftar. Screenshot HP (375px) & desktop.
- [ ] **Step 7: Commit** — `git commit -m "feat(bot): antarmuka chat HP-first dengan streaming"`

---

### Task 8: Tile portal "Bot CEO"

**Files:** Modify `apps/portal/src/app/launcher/page.tsx` (sekitar baris 80–162), mungkin `apps/portal/src/components/AppTile.tsx` (ikon).

- [ ] **Step 1: URL bot**

Setelah `const APP_URL = await getAppUrls()` tambahkan:
```ts
  // Bot CEO (apps/bot) — bukan AppName @suka/auth; gerbang = bisaSukaBot (sama dgn server apps/bot).
  const hostLauncher = (await headers()).get('host') || ''
  const BOT_URL = hostLauncher.includes('localhost') || hostLauncher.includes('127.0.0.1')
    ? 'http://localhost:3050'
    : (process.env.NEXT_PUBLIC_APP_URL_BOT || 'https://bot.sukashawarma.com')
```

- [ ] **Step 2: Tile**

Di array `portalApps`, sebelum `...apps.map(...)`, tambahkan:
```ts
    ...(bisaSukaBot ? [{
      id: 'bot-ceo', label: 'Bot CEO', url: BOT_URL,
      desc: 'Tanya data penjualan langsung ke bot', category: 'Eksekutif & Omzet',
      badge: 'Baru', group: 'Keuangan & Data',
    }] : []),
```

- [ ] **Step 3: Ikon** — buka `apps/portal/src/components/AppTile.tsx`/`AppGrid.tsx`; bila ikon dipetakan per `id` tanpa fallback, tambahkan `'bot-ceo'` → ikon `Bot` dari `lucide-react`. Bila ada fallback, biarkan.

- [ ] **Step 4: Verifikasi** — `cd apps/portal && yarn test && yarn type-check && yarn build` (bila portal punya `type-check`); preview portal sebagai admin lokal → tile "Bot CEO" tampil dan menuju `http://localhost:3050`; sebagai role lain (mis. crew) → tidak tampil.

- [ ] **Step 5: Commit** — `git commit -m "feat(portal): tile Bot CEO untuk owner/admin/developer"`

---

### Task 9: Docker, deploy, CI

**Files:** Create `apps/bot/Dockerfile`, `.github/workflows/deploy-bot-coolify.yml`; Modify `.github/workflows/ci.yml`, `apps/bot/README.md`.

- [ ] **Step 1: Dockerfile** — salin `apps/owner-dashboard/Dockerfile`, ganti setiap `owner-dashboard` → `bot` dan `@suka/owner-dashboard` → `@suka/bot`, lalu:
  - Builder: hapus baris `COPY packages/realtime/...` & `offline-queue` **hanya bila** `yarn install --frozen-lockfile` tetap lolos di Docker tanpa keduanya; bila ragu, biarkan (manifest workspace lain tak merugikan).
  - Ubah baris build menjadi `RUN NEXT_TURBOPACK=0 corepack enable && NEXT_TURBOPACK=0 yarn workspace @suka/bot build && mkdir -p apps/bot/public`.
  - Runner, setelah `ENV PORT=3000`, ganti blok secret menjadi:
    ```dockerfile
    # Secret server-only WAJIB di-declare ulang di stage runner (insiden 2026-08-13).
    ARG SUPABASE_JWT_SECRET
    ARG HERMES_API_URL
    ARG HERMES_KEY_CEO
    ENV SUPABASE_JWT_SECRET=$SUPABASE_JWT_SECRET
    ENV HERMES_API_URL=$HERMES_API_URL
    ENV HERMES_KEY_CEO=$HERMES_KEY_CEO
    ```
    (Tidak perlu `SUPABASE_SERVICE_ROLE_KEY` — app ini memakai sesi user.)
- [ ] **Step 2: Build image lokal** (bila Docker tersedia): `docker build -f apps/bot/Dockerfile -t suka-bot .` → sukses. Bila Docker tak ada di mesin dev, lewati dan andalkan workflow.
- [ ] **Step 3: Workflow deploy** — salin `.github/workflows/deploy-portal-coolify.yml` ke `deploy-bot-coolify.yml`; ganti: `paths` → `apps/bot/**`, `packages/auth/**`, `packages/design-system/**`, berkas workflow ini; `concurrency.group` → `deploy-bot-production`; image → `.../bot`; `file: apps/bot/Dockerfile`; build-args hanya `NEXT_PUBLIC_COOKIE_DOMAIN`, `NEXT_PUBLIC_PORTAL_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (secret server-only diisi di panel Coolify, bukan GitHub); pencarian aplikasi Coolify → fqdn `bot.sukashawarma.com` / name `bot`; smoke test → `https://bot.sukashawarma.com/api/health` (harap 200).
- [ ] **Step 4: CI** — di `.github/workflows/ci.yml`, pada job yang menjalankan test app lain, tambahkan `yarn workspace @suka/bot type-check` dan `yarn workspace @suka/bot test`.
- [ ] **Step 5: README** — perbarui `apps/bot/README.md`: status → "fase 1 dibangun", cara dev (`yarn workspace @suka/bot dev`, port 3050), env yang dibutuhkan (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_COOKIE_DOMAIN`, `NEXT_PUBLIC_PORTAL_URL`, `SUPABASE_JWT_SECRET`, `HERMES_API_URL`, `HERMES_KEY_CEO`).
- [ ] **Step 6: Commit** — `git commit -m "chore(bot): Dockerfile, workflow deploy Coolify, CI"`

---

### Task 10: API server Hermes di VPS (manual, dev)

**Files:** Modify `docs/RUNBOOK-HERMES-VPS.md` (bagian baru "API server untuk webapp").

- [ ] **Step 1: Cari IP gateway jaringan Coolify** (root):
```bash
docker network ls | grep -i coolify
docker network inspect coolify -f '{{range .IPAM.Config}}{{.Gateway}}{{end}}'
```
Catat `<GW>` (mis. `10.0.1.1`). Container app Coolify menjangkau host lewat IP ini.

- [ ] **Step 2: Nyalakan multiplex + API server** (user `suka-hermes`) — cek dulu kunci config persis: `hermes config --help` & dokumen API server. Target:
  - host gateway (profil default) `config.yaml`: `gateway.multiplex_profiles: true`, `gateway.api_server.enabled: true`, `host: <GW>`, `port: 8643`.
  - `~/.hermes/profiles/ceo/.env`: `API_SERVER_KEY=<acak 48+ karakter>` (buat dengan `openssl rand -base64 36`, simpan lewat nano; jangan di-echo/screenshot).
  - `hermes gateway restart`.
- [ ] **Step 3: Kunci toolset `api_server` profil ceo SEBELUM uji**:
```bash
ceo tools disable --platform api_server web browser terminal file code_execution vision image_gen tts skills todo memory session_search connections delegation cronjob computer_use
ceo tools --summary   # api_server harus 2/28 (Clarifying Questions + suka)
```
- [ ] **Step 4: Uji jangkauan**
  - Dari dalam jaringan Coolify (root): `docker run --rm --network coolify curlimages/curl -s -o /dev/null -w '%{http_code}\n' http://<GW>:8643/p/ceo/v1/models` → **401** (tanpa kunci); dengan `-H "Authorization: Bearer <kunci>"` → **200**.
  - Dari laptop: `curl -m 5 http://76.13.193.138:8643/` → **gagal/timeout** (tidak terjangkau dari internet). Bila terjangkau → tambahkan aturan firewall menolak 8643 dari luar sebelum lanjut.
- [ ] **Step 5: Runbook** — tulis langkah 1–4 + nilai `<GW>` ke `docs/RUNBOOK-HERMES-VPS.md`; commit.

---

### Task 11: Deploy & uji ujung-ke-ujung (manual)

- [ ] **Step 1:** Merge `feat/webapp-bot` → `main` (izin owner), push.
- [ ] **Step 2: Coolify** — buat aplikasi `bot` dari image/Dockerfile, domain `bot.sukashawarma.com` (DNS Cloudflare), env: `NEXT_PUBLIC_*` (sama dgn portal), `SUPABASE_JWT_SECRET`, `HERMES_API_URL=http://<GW>:8643`, `HERMES_KEY_CEO=<kunci Task 10>`. Deploy.
- [ ] **Step 3: Uji (catat di `supabase/verifikasi/bot/uji-e2e.md`)**
  1. `https://bot.sukashawarma.com/api/health` → 200.
  2. Buka tanpa login → diarahkan ke portal; login sebagai owner/admin → kembali → layar chat.
  3. "Omzet kemarin berapa?" → angka = Rangkuman Penjualan; jawaban mengalir bertahap.
  4. Refresh → percakapan ada di daftar & isinya utuh.
  5. Akun role lain (mis. crew) → "Tidak punya akses"; tile portal tidak tampil.
  6. `hermes gateway stop` sebentar → kirim pesan → teks galat standar; nyalakan lagi.
  7. Lihat sumber halaman & tab Network browser: tidak ada `HERMES_KEY`/`hms_`/`API_SERVER_KEY`.
  8. HP: laci percakapan buka/tutup, tombol cepat, input tak tertutup keyboard.
- [ ] **Step 4:** Perbarui CLAUDE.md (entri sesi) & README `apps/bot` dengan hasilnya; commit.

---

## Self-review

- Spec W1 → T1/T9; W2 → T5 (`ambilSesi`), T7 (halaman), T8 (tile); W3 → T3; W4/W5 → T4, T6, T10; W6 → T2, T5, T6; W7 → T10 Step 3; W8 → T3/T6; W9 → T8 (label "Bot CEO"). §9 pengujian → T2–T7 + T11.
- Penyimpangan disengaja dari spec §4: **tanpa middleware** — gerbang di halaman & route (`ambilSesi`) agar tak mengubah `@suka/auth`; perilaku sama (belum login → portal, role lain → ditolak).
- Terbuka dari spec §11: IP internal → T10 Step 1; event SSE pemanggilan alat → indikator umum "Sedang mengambil data…" (Task 7); bila Hermes ternyata mengirim event alat, tambahkan di fase berikut.
- Nama konsisten: `profilUntukPeran`/`LABEL_PROFIL`/`Profil` (T3→T5,T7), `BATAS`/`GALAT_STANDAR`/`validasiPesan`/`judulDari`/`idUntukDipangkas` (T3→T5,T6), `tanyaHermes`/`kunciProfil`/`GalatHermes` (T4→T6), `ambilSesi`/`Sesi` (T5→T6,T7), `pecahTeks` (T7).
