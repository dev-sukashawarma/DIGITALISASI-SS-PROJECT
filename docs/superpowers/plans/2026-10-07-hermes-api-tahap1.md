# Hermes API Tahap 1 — Fondasi MCP + Domain Penjualan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hermes Agent (VPS) bisa memanggil server MCP baca-saja `/api/hermes/mcp` di admin-dashboard dengan kunci per bot, dan bot CEO bisa menjawab omzet/peringkat/menu terlaris serta mengirim laporan pagi dengan angka identik Rangkuman Penjualan.

**Architecture:** Inti `getPosReport` dipindah ke modul server biasa (`lib/posReport/laporan.ts`) yang menerima cakupan secara eksplisit; berkas `'use server'` tetap satu-satunya pintu sesi-cookie. MCP (JSON-RPC lewat HTTP, respons `application/json`) ditulis sendiri sebagai fungsi murni ber-test; alat penjualan membungkus fungsi SUKA Bot yang sudah teruji (`alatOmzet`, `hitungRanking`, `hitungRekap`) — tidak ada rumus baru. Kunci = `hms_<prefix8>_<rahasia32>`, disimpan sebagai SHA-256, dicek scope + allowlist IP, setiap panggilan dicatat.

**Tech Stack:** Next.js 16 route handler, zod 4.4 (`z.toJSONSchema`), Supabase service role, vitest 2, PostgreSQL migration.

**Spec:** `docs/superpowers/specs/2026-10-07-hermes-api-design.md` · Runbook VPS: `docs/RUNBOOK-HERMES-VPS.md`

## Global Constraints

- K1: **Nol endpoint tulis** ke data bisnis. Satu-satunya tulisan = `hermes_api_log` + `terakhir_dipakai_at`.
- K3: Angka wajib lewat fungsi laporan yang dipakai layar (`getPosReport` via `laporanPosUntukScope`). Dilarang query `orders` mentah.
- K4: Kunci per bot, scope domain (`penjualan|gudang|absensi|finance`), allowlist IP **fail-closed** (daftar kosong = tolak semua), hash SHA-256, perbandingan timing-safe, dibuat dari halaman admin & tampil sekali.
- §6 larangan data: tak ada output berisi gaji/kasbon per orang, NIK, no. HP, alamat, email staf, selfie/wajah, data pelanggan.
- Galat pengambilan data **tidak pernah** menjadi `0` — kembalikan galat eksplisit (`isError: true`).
- Outlet terhitung = `outletTerhitung()` SUKA Bot (internal + mitra, tanpa `ss-backup` & nama tes).
- Omzet tanpa persentase (keputusan owner 2026-10-05) — sandingkan rupiah saja.
- Tidak menambah dependency npm (hindari drift `yarn.lock`, lihat CLAUDE.md "Menambah dependency").
- Migration timestamp `20261007HHMMSS` (lint menolak >2 hari ke depan); cek `schema_migrations` sebelum memilih jam.
- Jalankan test dari `apps/admin-dashboard` (`yarn test <path>`), bukan dari worktree tanpa `node_modules` app (zod root = 3.25, tak punya `z.toJSONSchema`).
- Pesan commit diakhiri `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

| File | Tanggung jawab |
|---|---|
| `apps/admin-dashboard/src/lib/posReport/laporan.ts` (baru) | Inti Rangkuman Penjualan dengan cakupan eksplisit |
| `apps/admin-dashboard/src/app/actions/posReport.ts` (ubah) | Pintu `'use server'` tipis: sesi cookie → `laporan.ts` |
| `apps/admin-dashboard/src/app/actions/posReport.pintu.test.ts` (baru) | Regresi keamanan: berkas server action tak mengekspor fungsi bercakupan |
| `apps/admin-dashboard/src/lib/sukaBot/server/sumberData.ts` (ubah) | `buatAmbilLaporan(panggil)` dipakai SUKA Bot & Hermes |
| `supabase/migrations/20261007130000_hermes_api_key.sql` (baru) | Tabel kunci + log |
| `supabase/verifikasi/hermes/t1_akses_tabel.sql` (baru) | Uji: anon/authenticated tak bisa menyentuh tabel |
| `apps/admin-dashboard/src/lib/hermes/domain.ts` | Daftar domain |
| `apps/admin-dashboard/src/lib/hermes/kunci.ts` | Buat/hash/urai kunci |
| `apps/admin-dashboard/src/lib/hermes/ip.ts` | IP klien + allowlist |
| `apps/admin-dashboard/src/lib/hermes/validasi.ts` | Validasi input form kunci |
| `apps/admin-dashboard/src/lib/hermes/mcp.ts` | Handler JSON-RPC MCP murni |
| `apps/admin-dashboard/src/lib/hermes/laporanPagi.ts` | Template teks laporan pagi CEO |
| `apps/admin-dashboard/src/lib/hermes/alat/penjualan.ts` | 5 alat domain penjualan |
| `apps/admin-dashboard/src/lib/hermes/registry.ts` | Kumpulan alat → `AlatMcp[]` + skema JSON |
| `apps/admin-dashboard/src/lib/hermes/server/autentikasi.ts` | Cek kunci di DB + log |
| `apps/admin-dashboard/src/lib/hermes/server/konteks.ts` | Konteks data service-role |
| `apps/admin-dashboard/src/app/api/hermes/mcp/route.ts` | Endpoint HTTP |
| `apps/admin-dashboard/src/middleware.ts` (ubah) | Bypass `/api/hermes/` |
| `apps/admin-dashboard/src/app/dashboard/sistem/hermes/{page.tsx,actions.ts,KunciHermesPanel.tsx}` | Halaman kelola kunci |
| `apps/admin-dashboard/src/components/layout/navConfig.ts` (+test) | Item nav "Kunci Hermes" |
| `docs/RUNBOOK-HERMES-VPS.md`, `docs/hermes/SOUL-ceo.md` | Sambungkan Hermes + gerbang |

---

### Task 1: Pisahkan inti Rangkuman Penjualan dari pintu sesi-cookie

**Files:**
- Create: `apps/admin-dashboard/src/lib/posReport/laporan.ts`
- Modify: `apps/admin-dashboard/src/app/actions/posReport.ts`
- Modify: `apps/admin-dashboard/src/lib/sukaBot/server/sumberData.ts:1-20`
- Test: `apps/admin-dashboard/src/app/actions/posReport.pintu.test.ts`

**Interfaces:**
- Produces:
  - `type CakupanLaporan = { supabase: any; scopeKey: string; allowedOutletIds: 'all' | string[] }`
  - `laporanPosUntukScope(rawReq: PosReportRequest, cakupan: CakupanLaporan)` — bentuk hasil persis sama dengan `getPosReport` lama
  - `kategoriLaporanPosUntukScope(rawReq: PosReportRequest, cakupan: CakupanLaporan)`
  - `clearMenuMemo(): void`
  - `type PosReportRequest` (dipindah; `posReport.ts` me-re-export)
  - `buatAmbilLaporan(panggil: (req: PosReportRequest) => Promise<any>): AmbilLaporan` di `sumberData.ts`

**Kenapa:** `getPosReport` memanggil `resolveCallerScope()` yang mewajibkan cookie → Hermes (kunci API) tak bisa memakainya. Fungsi bercakupan **tidak boleh** diekspor dari berkas `'use server'` — setiap ekspor di sana adalah endpoint POST publik (pelajaran Session 2026-07-20).

- [ ] **Step 1: Tulis test regresi pintu (gagal)**

```ts
// apps/admin-dashboard/src/app/actions/posReport.pintu.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sumber = readFileSync(join(__dirname, 'posReport.ts'), 'utf8')

