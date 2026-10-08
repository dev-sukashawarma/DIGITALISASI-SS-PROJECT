# Kantor Bot — Tahap A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Halaman `/kantor` di `apps/bot` yang menampilkan tiap bot Hermes aktif sebagai karakter pixel-art di kantor, dengan animasi mengikuti aktivitas `hermes_api_log` (polling 10 detik).

**Architecture:** Fungsi DB `status_kantor_bot()` (SECURITY DEFINER, owner/admin saja) meringkas kunci aktif + log terakhir → route `GET /api/kantor/status` menghitung `keadaan` dengan fungsi murni → komponen klien memuat engine Canvas hasil porting Pixel Agents (MIT) dan menerjemahkan keadaan menjadi perintah engine.

**Tech Stack:** Next.js 16 app router, React 19, TypeScript strict (`noUnusedLocals`), Vitest (env node), Supabase Postgres, Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-10-07-kantor-bot-tahap-a-design.md`

## Global Constraints

- Branch: `feat/kantor-bot`. Sebelum tiap commit: `git branch --show-current` harus `feat/kantor-bot` (otomasi repo pernah memindah branch di tengah sesi). Jangan push, jangan merge.
- Semua perintah dijalankan dari root monorepo `D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT` kecuali disebut lain. Jangan menjalankan `yarn install`/`yarn add` (lihat CLAUDE.md, lockfile drift). Tidak ada dependency baru.
- Test: `yarn workspace @suka/bot test` · Type-check: `yarn workspace @suka/bot type-check` · Build: `yarn workspace @suka/bot build`.
- Upstream Pixel Agents dipatok ke commit `3537e140c2094761beae748592aeb92ece8edfdd` (lisensi MIT, Copyright (c) 2026 Pablo De Lucca). Clone dangkal ada di scratchpad sesi; bila tak ada: `git clone --depth 1 https://github.com/pixel-agents-hq/pixel-agents.git <scratch>/pa` lalu `git -C <scratch>/pa log -1 --format=%H` harus sama dengan commit di atas (bila beda, `git -C <scratch>/pa fetch --depth 1 origin 3537e140c2094761beae748592aeb92ece8edfdd && git -C <scratch>/pa checkout FETCH_HEAD`).
- Respons galat route: `{ galat: string }` (pola route `apps/bot` yang sudah ada). Teks UI Bahasa Indonesia.
- Konstanta keadaan (spec §5.2): `JENDELA_BEKERJA_DTK = 60`, `JENDELA_GALAT_MNT = 10`, `JAM_BANGUN = 7`, `JAM_TIDUR = 23`, zona Asia/Jakarta (UTC+7, tanpa DST). Polling `POLL_MS = 10_000`.
- Akses: owner/admin/developer staf aktif (`is_owner_or_admin()` + `outlet_staff.status = 'active'`). Fungsi DB tidak pernah mengembalikan `prefix`, `hash_kunci`, `ip_diizinkan`, `ip`, `alasan`.
- Jangan mengubah tabel `hermes_api_key`/`hermes_api_log` (kolom, RLS, publikasi). Jangan mengubah perilaku chat/`ambilSesi()`.
- Migration: jangan pakai timestamp 2030; cek `ls supabase/migrations | cut -c1-14 | sort | uniq -d` (harus kosong) dan versi yang sudah terstempel hari itu sebelum memilih timestamp; verifikasi stempel dengan SELECT setelah apply.

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `supabase/migrations/<TS>_status_kantor_bot.sql` | Fungsi `status_kantor_bot()` + grant |
| `supabase/verifikasi/kantor_bot/t1.sql` | Uji akses & bentuk keluaran fungsi |
| `apps/bot/src/lib/server/sesi.ts` (ubah) | Ekstrak bacaan dasar; tambah `ambilSesiKantor()` |
| `apps/bot/src/lib/gerbang.ts` + test | Fungsi murni keputusan gerbang |
| `apps/bot/src/kantor/keadaan.ts` + test | Baris RPC → `Meja` + `keadaan` |
| `apps/bot/src/kantor/peta.ts` + test | Urutan/kapasitas/id karakter + rencana sinkron engine |
| `apps/bot/src/app/api/kantor/status/route.ts` + test | Endpoint polling |
| `apps/bot/src/kantor/engine/**` | Porting engine Pixel Agents (MIT) |
| `apps/bot/src/kantor/muatAset.ts` | Muat & decode PNG/JSON aset di browser |
| `apps/bot/src/kantor/engine.test.ts` | Uji asap engine di node (kursi, addAgent) |
| `apps/bot/public/kantor/assets/**` | Aset + indeks + `KREDIT.md` |
| `apps/bot/src/components/kantor/KantorApp.tsx` | Kanvas, polling, kartu nama, fallback |
| `apps/bot/src/app/kantor/page.tsx` | Gerbang server + render |
| `apps/bot/src/app/page.tsx`, `src/components/ChatApp.tsx` (ubah) | Tautan "Kantor" |

---

### Task 1: Fungsi DB `status_kantor_bot()` + uji SQL

**Files:**
- Create: `supabase/migrations/<TS>_status_kantor_bot.sql`
- Create: `supabase/verifikasi/kantor_bot/t1.sql`

**Interfaces:**
- Produces: RPC `status_kantor_bot()` → baris `{ id uuid, nama text, scope text[], dibuat_at timestamptz, terakhir_at timestamptz|null, status_terakhir text|null ('ok'|'galat'|'ditolak'), alat_terakhir text|null, panggilan_hari_ini int }`, urut `dibuat_at, id`. Non owner/admin → SQLSTATE `42501`.

- [ ] **Step 1: Pilih timestamp.** Jalankan:

```bash
ls supabase/migrations | cut -c1-14 | sort | uniq -d
```
Expected: kosong. Lalu via Supabase MCP `execute_sql`:
```sql
SELECT version FROM supabase_migrations.schema_migrations WHERE version LIKE '20261007%' ORDER BY version;
```
Pilih `<TS>` = `20261007` + jam berikutnya yang belum dipakai di keduanya (format `YYYYMMDDHHMMSS`).

- [ ] **Step 2: Tulis uji SQL yang gagal** `supabase/verifikasi/kantor_bot/t1.sql`:

```sql
-- Uji status_kantor_bot(). Jalankan seluruh berkas sekali; semua dalam transaksi + ROLLBACK.
-- LULUS = berakhir tanpa error dengan NOTICE 'T1 LULUS'.
BEGIN;
DO $$
DECLARE
  v_owner uuid;
  v_crew  uuid;
  v_n int;
  v_kolom text[];
  v_ditolak boolean := false;
BEGIN
  -- Ambil fixture SEBELUM berganti peran (RLS bisa menyembunyikan baris).
  SELECT id INTO v_owner FROM outlet_staff WHERE role IN ('owner','admin','developer') AND status = 'active' LIMIT 1;
  SELECT id INTO v_crew  FROM outlet_staff WHERE role = 'crew' AND status = 'active' LIMIT 1;
  IF v_owner IS NULL OR v_crew IS NULL THEN RAISE EXCEPTION 'fixture tidak ada'; END IF;

  -- (a) owner/admin bisa membaca; jumlah = kunci aktif
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM public.status_kantor_bot();
  RESET ROLE;
  IF v_n <> (SELECT count(*) FROM hermes_api_key WHERE aktif) THEN
    RAISE EXCEPTION '(a) jumlah baris % ≠ kunci aktif', v_n;
  END IF;

  -- (b) kolom keluaran persis, tanpa kolom sensitif
  SELECT array_agg(p ORDER BY o) INTO v_kolom
  FROM unnest((SELECT proargnames FROM pg_proc WHERE proname = 'status_kantor_bot'))
       WITH ORDINALITY AS t(p, o);
  IF v_kolom <> ARRAY['id','nama','scope','dibuat_at','terakhir_at','status_terakhir','alat_terakhir','panggilan_hari_ini'] THEN
    RAISE EXCEPTION '(b) kolom keluaran salah: %', v_kolom;
  END IF;

  -- (c) crew ditolak 42501
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM * FROM public.status_kantor_bot();
  EXCEPTION WHEN insufficient_privilege THEN v_ditolak := true;
  END;
  RESET ROLE;
  IF NOT v_ditolak THEN RAISE EXCEPTION '(c) crew tidak ditolak'; END IF;

  -- (d) anon & PUBLIC tanpa EXECUTE; authenticated punya
  IF has_function_privilege('anon', 'public.status_kantor_bot()', 'EXECUTE') THEN
    RAISE EXCEPTION '(d) anon punya EXECUTE';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.status_kantor_bot()', 'EXECUTE') THEN
    RAISE EXCEPTION '(d) authenticated tanpa EXECUTE';
  END IF;

  -- (e) SECURITY DEFINER + search_path terkunci
  IF NOT (SELECT prosecdef FROM pg_proc WHERE proname = 'status_kantor_bot') THEN
    RAISE EXCEPTION '(e) bukan SECURITY DEFINER';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'status_kantor_bot'
                 AND proconfig @> ARRAY['search_path=public']) THEN
    RAISE EXCEPTION '(e) search_path tidak terkunci';
  END IF;

  RAISE NOTICE 'T1 LULUS';
END $$;
ROLLBACK;
```