describe('posReport.ts = pintu server action', () => {
  it('hanya mengekspor empat fungsi yang memeriksa sesi', () => {
    const ekspor = [...sumber.matchAll(/export\s+async\s+function\s+(\w+)/g)].map((m) => m[1]).sort()
    expect(ekspor).toEqual(['getPosReport', 'getPosReportCategories', 'invalidatePosReportDays', 'refreshPosReportRange'])
  })
  it('getPosReport & getPosReportCategories selalu memanggil resolveCallerScope()', () => {
    for (const nama of ['getPosReport', 'getPosReportCategories']) {
      const badan = sumber.split(`export async function ${nama}(`)[1]?.split('\nexport ')[0] ?? ''
      expect(badan).toContain('resolveCallerScope()')
    }
  })
  it('tidak ada fungsi bercakupan yang bocor ke berkas server action', () => {
    expect(sumber).not.toMatch(/export\s+(async\s+)?function\s+\w*UntukScope/)
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd apps/admin-dashboard && yarn test src/app/actions/posReport.pintu.test.ts`
Expected: FAIL pada test kedua (badan `getPosReport` lama memanggil `getPreparedReport(rawReq)`, bukan `resolveCallerScope()` langsung).

- [ ] **Step 3: Buat `lib/posReport/laporan.ts` dengan memindahkan kode**

Isi berkas baru (tanpa `'use server'`, tetap `// @ts-nocheck` seperti asalnya):
1. Baris pertama `// @ts-nocheck`, lalu komentar: `// Inti Rangkuman Penjualan. HANYA dipanggil server. Pemanggil WAJIB menyerahkan cakupan yang sudah diverifikasi (sesi cookie lewat app/actions/posReport.ts, atau kunci Hermes lewat lib/hermes/server). JANGAN diekspor ulang dari berkas 'use server'.`
2. Pindahkan **apa adanya** dari `app/actions/posReport.ts`: import `ambilRiwayatHpp`, `TEST_OUTLET_ID`, `isDateStr, jakartaDate, jakartaRangeIso` (dari `@/lib/ownerDashboardCache`), `loadPosReportOrders, getEarliestSalesDate, selectReportOrders` (dari `@/lib/posReport/load`), `getPrepared, PREPARED_TTL_WITH_TODAY_MS, PREPARED_TTL_PAST_ONLY_MS` (dari `@/lib/posReport/prepared`), `fetchAllPages`, seluruh import `@/lib/posReport/compute`; `export type PosReportRequest`; `SHIFT_SELECT`, `MENU_SELECT`, `MENU_MEMO_TTL_MS`, `menuMemo`, `getMenuItems`, `sanitizeRequest`, `loadReportContext`, `getPreparedReport`. (Import yang ternyata tak terpakai di salah satu berkas boleh dihapus dari berkas itu.)
3. Tambahkan tipe dan ubah tanda tangan:

```ts
export type CakupanLaporan = { supabase: any; scopeKey: string; allowedOutletIds: 'all' | string[] }

export function clearMenuMemo() {
  menuMemo.clear()
}
```
   - `loadReportContext(req, scope: CakupanLaporan, from)` — ganti tipe parameter `scope` dari `Awaited<ReturnType<typeof resolveCallerScope>>` ke `CakupanLaporan`.
   - `getPreparedReport(rawReq: PosReportRequest, scope: CakupanLaporan)` — hapus baris `const scope = await resolveCallerScope()`; sisanya (termasuk cek `Forbidden: outlet not in caller scope`) tetap.
4. Pindahkan badan `getPosReport` lama menjadi:
```ts
export async function laporanPosUntukScope(rawReq: PosReportRequest, scope: CakupanLaporan) {
  const { req, prepared } = await getPreparedReport(rawReq, scope)
  // ... sisa badan getPosReport lama, TANPA perubahan apa pun ...
}
```
5. Pindahkan badan `getPosReportCategories` lama menjadi `export async function kategoriLaporanPosUntukScope(rawReq: PosReportRequest, scope: CakupanLaporan)` dengan `getPreparedReport(rawReq, scope)`.

- [ ] **Step 4: Tipiskan `app/actions/posReport.ts`**

Sisakan: header komentar, `'use server'`, import yang masih dipakai (`cookies`, `updateTag`, `createSupabaseServerClient, getVerifiedUserId`, `resolveCallerScope`, `bumpDayGenerations`, `eachDateInclusive, isDateStr, jakartaDate`, `posReportDayTag, clearPosReportTodayMemo`, `clearPrepared`), lalu:

```ts
import {
  laporanPosUntukScope,
  kategoriLaporanPosUntukScope,
  clearMenuMemo,
  type PosReportRequest,
} from '@/lib/posReport/laporan'

export type { PosReportRequest }

export async function getPosReport(rawReq: PosReportRequest) {
  return laporanPosUntukScope(rawReq, await resolveCallerScope())
}

/** Data untuk ekspor "PDF/CSV Semua Channel" — hanya dihitung saat tombol ditekan. */
export async function getPosReportCategories(rawReq: PosReportRequest) {
  return kategoriLaporanPosUntukScope(rawReq, await resolveCallerScope())
}
```
`requireUser`, `invalidatePosReportDays` tetap. Di `refreshPosReportRange`, ganti `menuMemo.clear()` dengan `clearMenuMemo()`.

- [ ] **Step 5: `sumberData.ts` — pabrik adapter dipakai bersama**

Ganti blok `ambilLaporanRangkuman` (baris 1-20) dengan:

```ts
// Adapter nyata untuk alat SUKA Bot & Hermes. Rumus = Rangkuman Penjualan (getPosReport).
import { getPosReport, type PosReportRequest } from '@/app/actions/posReport'
import type { AmbilLaporan, OutletInfo, KonteksPenjualan } from '../alat/penjualan'
import type { KonteksStok, BahanInfo, BarisStok } from '../alat/stok'

/** Bungkus pemanggil Rangkuman Penjualan apa pun (sesi cookie atau cakupan Hermes) jadi AmbilLaporan. */
export function buatAmbilLaporan(panggil: (req: PosReportRequest) => Promise<any>): AmbilLaporan {
  return async ({ dari, sampai, outletIds, kanal }) => {
    // outlets kosong akan dibaca getPosReport sebagai "semua" (termasuk SS Online) — tolak.
    if (outletIds.length === 0) throw new Error('Daftar outlet kosong')
    const r: any = await panggil({
      from: dari, to: sampai, outlets: outletIds, channels: kanal,
      paymentMethod: 'all', search: '', page: 1, pageSize: 1, isPawoonVisible: true,
    })
    return {
      omzetKotor: Number(r.analytics.grossRevenue) || 0,
      omzetBersih: Number(r.analytics.netRevenue) || 0,
      transaksi: Number(r.analytics.totalOrders) || 0,
      menu: (r.analytics.bestSellers ?? []).map((b: any) => ({ nama: String(b.name), qty: Number(b.qty) || 0, omzet: Number(b.revenue) || 0 })),
    }
  }
}

/** Rangkuman Penjualan yang sama dengan /dashboard/reports/pos (rumus + cache per hari). */
export const ambilLaporanRangkuman: AmbilLaporan = buatAmbilLaporan(getPosReport)
```
(Sisa berkas — `ambilOutlets`, `konteksStok`, `konteksPenjualan` — tidak berubah.)

- [ ] **Step 6: Jalankan test + type-check + build**

Run: `cd apps/admin-dashboard && yarn test src/app/actions/posReport.pintu.test.ts src/lib/sukaBot src/lib/posReport && yarn type-check && yarn build`
Expected: test PASS; type-check tanpa error baru di berkas yang disentuh; build sukses dengan `/dashboard/reports/pos` & `/api/asisten/*` tetap ada.

- [ ] **Step 7: Smoke manual Rangkuman Penjualan**

`yarn dev`, login admin, buka `/dashboard/reports/pos`, pilih "Kemarin" + semua outlet internal & mitra; catat omzet kotor & transaksi. Bandingkan dengan angka yang sama di `main` (atau produksi). Harus identik.

- [ ] **Step 8: Commit**

```bash
git add apps/admin-dashboard/src/lib/posReport/laporan.ts apps/admin-dashboard/src/app/actions/posReport.ts apps/admin-dashboard/src/app/actions/posReport.pintu.test.ts apps/admin-dashboard/src/lib/sukaBot/server/sumberData.ts
git commit -m "refactor(pos-report): pisahkan inti laporan dari pintu sesi-cookie

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Tabel kunci & log Hermes

**Files:**
- Create: `supabase/migrations/20261007130000_hermes_api_key.sql`
- Create: `supabase/verifikasi/hermes/t1_akses_tabel.sql`

**Interfaces:**
- Produces: tabel `public.hermes_api_key(id, nama, prefix, hash_kunci, scope text[], ip_diizinkan text[], aktif, dibuat_oleh, dibuat_at, dicabut_at, terakhir_dipakai_at)` dan `public.hermes_api_log(id, kunci_id, prefix, alat, status, alasan, ip, durasi_ms, at)`; hanya service role yang bisa membaca/menulis.

- [ ] **Step 1: Cek timestamp bebas**

Run (Supabase MCP `execute_sql` atau SQL Editor):
```sql
SELECT version FROM supabase_migrations.schema_migrations WHERE version LIKE '20261007%' ORDER BY 1;
```
Expected: `20261007130000` tidak ada. Jika ada, naikkan jam (mis. `20261007131000`) dan pakai nama itu di seluruh task ini.

- [ ] **Step 2: Tulis uji akses (gagal sebelum migration)**

```sql
-- supabase/verifikasi/hermes/t1_akses_tabel.sql
-- Uji akses tabel Hermes. Selalu ROLLBACK. Lulus = selesai tanpa error.
BEGIN;
DO $$
DECLARE v_admin uuid; v_ok boolean;
BEGIN
  IF to_regclass('public.hermes_api_key') IS NULL OR to_regclass('public.hermes_api_log') IS NULL THEN
    RAISE EXCEPTION 'tabel hermes belum ada';
  END IF;
  SELECT id INTO v_admin FROM outlet_staff WHERE role = 'admin' AND status = 'active' LIMIT 1;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'fixture admin kosong'; END IF;

  -- (a) admin login (authenticated) TIDAK boleh membaca kunci
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN PERFORM 1 FROM public.hermes_api_key LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION '(a) authenticated bisa membaca hermes_api_key'; END IF;

  -- (b) authenticated tidak boleh menulis log
  v_ok := false;
  BEGIN INSERT INTO public.hermes_api_log (status) VALUES ('ok');
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION '(b) authenticated bisa menulis hermes_api_log'; END IF;
  RESET ROLE;

  -- (c) anon tidak boleh membaca
  SET LOCAL ROLE anon;
  v_ok := false;
  BEGIN PERFORM 1 FROM public.hermes_api_key LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION '(c) anon bisa membaca hermes_api_key'; END IF;
  RESET ROLE;

  -- (d) CHECK scope menolak domain asing
  v_ok := false;
  BEGIN INSERT INTO public.hermes_api_key (nama, prefix, hash_kunci, scope)
        VALUES ('uji', 'abcdef12', repeat('a', 64), ARRAY['gaji']);
  EXCEPTION WHEN check_violation THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION '(d) scope asing diterima'; END IF;
END $$;
ROLLBACK;
-- Kontrol negatif (jalankan terpisah, harus GAGAL): ganti ARRAY['gaji'] di (d) menjadi ARRAY['penjualan'].
```

Run: jalankan berkas di SQL Editor / `execute_sql`.
Expected: ERROR `tabel hermes belum ada`.

- [ ] **Step 3: Tulis migration**

```sql
-- supabase/migrations/20261007130000_hermes_api_key.sql
-- Kunci API untuk Hermes Agent (bot divisi) + log panggilan.
-- Spec: docs/superpowers/specs/2026-10-07-hermes-api-design.md §5.
-- Hanya service role (route /api/hermes/* dan server action halaman admin) yang menyentuh tabel ini.

CREATE TABLE IF NOT EXISTS public.hermes_api_key (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL CHECK (char_length(btrim(nama)) BETWEEN 3 AND 60),
  prefix text NOT NULL UNIQUE CHECK (prefix ~ '^[0-9a-f]{8}$'),
  hash_kunci text NOT NULL CHECK (hash_kunci ~ '^[0-9a-f]{64}$'),
  scope text[] NOT NULL CHECK (
    cardinality(scope) > 0
    AND scope <@ ARRAY['penjualan','gudang','absensi','finance']::text[]
  ),
  ip_diizinkan text[] NOT NULL DEFAULT '{}',
  aktif boolean NOT NULL DEFAULT true,
  dibuat_oleh uuid REFERENCES public.outlet_staff(id),
  dibuat_at timestamptz NOT NULL DEFAULT now(),
  dicabut_at timestamptz,
  terakhir_dipakai_at timestamptz,
  CONSTRAINT hermes_api_key_dicabut_konsisten CHECK (aktif OR dicabut_at IS NOT NULL)
);

COMMENT ON TABLE public.hermes_api_key IS
  'Kunci per bot Hermes. Kunci asli hanya ditampilkan sekali; yang disimpan SHA-256. ip_diizinkan kosong = tolak semua.';

CREATE TABLE IF NOT EXISTS public.hermes_api_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kunci_id uuid REFERENCES public.hermes_api_key(id) ON DELETE SET NULL,
  prefix text,
  alat text,
  status text NOT NULL CHECK (status IN ('ok', 'galat', 'ditolak')),
  alasan text,
  ip text,
  durasi_ms integer,
  at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.hermes_api_log IS 'Log panggilan Hermes. Tanpa isi jawaban.';

CREATE INDEX IF NOT EXISTS hermes_api_log_at_idx ON public.hermes_api_log (at DESC);
CREATE INDEX IF NOT EXISTS hermes_api_log_kunci_idx ON public.hermes_api_log (kunci_id, at DESC);

ALTER TABLE public.hermes_api_key ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hermes_api_log ENABLE ROW LEVEL SECURITY;

-- Default privileges Supabase memberi ALL ke tabel baru: cabut eksplisit.
REVOKE ALL ON TABLE public.hermes_api_key FROM anon, authenticated;
REVOKE ALL ON TABLE public.hermes_api_log FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.hermes_api_log_id_seq FROM anon, authenticated;
```

- [ ] **Step 4: Terapkan & verifikasi ke katalog**

Terapkan isi berkas (Supabase MCP `apply_migration` dengan nama `hermes_api_key`, atau jalur `exec_sql` + stempel manual sesuai memori proyek). Lalu:
```sql
SELECT c.relname, c.relrowsecurity,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS auth_select,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select
FROM pg_class c WHERE c.relname IN ('hermes_api_key','hermes_api_log');
SELECT version, name FROM supabase_migrations.schema_migrations WHERE version LIKE '20261007%';
```
Expected: 2 baris, `relrowsecurity = true`, `auth_select = false`, `anon_select = false`; versi `20261007130000` tercatat (jika `apply_migration` mencatat versi lain, stempel versi berkas juga dan catat di laporan).

- [ ] **Step 5: Jalankan uji akses + kontrol negatif**

Run `t1_akses_tabel.sql`. Expected: selesai tanpa error. Lalu jalankan kontrol negatif (ganti `'gaji'` → `'penjualan'` di salinan sementara). Expected: ERROR `(d) scope asing diterima`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261007130000_hermes_api_key.sql supabase/verifikasi/hermes/t1_akses_tabel.sql
git commit -m "feat(hermes): tabel kunci API & log (service role saja)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Kunci, IP, dan validasi (fungsi murni)

**Files:**
- Create: `apps/admin-dashboard/src/lib/hermes/domain.ts`, `kunci.ts`, `ip.ts`, `validasi.ts`
- Test: `apps/admin-dashboard/src/lib/hermes/kunci.test.ts`, `ip.test.ts`, `validasi.test.ts`

**Interfaces:**
- Produces:
  - `type Domain = 'penjualan' | 'gudang' | 'absensi' | 'finance'`; `const DOMAIN: readonly Domain[]`; `function adalahDomain(x: string): x is Domain`
  - `hashKunci(kunci: string): string` (hex 64), `buatKunciBaru(): { kunci: string; prefix: string; hash: string }`, `uraiBearer(header: string | null): { kunci: string; prefix: string } | null`, `hashCocok(a: string, b: string): boolean`
  - `ipKlien(h: { get(n: string): string | null }): string | null`, `normalisasiIp(ip: string): string`, `ipValid(ip: string): boolean`, `ipDiizinkan(ip: string | null, daftar: string[]): boolean`
  - `validasiInputKunci(x: { nama: unknown; scope: unknown; ip: unknown }): { ok: true; nama: string; scope: Domain[]; ip: string[] } | { ok: false; pesan: string }`

- [ ] **Step 1: Tulis test (gagal)**

```ts
// apps/admin-dashboard/src/lib/hermes/kunci.test.ts
import { buatKunciBaru, hashKunci, uraiBearer, hashCocok } from './kunci'

describe('kunci Hermes', () => {
  it('format hms_<prefix8>_<rahasia32> dan hash = sha256 kunci', () => {
    const k = buatKunciBaru()
    expect(k.kunci).toMatch(/^hms_[0-9a-f]{8}_[A-Za-z0-9_-]{32}$/)
    expect(k.kunci.slice(4, 12)).toBe(k.prefix)
    expect(k.hash).toBe(hashKunci(k.kunci))
    expect(k.hash).toMatch(/^[0-9a-f]{64}$/)
  })
  it('dua kunci tidak pernah sama', () => {
    expect(buatKunciBaru().kunci).not.toBe(buatKunciBaru().kunci)
  })
  it('uraiBearer menerima Bearer + format benar saja', () => {
    const k = buatKunciBaru()
    expect(uraiBearer(`Bearer ${k.kunci}`)).toEqual({ kunci: k.kunci, prefix: k.prefix })
    expect(uraiBearer(`bearer  ${k.kunci} `)).toEqual({ kunci: k.kunci, prefix: k.prefix })
    expect(uraiBearer(null)).toBeNull()
    expect(uraiBearer(k.kunci)).toBeNull()
    expect(uraiBearer('Bearer hms_XYZ')).toBeNull()
    expect(uraiBearer(`Bearer ${k.kunci}x`)).toBeNull()
  })
  it('hashCocok: sama → true, beda/kosong/panjang beda → false', () => {
    const h = hashKunci('a')
    expect(hashCocok(h, hashKunci('a'))).toBe(true)
    expect(hashCocok(h, hashKunci('b'))).toBe(false)
    expect(hashCocok(h, '')).toBe(false)
    expect(hashCocok(h, h.slice(2))).toBe(false)
  })
})
```

```ts
// apps/admin-dashboard/src/lib/hermes/ip.test.ts
import { ipKlien, ipDiizinkan, ipValid, normalisasiIp } from './ip'

const h = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null })

describe('IP klien', () => {
  it('x-real-ip diutamakan', () => {
    expect(ipKlien(h({ 'x-real-ip': '76.13.193.138', 'x-forwarded-for': '1.1.1.1' }))).toBe('76.13.193.138')
  })
  it('tanpa x-real-ip: hop TERAKHIR x-forwarded-for (yang ditambahkan proxy), bukan yang pertama', () => {
    expect(ipKlien(h({ 'x-forwarded-for': '6.6.6.6, 76.13.193.138' }))).toBe('76.13.193.138')
  })
  it('tanpa header → null', () => {
    expect(ipKlien(h({}))).toBeNull()
  })
  it('IPv4-mapped IPv6 dinormalkan', () => {
    expect(normalisasiIp('::ffff:76.13.193.138')).toBe('76.13.193.138')
    expect(ipKlien(h({ 'x-real-ip': '::ffff:10.0.1.1' }))).toBe('10.0.1.1')
  })
  it('allowlist fail-closed', () => {
    expect(ipDiizinkan('76.13.193.138', ['76.13.193.138'])).toBe(true)
    expect(ipDiizinkan('76.13.193.138', [])).toBe(false)
    expect(ipDiizinkan(null, ['76.13.193.138'])).toBe(false)
    expect(ipDiizinkan('76.13.193.139', ['76.13.193.138'])).toBe(false)
  })
  it('ipValid', () => {
    expect(ipValid('76.13.193.138')).toBe(true)
    expect(ipValid('2a02:4780:59:ce0d::1')).toBe(true)
    expect(ipValid('999.1.1.1')).toBe(false)
    expect(ipValid('abc')).toBe(false)
    expect(ipValid('76.13.193.0/24')).toBe(false)
  })
})
```

```ts
// apps/admin-dashboard/src/lib/hermes/validasi.test.ts
import { validasiInputKunci } from './validasi'

describe('validasiInputKunci', () => {
  it('menerima input benar dan merapikannya', () => {
    expect(validasiInputKunci({ nama: '  Bot CEO ', scope: ['penjualan', 'gudang', 'penjualan'], ip: [' 76.13.193.138 '] }))
      .toEqual({ ok: true, nama: 'Bot CEO', scope: ['penjualan', 'gudang'], ip: ['76.13.193.138'] })
  })
  it('menolak nama pendek, scope kosong/asing, IP salah, terlalu banyak IP', () => {
    expect(validasiInputKunci({ nama: 'ab', scope: ['penjualan'], ip: ['1.1.1.1'] }).ok).toBe(false)
    expect(validasiInputKunci({ nama: 'Bot', scope: [], ip: ['1.1.1.1'] }).ok).toBe(false)
    expect(validasiInputKunci({ nama: 'Bot', scope: ['gaji'], ip: ['1.1.1.1'] }).ok).toBe(false)
    expect(validasiInputKunci({ nama: 'Bot', scope: ['penjualan'], ip: ['x'] }).ok).toBe(false)
    expect(validasiInputKunci({ nama: 'Bot', scope: ['penjualan'], ip: Array.from({ length: 11 }, (_, i) => `1.1.1.${i}`) }).ok).toBe(false)
  })
  it('IP boleh kosong (kunci dibuat dulu, IP diisi setelah terlihat di log)', () => {
    expect(validasiInputKunci({ nama: 'Bot', scope: ['penjualan'], ip: [] })).toMatchObject({ ok: true, ip: [] })
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd apps/admin-dashboard && yarn test src/lib/hermes`
Expected: FAIL — modul tidak ditemukan.

- [ ] **Step 3: Implementasi**

```ts
// apps/admin-dashboard/src/lib/hermes/domain.ts
export const DOMAIN = ['penjualan', 'gudang', 'absensi', 'finance'] as const
export type Domain = (typeof DOMAIN)[number]
export function adalahDomain(x: string): x is Domain {
  return (DOMAIN as readonly string[]).includes(x)
}
```

```ts
// apps/admin-dashboard/src/lib/hermes/kunci.ts
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

const POLA_KUNCI = /^hms_([0-9a-f]{8})_([A-Za-z0-9_-]{32})$/

export function hashKunci(kunci: string): string {
  return createHash('sha256').update(kunci, 'utf8').digest('hex')
}

/** Kunci asli hanya dikembalikan di sini — simpan `prefix` + `hash`, tampilkan `kunci` sekali. */
export function buatKunciBaru(): { kunci: string; prefix: string; hash: string } {
  const prefix = randomBytes(4).toString('hex')
  const rahasia = randomBytes(24).toString('base64url') // 32 karakter
  const kunci = `hms_${prefix}_${rahasia}`
  return { kunci, prefix, hash: hashKunci(kunci) }
}

export function uraiBearer(header: string | null): { kunci: string; prefix: string } | null {
  if (!header) return null
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim())
  if (!m) return null
  const k = POLA_KUNCI.exec(m[1])
  return k ? { kunci: m[1], prefix: k[1] } : null
}

export function hashCocok(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/.test(a) || !/^[0-9a-f]+$/.test(b)) return false
  const x = Buffer.from(a, 'hex')
  const y = Buffer.from(b, 'hex')
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y)
}
```

```ts
// apps/admin-dashboard/src/lib/hermes/ip.ts
import { isIP } from 'node:net'

export function normalisasiIp(ip: string): string {
  const t = ip.trim()
  return t.toLowerCase().startsWith('::ffff:') && isIP(t.slice(7)) === 4 ? t.slice(7) : t
}

/**
 * IP yang dilihat reverse proxy (Traefik/Coolify). x-real-ip di-set proxy; bila tak ada,
 * pakai hop TERAKHIR x-forwarded-for (yang ditambahkan proxy) — hop pertama bisa dipalsukan klien.
 */
export function ipKlien(h: { get(n: string): string | null }): string | null {
  const real = h.get('x-real-ip')?.trim()
  if (real) return normalisasiIp(real)
  const xff = h.get('x-forwarded-for')
  if (!xff) return null
  const hop = xff.split(',').map((s) => s.trim()).filter(Boolean)
  return hop.length ? normalisasiIp(hop[hop.length - 1]) : null
}

export function ipValid(ip: string): boolean {
  return isIP(ip) !== 0
}

/** Fail-closed: daftar kosong atau IP tak dikenal = tolak. */
export function ipDiizinkan(ip: string | null, daftar: string[]): boolean {
  return !!ip && daftar.includes(ip)
}
```

```ts
// apps/admin-dashboard/src/lib/hermes/validasi.ts
import { adalahDomain, type Domain } from './domain'
import { ipValid, normalisasiIp } from './ip'

const MAKS_IP = 10

export function validasiInputKunci(x: { nama: unknown; scope: unknown; ip: unknown }):
  | { ok: true; nama: string; scope: Domain[]; ip: string[] }
  | { ok: false; pesan: string } {
  const nama = typeof x.nama === 'string' ? x.nama.trim() : ''
  if (nama.length < 3 || nama.length > 60) return { ok: false, pesan: 'Nama 3–60 karakter.' }
  if (!Array.isArray(x.scope) || x.scope.length === 0) return { ok: false, pesan: 'Pilih minimal satu domain.' }
  const scope = [...new Set(x.scope.map(String))]
  if (!scope.every(adalahDomain)) return { ok: false, pesan: 'Domain tidak dikenal.' }
  if (!Array.isArray(x.ip)) return { ok: false, pesan: 'Daftar IP tidak valid.' }
  const ip = [...new Set(x.ip.map((s) => normalisasiIp(String(s))).filter(Boolean))]
  if (ip.length > MAKS_IP) return { ok: false, pesan: `Maksimal ${MAKS_IP} IP.` }
  const salah = ip.find((s) => !ipValid(s))
  if (salah) return { ok: false, pesan: `IP tidak valid: ${salah}` }
  return { ok: true, nama, scope: scope as Domain[], ip }
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `cd apps/admin-dashboard && yarn test src/lib/hermes`
Expected: PASS semua.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/hermes
git commit -m "feat(hermes): kunci, IP klien & validasi (fungsi murni ber-test)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Handler JSON-RPC MCP

**Files:**
- Create: `apps/admin-dashboard/src/lib/hermes/mcp.ts`
- Test: `apps/admin-dashboard/src/lib/hermes/mcp.test.ts`

**Interfaces:**
- Consumes: `Domain` (Task 3)
- Produces:
  - `type HasilAlat = { ok: true; data: Record<string, unknown> } | { ok: false; pesan: string }`
  - `interface AlatMcp { nama: string; domain: Domain; deskripsi: string; skemaInput: Record<string, unknown>; jalankan(args: unknown): Promise<HasilAlat> }`
  - `interface KonteksMcp { scope: Domain[]; alat: AlatMcp[] }`
  - `type JawabanRpc = { jsonrpc: '2.0'; id: string | number | null; result?: unknown; error?: { code: number; message: string } }`
  - `tanganiPesan(pesan: unknown, k: KonteksMcp): Promise<{ jawaban: JawabanRpc | null; log?: { alat: string; status: 'ok' | 'galat' | 'ditolak'; alasan?: string } }>`
  - `VERSI_PROTOKOL: readonly string[]`

Protokol: MCP Streamable HTTP, server menjawab satu objek JSON-RPC per POST (`application/json`). Notifikasi (tanpa `id`) → `jawaban: null` (route membalas 202). Batch tidak didukung (dihapus di spesifikasi 2025-06-18).

- [ ] **Step 1: Tulis test (gagal)**

```ts
// apps/admin-dashboard/src/lib/hermes/mcp.test.ts
import { tanganiPesan, VERSI_PROTOKOL, type AlatMcp, type KonteksMcp, type HasilAlat } from './mcp'

const alat = (nama: string, domain: AlatMcp['domain'], hasil: HasilAlat): AlatMcp => ({
  nama, domain, deskripsi: `alat ${nama}`, skemaInput: { type: 'object', properties: {} },
  jalankan: vi.fn(async () => hasil),
})
const k = (scope: KonteksMcp['scope'], extra: AlatMcp[] = []): KonteksMcp => ({
  scope,
  alat: [alat('omzet', 'penjualan', { ok: true, data: { status: 'ok', omzet: 1 } }), alat('rahasia_finance', 'finance', { ok: true, data: {} }), ...extra],
})

describe('MCP JSON-RPC', () => {
  it('initialize menyepakati versi yang didukung', async () => {
    const r = await tanganiPesan({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, k(['penjualan']))
    expect(r.jawaban?.result).toMatchObject({ protocolVersion: '2025-03-26', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'suka-shawarma' } })
  })
  it('initialize dengan versi asing → versi terbaru kita', async () => {
    const r = await tanganiPesan({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } }, k(['penjualan']))
    expect((r.jawaban?.result as any).protocolVersion).toBe(VERSI_PROTOKOL[0])
  })
  it('notifikasi (tanpa id) → tanpa jawaban', async () => {
    const r = await tanganiPesan({ jsonrpc: '2.0', method: 'notifications/initialized' }, k(['penjualan']))
    expect(r.jawaban).toBeNull()
  })
  it('ping → objek kosong', async () => {
    const r = await tanganiPesan({ jsonrpc: '2.0', id: 'p', method: 'ping' }, k(['penjualan']))
    expect(r.jawaban).toEqual({ jsonrpc: '2.0', id: 'p', result: {} })
  })
  it('tools/list hanya menampilkan alat dalam scope', async () => {
    const r = await tanganiPesan({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, k(['penjualan']))
    const tools = (r.jawaban?.result as any).tools
    expect(tools.map((t: any) => t.name)).toEqual(['omzet'])
    expect(tools[0]).toEqual({ name: 'omzet', description: 'alat omzet', inputSchema: { type: 'object', properties: {} } })
  })
  it('tools/call alat dalam scope → content teks JSON', async () => {
    const r = await tanganiPesan({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'omzet', arguments: { periode: 'kemarin' } } }, k(['penjualan']))
    const res = r.jawaban?.result as any
    expect(res.isError).toBe(false)
    expect(JSON.parse(res.content[0].text)).toEqual({ status: 'ok', omzet: 1 })
    expect(res.structuredContent).toEqual({ status: 'ok', omzet: 1 })
    expect(r.log).toEqual({ alat: 'omzet', status: 'ok' })
  })
  it('tools/call alat di luar scope → error seperti alat tak dikenal (tak membocorkan keberadaan)', async () => {
    const konteks = k(['penjualan'])
    const r = await tanganiPesan({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'rahasia_finance' } }, konteks)
    expect(r.jawaban?.error).toEqual({ code: -32602, message: 'Alat tidak dikenal: rahasia_finance' })
    expect(konteks.alat[1].jalankan).not.toHaveBeenCalled()
    expect(r.log).toEqual({ alat: 'rahasia_finance', status: 'ditolak', alasan: 'di luar scope atau tak dikenal' })
  })
  it('alat gagal → isError true + pesan, BUKAN angka 0', async () => {
    const r = await tanganiPesan(
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'rusak' } },
      k(['penjualan'], [alat('rusak', 'penjualan', { ok: false, pesan: 'Data tidak tersedia: timeout' })]),
    )
    const res = r.jawaban?.result as any
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toBe('Data tidak tersedia: timeout')
    expect(r.log).toEqual({ alat: 'rusak', status: 'galat', alasan: 'Data tidak tersedia: timeout' })
  })
  it('alat melempar exception → isError true', async () => {
    const meledak: AlatMcp = { nama: 'meledak', domain: 'penjualan', deskripsi: '', skemaInput: {}, jalankan: async () => { throw new Error('boom') } }
    const r = await tanganiPesan({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'meledak' } }, k(['penjualan'], [meledak]))
    expect((r.jawaban?.result as any).isError).toBe(true)
    expect((r.jawaban?.result as any).content[0].text).toBe('Data tidak tersedia: boom')
  })
  it('method tak dikenal → -32601; pesan rusak → -32600; batch → -32600', async () => {
    expect((await tanganiPesan({ jsonrpc: '2.0', id: 7, method: 'resources/list' }, k(['penjualan']))).jawaban?.error?.code).toBe(-32601)
    expect((await tanganiPesan({ id: 8, method: 'ping' }, k(['penjualan']))).jawaban?.error?.code).toBe(-32600)
    expect((await tanganiPesan([{ jsonrpc: '2.0', id: 9, method: 'ping' }], k(['penjualan']))).jawaban?.error?.code).toBe(-32600)
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd apps/admin-dashboard && yarn test src/lib/hermes/mcp.test.ts`
Expected: FAIL — modul tidak ditemukan.

- [ ] **Step 3: Implementasi**

```ts
// apps/admin-dashboard/src/lib/hermes/mcp.ts
import type { Domain } from './domain'

/** Versi protokol MCP yang kita layani, terbaru dulu. */
export const VERSI_PROTOKOL = ['2025-06-18', '2025-03-26', '2024-11-05'] as const

export type HasilAlat = { ok: true; data: Record<string, unknown> } | { ok: false; pesan: string }

export interface AlatMcp {
  nama: string
  domain: Domain
  deskripsi: string
  skemaInput: Record<string, unknown>
  jalankan(args: unknown): Promise<HasilAlat>
}

export interface KonteksMcp {
  scope: Domain[]
  alat: AlatMcp[]
}

export type JawabanRpc = {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: { code: number; message: string }
}

type CatatanLog = { alat: string; status: 'ok' | 'galat' | 'ditolak'; alasan?: string }

const INSTRUKSI =
  'Data operasional Suka Shawarma (baca saja). Setiap angka WAJIB berasal dari hasil alat; ' +
  'bila alat gagal, katakan "data tidak tersedia" beserta alasannya. Jangan memperkirakan.'

const galat = (id: JawabanRpc['id'], code: number, message: string): JawabanRpc => ({ jsonrpc: '2.0', id, error: { code, message } })

export async function tanganiPesan(pesan: unknown, k: KonteksMcp): Promise<{ jawaban: JawabanRpc | null; log?: CatatanLog }> {
  if (Array.isArray(pesan)) return { jawaban: galat(null, -32600, 'Batch tidak didukung') }
  if (!pesan || typeof pesan !== 'object') return { jawaban: galat(null, -32600, 'Invalid Request') }
  const p = pesan as { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: any }
  const adaId = Object.prototype.hasOwnProperty.call(p, 'id')
  const id = typeof p.id === 'string' || typeof p.id === 'number' ? p.id : null
  if (p.jsonrpc !== '2.0' || typeof p.method !== 'string') return { jawaban: galat(id, -32600, 'Invalid Request') }
  if (!adaId) return { jawaban: null } // notifikasi

  const terlihat = k.alat.filter((a) => k.scope.includes(a.domain))

  switch (p.method) {
    case 'initialize': {
      const diminta = p.params?.protocolVersion
      const versi = (VERSI_PROTOKOL as readonly string[]).includes(diminta) ? diminta : VERSI_PROTOKOL[0]
      return {
        jawaban: {
          jsonrpc: '2.0', id,
          result: {
            protocolVersion: versi,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: 'suka-shawarma', version: '1.0.0' },
            instructions: INSTRUKSI,
          },
        },
      }
    }
    case 'ping':
      return { jawaban: { jsonrpc: '2.0', id, result: {} } }
    case 'tools/list':
      return {
        jawaban: {
          jsonrpc: '2.0', id,
          result: { tools: terlihat.map((a) => ({ name: a.nama, description: a.deskripsi, inputSchema: a.skemaInput })) },
        },
      }
    case 'tools/call': {
      const nama = typeof p.params?.name === 'string' ? p.params.name : ''
      const a = terlihat.find((x) => x.nama === nama)
      if (!a) {
        return {
          jawaban: galat(id, -32602, `Alat tidak dikenal: ${nama}`),
          log: { alat: nama || '(kosong)', status: 'ditolak', alasan: 'di luar scope atau tak dikenal' },
        }
      }
      let hasil: HasilAlat
      try {
        hasil = await a.jalankan(p.params?.arguments ?? {})
      } catch (e) {
        hasil = { ok: false, pesan: `Data tidak tersedia: ${e instanceof Error ? e.message : String(e)}` }
      }
      if (!hasil.ok) {
        return {
          jawaban: { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: hasil.pesan }], isError: true } },
          log: { alat: nama, status: 'galat', alasan: hasil.pesan },
        }
      }
      return {
        jawaban: {
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: JSON.stringify(hasil.data) }], structuredContent: hasil.data, isError: false },
        },
        log: { alat: nama, status: 'ok' },
      }
    }
    default:
      return { jawaban: galat(id, -32601, `Method tidak dikenal: ${p.method}`) }
  }
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `cd apps/admin-dashboard && yarn test src/lib/hermes/mcp.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/hermes/mcp.ts apps/admin-dashboard/src/lib/hermes/mcp.test.ts
git commit -m "feat(hermes): handler JSON-RPC MCP (scope, galat eksplisit)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Alat domain penjualan + laporan pagi CEO + registry

**Files:**
- Create: `apps/admin-dashboard/src/lib/hermes/laporanPagi.ts`, `alat/penjualan.ts`, `registry.ts`
- Test: `apps/admin-dashboard/src/lib/hermes/laporanPagi.test.ts`, `registry.test.ts`

**Interfaces:**
- Consumes: `AlatMcp`, `HasilAlat` (Task 4); `Domain` (Task 3); dari SUKA Bot: `alatOmzet`, `alatBandingkan`, `alatMenuTerlaris`, `alatRankingOutlet`, `type KonteksPenjualan`, `type OutletInfo` (`@/lib/sukaBot/alat/penjualan`); `hitungRekap`, `tanggalRekapUntuk`, `type DataRekap` (`@/lib/sukaBot/rekap`); `rupiah` (`@/lib/sukaBot/format`); `labelTanggal` (`@/lib/sukaBot/periode`).
- Produces:
  - `interface KonteksHermes { penjualan: KonteksPenjualan; sekarang: Date }`
  - `interface DefinisiAlat { nama: string; domain: Domain; deskripsi: string; skema: z.ZodType; contoh: Record<string, unknown>; jalankan(ctx: KonteksHermes, a: any): Promise<Record<string, unknown>> }`
  - `ALAT_PENJUALAN: DefinisiAlat[]`, `ALAT_HERMES: DefinisiAlat[]`
  - `teksLaporanPagiCeo(d: DataRekap): string`
  - `bangunAlatMcp(ambilKonteks: () => Promise<KonteksHermes>): AlatMcp[]`
  - `skemaJson(s: z.ZodType): Record<string, unknown>`

Catatan cakupan: butir 5 laporan pagi ("satu baris domain lain") belum ada isinya di tahap 1 — tak ada domain lain yang aktif. SS Online **tidak** dicantumkan (`getPosReport` dengan id outlet marketplace belum diverifikasi setara dengan pilihan "SS Online" di layar); teks menyebut "tanpa SS Online" secara eksplisit.

- [ ] **Step 1: Tulis test template (gagal)**

```ts
// apps/admin-dashboard/src/lib/hermes/laporanPagi.test.ts
import { teksLaporanPagiCeo } from './laporanPagi'
import { labelTanggal } from '@/lib/sukaBot/periode'
import type { DataRekap } from '@/lib/sukaBot/rekap'

const d: DataRekap = {
  tanggal: '2026-10-06', pembanding: '2026-09-29',
  omzet: 48_500_000, omzetPembanding: 51_000_000, transaksi: 1234,
  ranking: [
    { peringkat: 1, nama: 'EMPANG', omzet: 6_000_000 },
    { peringkat: 2, nama: 'BEJI', omzet: 4_000_000 },
    { peringkat: 3, nama: 'KALISARI', omzet: 0 },
  ],
  menuTeratas: [{ nama: 'Original Sapi Jumbo', qty: 320 }, { nama: 'Original Ayam Jumbo', qty: 290 }, { nama: 'Ice Tea', qty: 150 }],
}

describe('teksLaporanPagiCeo', () => {
  const t = teksLaporanPagiCeo(d)
  it('memuat tanggal, omzet & pembanding dalam rupiah, tanpa persen', () => {
    expect(t).toContain(labelTanggal('2026-10-06'))
    expect(t).toContain('Omzet kotor: Rp 48.500.000')
    expect(t).toContain(`Minggu lalu (${labelTanggal('2026-09-29')}): Rp 51.000.000`)
    expect(t).not.toMatch(/%/)
  })
  it('memuat transaksi, tertinggi, terendah, dan outlet tanpa penjualan', () => {
    expect(t).toContain('Transaksi: 1.234')
    expect(t).toContain('Tertinggi: EMPANG — Rp 6.000.000')
    expect(t).toContain('Terendah: KALISARI — Rp 0')
    expect(t).toContain('Tanpa penjualan: KALISARI')
  })
  it('memuat 3 menu terlaris berurutan dan sumber', () => {
    expect(t).toMatch(/1\. Original Sapi Jumbo — 320 porsi\n2\. Original Ayam Jumbo — 290 porsi\n3\. Ice Tea — 150 porsi/)
    expect(t).toContain('Sumber: Rangkuman Penjualan')
    expect(t).toContain('tanpa SS Online')
  })
  it('ranking kosong tidak meledak', () => {
    const k = teksLaporanPagiCeo({ ...d, ranking: [], menuTeratas: [] })
    expect(k).toContain('Tertinggi: —')
    expect(k).toContain('Terendah: —')
  })
})
```

- [ ] **Step 2: Tulis test registry + gerbang larangan data (gagal)**

```ts
// apps/admin-dashboard/src/lib/hermes/registry.test.ts
import { ALAT_HERMES, bangunAlatMcp, type KonteksHermes } from './registry'
import { DOMAIN } from './domain'
import type { KonteksPenjualan, OutletInfo } from '@/lib/sukaBot/alat/penjualan'

const outlets: OutletInfo[] = [
  { id: 'o1', name: 'SUKA SHAWARMA EMPANG', type: 'internal', is_active: true, slug: 'empang' },
  { id: 'o2', name: 'MITRA CIBINONG', type: 'mitra', is_active: true, slug: 'cibinong' },
  { id: 'o3', name: 'outlet tes', type: 'test', is_active: true, slug: 'tes' },
]
const penjualan: KonteksPenjualan = {
  outlets,
  hariIni: '2026-10-07',
  sekarang: new Date('2026-10-07T03:00:00Z'),
  ambilLaporan: async ({ outletIds }) => ({
    omzetKotor: 1_000_000 * outletIds.length, omzetBersih: 900_000 * outletIds.length, transaksi: 10 * outletIds.length,
    menu: [{ nama: 'Original Sapi Jumbo', qty: 5, omzet: 300_000 }],
  }),
}
const ctx: KonteksHermes = { penjualan, sekarang: penjualan.sekarang }

// §6 spec: pola yang tak boleh pernah muncul di output alat mana pun.
const TERLARANG = [
  /gaji|salary|kasbon|cash_advance|payroll/i,
  /\bnik\b|ktp/i,
  /face_descriptor|selfie|ref_photo_url|foto_wajah/i,
  /password|token|api_key|service_role/i,
  /(\+62|\b08)\d{8,12}\b/,
  /\b\d{16}\b/,
  /@[a-z0-9-]+\.[a-z]{2,}/i,
]

const cari = (nama: string) => bangunAlatMcp(async () => ctx).find((m) => m.nama === nama)!

describe('registry alat Hermes', () => {
  it('nama unik, domain sah, deskripsi terisi, contoh argumen lolos skema', () => {
    const nama = ALAT_HERMES.map((a) => a.nama)
    expect(new Set(nama).size).toBe(nama.length)
    for (const a of ALAT_HERMES) {
      expect(DOMAIN).toContain(a.domain)
      expect(a.deskripsi.length).toBeGreaterThan(20)
      expect(a.skema.safeParse(a.contoh).success).toBe(true)
    }
  })
  it('skema JSON tiap alat = object tanpa $schema', () => {
    for (const m of bangunAlatMcp(async () => ctx)) {
      expect(m.skemaInput.type).toBe('object')
      expect(m.skemaInput).not.toHaveProperty('$schema')
    }
  })
  it('argumen salah → ok:false dengan pesan, bukan exception', async () => {
    const r = await cari('penjualan_ringkasan').jalankan({ periode: 'kemarin_lusa' })
    expect(r.ok).toBe(false)
  })
  it('sumber data gagal → ok:false "Data tidak tersedia", bukan angka 0', async () => {
    const rusak: KonteksHermes = { ...ctx, penjualan: { ...penjualan, ambilLaporan: async () => { throw new Error('timeout') } } }
    const r = await bangunAlatMcp(async () => rusak).find((m) => m.nama === 'penjualan_ringkasan')!.jalankan({ periode: 'kemarin' })
    expect(r).toEqual({ ok: false, pesan: 'Data tidak tersedia: timeout' })
  })
  it('GERBANG §6: output setiap alat bebas data terlarang & membawa meta', async () => {
    for (const m of bangunAlatMcp(async () => ctx)) {
      const def = ALAT_HERMES.find((a) => a.nama === m.nama)!
      const r = await m.jalankan(def.contoh)
      expect(r.ok, m.nama).toBe(true)
      const teks = JSON.stringify(r)
      for (const pola of TERLARANG) expect(teks, `${m.nama} cocok ${pola}`).not.toMatch(pola)
      if (r.ok) {
        expect(r.data.meta).toMatchObject({ sumber: 'Rangkuman Penjualan' })
        expect(['lengkap', 'sebagian']).toContain((r.data.meta as any).kelengkapan)
      }
    }
  })
  it('outlet tes tidak pernah ikut peringkat', async () => {
    const r = await cari('penjualan_peringkat_outlet').jalankan({ periode: 'kemarin' })
    expect(JSON.stringify(r)).not.toContain('outlet tes')
  })
  it('laporan_pagi_ceo mengembalikan teks template', async () => {
    const r = await cari('laporan_pagi_ceo').jalankan({ tanggal: '2026-10-06' })
    expect(r.ok && String(r.data.teks)).toContain('Laporan Pagi')
  })
})
```

- [ ] **Step 3: Jalankan, pastikan gagal**

Run: `cd apps/admin-dashboard && yarn test src/lib/hermes/laporanPagi.test.ts src/lib/hermes/registry.test.ts`
Expected: FAIL — modul tidak ditemukan.

- [ ] **Step 4: Implementasi template**

```ts
// apps/admin-dashboard/src/lib/hermes/laporanPagi.ts
import type { DataRekap } from '@/lib/sukaBot/rekap'
import { rupiah } from '@/lib/sukaBot/format'
import { labelTanggal } from '@/lib/sukaBot/periode'

// Teks dirakit kode, bukan AI (spec K12). Omzet tanpa persen (keputusan owner 2026-10-05).
export function teksLaporanPagiCeo(d: DataRekap): string {
  const atas = d.ranking[0]
  const bawah = d.ranking.length > 1 ? d.ranking[d.ranking.length - 1] : undefined
  const nol = d.ranking.filter((r) => r.omzet <= 0).map((r) => r.nama)
  return [
    `☀️ Laporan Pagi — ${labelTanggal(d.tanggal)}`,
    '',
    `Omzet kotor: ${rupiah(d.omzet)}`,
    `Minggu lalu (${labelTanggal(d.pembanding)}): ${rupiah(d.omzetPembanding)}`,
    `Transaksi: ${d.transaksi.toLocaleString('id-ID')}`,
    '',
    atas ? `Tertinggi: ${atas.nama} — ${rupiah(atas.omzet)}` : 'Tertinggi: —',
    bawah ? `Terendah: ${bawah.nama} — ${rupiah(bawah.omzet)}` : 'Terendah: —',
    ...(nol.length ? [`Tanpa penjualan: ${nol.join(', ')}`] : []),
    '',
    'Menu terlaris:',
    ...(d.menuTeratas.length
      ? d.menuTeratas.map((m, i) => `${i + 1}. ${m.nama} — ${m.qty.toLocaleString('id-ID')} porsi`)
      : ['—']),
    '',
    'Sumber: Rangkuman Penjualan (omzet kotor, outlet internal + mitra, tanpa SS Online).',
  ].join('\n')
}
```

- [ ] **Step 5: Implementasi alat penjualan**

```ts
// apps/admin-dashboard/src/lib/hermes/alat/penjualan.ts
import { z } from 'zod'
import { alatOmzet, alatBandingkan, alatMenuTerlaris, alatRankingOutlet } from '@/lib/sukaBot/alat/penjualan'
import { hitungRekap, tanggalRekapUntuk } from '@/lib/sukaBot/rekap'
import { teksLaporanPagiCeo } from '../laporanPagi'
import type { DefinisiAlat } from '../registry'

const TGL = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'format YYYY-MM-DD')
const PERIODE = z
  .enum(['hari_ini', 'kemarin', 'minggu_ini', 'minggu_lalu', 'bulan_ini', 'bulan_lalu', 'rentang'])
  .describe('Periode. Pakai "rentang" + dari/sampai untuk tanggal tertentu.')
const KANAL = z
  .enum(['semua', 'kasir', 'gofood', 'grabfood', 'shopeefood', 'food_apps', 'tiktok_go', 'web'])
  .describe('Kanal penjualan. Default semua.')
const OUTLET = z.string().min(1).max(60).describe('Nama outlet (sebagian nama boleh). Kosongkan untuk semua outlet.')

const zPeriode = { periode: PERIODE, dari: TGL.optional(), sampai: TGL.optional() }

export const ALAT_PENJUALAN: DefinisiAlat[] = [
  {
    nama: 'penjualan_ringkasan',
    domain: 'penjualan',
    deskripsi: 'Omzet kotor, omzet bersih, dan jumlah transaksi untuk satu periode, semua outlet atau satu outlet. Angka = Rangkuman Penjualan.',
    skema: z.object({ ...zPeriode, outlet: OUTLET.optional(), kanal: KANAL.optional() }).strict(),
    contoh: { periode: 'kemarin' },
    jalankan: (ctx, a) => alatOmzet(ctx.penjualan, a),
  },
  {
    nama: 'penjualan_bandingkan',
    domain: 'penjualan',
    deskripsi: 'Bandingkan omzet satu periode dengan periode pembanding (default: periode sebelumnya yang setara). Hasil dalam rupiah, tanpa persen.',
    skema: z
      .object({ ...zPeriode, pembanding: z.object(zPeriode).strict().optional(), outlet: OUTLET.optional(), kanal: KANAL.optional() })
      .strict(),
    contoh: { periode: 'minggu_lalu' },
    jalankan: (ctx, a) => alatBandingkan(ctx.penjualan, a),
  },
  {
    nama: 'penjualan_menu_terlaris',
    domain: 'penjualan',
    deskripsi: 'Daftar menu terlaris (atau tersepi) berdasarkan jumlah porsi untuk satu periode.',
    skema: z
      .object({
        ...zPeriode,
        outlet: OUTLET.optional(),
        kanal: KANAL.optional(),
        urutan: z.enum(['terlaris', 'tersepi']).optional(),
        jumlah: z.number().int().min(1).max(20).optional(),
      })
      .strict(),
    contoh: { periode: 'kemarin', jumlah: 3 },
    jalankan: (ctx, a) => alatMenuTerlaris(ctx.penjualan, a),
  },
  {
    nama: 'penjualan_peringkat_outlet',
    domain: 'penjualan',
    deskripsi: 'Peringkat semua outlet terhitung (internal + mitra, tanpa outlet tes & SS Online) berdasarkan omzet kotor.',
    skema: z.object({ ...zPeriode, kanal: KANAL.optional() }).strict(),
    contoh: { periode: 'kemarin' },
    jalankan: (ctx, a) => alatRankingOutlet(ctx.penjualan, a),
  },
  {
    nama: 'laporan_pagi_ceo',
    domain: 'penjualan',
    deskripsi: 'Laporan pagi CEO siap kirim (teks) + datanya. Tanggal default = kemarin (sebelum 05:00 WIB = lusa). Kirim field "teks" apa adanya.',
    skema: z.object({ tanggal: TGL.optional() }).strict(),
    contoh: {},
    jalankan: async (ctx, a: { tanggal?: string }) => {
      const tanggal = a.tanggal ?? tanggalRekapUntuk(ctx.sekarang)
      const d = await hitungRekap(ctx.penjualan, tanggal)
      return {
        status: 'ok',
        tanggal,
        teks: teksLaporanPagiCeo(d),
        data: {
          omzet_kotor: d.omzet,
          omzet_minggu_lalu: d.omzetPembanding,
          transaksi: d.transaksi,
          peringkat: d.ranking,
          menu_teratas: d.menuTeratas,
        },
        sumber: 'Rangkuman Penjualan',
      }
    },
  },
]
```

- [ ] **Step 6: Implementasi registry**

```ts
// apps/admin-dashboard/src/lib/hermes/registry.ts
import { z } from 'zod'
import type { KonteksPenjualan } from '@/lib/sukaBot/alat/penjualan'
import type { Domain } from './domain'
import type { AlatMcp, HasilAlat } from './mcp'
import { ALAT_PENJUALAN } from './alat/penjualan'

export interface KonteksHermes {
  penjualan: KonteksPenjualan
  sekarang: Date
}

export interface DefinisiAlat {
  nama: string
  domain: Domain
  deskripsi: string
  skema: z.ZodType
  /** Argumen contoh yang sah — dipakai test gerbang §6. */
  contoh: Record<string, unknown>
  jalankan(ctx: KonteksHermes, a: any): Promise<Record<string, unknown>>
}

export const ALAT_HERMES: DefinisiAlat[] = [...ALAT_PENJUALAN]

export function skemaJson(s: z.ZodType): Record<string, unknown> {
  const { $schema: _abaikan, ...sisa } = z.toJSONSchema(s) as Record<string, unknown>
  return sisa
}

function bungkus(def: DefinisiAlat, ambilKonteks: () => Promise<KonteksHermes>): AlatMcp {
  return {
    nama: def.nama,
    domain: def.domain,
    deskripsi: def.deskripsi,
    skemaInput: skemaJson(def.skema),
    async jalankan(args: unknown): Promise<HasilAlat> {
      const p = def.skema.safeParse(args ?? {})
      if (!p.success) {
        return { ok: false, pesan: `Argumen tidak valid: ${p.error.issues.map((i) => `${i.path.join('.') || '(akar)'} ${i.message}`).join('; ')}` }
      }
      try {
        const ctx = await ambilKonteks()
        const hasil = await def.jalankan(ctx, p.data)
        if (hasil.status === 'galat') return { ok: false, pesan: `Data tidak tersedia: ${String(hasil.pesan ?? 'galat')}` }
        return {
          ok: true,
          data: {
            ...hasil,
            meta: {
              sumber: 'Rangkuman Penjualan',
              dihitung_pada: ctx.sekarang.toISOString(),
              kelengkapan: hasil.catatan ? 'sebagian' : 'lengkap',
            },
          },
        }
      } catch (e) {
        return { ok: false, pesan: `Data tidak tersedia: ${e instanceof Error ? e.message : String(e)}` }
      }
    },
  }
}

/** Konteks diambil malas & sekali per permintaan: initialize/tools/list tidak menyentuh DB. */
export function bangunAlatMcp(ambilKonteks: () => Promise<KonteksHermes>): AlatMcp[] {
  let janji: Promise<KonteksHermes> | null = null
  const sekali = () => (janji ??= ambilKonteks())
  return ALAT_HERMES.map((d) => bungkus(d, sekali))
}
```

Catatan: `kelengkapan` memakai `catatan` dari alat SUKA Bot (diisi `catatanBerjalan`/`catatanBanding` bila periode masih berjalan). `laporan_pagi_ceo` tanpa `catatan` → `lengkap`, benar karena tanggalnya selalu hari lampau. Bila konteks gagal diambil (mis. DB down), janji yang ditolak tersimpan untuk sisa permintaan itu saja — permintaan berikutnya membangun ulang.

- [ ] **Step 7: Jalankan test, pastikan lulus**

Run: `cd apps/admin-dashboard && yarn test src/lib/hermes`
Expected: PASS semua (termasuk Task 3-4). Jika label tanggal berbeda format, perbaiki **test** agar memakai `labelTanggal(...)`, bukan mengubah `labelTanggal`. Jika `alatOmzet` dkk mengembalikan `status: 'ambigu'`/`'tidak_ditemukan'` untuk contoh tertentu, ganti **contoh**-nya, bukan alatnya.

- [ ] **Step 8: Commit**

```bash
git add apps/admin-dashboard/src/lib/hermes
git commit -m "feat(hermes): alat domain penjualan + laporan pagi CEO + gerbang larangan data

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Endpoint `/api/hermes/mcp` (autentikasi, log, konteks, middleware)

**Files:**
- Create: `apps/admin-dashboard/src/lib/hermes/server/autentikasi.ts`, `server/konteks.ts`, `apps/admin-dashboard/src/app/api/hermes/mcp/route.ts`
- Modify: `apps/admin-dashboard/src/middleware.ts` (setelah baris bypass `/api/asisten/`)
- Test: `apps/admin-dashboard/src/lib/hermes/server/autentikasi.test.ts`

**Interfaces:**
- Consumes: `uraiBearer`, `hashKunci`, `hashCocok`, `ipKlien`, `ipDiizinkan`, `adalahDomain`, `Domain` (Task 3); `tanganiPesan` (Task 4); `bangunAlatMcp`, `KonteksHermes` (Task 5); `laporanPosUntukScope`, `CakupanLaporan` (Task 1); `buatAmbilLaporan` (Task 1), `ambilOutlets` (sudah ada di `sumberData.ts`); `createServiceClient` (`@/lib/supabase/server`); `jakartaDate` (`@/lib/ownerDashboardCache`).
- Produces:
  - `type HasilAutentikasi = { ok: true; kunciId: string; prefix: string; scope: Domain[]; ip: string | null } | { ok: false; status: 401 | 403; alasan: string; kunciId: string | null; prefix: string | null; ip: string | null }`
  - `autentikasi(headers: { get(n: string): string | null }, svc: any): Promise<HasilAutentikasi>`
  - `catatLog(svc: any, e: { kunciId: string | null; prefix: string | null; alat: string | null; status: 'ok' | 'galat' | 'ditolak'; alasan?: string | null; ip: string | null; durasiMs: number }): Promise<void>`
  - `konteksHermes(svc: any, sekarang: Date): Promise<KonteksHermes>`

- [ ] **Step 1: Tulis test autentikasi (gagal)**

```ts
// apps/admin-dashboard/src/lib/hermes/server/autentikasi.test.ts
import { autentikasi } from './autentikasi'
import { buatKunciBaru } from '../kunci'

const k = buatKunciBaru()
const baris = (o: Record<string, unknown> = {}) => ({
  id: 'kid', hash_kunci: k.hash, scope: ['penjualan'], ip_diizinkan: ['76.13.193.138'], aktif: true, ...o,
})
function svc(data: unknown, error: unknown = null) {
  const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data, error }) }
  return { from: vi.fn(() => q) }
}
const h = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null })
const sah = { authorization: `Bearer ${k.kunci}`, 'x-real-ip': '76.13.193.138' }

describe('autentikasi Hermes', () => {
  it('kunci + IP benar → ok dengan scope', async () => {
    expect(await autentikasi(h(sah), svc(baris()))).toEqual({ ok: true, kunciId: 'kid', prefix: k.prefix, scope: ['penjualan'], ip: '76.13.193.138' })
  })
  it('tanpa header → 401, tanpa menyentuh DB', async () => {
    const s = svc(baris())
    const r = await autentikasi(h({ 'x-real-ip': '1.1.1.1' }), s)
    expect(r).toMatchObject({ ok: false, status: 401 })
    expect(s.from).not.toHaveBeenCalled()
  })
  it('prefix tak ada di DB → 401', async () => {
    expect(await autentikasi(h(sah), svc(null))).toMatchObject({ ok: false, status: 401, alasan: 'kunci tidak dikenal' })
  })
  it('hash tak cocok (rahasia ditebak dengan prefix benar) → 401', async () => {
    const palsu = `Bearer hms_${k.prefix}_${'A'.repeat(32)}`
    expect(await autentikasi(h({ ...sah, authorization: palsu }), svc(baris()))).toMatchObject({ ok: false, status: 401, alasan: 'kunci tidak dikenal' })
  })
  it('kunci dicabut → 401', async () => {
    expect(await autentikasi(h(sah), svc(baris({ aktif: false })))).toMatchObject({ ok: false, status: 401, alasan: 'kunci dicabut', kunciId: 'kid' })
  })
  it('IP lain / allowlist kosong → 403 (fail-closed)', async () => {
    expect(await autentikasi(h({ ...sah, 'x-real-ip': '9.9.9.9' }), svc(baris()))).toMatchObject({ ok: false, status: 403, ip: '9.9.9.9' })
    expect(await autentikasi(h(sah), svc(baris({ ip_diizinkan: [] })))).toMatchObject({ ok: false, status: 403 })
  })
  it('scope di DB yang bukan domain dibuang', async () => {
    const r = await autentikasi(h(sah), svc(baris({ scope: ['penjualan', 'aneh'] })))
    expect(r.ok && r.scope).toEqual(['penjualan'])
  })
  it('galat DB → dilempar (route membalas 500), bukan diam-diam lolos', async () => {
    await expect(autentikasi(h(sah), svc(null, { message: 'down' }))).rejects.toThrow('down')
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd apps/admin-dashboard && yarn test src/lib/hermes/server`
Expected: FAIL — modul tidak ditemukan.

- [ ] **Step 3: Implementasi autentikasi + log**

```ts
// apps/admin-dashboard/src/lib/hermes/server/autentikasi.ts
import { uraiBearer, hashKunci, hashCocok } from '../kunci'
import { ipKlien, ipDiizinkan } from '../ip'
import { adalahDomain, type Domain } from '../domain'

type Header = { get(n: string): string | null }

export type HasilAutentikasi =
  | { ok: true; kunciId: string; prefix: string; scope: Domain[]; ip: string | null }
  | { ok: false; status: 401 | 403; alasan: string; kunciId: string | null; prefix: string | null; ip: string | null }

export async function autentikasi(headers: Header, svc: any): Promise<HasilAutentikasi> {
  const ip = ipKlien(headers)
  const b = uraiBearer(headers.get('authorization'))
  if (!b) return { ok: false, status: 401, alasan: 'header Authorization tidak valid', kunciId: null, prefix: null, ip }

  const { data, error } = await svc
    .from('hermes_api_key')
    .select('id, hash_kunci, scope, ip_diizinkan, aktif')
    .eq('prefix', b.prefix)
    .maybeSingle()
  if (error) throw new Error(`hermes_api_key: ${error.message}`)

  if (!data || !hashCocok(hashKunci(b.kunci), String(data.hash_kunci))) {
    return { ok: false, status: 401, alasan: 'kunci tidak dikenal', kunciId: null, prefix: b.prefix, ip }
  }
  if (!data.aktif) return { ok: false, status: 401, alasan: 'kunci dicabut', kunciId: data.id, prefix: b.prefix, ip }
  if (!ipDiizinkan(ip, data.ip_diizinkan ?? [])) {
    return { ok: false, status: 403, alasan: `IP tidak diizinkan: ${ip ?? '(tak diketahui)'}`, kunciId: data.id, prefix: b.prefix, ip }
  }
  const scope = ((data.scope ?? []) as string[]).filter(adalahDomain)
  return { ok: true, kunciId: data.id, prefix: b.prefix, scope, ip }
}

/** Log tak boleh menggagalkan jawaban — galat hanya dicetak. */
export async function catatLog(
  svc: any,
  e: { kunciId: string | null; prefix: string | null; alat: string | null; status: 'ok' | 'galat' | 'ditolak'; alasan?: string | null; ip: string | null; durasiMs: number },
): Promise<void> {
  const { error } = await svc.from('hermes_api_log').insert({
    kunci_id: e.kunciId,
    prefix: e.prefix,
    alat: e.alat,
    status: e.status,
    alasan: e.alasan ? String(e.alasan).slice(0, 500) : null,
    ip: e.ip,
    durasi_ms: Math.round(e.durasiMs),
  })
  if (error) console.error('[hermes] gagal menulis log:', error.message)
}
```

- [ ] **Step 4: Implementasi konteks**

```ts
// apps/admin-dashboard/src/lib/hermes/server/konteks.ts
// Hanya untuk route /api/hermes/* SETELAH autentikasi kunci lolos.
import { laporanPosUntukScope, type CakupanLaporan } from '@/lib/posReport/laporan'
import { buatAmbilLaporan, ambilOutlets } from '@/lib/sukaBot/server/sumberData'
import { jakartaDate } from '@/lib/ownerDashboardCache'
import type { KonteksHermes } from '../registry'

export async function konteksHermes(svc: any, sekarang: Date): Promise<KonteksHermes> {
  // Cakupan 'all' = sama dengan role berakses penuh (owner/admin) di layar Rangkuman Penjualan,
  // jadi angka & cache-nya identik. Pembatasan per bot dilakukan lewat scope DOMAIN, bukan outlet.
  const cakupan: CakupanLaporan = { supabase: svc, scopeKey: 'all', allowedOutletIds: 'all' }
  const outlets = await ambilOutlets(svc)
  return {
    sekarang,
    penjualan: {
      outlets,
      hariIni: jakartaDate(sekarang),
      sekarang,
      ambilLaporan: buatAmbilLaporan((req) => laporanPosUntukScope(req, cakupan)),
    },
  }
}
```

- [ ] **Step 5: Implementasi route**

```ts
// apps/admin-dashboard/src/app/api/hermes/mcp/route.ts
// Server MCP baca-saja untuk Hermes Agent. Spec: docs/superpowers/specs/2026-10-07-hermes-api-design.md
// Gerbang SATU-SATUNYA = kunci (lib/hermes/server/autentikasi). Middleware sengaja dilewati.
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { autentikasi, catatLog } from '@/lib/hermes/server/autentikasi'
import { konteksHermes } from '@/lib/hermes/server/konteks'
import { bangunAlatMcp } from '@/lib/hermes/registry'
import { tanganiPesan } from '@/lib/hermes/mcp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const mulai = Date.now()
  let svc: any
  try {
    svc = createServiceClient()
  } catch {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  let auth
  try {
    auth = await autentikasi(req.headers, svc)
  } catch (e) {
    console.error('[hermes] autentikasi galat:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
  if (!auth.ok) {
    await catatLog(svc, { kunciId: auth.kunciId, prefix: auth.prefix, alat: null, status: 'ditolak', alasan: auth.alasan, ip: auth.ip, durasiMs: Date.now() - mulai })
    return NextResponse.json({ error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.status })
  }

  let pesan: unknown
  try {
    pesan = await req.json()
  } catch {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 })
  }

  const sekarang = new Date()
  const { jawaban, log } = await tanganiPesan(pesan, {
    scope: auth.scope,
    alat: bangunAlatMcp(() => konteksHermes(svc, sekarang)),
  })

  if (log) {
    await catatLog(svc, { kunciId: auth.kunciId, prefix: auth.prefix, alat: log.alat, status: log.status, alasan: log.alasan, ip: auth.ip, durasiMs: Date.now() - mulai })
  }
  const { error: errPakai } = await svc.from('hermes_api_key').update({ terakhir_dipakai_at: sekarang.toISOString() }).eq('id', auth.kunciId)
  if (errPakai) console.error('[hermes] gagal mencatat terakhir_dipakai_at:', errPakai.message)

  if (!jawaban) return new NextResponse(null, { status: 202 })
  return NextResponse.json(jawaban)
}

// Tanpa aliran SSE: GET/DELETE tidak didukung (spesifikasi MCP mengizinkan 405).
export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}
export function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}
```

- [ ] **Step 6: Bypass middleware**

Di `apps/admin-dashboard/src/middleware.ts`, tepat setelah baris `if (request.nextUrl.pathname.startsWith('/api/asisten/')) return NextResponse.next()`, tambahkan:

```ts
  // Hermes Agent (VPS): route memeriksa kunci API per bot sendiri (lib/hermes/server/autentikasi).
  // Tanpa bypass ini enforceAppAccess me-redirect panggilan tanpa cookie ke portal.
  if (request.nextUrl.pathname.startsWith('/api/hermes/')) return NextResponse.next()
```

- [ ] **Step 7: Jalankan test + type-check + build**

Run: `cd apps/admin-dashboard && yarn test src/lib/hermes && yarn type-check && yarn build`
Expected: PASS; tak ada error type baru di berkas yang disentuh; build menampilkan `ƒ /api/hermes/mcp`.

- [ ] **Step 8: Uji lokal tanpa kunci**

Dengan `yarn dev` berjalan (port admin-dashboard dari `package.json`):
```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:<port>/api/hermes/mcp -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"ping"}'
```
Expected: `401` (bukan redirect 307 — bukti bypass middleware bekerja; middleware juga melewati `localhost`, jadi ulangi uji ini di produksi pada Task 8).

- [ ] **Step 9: Commit**

```bash
git add apps/admin-dashboard/src/lib/hermes/server apps/admin-dashboard/src/app/api/hermes apps/admin-dashboard/src/middleware.ts
git commit -m "feat(hermes): endpoint /api/hermes/mcp dengan kunci, scope, allowlist IP & log

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Halaman admin "Kunci Hermes"

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/sistem/hermes/page.tsx`, `actions.ts`, `KunciHermesPanel.tsx`
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.ts` (grup "Sistem"), `apps/admin-dashboard/src/components/layout/navConfig.test.ts` (`BASELINE_ROUTES` ADMIN & OWNER)

**Interfaces:**
- Consumes: `requireRole` (`@/lib/authz`), `createServiceClient`, `buatKunciBaru`, `validasiInputKunci` (Task 3).
- Produces (server actions):
  - `buatKunciHermes(input: { nama: string; scope: string[]; ip: string[] }): Promise<{ ok: true; kunci: string } | { ok: false; pesan: string }>`
  - `cabutKunciHermes(id: string): Promise<{ ok: boolean; pesan?: string }>`
  - `ubahIpKunciHermes(id: string, ip: string[]): Promise<{ ok: boolean; pesan?: string }>`

- [ ] **Step 1: Server actions**

```ts
// apps/admin-dashboard/src/app/dashboard/sistem/hermes/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import { buatKunciBaru } from '@/lib/hermes/kunci'
import { validasiInputKunci } from '@/lib/hermes/validasi'

// Cek role DI DALAM action — guard halaman tidak melindungi server action (Session 2026-07-20).
const PERAN = ['owner', 'admin']
const JALUR = '/dashboard/sistem/hermes'
const UUID = /^[0-9a-f-]{36}$/i

export async function buatKunciHermes(input: { nama: string; scope: string[]; ip: string[] }) {
  const { userId } = await requireRole(PERAN)
  const v = validasiInputKunci(input)
  if (!v.ok) return { ok: false as const, pesan: v.pesan }
  const k = buatKunciBaru()
  const svc = createServiceClient()
  const { error } = await svc.from('hermes_api_key').insert({
    nama: v.nama, prefix: k.prefix, hash_kunci: k.hash, scope: v.scope, ip_diizinkan: v.ip, dibuat_oleh: userId,
  })
  if (error) return { ok: false as const, pesan: `Gagal menyimpan: ${error.message}` }
  revalidatePath(JALUR)
  return { ok: true as const, kunci: k.kunci }
}

export async function cabutKunciHermes(id: string) {
  await requireRole(PERAN)
  if (!UUID.test(id)) return { ok: false, pesan: 'ID tidak valid' }
  const svc = createServiceClient()
  const { error } = await svc.from('hermes_api_key').update({ aktif: false, dicabut_at: new Date().toISOString() }).eq('id', id)
  if (error) return { ok: false, pesan: error.message }
  revalidatePath(JALUR)
  return { ok: true }
}

export async function ubahIpKunciHermes(id: string, ip: string[]) {
  await requireRole(PERAN)
  if (!UUID.test(id)) return { ok: false, pesan: 'ID tidak valid' }
  // Validasi IP memakai validator yang sama (nama & scope pengisi yang pasti sah).
  const v = validasiInputKunci({ nama: 'abc', scope: ['penjualan'], ip })
  if (!v.ok) return { ok: false, pesan: v.pesan }
  const svc = createServiceClient()
  const { error } = await svc.from('hermes_api_key').update({ ip_diizinkan: v.ip }).eq('id', id)
  if (error) return { ok: false, pesan: error.message }
  revalidatePath(JALUR)
  return { ok: true }
}
```

- [ ] **Step 2: Halaman server**

```tsx
// apps/admin-dashboard/src/app/dashboard/sistem/hermes/page.tsx
import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import KunciHermesPanel from './KunciHermesPanel'

export const dynamic = 'force-dynamic'

export default async function HalamanKunciHermes() {
  await requireRole(['owner', 'admin'])
  const svc = createServiceClient()
  const [kunci, log] = await Promise.all([
    svc.from('hermes_api_key')
      .select('id, nama, prefix, scope, ip_diizinkan, aktif, dibuat_at, dicabut_at, terakhir_dipakai_at')
      .order('dibuat_at', { ascending: false }),
    svc.from('hermes_api_log')
      .select('id, prefix, alat, status, alasan, ip, durasi_ms, at')
      .order('at', { ascending: false })
      .limit(50),
  ])
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Kunci Hermes</h1>
        <p className="text-sm text-gray-600">
          Kunci API untuk bot Hermes (baca saja). Setiap kunci dibatasi domain dan IP. Kunci hanya ditampilkan sekali saat dibuat.
        </p>
      </header>
      {kunci.error || log.error ? (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Gagal memuat data: {kunci.error?.message ?? log.error?.message}
        </p>
      ) : (
        <KunciHermesPanel kunci={kunci.data ?? []} log={log.data ?? []} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Panel klien**

```tsx
// apps/admin-dashboard/src/app/dashboard/sistem/hermes/KunciHermesPanel.tsx
'use client'

import { useState, useTransition } from 'react'
import { buatKunciHermes, cabutKunciHermes, ubahIpKunciHermes } from './actions'

const DOMAIN = ['penjualan', 'gudang', 'absensi', 'finance'] as const

type Kunci = { id: string; nama: string; prefix: string; scope: string[]; ip_diizinkan: string[]; aktif: boolean; dibuat_at: string; dicabut_at: string | null; terakhir_dipakai_at: string | null }
type Log = { id: number; prefix: string | null; alat: string | null; status: string; alasan: string | null; ip: string | null; durasi_ms: number | null; at: string }

const waktu = (s: string | null) => (s ? new Date(s).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '—')
const pecahIp = (s: string) => s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean)