- [ ] **Step 3: Jalankan uji → harus GAGAL.** Via MCP `execute_sql` dengan isi berkas. Expected: error `function public.status_kantor_bot() does not exist`.

- [ ] **Step 4: Tulis migration** `supabase/migrations/<TS>_status_kantor_bot.sql`:

```sql
-- Kantor Bot tahap A (spec docs/superpowers/specs/2026-10-07-kantor-bot-tahap-a-design.md §4.2).
-- Ringkasan aktivitas tiap kunci Hermes aktif untuk papan /kantor di apps/bot.
-- hermes_api_log sengaja TANPA policy (hanya service role) — fungsi ini satu-satunya jalan baca
-- bagi pengguna, dan hanya untuk owner/admin. Tidak mengembalikan prefix/hash/IP/alasan.
CREATE OR REPLACE FUNCTION public.status_kantor_bot()
RETURNS TABLE (
  id uuid,
  nama text,
  scope text[],
  dibuat_at timestamptz,
  terakhir_at timestamptz,
  status_terakhir text,
  alat_terakhir text,
  panggilan_hari_ini integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_awal_hari timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta';
BEGIN
  IF NOT COALESCE(public.is_owner_or_admin(), false) THEN
    RAISE EXCEPTION 'status_kantor_bot: hanya owner/admin' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT k.id, k.nama, k.scope, k.dibuat_at,
         t.at, t.status, t.alat,
         (SELECT count(*)::integer FROM public.hermes_api_log h
           WHERE h.kunci_id = k.id AND h.at >= v_awal_hari)
  FROM public.hermes_api_key k
  LEFT JOIN LATERAL (
    SELECT l.at, l.status, l.alat
    FROM public.hermes_api_log l
    WHERE l.kunci_id = k.id AND l.at > now() - interval '24 hours'
    ORDER BY l.at DESC, l.id DESC
    LIMIT 1
  ) t ON true
  WHERE k.aktif
  ORDER BY k.dibuat_at, k.id;
END;
$$;

REVOKE ALL ON FUNCTION public.status_kantor_bot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.status_kantor_bot() TO authenticated;

COMMENT ON FUNCTION public.status_kantor_bot() IS
  'Kantor Bot (apps/bot /kantor): ringkasan kunci Hermes aktif + log terakhir. owner/admin saja.';
```

- [ ] **Step 5: Apply.** Via MCP `apply_migration` (name `status_kantor_bot`). Catatan: `apply_migration` menstempel versi = waktu apply, bukan nama berkas → setelah apply jalankan:

```sql
SELECT version, name FROM supabase_migrations.schema_migrations WHERE name = 'status_kantor_bot';
```
Lalu `git mv` berkas migration agar timestamp-nya sama persis dengan `version` yang tercatat (pola Session 2026-10-07 Hermes API).

- [ ] **Step 6: Verifikasi katalog.**

```sql
SELECT proname, prosecdef, proconfig FROM pg_proc WHERE proname = 'status_kantor_bot';
```
Expected: 1 baris, `prosecdef = true`, `proconfig = {search_path=public}`.

- [ ] **Step 7: Jalankan uji → LULUS.** `execute_sql` isi `t1.sql`. Expected: tanpa error (NOTICE `T1 LULUS`).

- [ ] **Step 8: Kontrol negatif.** Jalankan salinan sementara t1 (jangan di-commit) dengan baris `(c)` diubah menjadi pemanggilan sebagai `v_owner` (bukan `v_crew`). Expected: GAGAL dengan `(c) crew tidak ditolak` — membuktikan asersi bisa gagal.

- [ ] **Step 9: Commit**

```bash
git branch --show-current   # harus feat/kantor-bot
git add supabase/migrations/*_status_kantor_bot.sql supabase/verifikasi/kantor_bot/t1.sql
git commit -m "feat(bot): fungsi status_kantor_bot untuk papan Kantor Bot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Gerbang `ambilSesiKantor()`

**Files:**
- Create: `apps/bot/src/lib/gerbang.ts`, `apps/bot/src/lib/gerbang.test.ts`
- Modify: `apps/bot/src/lib/server/sesi.ts`

**Interfaces:**
- Produces: `ambilSesiKantor(): Promise<{ ok: true; sesi: SesiKantor } | { ok: false; status: 401 | 403 }>` dengan `SesiKantor = { supabase: any; userId: string; nama: string }`. `ambilSesi()` tetap sama signature & perilakunya.
- Produces: `putuskanGerbang(d: DasarGerbang, butuhProfil: boolean): GerbangHasil` (murni).

- [ ] **Step 1: Tulis test gagal** `apps/bot/src/lib/gerbang.test.ts`:

```ts
import { putuskanGerbang, type DasarGerbang } from '@/lib/gerbang'

const dasar = (ubah: Partial<DasarGerbang> = {}): DasarGerbang => ({
  userId: 'u1', boleh: true, galatRpc: false, status: 'active', role: 'owner', ...ubah,
})

describe('putuskanGerbang', () => {
  it('tanpa user → 401', () => {
    expect(putuskanGerbang(dasar({ userId: null }), false)).toEqual({ ok: false, status: 401 })
  })
  it('kantor: owner aktif lolos tanpa profil', () => {
    expect(putuskanGerbang(dasar(), false)).toEqual({ ok: true })
  })
  it('kantor: is_owner_or_admin false → 403', () => {
    expect(putuskanGerbang(dasar({ boleh: false }), false)).toEqual({ ok: false, status: 403 })
  })
  it('kantor: galat RPC → 403', () => {
    expect(putuskanGerbang(dasar({ galatRpc: true }), false)).toEqual({ ok: false, status: 403 })
  })
  it('kantor: staf nonaktif → 403', () => {
    expect(putuskanGerbang(dasar({ status: 'inactive' }), false)).toEqual({ ok: false, status: 403 })
  })
  it('chat: owner tanpa profil → 403', () => {
    expect(putuskanGerbang(dasar({ role: 'owner' }), true)).toEqual({ ok: false, status: 403 })
  })
  it('chat: developer berprofil lolos', () => {
    expect(putuskanGerbang(dasar({ role: 'developer' }), true)).toEqual({ ok: true })
  })
})
```

- [ ] **Step 2: Jalankan → gagal.** `yarn workspace @suka/bot test src/lib/gerbang.test.ts`. Expected: FAIL, modul `@/lib/gerbang` tidak ditemukan.

- [ ] **Step 3: Implementasi** `apps/bot/src/lib/gerbang.ts`:

```ts
// Keputusan gerbang murni (tanpa I/O) — dipakai ambilSesi (chat) & ambilSesiKantor (papan kantor).
import { profilUntukPeran } from '@/lib/peran'

export type DasarGerbang = {
  userId: string | null
  boleh: boolean
  galatRpc: boolean
  status: string | null
  role: string | null
}
export type GerbangHasil = { ok: true } | { ok: false; status: 401 | 403 }

export function putuskanGerbang(d: DasarGerbang, butuhProfil: boolean): GerbangHasil {
  if (!d.userId) return { ok: false, status: 401 }
  if (d.galatRpc || !d.boleh || d.status !== 'active') return { ok: false, status: 403 }
  if (butuhProfil && !profilUntukPeran(d.role)) return { ok: false, status: 403 }
  return { ok: true }
}
```

- [ ] **Step 4: Ubah** `apps/bot/src/lib/server/sesi.ts` menjadi:

```ts
// Gerbang tunggal app ini (spec W2): sesi SSO + is_owner_or_admin() + staf aktif (+ role terpetakan untuk chat).
// Dipakai di setiap route & halaman — app ini sengaja tanpa middleware (tak mengubah @suka/auth).
import { cookies } from 'next/headers'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'
import { profilUntukPeran, type Profil } from '@/lib/peran'
import { putuskanGerbang } from '@/lib/gerbang'

export type Sesi = { supabase: any; userId: string; nama: string; profil: Profil }
export type SesiKantor = { supabase: any; userId: string; nama: string }

async function bacaDasar() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({ getAll: () => cookieStore.getAll(), setAll: () => {} })
  const userId = await getVerifiedUserId(supabase)
  if (!userId) return { supabase, userId: null, boleh: false, galatRpc: false, staff: null }
  const [{ data: boleh, error }, { data: staff }] = await Promise.all([
    supabase.rpc('is_owner_or_admin'),
    supabase.from('outlet_staff').select('name, role, status').eq('id', userId).maybeSingle(),
  ])
  return { supabase, userId, boleh: boleh === true, galatRpc: !!error, staff }
}

export async function ambilSesi(): Promise<{ ok: true; sesi: Sesi } | { ok: false; status: 401 | 403 }> {
  const d = await bacaDasar()
  const g = putuskanGerbang(
    { userId: d.userId, boleh: d.boleh, galatRpc: d.galatRpc, status: d.staff?.status ?? null, role: d.staff?.role ?? null },
    true,
  )
  if (!g.ok) return g
  return {
    ok: true,
    sesi: { supabase: d.supabase, userId: d.userId!, nama: (d.staff?.name as string) || 'Bos', profil: profilUntukPeran(d.staff?.role)! },
  }
}

export async function ambilSesiKantor(): Promise<{ ok: true; sesi: SesiKantor } | { ok: false; status: 401 | 403 }> {
  const d = await bacaDasar()
  const g = putuskanGerbang(
    { userId: d.userId, boleh: d.boleh, galatRpc: d.galatRpc, status: d.staff?.status ?? null, role: d.staff?.role ?? null },
    false,
  )
  if (!g.ok) return g
  return { ok: true, sesi: { supabase: d.supabase, userId: d.userId!, nama: (d.staff?.name as string) || 'Bos' } }
}
```

- [ ] **Step 5: Jalankan test & type-check.** `yarn workspace @suka/bot test` lalu `yarn workspace @suka/bot type-check`. Expected: semua PASS, 0 error (test lama ikut lulus — perilaku chat tidak berubah).

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git add apps/bot/src/lib/gerbang.ts apps/bot/src/lib/gerbang.test.ts apps/bot/src/lib/server/sesi.ts
git commit -m "feat(bot): gerbang ambilSesiKantor untuk owner/admin tanpa syarat profil

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Aturan keadaan (`keadaan.ts`)

**Files:**
- Create: `apps/bot/src/kantor/keadaan.ts`, `apps/bot/src/kantor/keadaan.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Keadaan = 'bekerja' | 'siaga' | 'galat' | 'tidur'
  export type BarisStatus = { id: string; nama: string; scope: string[]; dibuat_at: string; terakhir_at: string | null; status_terakhir: string | null; alat_terakhir: string | null; panggilan_hari_ini: number }
  export type Meja = { id: string; nama: string; scope: string[]; keadaan: Keadaan; alatTerakhir: string | null; terakhirAt: string | null }
  export function tentukanKeadaan(b: BarisStatus, sekarang: Date): Keadaan
  export function keMeja(b: BarisStatus, sekarang: Date): Meja
  ```

- [ ] **Step 1: Tulis test gagal** `apps/bot/src/kantor/keadaan.test.ts`:

```ts
import { tentukanKeadaan, keMeja, type BarisStatus } from '@/kantor/keadaan'

// 2026-10-07 10:00 WIB = 03:00Z
const SIANG = new Date('2026-10-07T03:00:00Z')
const baris = (ubah: Partial<BarisStatus> = {}): BarisStatus => ({
  id: 'k1', nama: 'Bot HRD', scope: ['absensi'], dibuat_at: '2026-10-01T00:00:00Z',
  terakhir_at: null, status_terakhir: null, alat_terakhir: null, panggilan_hari_ini: 0, ...ubah,
})
const mundur = (d: Date, dtk: number) => new Date(d.getTime() - dtk * 1000).toISOString()

describe('tentukanKeadaan', () => {
  it('tanpa log hari ini → tidur', () => {
    expect(tentukanKeadaan(baris(), SIANG)).toBe('tidur')
  })
  it('ok tepat 60 dtk lalu → bekerja', () => {
    expect(tentukanKeadaan(baris({ terakhir_at: mundur(SIANG, 60), status_terakhir: 'ok', panggilan_hari_ini: 1 }), SIANG)).toBe('bekerja')
  })
  it('ok 61 dtk lalu, ada panggilan hari ini → siaga', () => {
    expect(tentukanKeadaan(baris({ terakhir_at: mundur(SIANG, 61), status_terakhir: 'ok', panggilan_hari_ini: 3 }), SIANG)).toBe('siaga')
  })
  it('galat tepat 10 mnt lalu → galat', () => {
    expect(tentukanKeadaan(baris({ terakhir_at: mundur(SIANG, 600), status_terakhir: 'galat', panggilan_hari_ini: 1 }), SIANG)).toBe('galat')
  })
  it('ditolak 10 mnt + 1 dtk lalu → jatuh ke siaga', () => {
    expect(tentukanKeadaan(baris({ terakhir_at: mundur(SIANG, 601), status_terakhir: 'ditolak', panggilan_hari_ini: 1 }), SIANG)).toBe('siaga')
  })
  it('galat baru menang atas aturan lain, juga di malam hari', () => {
    const malam = new Date('2026-10-07T16:30:00Z') // 23:30 WIB
    expect(tentukanKeadaan(baris({ terakhir_at: mundur(malam, 5), status_terakhir: 'ditolak', panggilan_hari_ini: 1 }), malam)).toBe('galat')
  })
  it('bekerja di 23:30 WIB tetap bekerja', () => {
    const malam = new Date('2026-10-07T16:30:00Z')
    expect(tentukanKeadaan(baris({ terakhir_at: mundur(malam, 10), status_terakhir: 'ok', panggilan_hari_ini: 1 }), malam)).toBe('bekerja')
  })
  it('jam tidur: 06:59 WIB tidur, 07:00 WIB siaga', () => {
    const b = baris({ terakhir_at: '2026-10-06T10:00:00Z', status_terakhir: 'ok', panggilan_hari_ini: 2 })
    expect(tentukanKeadaan(b, new Date('2026-10-06T23:59:00Z'))).toBe('tidur') // 06:59 WIB
    expect(tentukanKeadaan(b, new Date('2026-10-07T00:00:00Z'))).toBe('siaga') // 07:00 WIB
  })
  it('jam tidur: 22:59 WIB siaga, 23:00 WIB tidur', () => {
    const b = baris({ terakhir_at: '2026-10-07T05:00:00Z', status_terakhir: 'ok', panggilan_hari_ini: 2 })
    expect(tentukanKeadaan(b, new Date('2026-10-07T15:59:00Z'))).toBe('siaga')
    expect(tentukanKeadaan(b, new Date('2026-10-07T16:00:00Z'))).toBe('tidur')
  })
})

describe('keMeja', () => {
  it('memetakan kolom & menghitung keadaan', () => {
    const b = baris({ terakhir_at: mundur(SIANG, 5), status_terakhir: 'ok', alat_terakhir: 'rekap_absensi', panggilan_hari_ini: 1 })
    expect(keMeja(b, SIANG)).toEqual({
      id: 'k1', nama: 'Bot HRD', scope: ['absensi'], keadaan: 'bekerja',
      alatTerakhir: 'rekap_absensi', terakhirAt: b.terakhir_at,
    })
  })
})
```

- [ ] **Step 2: Jalankan → gagal.** `yarn workspace @suka/bot test src/kantor/keadaan.test.ts`. Expected: FAIL (modul tidak ada).

- [ ] **Step 3: Implementasi** `apps/bot/src/kantor/keadaan.ts`:

```ts
// Aturan keadaan meja Kantor Bot (spec §5.2). Murni — dipanggil di server dengan jam server.
export type Keadaan = 'bekerja' | 'siaga' | 'galat' | 'tidur'

export type BarisStatus = {
  id: string
  nama: string
  scope: string[]
  dibuat_at: string
  terakhir_at: string | null
  status_terakhir: string | null
  alat_terakhir: string | null
  panggilan_hari_ini: number
}

export type Meja = {
  id: string
  nama: string
  scope: string[]
  keadaan: Keadaan
  alatTerakhir: string | null
  terakhirAt: string | null
}

export const JENDELA_BEKERJA_DTK = 60
export const JENDELA_GALAT_MNT = 10
export const JAM_BANGUN = 7
export const JAM_TIDUR = 23
const WIB_JAM = 7 // Asia/Jakarta = UTC+7, tanpa DST