export default function KunciHermesPanel({ kunci, log }: { kunci: Kunci[]; log: Log[] }) {
  const [nama, setNama] = useState('')
  const [scope, setScope] = useState<string[]>(['penjualan'])
  const [ip, setIp] = useState('')
  const [kunciBaru, setKunciBaru] = useState<string | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)
  const [sibuk, mulai] = useTransition()

  const buat = () =>
    mulai(async () => {
      setPesan(null)
      const r = await buatKunciHermes({ nama, scope, ip: pecahIp(ip) })
      if (r.ok) { setKunciBaru(r.kunci); setNama(''); setIp('') } else setPesan(r.pesan)
    })

  const cabut = (k: Kunci) =>
    mulai(async () => {
      if (!confirm(`Cabut kunci "${k.nama}"? Bot yang memakainya langsung berhenti.`)) return
      const r = await cabutKunciHermes(k.id)
      if (!r.ok) setPesan(r.pesan ?? 'Gagal mencabut')
    })

  const ubahIp = (k: Kunci) =>
    mulai(async () => {
      const isian = prompt('IP diizinkan (pisahkan dengan koma). Kosong = tolak semua.', k.ip_diizinkan.join(', '))
      if (isian === null) return
      const r = await ubahIpKunciHermes(k.id, pecahIp(isian))
      if (!r.ok) setPesan(r.pesan ?? 'Gagal mengubah IP')
    })

  return (
    <div className="space-y-6">
      {kunciBaru && (
        <div className="rounded border border-amber-400 bg-amber-50 p-4">
          <p className="font-semibold">Salin kunci ini sekarang — tidak akan ditampilkan lagi.</p>
          <code className="mt-2 block break-all rounded bg-white p-2 text-sm">{kunciBaru}</code>
          <div className="mt-2 flex gap-2">
            <button className="rounded bg-gray-900 px-3 py-1 text-sm text-white" onClick={() => navigator.clipboard.writeText(kunciBaru)}>Salin</button>
            <button className="rounded border px-3 py-1 text-sm" onClick={() => setKunciBaru(null)}>Sudah disalin</button>
          </div>
        </div>
      )}
      {pesan && <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{pesan}</p>}

      <section className="space-y-3 rounded border p-4">
        <h2 className="font-semibold">Buat kunci</h2>
        <input className="w-full rounded border px-3 py-2" placeholder="Nama, mis. Bot CEO" value={nama} onChange={(e) => setNama(e.target.value)} />
        <div className="flex flex-wrap gap-3 text-sm">
          {DOMAIN.map((d) => (
            <label key={d} className="flex items-center gap-1">
              <input type="checkbox" checked={scope.includes(d)} onChange={(e) => setScope((s) => (e.target.checked ? [...s, d] : s.filter((x) => x !== d)))} />
              {d}
            </label>
          ))}
        </div>
        <input className="w-full rounded border px-3 py-2" placeholder="IP diizinkan, pisahkan koma (boleh kosong dulu)" value={ip} onChange={(e) => setIp(e.target.value)} />
        <p className="text-xs text-gray-500">IP kosong = semua panggilan ditolak. Lihat kolom IP pada log "ditolak" untuk tahu IP VPS yang sebenarnya.</p>
        <button disabled={sibuk} onClick={buat} className="rounded bg-orange-500 px-4 py-2 text-white disabled:opacity-50">Buat kunci</button>
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-3 font-semibold">Daftar kunci</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th>Nama</th><th>Prefix</th><th>Domain</th><th>IP</th><th>Terakhir dipakai</th><th>Status</th><th /></tr></thead>
            <tbody>
              {kunci.map((k) => (
                <tr key={k.id} className="border-t align-top">
                  <td className="py-2">{k.nama}</td>
                  <td><code>{k.prefix}</code></td>
                  <td>{k.scope.join(', ')}</td>
                  <td>{k.ip_diizinkan.length ? k.ip_diizinkan.join(', ') : <span className="text-red-600">(kosong)</span>}</td>
                  <td>{waktu(k.terakhir_dipakai_at)}</td>
                  <td>{k.aktif ? 'aktif' : `dicabut ${waktu(k.dicabut_at)}`}</td>
                  <td className="space-x-2 whitespace-nowrap">
                    {k.aktif && (
                      <>
                        <button disabled={sibuk} className="text-blue-600" onClick={() => ubahIp(k)}>IP</button>
                        <button disabled={sibuk} className="text-red-600" onClick={() => cabut(k)}>Cabut</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {kunci.length === 0 && <tr><td colSpan={7} className="py-3 text-gray-500">Belum ada kunci.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-3 font-semibold">50 panggilan terakhir</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th>Waktu</th><th>Prefix</th><th>Alat</th><th>Status</th><th>IP</th><th>Alasan</th><th>ms</th></tr></thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="py-1">{waktu(l.at)}</td>
                  <td><code>{l.prefix ?? '—'}</code></td>
                  <td>{l.alat ?? '—'}</td>
                  <td className={l.status === 'ok' ? 'text-green-700' : 'text-red-700'}>{l.status}</td>
                  <td>{l.ip ?? '—'}</td>
                  <td className="max-w-xs truncate" title={l.alasan ?? ''}>{l.alasan ?? ''}</td>
                  <td>{l.durasi_ms ?? '—'}</td>
                </tr>
              ))}
              {log.length === 0 && <tr><td colSpan={7} className="py-3 text-gray-500">Belum ada panggilan.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Nav (test gagal dulu)**

Di `navConfig.ts`, grup `title: 'Sistem'`, tambahkan item setelah "Kesehatan Sistem"; impor `KeyRound` dari `lucide-react` bila belum diimpor:
```ts
      { href: '/dashboard/sistem/hermes', label: 'Kunci Hermes', shortLabel: 'Hermes', icon: KeyRound, roles: ['ADMIN', 'OWNER'] },
```
Run: `cd apps/admin-dashboard && yarn test src/components/layout/navConfig.test.ts`
Expected: FAIL pada `ADMIN/OWNER: himpunan route tidak berubah dari baseline`.

- [ ] **Step 5: Perbarui `BASELINE_ROUTES`**

Tambahkan `'/dashboard/sistem/hermes'` ke daftar `ADMIN` dan `OWNER` di `BASELINE_ROUTES` (`navConfig.test.ts` ~baris 35). Jangan ubah role lain. Bila test "jumlah pintu" juga gagal, laporkan angkanya dan sesuaikan **hanya** bila penyebabnya item baru ini (pintu = grup; grup Sistem sudah ada, jadi seharusnya tidak berubah).
Run: `yarn test src/components/layout/navConfig.test.ts`
Expected: PASS (termasuk "setiap href punya page.tsx").

- [ ] **Step 6: Type-check + build**

Run: `cd apps/admin-dashboard && yarn type-check && yarn build`
Expected: tak ada error baru; build memuat `ƒ /dashboard/sistem/hermes`.

- [ ] **Step 7: Smoke lokal halaman**

`yarn dev`, login admin → Sistem → **Kunci Hermes**. Buat kunci "Uji Lokal", scope penjualan, IP `127.0.0.1`. Kunci tampil sekali. Muat ulang → kunci asli tak tampil, prefix tampil.

- [ ] **Step 8: Uji MCP ujung-ke-ujung lokal (gerbang 2)**

Dengan kunci dari Step 7 di variabel shell `K` (jangan dicommit):
```bash
U=http://localhost:<port>/api/hermes/mcp
H='-H content-type:application/json -H x-real-ip:127.0.0.1'
curl -s -X POST $U -H "authorization: Bearer $K" $H -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}'
curl -s -X POST $U -H "authorization: Bearer $K" $H -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
curl -s -X POST $U -H "authorization: Bearer $K" $H -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"penjualan_ringkasan","arguments":{"periode":"kemarin"}}}'
curl -s -o /dev/null -w '%{http_code}\n' -X POST $U -H "authorization: Bearer ${K}x" $H -d '{"jsonrpc":"2.0","id":4,"method":"ping"}'
```
Expected: (1) `protocolVersion` 2025-06-18; (2) 5 alat; (3) `isError:false` + omzet kemarin; (4) `401`.
Lalu ubah IP kunci ke `10.10.10.10` → (1) jadi `403` dan log menampilkan IP `127.0.0.1`. Lalu **Cabut** → `401`. Catat hasil di laporan task.

- [ ] **Step 9: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/sistem/hermes apps/admin-dashboard/src/components/layout/navConfig.ts apps/admin-dashboard/src/components/layout/navConfig.test.ts
git commit -m "feat(hermes): halaman admin Kunci Hermes (buat sekali tampil, IP, cabut, log)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Sambungkan Hermes (VPS) + gerbang domain penjualan

**Files:**
- Create: `docs/hermes/SOUL-ceo.md`, `supabase/verifikasi/hermes/gerbang-penjualan.md`
- Modify: `docs/RUNBOOK-HERMES-VPS.md` (bagian `## Berikutnya`)

Sebagian manual (VPS & Coolify). Langkah dokumen dikerjakan agen; langkah VPS dicentang dev.

- [ ] **Step 1: SOUL profil CEO**

```markdown
<!-- docs/hermes/SOUL-ceo.md — salin ke ~/.hermes/profiles/ceo/SOUL.md di VPS -->
Kamu adalah asisten CEO Suka Shawarma. Kamu hanya membaca data operasional lewat alat
MCP "suka" (penjualan; domain lain menyusul).

## Aturan angka (wajib)
- Setiap angka WAJIB berasal dari hasil alat di percakapan ini. Jangan pernah menebak,
  membulatkan dari ingatan, atau memakai angka dari percakapan lama.
- Bila alat gagal atau tidak ada alat untuk pertanyaan itu, katakan "data tidak tersedia"
  beserta alasannya.
- Sebutkan periode/tanggal dan cakupan outlet setiap kali menyebut angka.
- Omzet ditulis dalam rupiah, tanpa persentase.
- Untuk laporan pagi, kirim field `teks` dari alat `laporan_pagi_ceo` apa adanya; boleh
  menambah SATU kalimat komentar di bawahnya, tanpa angka baru.

## Keamanan (wajib)
- Jangan pernah meminta, menerima, atau menampilkan kunci, password, token, atau isi file
  konfigurasi. Jika pengguna menempelkannya, minta mereka menghapus pesan itu dan
  merotasi kuncinya.
- Jangan menyarankan perintah terminal atau server.
- Jangan membahas gaji, kasbon, NIK, nomor HP, atau data pribadi siapa pun.

## Gaya
Bahasa Indonesia, singkat, poin-poin, angka penting ditebalkan. Dibaca di HP lewat Telegram.
```

- [ ] **Step 2: Dokumen gerbang**

```markdown
<!-- supabase/verifikasi/hermes/gerbang-penjualan.md -->
# Gerbang domain penjualan (spec §9)

| # | Gerbang | Cara | Hasil | Tanggal / oleh |
|---|---|---|---|---|
| 1 | Cocok angka | 3 tanggal lampau berbeda (mis. Senin, Sabtu, tanggal 1). Panggil `penjualan_ringkasan {periode:"rentang",dari:T,sampai:T}` dan `penjualan_peringkat_outlet` yang sama. Bandingkan dengan /dashboard/reports/pos tanggal T, outlet = semua outlet internal + mitra aktif (BUKAN "Semua Cabang", yang ikut SS Online). Omzet kotor, transaksi, dan omzet 3 outlet acak harus SAMA PERSIS. | | |
| 2 | Uji kunci | Task 7 Step 8 diulang di produksi: kunci salah → 401; IP lain → 403; cabut → 401; kunci scope `gudang` tidak melihat alat penjualan di `tools/list`; POST tanpa kunci → 401 (bukan redirect). | | |
| 3 | Larangan data | `yarn test src/lib/hermes/registry.test.ts` (GERBANG §6) lulus. | | |
| 4 | Masa uji 1 minggu | Laporan pagi 07:00 dikirim ke grup Telegram uji (hanya dev) 7 hari berturut-turut; tiap hari dicocokkan dengan layar. Baru dipindah ke grup Owner. | | |
```

- [ ] **Step 3: Perbarui runbook**

Ganti bagian `## Berikutnya` di `docs/RUNBOOK-HERMES-VPS.md` dengan:

````markdown
## Sambungkan MCP Suka Shawarma (profil `ceo`)

Prasyarat: admin-dashboard dengan `/api/hermes/mcp` sudah ter-deploy.

1. Halaman admin **Sistem → Kunci Hermes** → buat kunci "Bot CEO", scope `penjualan`
   (domain lain dicentang saat tahapnya live), IP **kosong dulu**.
2. Di VPS (`su - suka-hermes`):
   ```bash
   hermes profile create ceo
   ceo setup model            # Custom endpoint http://127.0.0.1:20128/v1, mode 2
   echo 'SUKA_MCP_KEY=<kunci>' >> ~/.hermes/profiles/ceo/.env
   chmod 600 ~/.hermes/profiles/ceo/.env
   ```
   Tambahkan ke `~/.hermes/profiles/ceo/config.yaml`:
   ```yaml
   mcp_servers:
     suka:
       url: https://<domain-admin-dashboard>/api/hermes/mcp
       headers:
         Authorization: "Bearer ${SUKA_MCP_KEY}"
       enabled: true
   ```
3. Kunci toolset bawaan profil `ceo` untuk **cli dan telegram** (daftar langkah 4), lalu
   `ceo tools --summary` — alat `suka:*` harus terlihat & aktif; bila ikut mati,
   `ceo tools enable suka:penjualan_ringkasan ...` (format `server:tool`).
4. Salin `docs/hermes/SOUL-ceo.md` → `~/.hermes/profiles/ceo/SOUL.md`.
5. Panggilan pertama akan **403** (IP kosong). Buka log di halaman Kunci Hermes, lihat IP
   pada baris "ditolak", tambahkan IP itu ke kunci → ulangi. (Bila Coolify berjalan di VPS
   yang sama, IP-nya bisa IP publik VPS atau IP jaringan Docker — pakai yang tercatat.)
6. Uji: `ceo` → "omzet kemarin berapa?" → jawaban menyebut periode & sama dengan layar.
7. Jadwal: `ceo cron --help` → jadwalkan 07:00 WIB panggil `laporan_pagi_ceo` dan kirim
   `teks` ke grup Telegram **uji**. Cron Hermes kemungkinan UTC (07:00 WIB = 00:00 UTC) —
   cek dengan jadwal uji beberapa menit ke depan dulu.
8. Isi tabel `supabase/verifikasi/hermes/gerbang-penjualan.md`.
````

- [ ] **Step 4: Commit dokumen**

```bash
git add docs/hermes/SOUL-ceo.md supabase/verifikasi/hermes/gerbang-penjualan.md docs/RUNBOOK-HERMES-VPS.md
git commit -m "docs(hermes): SOUL CEO, gerbang penjualan, runbook sambung MCP

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5 (manual, dev): Deploy & sambung**

Merge + push (izin owner) → redeploy **admin-dashboard** di Coolify → jalankan runbook "Sambungkan MCP" langkah 1–7 → isi gerbang 1–3. Gerbang 4 berjalan seminggu sebelum laporan pagi pindah ke grup Owner.

---

## Self-review

- Spec K1 read-only → Task 6 route hanya membaca + log. K3 → Task 1/5 memakai `getPosReport` & fungsi SUKA Bot. K4 → Task 2/3/6/7. K5 domain/scope → Task 3/4. K9 MCP → Task 4/6. K12 template → Task 5. K14 gerbang → Task 5 (gerbang 3 otomatis) + Task 8.
- §5 tabel & halaman → Task 2/7. §6 larangan → Task 5 test. §7.1 alat penjualan + laporan pagi → Task 5 (butir 5 "baris domain lain" & SS Online sengaja ditunda, tertulis). §9 gerbang → Task 8. §10 kewajiban Hermes → Task 8.
- Sengaja di luar plan: domain gudang/absensi/finance, webapp `bot.sukashawarma.com`, API server Hermes, digest Telegram selain laporan pagi.
- Konsistensi nama: `laporanPosUntukScope`/`CakupanLaporan` (T1→T6), `buatAmbilLaporan` (T1→T6), `AlatMcp`/`HasilAlat`/`tanganiPesan` (T4→T5/T6), `KonteksHermes`/`bangunAlatMcp`/`ALAT_HERMES` (T5→T6), `autentikasi`/`catatLog` (T6), `validasiInputKunci`/`buatKunciBaru` (T3→T7).