function jamWib(d: Date): number {
  return (d.getUTCHours() + WIB_JAM) % 24
}

export function tentukanKeadaan(b: BarisStatus, sekarang: Date): Keadaan {
  const umurDtk = b.terakhir_at ? (sekarang.getTime() - new Date(b.terakhir_at).getTime()) / 1000 : Infinity
  if ((b.status_terakhir === 'galat' || b.status_terakhir === 'ditolak') && umurDtk <= JENDELA_GALAT_MNT * 60) return 'galat'
  if (b.status_terakhir === 'ok' && umurDtk <= JENDELA_BEKERJA_DTK) return 'bekerja'
  const jam = jamWib(sekarang)
  if (jam < JAM_BANGUN || jam >= JAM_TIDUR) return 'tidur'
  if (b.panggilan_hari_ini > 0) return 'siaga'
  return 'tidur'
}

export function keMeja(b: BarisStatus, sekarang: Date): Meja {
  return {
    id: b.id,
    nama: b.nama,
    scope: b.scope,
    keadaan: tentukanKeadaan(b, sekarang),
    alatTerakhir: b.alat_terakhir,
    terakhirAt: b.terakhir_at,
  }
}
```

- [ ] **Step 4: Jalankan → lulus.** `yarn workspace @suka/bot test src/kantor/keadaan.test.ts`. Expected: PASS semua.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add apps/bot/src/kantor/keadaan.ts apps/bot/src/kantor/keadaan.test.ts
git commit -m "feat(bot): aturan keadaan meja Kantor Bot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Penempatan & rencana sinkron (`peta.ts`)

**Files:**
- Create: `apps/bot/src/kantor/peta.ts`, `apps/bot/src/kantor/peta.test.ts`

**Interfaces:**
- Consumes: `Meja`, `Keadaan` dari `@/kantor/keadaan`.
- Produces:
  ```ts
  export type Penempatan = { agentId: number; palet: number; meja: Meja }
  export function idKarakter(idKunci: string): number            // stabil, 1..2^31-1
  export function tempatkan(meja: Meja[], kapasitas: number, jumlahPalet: number): { diKantor: Penempatan[]; diLuar: Meja[] }
  export function rencanaSinkron(adaSekarang: number[], target: Penempatan[]): { tambah: Penempatan[]; hapus: number[] }
  ```

- [ ] **Step 1: Tulis test gagal** `apps/bot/src/kantor/peta.test.ts`:

```ts
import { idKarakter, tempatkan, rencanaSinkron } from '@/kantor/peta'
import type { Meja } from '@/kantor/keadaan'

const meja = (id: string): Meja => ({ id, nama: id, scope: [], keadaan: 'siaga', alatTerakhir: null, terakhirAt: null })

describe('idKarakter', () => {
  it('stabil & positif', () => {
    expect(idKarakter('667ce866-aaaa')).toBe(idKarakter('667ce866-aaaa'))
    expect(idKarakter('a')).toBeGreaterThan(0)
  })
  it('beda kunci → beda id', () => {
    expect(idKarakter('kunci-1')).not.toBe(idKarakter('kunci-2'))
  })
})

describe('tempatkan', () => {
  it('mempertahankan urutan input & memotong di kapasitas', () => {
    const r = tempatkan([meja('a'), meja('b'), meja('c')], 2, 6)
    expect(r.diKantor.map((p) => p.meja.id)).toEqual(['a', 'b'])
    expect(r.diLuar.map((m) => m.id)).toEqual(['c'])
  })
  it('palet = idKarakter mod jumlahPalet', () => {
    const r = tempatkan([meja('a')], 6, 6)
    expect(r.diKantor[0].palet).toBe(idKarakter('a') % 6)
    expect(r.diKantor[0].agentId).toBe(idKarakter('a'))
  })
  it('nol kunci → kosong', () => {
    expect(tempatkan([], 6, 6)).toEqual({ diKantor: [], diLuar: [] })
  })
  it('jumlahPalet 0 → palet 0', () => {
    expect(tempatkan([meja('a')], 6, 0).diKantor[0].palet).toBe(0)
  })
})

describe('rencanaSinkron', () => {
  it('tambah yang baru, hapus yang hilang, biarkan yang tetap', () => {
    const t = tempatkan([meja('a'), meja('b')], 6, 6).diKantor
    const r = rencanaSinkron([idKarakter('a'), idKarakter('x')], t)
    expect(r.tambah.map((p) => p.meja.id)).toEqual(['b'])
    expect(r.hapus).toEqual([idKarakter('x')])
  })
})
```

- [ ] **Step 2: Jalankan → gagal.** `yarn workspace @suka/bot test src/kantor/peta.test.ts`. Expected: FAIL (modul tidak ada).

- [ ] **Step 3: Implementasi** `apps/bot/src/kantor/peta.ts`:

```ts
// Penempatan bot ke kursi kantor + selisih terhadap karakter yang sudah ada di engine (spec §5.4).
import type { Meja } from '@/kantor/keadaan'

export type Penempatan = { agentId: number; palet: number; meja: Meja }

// FNV-1a 32-bit, dipangkas ke 31 bit positif (engine memakai number sebagai id karakter).
export function idKarakter(idKunci: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < idKunci.length; i++) {
    h ^= idKunci.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 1) || 1
}

// Urutan input = urutan RPC (dibuat_at, id) → urutan masuk kantor stabil.
export function tempatkan(meja: Meja[], kapasitas: number, jumlahPalet: number) {
  const diKantor: Penempatan[] = meja.slice(0, Math.max(0, kapasitas)).map((m) => {
    const agentId = idKarakter(m.id)
    return { agentId, palet: jumlahPalet > 0 ? agentId % jumlahPalet : 0, meja: m }
  })
  return { diKantor, diLuar: meja.slice(Math.max(0, kapasitas)) }
}

export function rencanaSinkron(adaSekarang: number[], target: Penempatan[]) {
  const ada = new Set(adaSekarang)
  const ingin = new Set(target.map((p) => p.agentId))
  return {
    tambah: target.filter((p) => !ada.has(p.agentId)),
    hapus: adaSekarang.filter((id) => !ingin.has(id)),
  }
}
```

- [ ] **Step 4: Jalankan → lulus.** `yarn workspace @suka/bot test src/kantor/peta.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add apps/bot/src/kantor/peta.ts apps/bot/src/kantor/peta.test.ts
git commit -m "feat(bot): penempatan meja & rencana sinkron Kantor Bot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Route `GET /api/kantor/status`

**Files:**
- Create: `apps/bot/src/app/api/kantor/status/route.ts`, `apps/bot/src/app/api/kantor/status/route.test.ts`

**Interfaces:**
- Consumes: `ambilSesiKantor` (Task 2), `keMeja`, `BarisStatus`, `Meja` (Task 3), RPC `status_kantor_bot` (Task 1).
- Produces: `GET` → 200 `{ diambilAt: string; meja: Meja[] }` · 401/403 `{ galat: 'Tidak punya akses.' }` · 502 `{ galat: 'Gagal memuat status bot.' }`; header `Cache-Control: no-store`.

- [ ] **Step 1: Tulis test gagal** `apps/bot/src/app/api/kantor/status/route.test.ts`:

```ts
import { vi } from 'vitest'

const ambil = vi.fn()
vi.mock('@/lib/server/sesi', () => ({ ambilSesiKantor: () => ambil() }))

import { GET } from './route'

const sesiDengan = (rpc: () => Promise<unknown>) => ({ ok: true, sesi: { supabase: { rpc }, userId: 'u', nama: 'Bos' } })

describe('GET /api/kantor/status', () => {
  beforeEach(() => ambil.mockReset())

  it('401 diteruskan', async () => {
    ambil.mockResolvedValue({ ok: false, status: 401 })
    const r = await GET()
    expect(r.status).toBe(401)
    expect(await r.json()).toEqual({ galat: 'Tidak punya akses.' })
  })
  it('42501 dari RPC → 403', async () => {
    ambil.mockResolvedValue(sesiDengan(async () => ({ data: null, error: { code: '42501' } })))
    expect((await GET()).status).toBe(403)
  })
  it('galat lain → 502', async () => {
    ambil.mockResolvedValue(sesiDengan(async () => ({ data: null, error: { code: 'XX000' } })))
    const r = await GET()
    expect(r.status).toBe(502)
    expect(await r.json()).toEqual({ galat: 'Gagal memuat status bot.' })
  })
  it('200 dengan meja ber-keadaan & no-store', async () => {
    const baris = { id: 'k1', nama: 'Bot HRD', scope: ['absensi'], dibuat_at: '2026-10-01T00:00:00Z',
      terakhir_at: new Date().toISOString(), status_terakhir: 'ok', alat_terakhir: 'rekap', panggilan_hari_ini: 1 }
    ambil.mockResolvedValue(sesiDengan(async () => ({ data: [baris], error: null })))
    const r = await GET()
    expect(r.status).toBe(200)
    expect(r.headers.get('cache-control')).toBe('no-store')
    const j = await r.json()
    expect(j.meja).toEqual([{ id: 'k1', nama: 'Bot HRD', scope: ['absensi'], keadaan: 'bekerja', alatTerakhir: 'rekap', terakhirAt: baris.terakhir_at }])
    expect(typeof j.diambilAt).toBe('string')
  })
})
```

- [ ] **Step 2: Jalankan → gagal.** `yarn workspace @suka/bot test src/app/api/kantor`. Expected: FAIL (`./route` tidak ada).

- [ ] **Step 3: Implementasi** `apps/bot/src/app/api/kantor/status/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { ambilSesiKantor } from '@/lib/server/sesi'
import { keMeja, type BarisStatus } from '@/kantor/keadaan'

export const dynamic = 'force-dynamic'

const TANPA_CACHE = { 'Cache-Control': 'no-store' }

export async function GET() {
  const g = await ambilSesiKantor()
  if (!g.ok) return NextResponse.json({ galat: 'Tidak punya akses.' }, { status: g.status, headers: TANPA_CACHE })
  const { data, error } = await g.sesi.supabase.rpc('status_kantor_bot')
  if (error) {
    const status = error.code === '42501' ? 403 : 502
    const galat = status === 403 ? 'Tidak punya akses.' : 'Gagal memuat status bot.'
    return NextResponse.json({ galat }, { status, headers: TANPA_CACHE })
  }
  const sekarang = new Date()
  const meja = ((data ?? []) as BarisStatus[]).map((b) => keMeja(b, sekarang))
  return NextResponse.json({ diambilAt: sekarang.toISOString(), meja }, { headers: TANPA_CACHE })
}
```

- [ ] **Step 4: Jalankan → lulus.** `yarn workspace @suka/bot test` lalu `yarn workspace @suka/bot type-check`. Expected: PASS, 0 error.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add apps/bot/src/app/api/kantor
git commit -m "feat(bot): route /api/kantor/status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Porting engine Pixel Agents + aset

**Files:**
- Create: `apps/bot/src/kantor/engine/**` (salinan, lihat Step 1)
- Create: `apps/bot/src/kantor/muatAset.ts`
- Create: `apps/bot/src/kantor/engine.test.ts`
- Create: `apps/bot/public/kantor/assets/**`, `apps/bot/public/kantor/assets/KREDIT.md`
- Create: `apps/bot/scripts/kantor/bangun-indeks-aset.md` (catatan cara membangkitkan ulang indeks)

**Interfaces:**
- Produces (dipakai Task 7), semua dari `@/kantor/engine/...`:
  - `OfficeState` (`office/engine/officeState`): `new OfficeState(layout)`, `.addAgent(id, palette?, hueShift?, seatId?, skipSpawnEffect?)`, `.removeAgent(id)`, `.setAgentActive(id, bool)`, `.setAgentTool(id, string|null)`, `.showPermissionBubble(id)`, `.clearPermissionBubble(id)`, `.update(dt)`, `.getCharacters()`, `.getCharacterAt(wx, wy)`, `.getLayout()`, field `.characters`, `.seats`, `.tileMap`, `.furniture`, `.pets`, `.selectedAgentId`, `.hoveredAgentId`, `.hoveredTile`.
  - `renderFrame` (`office/engine/renderer`), `startGameLoop` (`office/engine/gameLoop`), `TILE_SIZE` (`office/types`), `migrateLayoutColors` (`office/layout/layoutSerializer`), `buildDynamicCatalog` (`office/layout/furnitureCatalog`), `setCharacterTemplates`/`getLoadedCharacterCount` (`office/sprites/spriteData`), `setFloorSprites` (`office/floorTiles`), `setWallSprites` (`office/wallTiles`).
  - `muatAset(base: string): Promise<AsetKantor>` dari `@/kantor/muatAset`, dengan `AsetKantor = { layout: unknown; jumlahKarakter: number }` — memanggil semua setter engine di atas sebelum resolve.

`<PA>` = folder clone upstream di scratchpad (lihat Global Constraints).

- [ ] **Step 1: Salin berkas engine** (mempertahankan struktur relatif agar impor `../../constants` dll. tetap valid):

```bash
E=apps/bot/src/kantor/engine
mkdir -p $E/office/engine $E/office/sprites $E/office/layout $E/core/assets $E/components/ui
cp <PA>/webview-ui/src/constants.ts $E/constants.ts
cp <PA>/webview-ui/src/components/ui/types.ts $E/components/ui/types.ts
cp <PA>/core/src/paletteUtils.ts $E/core/paletteUtils.ts
cp <PA>/core/src/assets/colorUtils.ts <PA>/core/src/assets/constants.ts <PA>/core/src/assets/types.ts $E/core/assets/
for f in colorize floorTiles projection toolUtils types wallTiles; do cp <PA>/webview-ui/src/office/$f.ts $E/office/; done
for f in <PA>/webview-ui/src/office/engine/*.ts; do case "$f" in *.test.ts) ;; *) cp "$f" $E/office/engine/;; esac; done
for f in <PA>/webview-ui/src/office/sprites/*; do case "$f" in *.test.ts) ;; *) cp "$f" $E/office/sprites/;; esac; done
for f in furnitureCatalog layoutSerializer tileMap; do cp <PA>/webview-ui/src/office/layout/$f.ts $E/office/layout/; done
```

- [ ] **Step 2: Perbaiki impor.**
  - Hapus akhiran `.js` di impor relatif: `find $E -name '*.ts' -exec sed -i "s#\(from '\.[^']*\)\.js'#\1'#" {} +`
  - `office/engine/officeState.ts`: ganti `'../../../../core/src/paletteUtils'` → `'../../core/paletteUtils'`.
  - Hapus `office/engine/index.ts` & `office/sprites/index.ts` & bila mengekspor dari berkas yang tak disalin (cek dengan type-check).
  - Bila `core/paletteUtils.ts` mengimpor modul lain dari `core/src`, salin modul itu ke `$E/core/` dengan nama sama.
  - Tambahkan baris pertama di **setiap** berkas `.ts` hasil salinan:
    ```ts
    // Diporting dari pixel-agents-hq/pixel-agents @3537e140 (MIT, (c) 2026 Pablo De Lucca). Lihat public/kantor/assets/KREDIT.md.
    ```

- [ ] **Step 3: Type-check & bereskan.** `yarn workspace @suka/bot type-check`. Perbaiki hanya yang perlu agar lolos (impor hilang → salin berkasnya dari upstream dengan struktur sama; `noUnusedLocals` → hapus simbol tak terpakai). **Jangan** mengubah logika engine. Bila sebuah berkas menarik modul editor/VS Code/transport, putuskan impor itu (hapus fungsi yang memakainya hanya bila fungsi itu tak dipanggil oleh daftar Interfaces di atas). Expected akhir: 0 error.

- [ ] **Step 4: Salin aset & bangkitkan indeks.**

```bash
A=apps/bot/public/kantor/assets
mkdir -p $A
cp -r <PA>/webview-ui/public/assets/characters <PA>/webview-ui/public/assets/floors <PA>/webview-ui/public/assets/walls <PA>/webview-ui/public/assets/furniture $A/
cp <PA>/webview-ui/public/assets/default-layout-1.json $A/
```
Bangkitkan `asset-index.json` & `furniture-catalog.json` memakai kode upstream (Node 22 strip-types):
```bash
S=<scratch>/bangun && mkdir -p $S
cp <PA>/core/src/assets/build.ts <PA>/core/src/assets/manifestUtils.ts <PA>/core/src/assets/types.ts $S/
sed -i "s#\(from '\./[^']*\)\.js'#\1.ts'#" $S/*.ts
cat > $S/jalan.ts <<'EOF'
import { writeFileSync } from 'node:fs'
import { buildAssetIndex, buildFurnitureCatalog } from './build.ts'
const dir = process.argv[2]
writeFileSync(`${dir}/asset-index.json`, JSON.stringify(buildAssetIndex(dir), null, 2) + '\n')
writeFileSync(`${dir}/furniture-catalog.json`, JSON.stringify(buildFurnitureCatalog(dir), null, 2) + '\n')
EOF
node --experimental-strip-types $S/jalan.ts "$(pwd)/$A"
```
Expected: `asset-index.json` berisi `characters` 6 berkas, `floors`, `walls`, `defaultLayout: "default-layout-1.json"`; `furniture-catalog.json` berupa array tak kosong. Tulis langkah ini ke `apps/bot/scripts/kantor/bangun-indeks-aset.md`.

- [ ] **Step 5: Tulis** `apps/bot/public/kantor/assets/KREDIT.md`:

```md
# Kredit aset Kantor Bot

- **Karakter** (`characters/`): berbasis *MetroCity Free Topdown Character Pack* oleh JIK-A-4
  (https://jik-a-4.itch.io/metrocity-free-topdown-character-pack), lisensi CC0 1.0, disesuaikan
  oleh proyek Pixel Agents.
- **Lantai, dinding, furnitur, layout bawaan** (`floors/`, `walls/`, `furniture/`,
  `default-layout-1.json`) dan **kode engine** (`apps/bot/src/kantor/engine/`): dari
  https://github.com/pixel-agents-hq/pixel-agents commit 3537e140c2094761beae748592aeb92ece8edfdd.

## Lisensi MIT (Pixel Agents)

<salin isi lengkap <PA>/LICENSE di sini, apa adanya>
```
Ganti baris `<salin ...>` dengan isi berkas `<PA>/LICENSE` (salin persis, bukan diketik ulang).

- [ ] **Step 6: Tulis** `apps/bot/src/kantor/muatAset.ts` (diadaptasi dari `<PA>/webview-ui/src/browserMock.ts`, MIT):

```ts
// Diadaptasi dari pixel-agents-hq/pixel-agents @3537e140 webview-ui/src/browserMock.ts (MIT).
// Memuat PNG aset di browser, decode ke matriks warna hex, lalu menyuntik ke engine.
import { rgbaToHex } from '@/kantor/engine/core/assets/colorUtils'
import {
  CHAR_FRAME_H, CHAR_FRAME_W, CHAR_FRAMES_PER_ROW, CHARACTER_DIRECTIONS, FLOOR_TILE_SIZE,
  WALL_BITMASK_COUNT, WALL_GRID_COLS, WALL_PIECE_HEIGHT, WALL_PIECE_WIDTH,
} from '@/kantor/engine/core/assets/constants'
import type { AssetIndex, CatalogEntry, CharacterDirectionSprites } from '@/kantor/engine/core/assets/types'
import { setCharacterTemplates } from '@/kantor/engine/office/sprites/spriteData'
import { setFloorSprites } from '@/kantor/engine/office/floorTiles'
import { setWallSprites } from '@/kantor/engine/office/wallTiles'
import { buildDynamicCatalog } from '@/kantor/engine/office/layout/furnitureCatalog'

type Png = { width: number; height: number; data: Uint8ClampedArray }
export type AsetKantor = { layout: unknown; jumlahKarakter: number }

async function decodePng(url: string): Promise<Png> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Gagal memuat ${url} (${res.status})`)
  const bitmap = await createImageBitmap(await res.blob())
  const c = document.createElement('canvas')
  c.width = bitmap.width
  c.height = bitmap.height
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D tidak tersedia')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const img = ctx.getImageData(0, 0, c.width, c.height)
  return { width: c.width, height: c.height, data: img.data }
}

function potong(png: Png, w: number, h: number, ox = 0, oy = 0): string[][] {
  const out: string[][] = []
  for (let y = 0; y < h; y++) {
    const row: string[] = []
    for (let x = 0; x < w; x++) {
      const i = ((oy + y) * png.width + (ox + x)) * 4
      row.push(rgbaToHex(png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]))
    }
    out.push(row)
  }
  return out
}

const jalur = (kind: string, rel: string) => (rel.startsWith(`${kind}/`) ? rel : `${kind}/${rel}`)

export async function muatAset(base: string): Promise<AsetKantor> {
  const [indeks, katalog] = await Promise.all([
    fetch(`${base}asset-index.json`).then((r) => r.json()) as Promise<AssetIndex>,
    fetch(`${base}furniture-catalog.json`).then((r) => r.json()) as Promise<CatalogEntry[]>,
  ])

  const karakter = await Promise.all(indeks.characters.map(async (rel) => {
    const png = await decodePng(`${base}${jalur('characters', rel)}`)
    const s: CharacterDirectionSprites = { down: [], up: [], right: [] }
    CHARACTER_DIRECTIONS.forEach((dir, di) => {
      s[dir] = Array.from({ length: CHAR_FRAMES_PER_ROW }, (_, f) =>
        potong(png, CHAR_FRAME_W, CHAR_FRAME_H, f * CHAR_FRAME_W, di * CHAR_FRAME_H))
    })
    return s
  }))
  const lantai = await Promise.all(indeks.floors.map(async (rel) =>
    potong(await decodePng(`${base}${jalur('floors', rel)}`), FLOOR_TILE_SIZE, FLOOR_TILE_SIZE)))
  const dinding = await Promise.all(indeks.walls.map(async (rel) => {
    const png = await decodePng(`${base}${jalur('walls', rel)}`)
    return Array.from({ length: WALL_BITMASK_COUNT }, (_, m) =>
      potong(png, WALL_PIECE_WIDTH, WALL_PIECE_HEIGHT, (m % WALL_GRID_COLS) * WALL_PIECE_WIDTH, Math.floor(m / WALL_GRID_COLS) * WALL_PIECE_HEIGHT))
  }))
  const furnitur: Record<string, string[][]> = {}
  await Promise.all(katalog.map(async (e) => {
    furnitur[e.id] = potong(await decodePng(`${base}${e.furniturePath}`), e.width, e.height)
  }))
  const layout = indeks.defaultLayout ? await fetch(`${base}${indeks.defaultLayout}`).then((r) => r.json()) : null

  // Urutan sama dengan upstream: karakter → lantai → dinding → furnitur → layout.
  setCharacterTemplates(karakter)
  setFloorSprites(lantai)
  setWallSprites(dinding)
  buildDynamicCatalog({ catalog: katalog as never, sprites: furnitur })
  return { layout, jumlahKarakter: karakter.length }
}
```
Bila tipe `setCharacterTemplates`/`buildDynamicCatalog` menolak argumen, sesuaikan cast dengan tipe ekspor engine (lihat `office/sprites/spriteData.ts` & `office/layout/furnitureCatalog.ts`), jangan ubah engine.

- [ ] **Step 7: Tulis uji asap engine** `apps/bot/src/kantor/engine.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildDynamicCatalog } from '@/kantor/engine/office/layout/furnitureCatalog'
import { migrateLayoutColors } from '@/kantor/engine/office/layout/layoutSerializer'
import { OfficeState } from '@/kantor/engine/office/engine/officeState'

const A = join(__dirname, '..', '..', 'public', 'kantor', 'assets')
const baca = (f: string) => JSON.parse(readFileSync(join(A, f), 'utf8'))

describe('engine kantor (porting)', () => {
  it('layout bawaan punya kursi & karakter mendapat kursi', () => {
    const katalog = baca('furniture-catalog.json') as Array<{ id: string; width: number; height: number }>
    const sprites = Object.fromEntries(katalog.map((e) => [e.id, Array.from({ length: e.height }, () => Array(e.width).fill(''))]))
    buildDynamicCatalog({ catalog: katalog as never, sprites })
    const os = new OfficeState(migrateLayoutColors(baca('default-layout-1.json')))
    expect(os.seats.size).toBeGreaterThanOrEqual(4)
    os.addAgent(11, 0, undefined, undefined, true)
    os.addAgent(22, 1, undefined, undefined, true)
    const ch = os.getCharacters()
    expect(ch.map((c) => c.id).sort()).toEqual([11, 22])
    expect(ch.every((c) => c.seatId)).toBe(true)
    os.setAgentActive(11, true)
    os.setAgentTool(11, 'rekap_absensi')
    os.update(0.1)
    os.removeAgent(22)
    expect(os.getCharacters().map((c) => c.id)).toEqual([11])
  })
})
```

- [ ] **Step 8: Jalankan.** `yarn workspace @suka/bot test src/kantor/engine.test.ts`. Expected: PASS. Bila gagal karena `document is not defined` pada impor modul (bukan saat dipanggil), pindahkan akses `document` di berkas engine itu ke dalam fungsi pemanggilnya (perubahan minimal, beri komentar `// porting: lazy agar bisa diuji di node`). Lalu `yarn workspace @suka/bot type-check` → 0 error. Catat nilai `os.seats.size` di pesan commit.

- [ ] **Step 9: Commit**

```bash
git branch --show-current
git add apps/bot/src/kantor/engine apps/bot/src/kantor/muatAset.ts apps/bot/src/kantor/engine.test.ts apps/bot/public/kantor apps/bot/scripts/kantor
git commit -m "feat(bot): porting engine Pixel Agents (MIT) + aset kantor

Kursi di layout bawaan: <isi dari Step 8>.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Halaman `/kantor` + `KantorApp`

**Files:**
- Create: `apps/bot/src/components/kantor/KantorApp.tsx`
- Create: `apps/bot/src/app/kantor/page.tsx`
- Modify: `apps/bot/src/app/page.tsx`, `apps/bot/src/components/ChatApp.tsx`

**Interfaces:**
- Consumes: `muatAset`, engine (Task 6); `tempatkan`, `rencanaSinkron`, `Penempatan` (Task 4); `Meja`, `Keadaan` (Task 3); `GET /api/kantor/status` (Task 5); `ambilSesiKantor` (Task 2).
- Produces: `KantorApp` props `{ layarPenuh: boolean; portalUrl: string; onPilihMeja?: (id: string) => void }` (kait Tahap B/C).

- [ ] **Step 1: Tulis** `apps/bot/src/components/kantor/KantorApp.tsx`:

```tsx
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { muatAset } from '@/kantor/muatAset'
import { tempatkan, rencanaSinkron, type Penempatan } from '@/kantor/peta'
import type { Meja, Keadaan } from '@/kantor/keadaan'
import { OfficeState } from '@/kantor/engine/office/engine/officeState'
import { renderFrame } from '@/kantor/engine/office/engine/renderer'
import { startGameLoop } from '@/kantor/engine/office/engine/gameLoop'
import { migrateLayoutColors } from '@/kantor/engine/office/layout/layoutSerializer'
import { TILE_SIZE } from '@/kantor/engine/office/types'

const POLL_MS = 10_000
const BASE_ASET = '/kantor/assets/'
const LABEL: Record<Keadaan, string> = { bekerja: 'Bekerja', siaga: 'Siaga', galat: 'Ada masalah', tidur: 'Tidur' }
const WARNA: Record<Keadaan, string> = {
  bekerja: 'bg-suka-green text-white', siaga: 'bg-white text-suka-brown',
  galat: 'bg-red-600 text-white', tidur: 'bg-gray-200 text-gray-500',
}

type Label = { agentId: number; x: number; y: number; meja: Meja }

function terapkanKeadaan(os: OfficeState, p: Penempatan) {
  const { agentId: id, meja } = p
  os.setAgentActive(id, meja.keadaan === 'bekerja')
  os.setAgentTool(id, meja.keadaan === 'bekerja' ? meja.alatTerakhir : null)
  if (meja.keadaan === 'galat') os.showPermissionBubble(id)
  else os.clearPermissionBubble(id)
}

export default function KantorApp({ layarPenuh, portalUrl, onPilihMeja }: { layarPenuh: boolean; portalUrl: string; onPilihMeja?: (id: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const osRef = useRef<OfficeState | null>(null)
  const jumlahPaletRef = useRef(0)
  const offsetRef = useRef({ x: 0, y: 0, zoom: 1 })
  const penempatanRef = useRef<Penempatan[]>([])
  const [mesinSiap, setMesinSiap] = useState(false)
  const [asetGagal, setAsetGagal] = useState(false)
  const [meja, setMeja] = useState<Meja[] | null>(null)
  const [diLuar, setDiLuar] = useState<Meja[]>([])
  const [diambilAt, setDiambilAt] = useState<string | null>(null)
  const [pollingGagal, setPollingGagal] = useState(false)
  const [labels, setLabels] = useState<Label[]>([])
  const [terpilih, setTerpilih] = useState<string | null>(null)

  // 1) Muat aset + engine sekali.
  useEffect(() => {
    let batal = false
    muatAset(BASE_ASET)
      .then(({ layout, jumlahKarakter }) => {
        if (batal) return
        osRef.current = new OfficeState(migrateLayoutColors(layout as never))
        jumlahPaletRef.current = jumlahKarakter
        setMesinSiap(true)
      })
      .catch(() => { if (!batal) setAsetGagal(true) })
    return () => { batal = true }
  }, [])

  // 2) Polling status (dijeda saat tab tersembunyi).
  const muatStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/kantor/status', { cache: 'no-store' })
      if (r.status === 401) { window.location.href = portalUrl; return }
      if (r.status === 403) { window.location.reload(); return }
      if (!r.ok) throw new Error(String(r.status))
      const j = (await r.json()) as { diambilAt: string; meja: Meja[] }
      setMeja(j.meja)
      setDiambilAt(j.diambilAt)
      setPollingGagal(false)
    } catch {
      setPollingGagal(true) // keadaan terakhir dipertahankan
    }
  }, [portalUrl])

  useEffect(() => {
    let t: ReturnType<typeof setInterval> | null = null
    const mulai = () => { if (!t) { void muatStatus(); t = setInterval(muatStatus, POLL_MS) } }
    const henti = () => { if (t) { clearInterval(t); t = null } }
    const onVis = () => (document.hidden ? henti() : mulai())
    if (!document.hidden) mulai()
    document.addEventListener('visibilitychange', onVis)
    return () => { henti(); document.removeEventListener('visibilitychange', onVis) }
  }, [muatStatus])

  // 3) Sinkron meja → engine.
  useEffect(() => {
    const os = osRef.current
    if (!os || !meja) return
    const { diKantor, diLuar: luar } = tempatkan(meja, os.seats.size, jumlahPaletRef.current)
    const { tambah, hapus } = rencanaSinkron([...os.characters.keys()], diKantor)
    for (const id of hapus) os.removeAgent(id)
    for (const p of tambah) os.addAgent(p.agentId, p.palet, undefined, undefined, true)
    for (const p of diKantor) terapkanKeadaan(os, p)
    penempatanRef.current = diKantor
    setDiLuar(luar)
  }, [meja, mesinSiap])

  // 4) Game loop + render + posisi kartu nama.
  useEffect(() => {
    const canvas = canvasRef.current
    const os = osRef.current
    if (!canvas || !os || !mesinSiap) return
    let bingkai = 0
    const stop = startGameLoop(canvas, {
      update: (dt) => os.update(dt),
      render: (ctx) => {
        const dpr = window.devicePixelRatio || 1
        const w = Math.floor(canvas.clientWidth * dpr)
        const h = Math.floor(canvas.clientHeight * dpr)
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
        const layout = os.getLayout()
        const zoom = Math.max(1, Math.floor(Math.min(w / (layout.cols * TILE_SIZE), h / (layout.rows * TILE_SIZE))))
        const { offsetX, offsetY } = renderFrame(
          ctx, w, h, os.tileMap, os.furniture, os.getCharacters(), zoom, 0, 0,
          { selectedAgentId: os.selectedAgentId, hoveredAgentId: os.hoveredAgentId, hoveredTile: os.hoveredTile, seats: os.seats, characters: os.characters },
          undefined, layout.tileColors, layout.cols, layout.rows, layout.carpetTiles, layout.areas, layout.areaTiles, false, null, os.pets,
        )
        offsetRef.current = { x: offsetX, y: offsetY, zoom }
        if (++bingkai % 6 === 0) {
          setLabels(penempatanRef.current.flatMap((p) => {
            const ch = os.characters.get(p.agentId)
            if (!ch) return []
            return [{ agentId: p.agentId, meja: p.meja, x: (offsetX + ch.x * zoom) / dpr, y: (offsetY + (ch.y - 30) * zoom) / dpr }]
          }))
        }
      },
    })
    return stop
  }, [mesinSiap])

  const klikKanvas = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const os = osRef.current
    const canvas = canvasRef.current
    if (!os || !canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const { x, y, zoom } = offsetRef.current
    const wx = ((e.clientX - rect.left) * dpr - x) / zoom
    const wy = ((e.clientY - rect.top) * dpr - y) / zoom
    const id = os.getCharacterAt(wx, wy)
    const p = penempatanRef.current.find((q) => q.agentId === id)
    os.selectedAgentId = p ? p.agentId : null
    setTerpilih(p ? p.meja.id : null)
    if (p) onPilihMeja?.(p.meja.id)
  }

  const jam = diambilAt ? new Date(diambilAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : null
  const semua = meja ?? []

  return (
    <main className="flex h-dvh flex-col bg-suka-cream">
      {!layarPenuh && (
        <header className="flex items-center gap-3 border-b bg-white p-3">
          <h1 className="flex-1 font-bold text-suka-brown">Kantor Bot</h1>
          <a href="/" className="rounded-lg border px-3 py-1.5 text-sm text-suka-brown hover:bg-suka-cream">Chat</a>
          <a href={portalUrl} className="rounded-lg border px-3 py-1.5 text-sm text-suka-brown hover:bg-suka-cream">Portal</a>
        </header>
      )}
      {pollingGagal && (
        <div role="status" className="bg-amber-100 px-3 py-1 text-center text-xs text-amber-900">
          Data terakhir {jam ?? '—'} — mencoba lagi
        </div>
      )}
      {asetGagal ? (
        <section className="flex-1 overflow-auto p-4">
          <p className="mb-3 text-sm text-gray-600">Gambar kantor gagal dimuat. Status bot:</p>
          <DaftarMeja meja={semua} />
        </section>
      ) : (
        <section className="relative min-h-0 flex-1">
          <canvas ref={canvasRef} onClick={klikKanvas} className="h-full w-full cursor-pointer [image-rendering:pixelated]" />
          <div className="pointer-events-none absolute inset-0 hidden md:block">
            {labels.map((l) => (
              <div key={l.agentId} style={{ left: l.x, top: l.y }}
                className={`absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded px-2 py-0.5 text-xs shadow ${WARNA[l.meja.keadaan]} ${terpilih === l.meja.id ? 'ring-2 ring-suka-orange' : ''}`}>
                {l.meja.keadaan === 'galat' && '! '}{l.meja.nama}
                {l.meja.keadaan === 'tidur' && ' z z'}
                {l.meja.keadaan === 'bekerja' && l.meja.alatTerakhir && <span className="opacity-80"> · {l.meja.alatTerakhir}</span>}
              </div>
            ))}
          </div>
          {meja && semua.length === 0 && (
            <p className="absolute inset-x-0 top-4 text-center text-sm text-gray-600">Belum ada bot aktif</p>
          )}
        </section>
      )}
      {!asetGagal && (
        <section className="border-t bg-white p-3 md:hidden">
          <DaftarMeja meja={semua} />
        </section>
      )}
      {!asetGagal && diLuar.length > 0 && (
        <section className="hidden border-t bg-white p-3 md:block">
          <p className="mb-2 text-xs text-gray-600">Di luar kantor (kursi penuh):</p>
          <DaftarMeja meja={diLuar} />
        </section>
      )}
    </main>
  )
}

function DaftarMeja({ meja }: { meja: Meja[] }) {
  return (
    <ul className="space-y-1">
      {meja.map((m) => (
        <li key={m.id} className="flex items-center gap-2 text-sm">
          <span className={`rounded px-2 py-0.5 text-xs ${WARNA[m.keadaan]}`}>{LABEL[m.keadaan]}</span>
          <span className="font-medium">{m.nama}</span>
          {m.keadaan === 'bekerja' && m.alatTerakhir && <span className="text-gray-500">· {m.alatTerakhir}</span>}
        </li>
      ))}
    </ul>
  )
}
```

Catatan untuk implementer: bila tanda tangan `renderFrame`/field `OfficeState` hasil porting berbeda dari pemanggilan di atas, ikuti tanda tangan porting (sumber kebenaran = upstream @3537e140), tanpa mengubah engine. `os.selectedAgentId` adalah field publik di upstream.

- [ ] **Step 2: Tulis** `apps/bot/src/app/kantor/page.tsx`:

```tsx
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ambilSesiKantor } from '@/lib/server/sesi'
import KantorApp from '@/components/kantor/KantorApp'

export const dynamic = 'force-dynamic'

export default async function HalamanKantor({ searchParams }: { searchParams: Promise<{ layar?: string }> }) {
  const host = (await headers()).get('host') || ''
  const portalUrl = host.includes('localhost') || host.includes('127.0.0.1')
    ? 'http://localhost:3010'
    : process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
  const g = await ambilSesiKantor()
  if (!g.ok && g.status === 401) redirect(portalUrl)
  if (!g.ok) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-bold">Tidak punya akses</h1>
        <p className="mt-2 text-sm">Kantor Bot hanya untuk owner dan admin.</p>
        <a href={portalUrl} className="mt-4 inline-block rounded-lg bg-suka-orange px-4 py-2 text-sm text-white">Kembali ke portal</a>
      </main>
    )
  }
  const { layar } = await searchParams
  return <KantorApp layarPenuh={layar === 'penuh'} portalUrl={portalUrl} />
}
```

- [ ] **Step 3: Tautan "Kantor".**
  - `apps/bot/src/app/page.tsx`: impor `ambilSesiKantor`; hitung `const k = await ambilSesiKantor()` setelah `ambilSesi()`. Di cabang 403 tambahkan, bila `k.ok`, `<a href="/kantor" className="mt-4 ml-2 inline-block rounded-lg border px-4 py-2 text-sm text-suka-brown">Buka Kantor Bot</a>` di samping tombol portal. Di render `ChatApp` tambahkan prop `bolehKantor={k.ok}`.
  - `apps/bot/src/components/ChatApp.tsx`: tambah prop `bolehKantor: boolean` ke tanda tangan komponen; di `<header>` tepat sebelum tautan portal, tambah:
    ```tsx
    {bolehKantor && (
      <a href="/kantor" className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm text-suka-brown hover:bg-suka-cream">Kantor</a>
    )}
    ```

- [ ] **Step 4: Verifikasi otomatis.** `yarn workspace @suka/bot test` → PASS semua; `yarn workspace @suka/bot type-check` → 0 error; `yarn workspace @suka/bot build` → sukses dan output memuat rute `ƒ /kantor` dan `ƒ /api/kantor/status`.

- [ ] **Step 5: Smoke lokal di browser.** `yarn workspace @suka/bot dev` (port 3050, login via portal lokal :3010 dengan akun owner/admin/developer). Buka `http://localhost:3050/kantor`:
  - Kantor tampil, karakter MANAGER UTAMA & Bot HRD ada, kartu nama tampil (layar ≥ md).
  - Klik karakter → kartu nama ber-ring oranye.
  - `?layar=penuh` → header hilang.
  - DevTools offline → pita "Data terakhir … — mencoba lagi", karakter tetap.
  - Ganti `BASE_ASET` sementara ke path salah → daftar teks muncul (kembalikan setelahnya).
  - Lebar HP (375px) → daftar di bawah kanvas.
  - Tanya Bot HRD lewat Telegram → karakter HRD "Bekerja" ≤10 dtk, kembali "Siaga" ±60 dtk kemudian.
  - Login akun crew → `/kantor` menampilkan "Tidak punya akses".
  Catat hasilnya; bila ada yang gagal, perbaiki di task ini.

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git add apps/bot/src/components/kantor apps/bot/src/app/kantor apps/bot/src/app/page.tsx apps/bot/src/components/ChatApp.tsx
git commit -m "feat(bot): halaman /kantor — kantor pixel-art status bot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Dokumentasi & verifikasi akhir

**Files:**
- Modify: `apps/bot/README.md`, `CLAUDE.md`

- [ ] **Step 1: README.** Tambah bagian "Kantor Bot (`/kantor`)" di `apps/bot/README.md`: tujuan, gerbang owner/admin/developer, sumber data `status_kantor_bot()`, polling 10 dtk, aturan keadaan (tabel spec §5.2), lokasi engine & `KREDIT.md`, cara membangkitkan ulang indeks aset (`scripts/kantor/bangun-indeks-aset.md`), link spec & plan.

- [ ] **Step 2: CLAUDE.md.** Tambah entri `## Session 2026-10-07: Kantor Bot Tahap A (apps/bot)` sebelum baris `**Last updated:**`: status (branch `feat/kantor-bot`, belum merge/push), migration applied & terstempel (sebut versi persis), perlu redeploy `apps/bot`, gotcha (fungsi DB = satu-satunya jalan baca `hermes_api_log` untuk pengguna; engine porting dipatok upstream @3537e140, jangan ubah logika engine; kapasitas kursi = hitungan layout bawaan), next (Tahap B panel pantau, Tahap C ngobrol).

- [ ] **Step 3: Verifikasi akhir.**

```bash
yarn workspace @suka/bot test
yarn workspace @suka/bot type-check
yarn workspace @suka/bot build
git status --short
```
Expected: PASS, 0 error, build sukses, working tree bersih kecuali berkas Step 1–2. Jalankan ulang `supabase/verifikasi/kantor_bot/t1.sql` via `execute_sql` → `T1 LULUS`.

- [ ] **Step 4: Commit**

```bash
git branch --show-current
git add apps/bot/README.md CLAUDE.md
git commit -m "docs(bot): Kantor Bot tahap A — README & catatan sesi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
