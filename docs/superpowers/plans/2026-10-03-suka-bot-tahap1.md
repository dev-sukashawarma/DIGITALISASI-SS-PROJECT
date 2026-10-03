# SUKA Bot Tahap 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Asisten AI "SUKA Bot" di portal untuk role admin/owner/developer: rekap penjualan kemarin + tanya jawab soal penjualan dan stok bahan, dengan angka yang identik dengan Rangkuman Penjualan & app Stok.

**Architecture:** Tampilan (avatar + panel chat) di `apps/portal`; otak di `apps/admin-dashboard` (`/api/asisten/*`). Model AI (lewat 9Router, OpenAI-compatible) hanya memilih alat; setiap alat memanggil kode resmi yang sudah ada — `getPosReport` (Rangkuman Penjualan, ber-cache per hari) dan `monitoring_view_spv` + `formatTriUnitSaldoAdaptive` (app Stok). Semua jalan dengan sesi login penanya; gerbang = `is_owner_or_admin()`.

**Tech Stack:** Next.js 16 (route handlers), TypeScript, Supabase (Postgres + RLS + pg_cron), zod v4, vitest, fetch ke endpoint `/chat/completions` (tanpa SDK — hindari phantom dependency).

**Spec:** `docs/superpowers/specs/2026-10-03-suka-bot-design.md`

## Global Constraints

- Akses seluruh fitur: role `admin`, `owner`, `developer` saja = `public.is_owner_or_admin()` + `outlet_staff.status = 'active'`.
- AI **tidak pernah** menulis SQL atau menghitung angka. Semua angka berasal dari keluaran alat.
- Omzet acuan = **omzet kotor** (`analytics.grossRevenue` Rangkuman Penjualan).
- Outlet terhitung = `outlets.type IN ('outlet','mitra')` (daftar boleh). Outlet nonaktif tampil hanya bila omzetnya > 0 di periode itu. SS Online tidak ikut.
- Waktu = WIB. Minggu mulai **Senin**. Periode berjalan dibandingkan dengan rentang yang sama panjang.
- Setiap jawaban menyebut periode (tanggal persis) + sumber.
- Hanya-baca: tidak ada alat yang menulis data bisnis.
- Env server-only admin-dashboard: `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `SUKA_BOT_ALLOWED_ORIGINS`, `SUKA_BOT_BATAS_HARIAN` — wajib `ARG`+`ENV` di **stage runner** Dockerfile.
- Jangan tambah dependency baru ke `package.json` app mana pun (zod sudah ada di admin-dashboard).
- Migration baru: timestamp `20261003180000`. Sebelum apply, cek tidak bentrok (`ls supabase/migrations | cut -c1-14 | sort | uniq -d` dan `select version from supabase_migrations.schema_migrations where version = '20261003180000'`).
- Bahasa UI & jawaban: Indonesia santai, memanggil "Bos". Nama: **SUKA Bot**.
- Sebelum commit: `git branch --show-current` harus branch fitur (otomasi repo pernah memindahkan branch di tengah sesi).

## Penyesuaian terhadap spec (diputuskan saat menyusun plan)

1. **Teks rekap disusun template, bukan AI.** Angka & kalimat rekap dihasilkan kode (`teksRekap`). Nol risiko halusinasi, nol biaya token. AI dipakai untuk tanya jawab saja.
2. **Middleware admin-dashboard dilewati untuk `/api/asisten/*`.** Role `owner` tidak punya `admin-dashboard` di `ROLE_APP_ACCESS`, jadi `enforceAppAccess` akan me-redirect owner (dan preflight CORS). Route memeriksa sesi & `is_owner_or_admin()` sendiri.
3. **Titik merah "rekap baru" disimpan per perangkat** (localStorage), bukan per akun.
4. **Formatter stok:** `apps/stok/.../compositeUnit.ts` dan salinan admin-dashboard **kodenya identik** (beda hanya komentar, dicek 2026-10-03) — tidak perlu disamakan; Task 6 punya test penjaga.
5. **Alat stok membaca `monitoring_view_spv`** (sudah memuat `current_qty`, `saldo_is_gram`, `last_opname_date`) + Gudang Pusat ikut sebagai lokasi yang bisa ditanya.

## Peta berkas

**admin-dashboard** (`apps/admin-dashboard/`)
| Berkas | Tanggung jawab |
|---|---|
| `src/lib/sukaBot/periode.ts` | kata waktu → rentang tanggal + pembanding (murni) |
| `src/lib/sukaBot/pencarian.ts` | cocokkan nama outlet/bahan dari teks (murni) |
| `src/lib/sukaBot/format.ts` | rupiah, persen, jam WIB (murni) |
| `src/lib/sukaBot/alat/penjualan.ts` | alat omzet, bandingkan, menu terlaris, ranking |
| `src/lib/sukaBot/alat/stok.ts` | alat stok bahan |
| `src/lib/sukaBot/alat/registry.ts` | definisi alat (JSON schema) + validasi zod + dispatcher |
| `src/lib/sukaBot/llm.ts` | klien `/chat/completions` |
| `src/lib/sukaBot/agen.ts` | putaran model ↔ alat |
| `src/lib/sukaBot/prompt.ts` | prompt sistem |
| `src/lib/sukaBot/rekap.ts` | hitung data rekap + teks template |
| `src/lib/sukaBot/server/sesi.ts` | sesi + gerbang role |
| `src/lib/sukaBot/server/cors.ts` | origin yang diizinkan |
| `src/lib/sukaBot/server/sumberData.ts` | adapter nyata: getPosReport, outlets, bahan, monitoring view |
| `src/app/api/asisten/chat/route.ts` | POST tanya jawab |
| `src/app/api/asisten/rekap/route.ts` | GET rekap (buat bila belum ada), POST perbarui |
| `src/app/api/asisten/percakapan/route.ts` | GET riwayat |
| `src/middleware.ts` | lewati `/api/asisten/` |
| `Dockerfile` | env runner |

**portal** (`apps/portal/`)
| Berkas | Tanggung jawab |
|---|---|
| `src/components/sukaBot/api.ts` | fetch ke admin-dashboard |
| `src/components/sukaBot/AvatarSukaBot.tsx` | gambar pose + fallback |
| `src/components/sukaBot/PanelSukaBot.tsx` | rekap + chat |
| `src/components/sukaBot/SukaBotWidget.tsx` | tombol melayang + titik merah + error boundary |
| `src/components/sukaBot/SukaBotMount.tsx` | dynamic import (ssr:false) |
| `src/app/asisten/page.tsx` | halaman penuh |
| `src/app/launcher/page.tsx` | pasang `SukaBotMount` untuk 3 role |

**database**: `supabase/migrations/20261003180000_suka_bot.sql`, `supabase/verifikasi/suka_bot/t1_rls.sql`

---

### Task 1: Tabel, RLS, RPC pemakaian, retensi 90 hari

**Files:**
- Create: `supabase/migrations/20261003180000_suka_bot.sql`
- Create: `supabase/verifikasi/suka_bot/t1_rls.sql`

**Interfaces:**
- Produces: tabel `suka_bot_rekap(id, tanggal, versi, data, teks, dibuat_oleh, dibuat_at)`, `suka_bot_percakapan(id, user_id, judul, dibuat_at, diperbarui_at)`, `suka_bot_pesan(id, percakapan_id, user_id, peran, isi, meta, dibuat_at)`, `suka_bot_gagal(id, user_id, pertanyaan, alasan, dibuat_at)`, `suka_bot_pemakaian(user_id, tanggal, jumlah_pertanyaan, token_masuk, token_keluar)`; RPC `suka_bot_catat_pemakaian(p_token_masuk int, p_token_keluar int) returns int`.

- [ ] **Step 1: Tulis uji verifikasi (akan gagal karena tabel belum ada)**

`supabase/verifikasi/suka_bot/t1_rls.sql`:
```sql
-- Uji RLS SUKA Bot. Jalankan seluruh berkas; selalu ROLLBACK (nol perubahan nyata).
-- Lulus = selesai tanpa error. Kontrol negatif ada di bagian akhir (dikomentari).
BEGIN;

DO $$
DECLARE
  v_admin uuid; v_crew uuid; v_dev uuid; v_n int; v_pc uuid;
BEGIN
  SELECT id INTO v_admin FROM outlet_staff WHERE role = 'admin' AND status = 'active' LIMIT 1;
  SELECT id INTO v_crew  FROM outlet_staff WHERE role = 'crew'  AND status = 'active' LIMIT 1;
  SELECT id INTO v_dev   FROM outlet_staff WHERE role = 'developer' AND status = 'active' LIMIT 1;
  IF v_admin IS NULL OR v_crew IS NULL OR v_dev IS NULL THEN RAISE EXCEPTION 'fixture kosong'; END IF;

  -- (a) admin bisa membuat percakapan & pesan miliknya
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO suka_bot_percakapan (judul) VALUES ('uji') RETURNING id INTO v_pc;
  INSERT INTO suka_bot_pesan (percakapan_id, peran, isi) VALUES (v_pc, 'user', 'halo');
  SELECT count(*) INTO v_n FROM suka_bot_pesan WHERE percakapan_id = v_pc;
  IF v_n <> 1 THEN RAISE EXCEPTION '(a) admin tak bisa baca pesannya: %', v_n; END IF;

  -- (b) RPC pemakaian menghitung naik
  IF public.suka_bot_catat_pemakaian(10, 5) <> 1 THEN RAISE EXCEPTION '(b) hitungan pertama bukan 1'; END IF;
  IF public.suka_bot_catat_pemakaian(10, 5) <> 2 THEN RAISE EXCEPTION '(b) hitungan kedua bukan 2'; END IF;

  -- (c) admin tidak bisa membaca log gagal (khusus developer)
  INSERT INTO suka_bot_gagal (pertanyaan, alasan) VALUES ('laba kemarin?', 'di_luar_alat');
  SELECT count(*) INTO v_n FROM suka_bot_gagal;
  IF v_n <> 0 THEN RAISE EXCEPTION '(c) admin bisa baca suka_bot_gagal'; END IF;
  RESET ROLE;

  -- (d) crew: tidak bisa melihat percakapan admin, tidak bisa insert apa pun
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM suka_bot_percakapan;
  IF v_n <> 0 THEN RAISE EXCEPTION '(d) crew melihat % percakapan', v_n; END IF;
  SELECT count(*) INTO v_n FROM suka_bot_rekap;
  IF v_n <> 0 THEN RAISE EXCEPTION '(d) crew melihat rekap'; END IF;
  BEGIN
    INSERT INTO suka_bot_percakapan (judul) VALUES ('crew');
    RAISE EXCEPTION '(d) crew berhasil insert percakapan';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.suka_bot_catat_pemakaian(1, 1);
    RAISE EXCEPTION '(d) crew berhasil memanggil RPC pemakaian';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;

  -- (e) developer bisa membaca log gagal
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dev, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM suka_bot_gagal;
  IF v_n < 1 THEN RAISE EXCEPTION '(e) developer tak bisa baca log gagal'; END IF;
  RESET ROLE;

  -- (f) anon nol akses
  IF has_table_privilege('anon', 'public.suka_bot_rekap', 'select') THEN RAISE EXCEPTION '(f) anon bisa select rekap'; END IF;
  IF has_function_privilege('anon', 'public.suka_bot_catat_pemakaian(integer,integer)', 'execute') THEN RAISE EXCEPTION '(f) anon bisa execute RPC'; END IF;

  -- (g) rekap unik per (tanggal, versi)
  INSERT INTO suka_bot_rekap (tanggal, versi, data, teks, dibuat_oleh) VALUES ('2026-01-01', 1, '{}', 'x', v_admin);
  BEGIN
    INSERT INTO suka_bot_rekap (tanggal, versi, data, teks, dibuat_oleh) VALUES ('2026-01-01', 1, '{}', 'y', v_admin);
    RAISE EXCEPTION '(g) rekap kembar lolos';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  RAISE NOTICE 'SEMUA LULUS';
END $$;

-- Kontrol negatif (jalankan terpisah, harus GAGAL): ganti asersi (a) menjadi
-- IF v_n <> 2 ... dan pastikan error '(a) ...' muncul.
ROLLBACK;
```

- [ ] **Step 2: Jalankan uji — harus gagal**

Jalankan isi berkas lewat Supabase MCP `execute_sql` (atau SQL Editor).
Expected: ERROR `relation "suka_bot_percakapan" does not exist`.

- [ ] **Step 3: Tulis migration**

`supabase/migrations/20261003180000_suka_bot.sql`:
```sql
-- SUKA Bot tahap 1: rekap harian, riwayat chat, log pertanyaan gagal, pemakaian.
-- Spec: docs/superpowers/specs/2026-10-03-suka-bot-design.md §8
-- Akses: admin/owner/developer = is_owner_or_admin().

CREATE TABLE IF NOT EXISTS public.suka_bot_rekap (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal     date NOT NULL,
  versi       int  NOT NULL CHECK (versi >= 1),
  data        jsonb NOT NULL,
  teks        text NOT NULL,
  dibuat_oleh uuid NOT NULL DEFAULT auth.uid(),
  dibuat_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tanggal, versi)
);

CREATE TABLE IF NOT EXISTS public.suka_bot_percakapan (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL DEFAULT auth.uid(),
  judul         text NOT NULL DEFAULT 'Percakapan',
  dibuat_at     timestamptz NOT NULL DEFAULT now(),
  diperbarui_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS suka_bot_percakapan_user_idx ON public.suka_bot_percakapan (user_id, diperbarui_at DESC);

CREATE TABLE IF NOT EXISTS public.suka_bot_pesan (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  percakapan_id uuid NOT NULL REFERENCES public.suka_bot_percakapan(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL DEFAULT auth.uid(),
  peran         text NOT NULL CHECK (peran IN ('user', 'assistant')),
  isi           text NOT NULL,
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  dibuat_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS suka_bot_pesan_percakapan_idx ON public.suka_bot_pesan (percakapan_id, dibuat_at);

CREATE TABLE IF NOT EXISTS public.suka_bot_gagal (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid(),
  pertanyaan text NOT NULL,
  alasan     text NOT NULL,
  dibuat_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.suka_bot_pemakaian (
  user_id           uuid NOT NULL,
  tanggal           date NOT NULL,
  jumlah_pertanyaan int  NOT NULL DEFAULT 0,
  token_masuk       bigint NOT NULL DEFAULT 0,
  token_keluar      bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, tanggal)
);

-- Default privileges Supabase memberi ALL ke tabel baru; cabut lalu beri seperlunya.
REVOKE ALL ON public.suka_bot_rekap, public.suka_bot_percakapan, public.suka_bot_pesan,
              public.suka_bot_gagal, public.suka_bot_pemakaian FROM anon, authenticated;
GRANT SELECT, INSERT ON public.suka_bot_rekap TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suka_bot_percakapan TO authenticated;
GRANT SELECT, INSERT ON public.suka_bot_pesan TO authenticated;
GRANT SELECT, INSERT ON public.suka_bot_gagal TO authenticated;
GRANT SELECT ON public.suka_bot_pemakaian TO authenticated;

ALTER TABLE public.suka_bot_rekap      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suka_bot_percakapan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suka_bot_pesan      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suka_bot_gagal      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suka_bot_pemakaian  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.suka_bot_is_developer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM outlet_staff WHERE id = auth.uid() AND role = 'developer' AND status = 'active');
$$;
REVOKE ALL ON FUNCTION public.suka_bot_is_developer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suka_bot_is_developer() TO authenticated;

DROP POLICY IF EXISTS suka_bot_rekap_select ON public.suka_bot_rekap;
CREATE POLICY suka_bot_rekap_select ON public.suka_bot_rekap FOR SELECT TO authenticated
  USING (public.is_owner_or_admin());
DROP POLICY IF EXISTS suka_bot_rekap_insert ON public.suka_bot_rekap;
CREATE POLICY suka_bot_rekap_insert ON public.suka_bot_rekap FOR INSERT TO authenticated
  WITH CHECK (public.is_owner_or_admin() AND dibuat_oleh = auth.uid());

DROP POLICY IF EXISTS suka_bot_percakapan_milik ON public.suka_bot_percakapan;
CREATE POLICY suka_bot_percakapan_milik ON public.suka_bot_percakapan FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.is_owner_or_admin())
  WITH CHECK (user_id = auth.uid() AND public.is_owner_or_admin());

DROP POLICY IF EXISTS suka_bot_pesan_select ON public.suka_bot_pesan;
CREATE POLICY suka_bot_pesan_select ON public.suka_bot_pesan FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_owner_or_admin());
DROP POLICY IF EXISTS suka_bot_pesan_insert ON public.suka_bot_pesan;
CREATE POLICY suka_bot_pesan_insert ON public.suka_bot_pesan FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND public.is_owner_or_admin()
    AND EXISTS (SELECT 1 FROM public.suka_bot_percakapan p WHERE p.id = percakapan_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS suka_bot_gagal_insert ON public.suka_bot_gagal;
CREATE POLICY suka_bot_gagal_insert ON public.suka_bot_gagal FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_owner_or_admin());
DROP POLICY IF EXISTS suka_bot_gagal_select ON public.suka_bot_gagal;
CREATE POLICY suka_bot_gagal_select ON public.suka_bot_gagal FOR SELECT TO authenticated
  USING (public.suka_bot_is_developer());

DROP POLICY IF EXISTS suka_bot_pemakaian_select ON public.suka_bot_pemakaian;
CREATE POLICY suka_bot_pemakaian_select ON public.suka_bot_pemakaian FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.suka_bot_is_developer());

-- Satu-satunya jalur tulis pemakaian: dihitung server, tak bisa direset klien.
CREATE OR REPLACE FUNCTION public.suka_bot_catat_pemakaian(p_token_masuk int, p_token_keluar int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tgl date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_jumlah int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_owner_or_admin() THEN
    RAISE EXCEPTION 'SUKA Bot hanya untuk admin/owner/developer' USING ERRCODE = '42501';
  END IF;
  INSERT INTO suka_bot_pemakaian (user_id, tanggal, jumlah_pertanyaan, token_masuk, token_keluar)
  VALUES (auth.uid(), v_tgl, 1, GREATEST(p_token_masuk, 0), GREATEST(p_token_keluar, 0))
  ON CONFLICT (user_id, tanggal) DO UPDATE SET
    jumlah_pertanyaan = suka_bot_pemakaian.jumlah_pertanyaan + 1,
    token_masuk  = suka_bot_pemakaian.token_masuk  + GREATEST(p_token_masuk, 0),
    token_keluar = suka_bot_pemakaian.token_keluar + GREATEST(p_token_keluar, 0)
  RETURNING jumlah_pertanyaan INTO v_jumlah;
  RETURN v_jumlah;
END $$;
REVOKE ALL ON FUNCTION public.suka_bot_catat_pemakaian(int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suka_bot_catat_pemakaian(int, int) TO authenticated;

-- Retensi riwayat chat 90 hari (03:30 WIB = 20:30 UTC). Rekap & log gagal tidak dihapus.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'suka-bot-retensi-90-hari') THEN
    PERFORM cron.unschedule('suka-bot-retensi-90-hari');
  END IF;
  PERFORM cron.schedule(
    'suka-bot-retensi-90-hari',
    '30 20 * * *',
    $cron$DELETE FROM public.suka_bot_percakapan WHERE diperbarui_at < now() - interval '90 days'$cron$
  );
END $$;
```

- [ ] **Step 4: Minta izin owner, lalu apply + stempel**

DB produksi dipakai bersama. **Tanya owner dulu.** Setelah diizinkan:
1. Cek bentrok: `select version from supabase_migrations.schema_migrations where version = '20261003180000';` → harus 0 baris.
2. Jalankan isi berkas migration lewat MCP `execute_sql`.
3. Stempel: `insert into supabase_migrations.schema_migrations (version, name) values ('20261003180000', 'suka_bot') on conflict do nothing;`
4. Verifikasi ke katalog (jangan percaya exit code):
```sql
select relname, relrowsecurity from pg_class where relname like 'suka_bot_%' and relkind = 'r';
select jobname, schedule from cron.job where jobname = 'suka-bot-retensi-90-hari';
select version from supabase_migrations.schema_migrations where version = '20261003180000';
```
Expected: 5 tabel `relrowsecurity = true`, 1 cron `30 20 * * *`, 1 baris stempel.

- [ ] **Step 5: Jalankan uji — harus lulus, lalu kontrol negatif**

Jalankan `t1_rls.sql`. Expected: `NOTICE: SEMUA LULUS`, transaksi di-ROLLBACK.
Lalu ubah asersi (a) menjadi `IF v_n <> 2` dan jalankan lagi → Expected: ERROR `(a) admin tak bisa baca pesannya: 1`. Kembalikan asersi.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261003180000_suka_bot.sql supabase/verifikasi/suka_bot/t1_rls.sql
git commit -m "feat(suka-bot): tabel rekap, percakapan, log gagal & pemakaian + RLS"
```

---

### Task 2: Kata waktu → rentang tanggal

**Files:**
- Create: `apps/admin-dashboard/src/lib/sukaBot/periode.ts`
- Test: `apps/admin-dashboard/src/lib/sukaBot/periode.test.ts`

**Interfaces:**
- Consumes: `addDaysStr`, `isDateStr` dari `@/lib/ownerDashboardCache`.
- Produces:
  - `type KodePeriode = 'hari_ini' | 'kemarin' | 'minggu_ini' | 'minggu_lalu' | 'bulan_ini' | 'bulan_lalu' | 'rentang'`
  - `interface Periode { dari: string; sampai: string; label: string; berjalan: boolean }`
  - `resolvePeriode(kode: KodePeriode, hariIni: string, rentang?: { dari?: string; sampai?: string }): Periode`
  - `periodePembanding(kode: KodePeriode, p: Periode): Periode`
  - `labelTanggal(ymd: string): string` → `'Kam 1 Okt 2026'`

- [ ] **Step 1: Tulis test gagal**

`periode.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { resolvePeriode, periodePembanding, labelTanggal } from './periode'

// 2026-10-01 = Kamis. Senin minggu itu = 2026-09-28.
const KAMIS = '2026-10-01'

describe('labelTanggal', () => {
  it('menulis hari, tanggal, bulan singkat, tahun', () => {
    expect(labelTanggal('2026-10-01')).toBe('Kam 1 Okt 2026')
    expect(labelTanggal('2026-09-28')).toBe('Sen 28 Sep 2026')
  })
})

describe('resolvePeriode', () => {
  it('hari_ini berjalan', () => {
    expect(resolvePeriode('hari_ini', KAMIS)).toMatchObject({ dari: KAMIS, sampai: KAMIS, berjalan: true })
  })
  it('kemarin', () => {
    expect(resolvePeriode('kemarin', KAMIS)).toMatchObject({ dari: '2026-09-30', sampai: '2026-09-30', berjalan: false })
  })
  it('minggu_ini mulai Senin', () => {
    expect(resolvePeriode('minggu_ini', KAMIS)).toMatchObject({ dari: '2026-09-28', sampai: KAMIS, berjalan: true })
  })
  it('minggu_ini saat hari Minggu tetap mulai Senin sebelumnya', () => {
    expect(resolvePeriode('minggu_ini', '2026-10-04')).toMatchObject({ dari: '2026-09-28', sampai: '2026-10-04' })
  })
  it('minggu_lalu Senin–Minggu penuh', () => {
    expect(resolvePeriode('minggu_lalu', KAMIS)).toMatchObject({ dari: '2026-09-21', sampai: '2026-09-27' })
  })
  it('bulan_ini & bulan_lalu', () => {
    expect(resolvePeriode('bulan_ini', KAMIS)).toMatchObject({ dari: '2026-10-01', sampai: KAMIS, berjalan: true })
    expect(resolvePeriode('bulan_lalu', KAMIS)).toMatchObject({ dari: '2026-09-01', sampai: '2026-09-30' })
  })
  it('rentang dijepit ke hari ini & ditolak bila terbalik/terlalu panjang', () => {
    expect(resolvePeriode('rentang', KAMIS, { dari: '2026-09-25', sampai: '2026-10-09' })).toMatchObject({ dari: '2026-09-25', sampai: KAMIS })
    expect(() => resolvePeriode('rentang', KAMIS, { dari: '2026-09-25', sampai: '2026-09-01' })).toThrow()
    expect(() => resolvePeriode('rentang', KAMIS, { dari: '2025-01-01', sampai: '2026-09-01' })).toThrow()
    expect(() => resolvePeriode('rentang', KAMIS, { dari: 'kemarin' })).toThrow()
  })
  it('label memuat tanggal persis', () => {
    expect(resolvePeriode('minggu_ini', KAMIS).label).toBe('Minggu ini (Sen 28 Sep 2026 – Kam 1 Okt 2026)')
  })
})

describe('periodePembanding', () => {
  const p = (k: any, h = KAMIS) => periodePembanding(k, resolvePeriode(k, h))
  it('harian & mingguan: mundur 7 hari dengan panjang sama', () => {
    expect(p('kemarin')).toMatchObject({ dari: '2026-09-23', sampai: '2026-09-23' })
    expect(p('minggu_ini')).toMatchObject({ dari: '2026-09-21', sampai: '2026-09-24' })
    expect(p('minggu_lalu')).toMatchObject({ dari: '2026-09-14', sampai: '2026-09-20' })
  })
  it('bulan_ini: tanggal 1 s/d hari yang sama bulan lalu, dijepit akhir bulan', () => {
    expect(p('bulan_ini')).toMatchObject({ dari: '2026-09-01', sampai: '2026-09-01' })
    expect(p('bulan_ini', '2026-03-31')).toMatchObject({ dari: '2026-02-01', sampai: '2026-02-28' })
  })
  it('bulan_lalu: bulan penuh sebelumnya', () => {
    expect(p('bulan_lalu')).toMatchObject({ dari: '2026-08-01', sampai: '2026-08-31' })
  })
  it('rentang: rentang sama panjang tepat sebelumnya', () => {
    const r = resolvePeriode('rentang', KAMIS, { dari: '2026-09-21', sampai: '2026-09-23' })
    expect(periodePembanding('rentang', r)).toMatchObject({ dari: '2026-09-18', sampai: '2026-09-20' })
  })
})
```

- [ ] **Step 2: Jalankan — harus gagal**

Run: `cd apps/admin-dashboard && ./node_modules/.bin/vitest run src/lib/sukaBot/periode.test.ts` (bila `.bin` lokal tak ada: `../../node_modules/.bin/vitest run src/lib/sukaBot/periode.test.ts`)
Expected: FAIL `Failed to resolve import "./periode"`.

- [ ] **Step 3: Implementasi**

`periode.ts`:
```ts
import { addDaysStr, isDateStr } from '@/lib/ownerDashboardCache'

export type KodePeriode = 'hari_ini' | 'kemarin' | 'minggu_ini' | 'minggu_lalu' | 'bulan_ini' | 'bulan_lalu' | 'rentang'
export interface Periode { dari: string; sampai: string; label: string; berjalan: boolean }

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const NAMA: Record<KodePeriode, string> = {
  hari_ini: 'Hari ini', kemarin: 'Kemarin', minggu_ini: 'Minggu ini', minggu_lalu: 'Minggu lalu',
  bulan_ini: 'Bulan ini', bulan_lalu: 'Bulan lalu', rentang: 'Rentang',
}
const MAKS_HARI_RENTANG = 366

const hariKe = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay()
const senin = (ymd: string) => addDaysStr(ymd, -((hariKe(ymd) + 6) % 7))
const awalBulan = (ymd: string) => `${ymd.slice(0, 8)}01`
const selisihHari = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

export function labelTanggal(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return `${HARI[hariKe(ymd)]} ${d} ${BULAN[m - 1]} ${y}`
}

function buat(kode: KodePeriode, dari: string, sampai: string, berjalan: boolean): Periode {
  const rentang = dari === sampai ? labelTanggal(dari) : `${labelTanggal(dari)} – ${labelTanggal(sampai)}`
  return { dari, sampai, berjalan, label: `${NAMA[kode]} (${rentang})` }
}

export function resolvePeriode(kode: KodePeriode, hariIni: string, rentang?: { dari?: string; sampai?: string }): Periode {
  switch (kode) {
    case 'hari_ini': return buat(kode, hariIni, hariIni, true)
    case 'kemarin': { const k = addDaysStr(hariIni, -1); return buat(kode, k, k, false) }
    case 'minggu_ini': return buat(kode, senin(hariIni), hariIni, true)
    case 'minggu_lalu': { const s = addDaysStr(senin(hariIni), -7); return buat(kode, s, addDaysStr(s, 6), false) }
    case 'bulan_ini': return buat(kode, awalBulan(hariIni), hariIni, true)
    case 'bulan_lalu': { const akhir = addDaysStr(awalBulan(hariIni), -1); return buat(kode, awalBulan(akhir), akhir, false) }
    case 'rentang': {
      const dari = rentang?.dari
      const sampaiMinta = rentang?.sampai ?? rentang?.dari
      if (!isDateStr(dari) || !isDateStr(sampaiMinta)) throw new Error('Tanggal rentang tidak valid (format YYYY-MM-DD)')
      const sampai = sampaiMinta > hariIni ? hariIni : sampaiMinta
      if (dari > sampai) throw new Error('Tanggal awal setelah tanggal akhir')
      if (selisihHari(dari, sampai) + 1 > MAKS_HARI_RENTANG) throw new Error('Rentang maksimal 366 hari')
      return buat(kode, dari, sampai, sampai === hariIni)
    }
  }
}

export function periodePembanding(kode: KodePeriode, p: Periode): Periode {
  if (kode === 'bulan_ini') {
    const akhirLalu = addDaysStr(p.dari, -1)
    const dari = awalBulan(akhirLalu)
    const target = addDaysStr(dari, selisihHari(p.dari, p.sampai))
    return buat('rentang', dari, target > akhirLalu ? akhirLalu : target, false)
  }
  if (kode === 'bulan_lalu') {
    const akhir = addDaysStr(p.dari, -1)
    return buat('bulan_lalu', awalBulan(akhir), akhir, false)
  }
  if (kode === 'rentang') {
    const panjang = selisihHari(p.dari, p.sampai) + 1
    return buat('rentang', addDaysStr(p.dari, -panjang), addDaysStr(p.dari, -1), false)
  }
  return buat('rentang', addDaysStr(p.dari, -7), addDaysStr(p.sampai, -7), false)
}
```

- [ ] **Step 4: Jalankan — harus lulus**

Run perintah Step 2. Expected: PASS (semua test).

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/sukaBot/periode.ts apps/admin-dashboard/src/lib/sukaBot/periode.test.ts
git commit -m "feat(suka-bot): resolusi kata waktu ke rentang tanggal WIB"
```

---

### Task 3: Pencocokan nama outlet & bahan + format angka

**Files:**
- Create: `apps/admin-dashboard/src/lib/sukaBot/pencarian.ts`, `apps/admin-dashboard/src/lib/sukaBot/format.ts`
- Test: `apps/admin-dashboard/src/lib/sukaBot/pencarian.test.ts`, `apps/admin-dashboard/src/lib/sukaBot/format.test.ts`

**Interfaces:**
- Produces:
  - `type HasilCari<T> = { status: 'cocok'; item: T } | { status: 'ambigu'; kandidat: T[] } | { status: 'tidak_ada' }`
  - `normalisasiOutlet(s: string): string`, `normalisasiBahan(s: string): string`
  - `cariSatu<T>(kueri: string, daftar: T[], nama: (t: T) => string, normalisasi: (s: string) => string): HasilCari<T>`
  - `rupiah(n: number): string` → `'Rp 48.200.000'`
  - `persenPerubahan(baru: number, lama: number): number | null` (1 desimal; `null` bila lama = 0)
  - `teksPersen(p: number | null): string` → `'+6,2%'`, `'-3%'`, `'—'`
  - `jamWib(d: Date): string` → `'14:30'`; `jamWibAngka(d: Date): number`

- [ ] **Step 1: Tulis test gagal**

`pencarian.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { cariSatu, normalisasiOutlet, normalisasiBahan } from './pencarian'

const OUTLETS = ['SUKA SHAWARMA BEJI', 'SUKA SHAWARMA DEPOK SUKMAJAYA', 'MITRA CIBUBUR', 'MITRA SAWANGAN DTC', 'MITRA CIBINONG']
const cariO = (q: string) => cariSatu(q, OUTLETS, (s) => s, normalisasiOutlet)

describe('cari outlet', () => {
  it('cocok tanpa awalan merek', () => {
    expect(cariO('beji')).toEqual({ status: 'cocok', item: 'SUKA SHAWARMA BEJI' })
    expect(cariO('Mitra Cibubur')).toEqual({ status: 'cocok', item: 'MITRA CIBUBUR' })
    expect(cariO('depok')).toEqual({ status: 'cocok', item: 'SUKA SHAWARMA DEPOK SUKMAJAYA' })
    expect(cariO('sawangan')).toEqual({ status: 'cocok', item: 'MITRA SAWANGAN DTC' })
  })
  it('ambigu bila lebih dari satu kecocokan sebagian', () => {
    expect(cariO('cib')).toEqual({ status: 'ambigu', kandidat: ['MITRA CIBUBUR', 'MITRA CIBINONG'] })
  })
  it('tidak_ada', () => {
    expect(cariO('bandung')).toEqual({ status: 'tidak_ada' })
    expect(cariO('   ')).toEqual({ status: 'tidak_ada' })
  })
})

const BAHAN = ['SAOS CABE', 'SAOS CABE POUCH', 'SAPI', 'AYAM', 'KENTANG']
const cariB = (q: string) => cariSatu(q, BAHAN, (s) => s, normalisasiBahan)

describe('cari bahan', () => {
  it('nama persis menang atas kecocokan sebagian', () => {
    expect(cariB('saos cabe')).toEqual({ status: 'cocok', item: 'SAOS CABE' })
  })
  it('kata sebagian yang ambigu → tanya balik', () => {
    expect(cariB('cabe')).toEqual({ status: 'ambigu', kandidat: ['SAOS CABE', 'SAOS CABE POUCH'] })
  })
  it('huruf besar/kecil & spasi diabaikan', () => {
    expect(cariB('  Sapi ')).toEqual({ status: 'cocok', item: 'SAPI' })
  })
})
```

`format.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { rupiah, persenPerubahan, teksPersen, jamWib, jamWibAngka } from './format'

describe('format', () => {
  it('rupiah dengan titik ribuan, dibulatkan', () => {
    expect(rupiah(48200000)).toBe('Rp 48.200.000')
    expect(rupiah(1234.6)).toBe('Rp 1.235')
    expect(rupiah(0)).toBe('Rp 0')
  })
  it('persen perubahan 1 desimal, null bila pembanding nol', () => {
    expect(persenPerubahan(106, 100)).toBe(6)
    expect(persenPerubahan(90, 120)).toBe(-25)
    expect(persenPerubahan(5, 0)).toBeNull()
  })
  it('teks persen', () => {
    expect(teksPersen(6.2)).toBe('+6,2%')
    expect(teksPersen(-3)).toBe('-3%')
    expect(teksPersen(0)).toBe('0%')
    expect(teksPersen(null)).toBe('—')
  })
  it('jam WIB', () => {
    const d = new Date('2026-10-01T07:30:00Z') // 14:30 WIB
    expect(jamWib(d)).toBe('14:30')
    expect(jamWibAngka(d)).toBe(14)
  })
})
```

- [ ] **Step 2: Jalankan — harus gagal**

Run: `cd apps/admin-dashboard && ../../node_modules/.bin/vitest run src/lib/sukaBot/pencarian.test.ts src/lib/sukaBot/format.test.ts`
Expected: FAIL import tidak ditemukan.

- [ ] **Step 3: Implementasi**

`pencarian.ts`:
```ts
export type HasilCari<T> = { status: 'cocok'; item: T } | { status: 'ambigu'; kandidat: T[] } | { status: 'tidak_ada' }

const rapikan = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()

/** Nama outlet tanpa awalan merek ("SUKA SHAWARMA", "MITRA", "SS"), supaya "beji" cocok. */
export function normalisasiOutlet(s: string): string {
  return rapikan(rapikan(s).replace(/\bsuka shawarma\b|\bmitra\b|\bss\b/g, ' '))
}

export function normalisasiBahan(s: string): string {
  return rapikan(s)
}

export function cariSatu<T>(kueri: string, daftar: T[], nama: (t: T) => string, normalisasi: (s: string) => string): HasilCari<T> {
  const q = normalisasi(kueri)
  if (!q) return { status: 'tidak_ada' }
  const persis = daftar.filter((t) => normalisasi(nama(t)) === q)
  if (persis.length === 1) return { status: 'cocok', item: persis[0] }
  if (persis.length > 1) return { status: 'ambigu', kandidat: persis }
  const kataQ = q.split(' ')
  const sebagian = daftar.filter((t) => {
    const n = normalisasi(nama(t))
    return kataQ.every((k) => n.includes(k))
  })
  if (sebagian.length === 1) return { status: 'cocok', item: sebagian[0] }
  if (sebagian.length > 1) return { status: 'ambigu', kandidat: sebagian }
  return { status: 'tidak_ada' }
}
```

`format.ts`:
```ts
export function rupiah(n: number): string {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`
}

export function persenPerubahan(baru: number, lama: number): number | null {
  if (!lama) return null
  return Math.round(((baru - lama) / lama) * 1000) / 10
}

export function teksPersen(p: number | null): string {
  if (p === null) return '—'
  const s = p.toLocaleString('id-ID', { maximumFractionDigits: 1 })
  return p > 0 ? `+${s}%` : `${s}%`
}

const FMT_JAM = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false })

export function jamWib(d: Date): string {
  return FMT_JAM.format(d)
}

export function jamWibAngka(d: Date): number {
  return Number(jamWib(d).slice(0, 2))
}
```

- [ ] **Step 4: Jalankan — harus lulus**

Run perintah Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/sukaBot/pencarian.ts apps/admin-dashboard/src/lib/sukaBot/pencarian.test.ts apps/admin-dashboard/src/lib/sukaBot/format.ts apps/admin-dashboard/src/lib/sukaBot/format.test.ts
git commit -m "feat(suka-bot): pencocokan nama outlet/bahan & format angka"
```

---

### Task 4: Alat penjualan (omzet, bandingkan, menu terlaris, ranking)

**Files:**
- Create: `apps/admin-dashboard/src/lib/sukaBot/alat/penjualan.ts`
- Test: `apps/admin-dashboard/src/lib/sukaBot/alat/penjualan.test.ts`

**Interfaces:**
- Consumes: Task 2 (`resolvePeriode`, `periodePembanding`, `KodePeriode`, `Periode`), Task 3 (`cariSatu`, `normalisasiOutlet`, `rupiah`, `persenPerubahan`, `teksPersen`, `jamWib`), `mapWithConcurrency` dari `@/lib/ownerDashboardCache`.
- Produces:
  - `interface RingkasanLaporan { omzetKotor: number; omzetBersih: number; transaksi: number; menu: { nama: string; qty: number; omzet: number }[] }`
  - `type AmbilLaporan = (r: { dari: string; sampai: string; outletIds: string[]; kanal: string[] }) => Promise<RingkasanLaporan>`
  - `interface OutletInfo { id: string; name: string; type: string; is_active: boolean }`
  - `interface KonteksPenjualan { ambilLaporan: AmbilLaporan; outlets: OutletInfo[]; hariIni: string; sekarang: Date }`
  - `const KANAL: Record<KodeKanal, { channels: string[]; label: string }>`; `type KodeKanal = 'semua' | 'kasir' | 'gofood' | 'grabfood' | 'shopeefood' | 'food_apps' | 'tiktok_go' | 'web'`
  - `interface ArgPeriode { periode: KodePeriode; dari?: string; sampai?: string }`
  - `alatOmzet(ctx, a: ArgPeriode & { outlet?: string; kanal?: KodeKanal })`
  - `alatBandingkan(ctx, a: ArgPeriode & { pembanding?: ArgPeriode; outlet?: string; kanal?: KodeKanal })`
  - `alatMenuTerlaris(ctx, a: ArgPeriode & { outlet?: string; kanal?: KodeKanal; urutan?: 'terlaris' | 'tersepi'; jumlah?: number })`
  - `alatRankingOutlet(ctx, a: ArgPeriode & { kanal?: KodeKanal; bandingkan?: boolean })`
  - `hitungRanking(ctx, p: Periode, pembanding: Periode | null, kanal: string[]): Promise<BarisRanking[]>` dengan `interface BarisRanking { peringkat: number; nama: string; omzet: number; omzetPembanding: number | null; persen: number | null }`
  - `outletTerhitung(outlets: OutletInfo[]): OutletInfo[]`
  - Semua alat mengembalikan objek dengan `status: 'ok' | 'ambigu' | 'tidak_ditemukan'`.

- [ ] **Step 1: Tulis test gagal**

`alat/penjualan.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import {
  alatOmzet, alatBandingkan, alatMenuTerlaris, alatRankingOutlet, outletTerhitung,
  type KonteksPenjualan, type OutletInfo, type RingkasanLaporan,
} from './penjualan'

const OUTLETS: OutletInfo[] = [
  { id: 'o-beji', name: 'SUKA SHAWARMA BEJI', type: 'outlet', is_active: true },
  { id: 'o-cbbr', name: 'MITRA CIBUBUR', type: 'mitra', is_active: true },
  { id: 'o-jati', name: 'SUKA SHAWARMA JATIASIH', type: 'outlet', is_active: false },
  { id: 'o-tes', name: 'outlet tes', type: 'test', is_active: true },
  { id: 'o-back', name: 'SS BACKUP', type: 'internal', is_active: true },
  { id: 'o-shp', name: 'Shopee', type: 'marketplace', is_active: true },
]

// Omzet palsu per outlet per tanggal awal periode — cukup untuk menguji perakitan.
const OMZET: Record<string, Record<string, number>> = {
  '2026-09-30': { 'o-beji': 1_000_000, 'o-cbbr': 3_000_000, 'o-jati': 0 },
  '2026-09-23': { 'o-beji': 800_000, 'o-cbbr': 3_000_000, 'o-jati': 0 },
}

function konteks(): KonteksPenjualan & { panggilan: any[] } {
  const panggilan: any[] = []
  const ambilLaporan = vi.fn(async (r: { dari: string; sampai: string; outletIds: string[]; kanal: string[] }): Promise<RingkasanLaporan> => {
    panggilan.push(r)
    const peta = OMZET[r.dari] ?? {}
    const omzet = r.outletIds.reduce((s, id) => s + (peta[id] ?? 0), 0)
    return {
      omzetKotor: omzet, omzetBersih: omzet * 0.9, transaksi: omzet / 50_000,
      menu: [{ nama: 'Original Sapi Jumbo', qty: 30, omzet: 900_000 }, { nama: 'Extra Keju', qty: 2, omzet: 14_000 }, { nama: 'Original Ayam Jumbo', qty: 12, omzet: 300_000 }],
    }
  })
  return { ambilLaporan, outlets: OUTLETS, hariIni: '2026-10-01', sekarang: new Date('2026-10-01T07:30:00Z'), panggilan }
}

describe('outletTerhitung', () => {
  it('hanya tipe outlet & mitra (daftar boleh)', () => {
    expect(outletTerhitung(OUTLETS).map((o) => o.id)).toEqual(['o-beji', 'o-cbbr', 'o-jati'])
  })
})

describe('alatOmzet', () => {
  it('semua outlet terhitung, omzet kotor, label & sumber', async () => {
    const ctx = konteks()
    const r: any = await alatOmzet(ctx, { periode: 'kemarin' })
    expect(ctx.panggilan[0]).toEqual({ dari: '2026-09-30', sampai: '2026-09-30', outletIds: ['o-beji', 'o-cbbr', 'o-jati'], kanal: ['all'] })
    expect(r).toMatchObject({ status: 'ok', omzet_kotor: 'Rp 4.000.000', omzet_kotor_angka: 4_000_000, transaksi: 80, sumber: 'Rangkuman Penjualan' })
    expect(r.periode).toBe('Kemarin (Rab 30 Sep 2026)')
    expect(r.cakupan).toBe('Semua outlet (3 outlet, tanpa SS Online)')
  })
  it('outlet tertentu + kanal', async () => {
    const ctx = konteks()
    const r: any = await alatOmzet(ctx, { periode: 'kemarin', outlet: 'beji', kanal: 'gofood' })
    expect(ctx.panggilan[0]).toMatchObject({ outletIds: ['o-beji'], kanal: ['gofood'] })
    expect(r).toMatchObject({ status: 'ok', cakupan: 'SUKA SHAWARMA BEJI', kanal: 'GoFood' })
  })
  it('outlet uji tidak bisa dipilih', async () => {
    const r: any = await alatOmzet(konteks(), { periode: 'kemarin', outlet: 'outlet tes' })
    expect(r.status).toBe('tidak_ditemukan')
  })
  it('periode berjalan diberi catatan jam', async () => {
    const r: any = await alatOmzet(konteks(), { periode: 'hari_ini' })
    expect(r.catatan).toBe('Angka berjalan sampai pukul 14:30 WIB.')
  })
})

describe('alatBandingkan', () => {
  it('pembanding otomatis = hari yang sama minggu lalu', async () => {
    const r: any = await alatBandingkan(konteks(), { periode: 'kemarin', outlet: 'beji' })
    expect(r).toMatchObject({
      status: 'ok',
      utama: { omzet_kotor: 'Rp 1.000.000' },
      pembanding: { omzet_kotor: 'Rp 800.000', periode: 'Rentang (Rab 23 Sep 2026)' },
      selisih: 'Rp 200.000',
      perubahan: '+25%',
    })
  })
})

describe('alatMenuTerlaris', () => {
  it('terlaris urut qty, dibatasi jumlah', async () => {
    const r: any = await alatMenuTerlaris(konteks(), { periode: 'kemarin', jumlah: 2 })
    expect(r.menu.map((m: any) => m.nama)).toEqual(['Original Sapi Jumbo', 'Original Ayam Jumbo'])
  })
  it('tersepi urut naik, hanya menu yang terjual', async () => {
    const r: any = await alatMenuTerlaris(konteks(), { periode: 'kemarin', urutan: 'tersepi', jumlah: 1 })
    expect(r.menu[0].nama).toBe('Extra Keju')
    expect(r.catatan).toContain('terjual minimal 1')
  })
})

describe('alatRankingOutlet', () => {
  it('urut omzet, outlet nonaktif tanpa omzet dibuang, perubahan vs minggu lalu', async () => {
    const r: any = await alatRankingOutlet(konteks(), { periode: 'kemarin' })
    expect(r.ranking.map((x: any) => [x.peringkat, x.nama, x.omzet, x.perubahan])).toEqual([
      [1, 'MITRA CIBUBUR', 'Rp 3.000.000', '0%'],
      [2, 'SUKA SHAWARMA BEJI', 'Rp 1.000.000', '+25%'],
    ])
  })
})
```

- [ ] **Step 2: Jalankan — harus gagal**

Run: `cd apps/admin-dashboard && ../../node_modules/.bin/vitest run src/lib/sukaBot/alat/penjualan.test.ts`
Expected: FAIL import tidak ditemukan.

- [ ] **Step 3: Implementasi**

`alat/penjualan.ts`:
```ts
import { mapWithConcurrency } from '@/lib/ownerDashboardCache'
import { resolvePeriode, periodePembanding, type KodePeriode, type Periode } from '../periode'
import { cariSatu, normalisasiOutlet } from '../pencarian'
import { rupiah, persenPerubahan, teksPersen, jamWib } from '../format'

export interface RingkasanLaporan { omzetKotor: number; omzetBersih: number; transaksi: number; menu: { nama: string; qty: number; omzet: number }[] }
export type AmbilLaporan = (r: { dari: string; sampai: string; outletIds: string[]; kanal: string[] }) => Promise<RingkasanLaporan>
export interface OutletInfo { id: string; name: string; type: string; is_active: boolean }
export interface KonteksPenjualan { ambilLaporan: AmbilLaporan; outlets: OutletInfo[]; hariIni: string; sekarang: Date }

export type KodeKanal = 'semua' | 'kasir' | 'gofood' | 'grabfood' | 'shopeefood' | 'food_apps' | 'tiktok_go' | 'web'
// Kunci = kunci channel Rangkuman Penjualan (computeAvailableChannels/isChannelSelected).
export const KANAL: Record<KodeKanal, { channels: string[]; label: string }> = {
  semua: { channels: ['all'], label: 'Semua kanal' },
  kasir: { channels: ['pos_kasir'], label: 'POS Kasir' },
  gofood: { channels: ['gofood'], label: 'GoFood' },
  grabfood: { channels: ['grabfood'], label: 'GrabFood' },
  shopeefood: { channels: ['shopeefood'], label: 'ShopeeFood' },
  food_apps: { channels: ['food_apps'], label: 'Food Apps (GoFood+GrabFood+ShopeeFood)' },
  tiktok_go: { channels: ['tiktokgo'], label: 'TikTok GO' },
  web: { channels: ['online'], label: 'Website Online' },
}

export interface ArgPeriode { periode: KodePeriode; dari?: string; sampai?: string }
export interface BarisRanking { peringkat: number; nama: string; omzet: number; omzetPembanding: number | null; persen: number | null }

const TIPE_TERHITUNG = new Set(['outlet', 'mitra'])
const KONKURENSI = 4
const SUMBER = 'Rangkuman Penjualan'

export function outletTerhitung(outlets: OutletInfo[]): OutletInfo[] {
  return outlets.filter((o) => TIPE_TERHITUNG.has(o.type))
}

const periodeDari = (ctx: KonteksPenjualan, a: ArgPeriode) => resolvePeriode(a.periode, ctx.hariIni, { dari: a.dari, sampai: a.sampai })
const catatanBerjalan = (ctx: KonteksPenjualan, p: Periode) => (p.berjalan ? `Angka berjalan sampai pukul ${jamWib(ctx.sekarang)} WIB.` : undefined)

type Cakupan = { ok: true; ids: string[]; label: string } | { ok: false; hasil: Record<string, unknown> }

function pilihCakupan(ctx: KonteksPenjualan, outlet?: string): Cakupan {
  const daftar = outletTerhitung(ctx.outlets)
  if (!outlet) return { ok: true, ids: daftar.map((o) => o.id), label: `Semua outlet (${daftar.length} outlet, tanpa SS Online)` }
  const h = cariSatu(outlet, daftar, (o) => o.name, normalisasiOutlet)
  if (h.status === 'cocok') return { ok: true, ids: [h.item.id], label: h.item.name }
  if (h.status === 'ambigu') return { ok: false, hasil: { status: 'ambigu', pesan: `Ada beberapa outlet yang cocok dengan "${outlet}". Tanyakan ke Bos yang mana.`, kandidat: h.kandidat.map((o) => o.name) } }
  return { ok: false, hasil: { status: 'tidak_ditemukan', pesan: `Outlet "${outlet}" tidak ditemukan di daftar outlet yang dihitung.`, outlet_tersedia: daftar.map((o) => o.name) } }
}

function ringkas(p: Periode, l: RingkasanLaporan) {
  return {
    periode: p.label,
    omzet_kotor: rupiah(l.omzetKotor),
    omzet_kotor_angka: Math.round(l.omzetKotor),
    omzet_bersih: rupiah(l.omzetBersih),
    transaksi: l.transaksi,
  }
}

export async function alatOmzet(ctx: KonteksPenjualan, a: ArgPeriode & { outlet?: string; kanal?: KodeKanal }) {
  const p = periodeDari(ctx, a)
  const c = pilihCakupan(ctx, a.outlet)
  if (!c.ok) return c.hasil
  const kanal = KANAL[a.kanal ?? 'semua']
  const l = await ctx.ambilLaporan({ dari: p.dari, sampai: p.sampai, outletIds: c.ids, kanal: kanal.channels })
  return { status: 'ok', ...ringkas(p, l), cakupan: c.label, kanal: kanal.label, catatan: catatanBerjalan(ctx, p), sumber: SUMBER }
}

export async function alatBandingkan(ctx: KonteksPenjualan, a: ArgPeriode & { pembanding?: ArgPeriode; outlet?: string; kanal?: KodeKanal }) {
  const p = periodeDari(ctx, a)
  const q = a.pembanding ? periodeDari(ctx, a.pembanding) : periodePembanding(a.periode, p)
  const c = pilihCakupan(ctx, a.outlet)
  if (!c.ok) return c.hasil
  const kanal = KANAL[a.kanal ?? 'semua']
  const [lp, lq] = await Promise.all([
    ctx.ambilLaporan({ dari: p.dari, sampai: p.sampai, outletIds: c.ids, kanal: kanal.channels }),
    ctx.ambilLaporan({ dari: q.dari, sampai: q.sampai, outletIds: c.ids, kanal: kanal.channels }),
  ])
  return {
    status: 'ok',
    cakupan: c.label,
    kanal: kanal.label,
    utama: ringkas(p, lp),
    pembanding: ringkas(q, lq),
    selisih: rupiah(lp.omzetKotor - lq.omzetKotor),
    perubahan: teksPersen(persenPerubahan(lp.omzetKotor, lq.omzetKotor)),
    catatan: catatanBerjalan(ctx, p),
    sumber: SUMBER,
  }
}

export async function alatMenuTerlaris(ctx: KonteksPenjualan, a: ArgPeriode & { outlet?: string; kanal?: KodeKanal; urutan?: 'terlaris' | 'tersepi'; jumlah?: number }) {
  const p = periodeDari(ctx, a)
  const c = pilihCakupan(ctx, a.outlet)
  if (!c.ok) return c.hasil
  const kanal = KANAL[a.kanal ?? 'semua']
  const l = await ctx.ambilLaporan({ dari: p.dari, sampai: p.sampai, outletIds: c.ids, kanal: kanal.channels })
  const jumlah = Math.min(20, Math.max(1, a.jumlah ?? 5))
  const tersepi = a.urutan === 'tersepi'
  const urut = [...l.menu].filter((m) => m.qty > 0).sort((x, y) => (tersepi ? x.qty - y.qty : y.qty - x.qty))
  return {
    status: 'ok',
    periode: p.label,
    cakupan: c.label,
    kanal: kanal.label,
    urutan: tersepi ? 'tersepi' : 'terlaris',
    menu: urut.slice(0, jumlah).map((m, i) => ({ peringkat: i + 1, nama: m.nama, terjual: m.qty, omzet_item: rupiah(m.omzet) })),
    catatan: [tersepi ? 'Hanya menu yang terjual minimal 1 porsi; menu yang tidak laku sama sekali tidak tercatat.' : undefined, catatanBerjalan(ctx, p)].filter(Boolean).join(' ') || undefined,
    sumber: SUMBER,
  }
}

export async function hitungRanking(ctx: KonteksPenjualan, p: Periode, pembanding: Periode | null, kanal: string[]): Promise<BarisRanking[]> {
  const daftar = outletTerhitung(ctx.outlets)
  const baris = await mapWithConcurrency(daftar, KONKURENSI, async (o) => {
    const [lp, lq] = await Promise.all([
      ctx.ambilLaporan({ dari: p.dari, sampai: p.sampai, outletIds: [o.id], kanal }),
      pembanding ? ctx.ambilLaporan({ dari: pembanding.dari, sampai: pembanding.sampai, outletIds: [o.id], kanal }) : Promise.resolve(null),
    ])
    return { o, omzet: lp.omzetKotor, omzetPembanding: lq ? lq.omzetKotor : null }
  })
  return baris
    .filter((b) => b.o.is_active || b.omzet > 0)
    .sort((x, y) => y.omzet - x.omzet)
    .map((b, i) => ({
      peringkat: i + 1,
      nama: b.o.name,
      omzet: b.omzet,
      omzetPembanding: b.omzetPembanding,
      persen: b.omzetPembanding === null ? null : persenPerubahan(b.omzet, b.omzetPembanding),
    }))
}

export async function alatRankingOutlet(ctx: KonteksPenjualan, a: ArgPeriode & { kanal?: KodeKanal; bandingkan?: boolean }) {
  const p = periodeDari(ctx, a)
  const q = a.bandingkan === false ? null : periodePembanding(a.periode, p)
  const kanal = KANAL[a.kanal ?? 'semua']
  const ranking = await hitungRanking(ctx, p, q, kanal.channels)
  return {
    status: 'ok',
    periode: p.label,
    pembanding: q?.label,
    kanal: kanal.label,
    ranking: ranking.map((r) => ({ peringkat: r.peringkat, nama: r.nama, omzet: rupiah(r.omzet), perubahan: q ? teksPersen(r.persen) : undefined })),
    catatan: catatanBerjalan(ctx, p),
    sumber: SUMBER,
  }
}
```

- [ ] **Step 4: Jalankan — harus lulus**

Run perintah Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/sukaBot/alat/penjualan.ts apps/admin-dashboard/src/lib/sukaBot/alat/penjualan.test.ts
git commit -m "feat(suka-bot): alat omzet, bandingkan, menu terlaris, ranking outlet"
```

---

### Task 5: Alat stok bahan

**Files:**
- Create: `apps/admin-dashboard/src/lib/sukaBot/alat/stok.ts`
- Test: `apps/admin-dashboard/src/lib/sukaBot/alat/stok.test.ts`

**Interfaces:**
- Consumes: Task 3 (`cariSatu`, `normalisasiBahan`, `normalisasiOutlet`), Task 4 (`OutletInfo`, `outletTerhitung`), `formatTriUnitSaldoAdaptive` dari `@/lib/format/compositeUnit`, `addDaysStr` dari `@/lib/ownerDashboardCache`.
- Produces:
  - `interface BahanInfo { id: string; nama: string; satuan: string; satuan_tengah: string | null; faktor_tengah: number | null; satuan_kecil: string | null; faktor_tampilan: number | null }`
  - `interface BarisStok { outlet_id: string; bahan_baku_id: string; current_qty: number; last_opname_date: string | null; saldo_is_gram: boolean }`
  - `interface KonteksStok { daftarBahan: () => Promise<BahanInfo[]>; barisStok: (bahanId: string) => Promise<BarisStok[]>; outlets: OutletInfo[]; hariIni: string }`
  - `const GUDANG_PUSAT_ID = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'`
  - `alatStokBahan(ctx: KonteksStok, a: { bahan: string; outlet?: string })`

- [ ] **Step 1: Tulis test gagal**

`alat/stok.test.ts`:
```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { alatStokBahan, GUDANG_PUSAT_ID, type KonteksStok } from './stok'
import { formatTriUnitSaldoAdaptive } from '@/lib/format/compositeUnit'

const SAPI = { id: 'b-sapi', nama: 'SAPI', satuan: 'Pack', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'gram', faktor_tampilan: 1000 }
const CABE = { id: 'b-cabe', nama: 'SAOS CABE', satuan: 'Dus', satuan_tengah: 'Kompan', faktor_tengah: 3, satuan_kecil: 'gram', faktor_tampilan: 16500 }
const CABE_P = { id: 'b-cabep', nama: 'SAOS CABE POUCH', satuan: 'Dus', satuan_tengah: 'Pouch', faktor_tengah: 12, satuan_kecil: 'gram', faktor_tampilan: 12000 }

function konteks(): KonteksStok {
  return {
    hariIni: '2026-10-03',
    outlets: [
      { id: 'o-beji', name: 'SUKA SHAWARMA BEJI', type: 'outlet', is_active: true },
      { id: 'o-emp', name: 'SUKA SHAWARMA EMPANG', type: 'outlet', is_active: true },
      { id: GUDANG_PUSAT_ID, name: 'GUDANG PUSAT (HQ)', type: 'office', is_active: true },
      { id: 'o-tes', name: 'outlet tes', type: 'test', is_active: true },
    ],
    daftarBahan: async () => [SAPI, CABE, CABE_P],
    barisStok: async (id) => id !== 'b-sapi' ? [] : [
      { outlet_id: 'o-beji', bahan_baku_id: 'b-sapi', current_qty: 12400, last_opname_date: '2026-10-02', saldo_is_gram: true },
      { outlet_id: 'o-emp', bahan_baku_id: 'b-sapi', current_qty: 3.5, last_opname_date: '2026-09-25', saldo_is_gram: false },
      { outlet_id: 'o-tes', bahan_baku_id: 'b-sapi', current_qty: 999, last_opname_date: null, saldo_is_gram: false },
      { outlet_id: GUDANG_PUSAT_ID, bahan_baku_id: 'b-sapi', current_qty: 40, last_opname_date: null, saldo_is_gram: false },
    ],
  }
}

describe('alatStokBahan', () => {
  it('semua lokasi: format sama dengan app Stok, outlet uji dibuang, opname terakhir & tanda tidak akurat', async () => {
    const r: any = await alatStokBahan(konteks(), { bahan: 'sapi' })
    expect(r.status).toBe('ok')
    expect(r.bahan).toBe('SAPI')
    expect(r.lokasi).toEqual([
      { lokasi: 'GUDANG PUSAT (HQ)', saldo_sistem: formatTriUnitSaldoAdaptive(40, false, 'Pack', null, null, 'gram', 1000), opname_terakhir: 'belum pernah', mungkin_tidak_akurat: true },
      { lokasi: 'SUKA SHAWARMA BEJI', saldo_sistem: formatTriUnitSaldoAdaptive(12400, true, 'Pack', null, null, 'gram', 1000), opname_terakhir: '2026-10-02 (1 hari lalu)', mungkin_tidak_akurat: false },
      { lokasi: 'SUKA SHAWARMA EMPANG', saldo_sistem: formatTriUnitSaldoAdaptive(3.5, false, 'Pack', null, null, 'gram', 1000), opname_terakhir: '2026-09-25 (8 hari lalu)', mungkin_tidak_akurat: true },
    ])
    expect(r.sumber).toContain('Stok')
  })
  it('satu outlet', async () => {
    const r: any = await alatStokBahan(konteks(), { bahan: 'sapi', outlet: 'beji' })
    expect(r.lokasi).toHaveLength(1)
    expect(r.lokasi[0].lokasi).toBe('SUKA SHAWARMA BEJI')
  })
  it('gudang pusat bisa ditanya', async () => {
    const r: any = await alatStokBahan(konteks(), { bahan: 'sapi', outlet: 'gudang' })
    expect(r.lokasi[0].lokasi).toBe('GUDANG PUSAT (HQ)')
  })
  it('nama bahan ambigu → tanya balik', async () => {
    const r: any = await alatStokBahan(konteks(), { bahan: 'cabe' })
    expect(r).toMatchObject({ status: 'ambigu', kandidat: ['SAOS CABE', 'SAOS CABE POUCH'] })
  })
  it('bahan tidak ditemukan', async () => {
    const r: any = await alatStokBahan(konteks(), { bahan: 'durian' })
    expect(r.status).toBe('tidak_ditemukan')
  })
})
```

- [ ] **Step 2: Jalankan — harus gagal**

Run: `cd apps/admin-dashboard && ../../node_modules/.bin/vitest run src/lib/sukaBot/alat/stok.test.ts`
Expected: FAIL import tidak ditemukan.

- [ ] **Step 3: Implementasi**

`alat/stok.ts`:
```ts
import { formatTriUnitSaldoAdaptive } from '@/lib/format/compositeUnit'
import { cariSatu, normalisasiBahan, normalisasiOutlet } from '../pencarian'
import { outletTerhitung, type OutletInfo } from './penjualan'

export interface BahanInfo { id: string; nama: string; satuan: string; satuan_tengah: string | null; faktor_tengah: number | null; satuan_kecil: string | null; faktor_tampilan: number | null }
export interface BarisStok { outlet_id: string; bahan_baku_id: string; current_qty: number; last_opname_date: string | null; saldo_is_gram: boolean }
export interface KonteksStok { daftarBahan: () => Promise<BahanInfo[]>; barisStok: (bahanId: string) => Promise<BarisStok[]>; outlets: OutletInfo[]; hariIni: string }

/** Gudang Pusat (type 'office') — dipakai trigger surat jalan; bukan outlet penjualan tapi lokasi stok sah. */
export const GUDANG_PUSAT_ID = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'
const BATAS_HARI_AKURAT = 3

const selisihHari = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

function lokasiStok(outlets: OutletInfo[]): OutletInfo[] {
  const gudang = outlets.filter((o) => o.id === GUDANG_PUSAT_ID)
  return [...gudang, ...outletTerhitung(outlets)]
}

export async function alatStokBahan(ctx: KonteksStok, a: { bahan: string; outlet?: string }) {
  const daftarBahan = await ctx.daftarBahan()
  const hb = cariSatu(a.bahan, daftarBahan, (b) => b.nama, normalisasiBahan)
  if (hb.status === 'ambigu') return { status: 'ambigu', pesan: `Ada beberapa bahan yang cocok dengan "${a.bahan}". Tanyakan ke Bos yang mana.`, kandidat: hb.kandidat.map((b) => b.nama) }
  if (hb.status === 'tidak_ada') return { status: 'tidak_ditemukan', pesan: `Bahan "${a.bahan}" tidak ditemukan di master bahan aktif.` }
  const bahan = hb.item

  const lokasi = lokasiStok(ctx.outlets)
  let dipilih = lokasi
  if (a.outlet) {
    const ho = cariSatu(a.outlet, lokasi, (o) => o.name, (s) => normalisasiOutlet(s).replace(/\bpusat\b|\bhq\b/g, '').trim())
    if (ho.status === 'ambigu') return { status: 'ambigu', pesan: `Ada beberapa lokasi yang cocok dengan "${a.outlet}".`, kandidat: ho.kandidat.map((o) => o.name) }
    if (ho.status === 'tidak_ada') return { status: 'tidak_ditemukan', pesan: `Lokasi "${a.outlet}" tidak ditemukan.` }
    dipilih = [ho.item]
  }
  const namaById = new Map(dipilih.map((o) => [o.id, o.name]))

  const baris = (await ctx.barisStok(bahan.id)).filter((b) => namaById.has(b.outlet_id))
  const hasil = baris
    .map((b) => {
      const hari = b.last_opname_date ? selisihHari(b.last_opname_date, ctx.hariIni) : null
      return {
        lokasi: namaById.get(b.outlet_id)!,
        saldo_sistem: formatTriUnitSaldoAdaptive(Number(b.current_qty) || 0, !!b.saldo_is_gram, bahan.satuan, bahan.satuan_tengah, bahan.faktor_tengah, bahan.satuan_kecil, bahan.faktor_tampilan),
        opname_terakhir: b.last_opname_date ? `${b.last_opname_date} (${hari} hari lalu)` : 'belum pernah',
        mungkin_tidak_akurat: hari === null || hari > BATAS_HARI_AKURAT,
      }
    })
    .sort((x, y) => x.lokasi.localeCompare(y.lokasi))

  return {
    status: 'ok',
    bahan: bahan.nama,
    lokasi: hasil,
    catatan: 'Saldo sistem = catatan aplikasi, benar sampai opname terakhir; bukan hitungan rak saat ini.',
    sumber: 'App Stok (Monitoring)',
  }
}
```

- [ ] **Step 4: Jalankan — harus lulus**

Run perintah Step 2. Expected: PASS.

- [ ] **Step 5: Tambah test penjaga paritas formatter**

Tambahkan ke `alat/stok.test.ts`:
```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('paritas formatter dengan app Stok', () => {
  it('kode compositeUnit admin-dashboard identik dengan app Stok (komentar diabaikan)', () => {
    const buangKomentar = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n')
    const admin = readFileSync(resolve(__dirname, '../../format/compositeUnit.ts'), 'utf8')
    const stok = readFileSync(resolve(__dirname, '../../../../../stok/src/lib/format/compositeUnit.ts'), 'utf8')
    expect(buangKomentar(admin)).toBe(buangKomentar(stok))
  })
})
```
Run perintah Step 2. Expected: PASS. (Bila suatu hari gagal: salin versi `apps/stok` ke admin-dashboard — app Stok adalah acuan.)

- [ ] **Step 6: Commit**

```bash
git add apps/admin-dashboard/src/lib/sukaBot/alat/stok.ts apps/admin-dashboard/src/lib/sukaBot/alat/stok.test.ts
git commit -m "feat(suka-bot): alat stok bahan per lokasi dengan format app Stok"
```

---

### Task 6: Registry alat + validasi parameter

**Files:**
- Create: `apps/admin-dashboard/src/lib/sukaBot/alat/registry.ts`
- Test: `apps/admin-dashboard/src/lib/sukaBot/alat/registry.test.ts`

**Interfaces:**
- Consumes: Task 4 & 5 semua `alat*`, `KonteksPenjualan`, `KonteksStok`.
- Produces:
  - `interface DefinisiAlat { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }`
  - `const DEFINISI_ALAT: DefinisiAlat[]` — nama: `omzet`, `bandingkan_periode`, `menu_terlaris`, `ranking_outlet`, `stok_bahan`, `catat_pertanyaan_gagal`
  - `interface DepsAlat { penjualan: KonteksPenjualan; stok: KonteksStok; catatGagal: (alasan: string) => Promise<void> }`
  - `jalankanAlat(nama: string, argumenJson: string, deps: DepsAlat): Promise<Record<string, unknown>>` — tidak pernah melempar; galat → `{ status: 'galat', pesan }`.

- [ ] **Step 1: Tulis test gagal**

`alat/registry.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { DEFINISI_ALAT, jalankanAlat, type DepsAlat } from './registry'

function deps(): DepsAlat {
  return {
    penjualan: {
      hariIni: '2026-10-01', sekarang: new Date('2026-10-01T07:30:00Z'),
      outlets: [{ id: 'o1', name: 'SUKA SHAWARMA BEJI', type: 'outlet', is_active: true }],
      ambilLaporan: vi.fn(async () => ({ omzetKotor: 100, omzetBersih: 90, transaksi: 2, menu: [] })),
    },
    stok: { hariIni: '2026-10-01', outlets: [], daftarBahan: async () => [], barisStok: async () => [] },
    catatGagal: vi.fn(async () => {}),
  }
}

describe('DEFINISI_ALAT', () => {
  it('enam alat dengan nama tetap', () => {
    expect(DEFINISI_ALAT.map((d) => d.function.name)).toEqual(['omzet', 'bandingkan_periode', 'menu_terlaris', 'ranking_outlet', 'stok_bahan', 'catat_pertanyaan_gagal'])
  })
})

describe('jalankanAlat', () => {
  it('meneruskan argumen valid', async () => {
    const r = await jalankanAlat('omzet', JSON.stringify({ periode: 'kemarin' }), deps())
    expect(r.status).toBe('ok')
  })
  it('argumen tidak valid → galat, tidak melempar', async () => {
    const r = await jalankanAlat('omzet', JSON.stringify({ periode: 'tahun_depan' }), deps())
    expect(r).toMatchObject({ status: 'galat' })
  })
  it('JSON rusak → galat', async () => {
    const r = await jalankanAlat('omzet', '{periode:', deps())
    expect(r).toMatchObject({ status: 'galat' })
  })
  it('nama alat tak dikenal → galat', async () => {
    const r = await jalankanAlat('hapus_semua', '{}', deps())
    expect(r).toMatchObject({ status: 'galat', pesan: 'Alat "hapus_semua" tidak ada' })
    expect(await jalankanAlat('constructor', '{}', deps())).toMatchObject({ status: 'galat' })
  })
  it('catat_pertanyaan_gagal memanggil catatGagal', async () => {
    const d = deps()
    const r = await jalankanAlat('catat_pertanyaan_gagal', JSON.stringify({ alasan: 'tanya laba' }), d)
    expect(d.catatGagal).toHaveBeenCalledWith('tanya laba')
    expect(r.status).toBe('ok')
  })
  it('galat dari alat ditangkap', async () => {
    const d = deps()
    d.penjualan.ambilLaporan = vi.fn(async () => { throw new Error('DB mati') })
    const r = await jalankanAlat('omzet', JSON.stringify({ periode: 'kemarin' }), d)
    expect(r).toMatchObject({ status: 'galat', pesan: 'DB mati' })
  })
})
```

- [ ] **Step 2: Jalankan — harus gagal**

Run: `cd apps/admin-dashboard && ../../node_modules/.bin/vitest run src/lib/sukaBot/alat/registry.test.ts`
Expected: FAIL import tidak ditemukan.

- [ ] **Step 3: Implementasi**

`alat/registry.ts`:
```ts
import { z } from 'zod'
import { alatOmzet, alatBandingkan, alatMenuTerlaris, alatRankingOutlet, type KonteksPenjualan } from './penjualan'
import { alatStokBahan, type KonteksStok } from './stok'

export interface DefinisiAlat { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }
export interface DepsAlat { penjualan: KonteksPenjualan; stok: KonteksStok; catatGagal: (alasan: string) => Promise<void> }

const KODE_PERIODE = ['hari_ini', 'kemarin', 'minggu_ini', 'minggu_lalu', 'bulan_ini', 'bulan_lalu', 'rentang'] as const
const KODE_KANAL = ['semua', 'kasir', 'gofood', 'grabfood', 'shopeefood', 'food_apps', 'tiktok_go', 'web'] as const
const TGL = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const zPeriode = { periode: z.enum(KODE_PERIODE), dari: TGL.optional(), sampai: TGL.optional() }
const zOutlet = z.string().min(1).max(60).optional()
const zKanal = z.enum(KODE_KANAL).optional()

const SKEMA = {
  omzet: z.object({ ...zPeriode, outlet: zOutlet, kanal: zKanal }),
  bandingkan_periode: z.object({ ...zPeriode, pembanding: z.object(zPeriode).optional(), outlet: zOutlet, kanal: zKanal }),
  menu_terlaris: z.object({ ...zPeriode, outlet: zOutlet, kanal: zKanal, urutan: z.enum(['terlaris', 'tersepi']).optional(), jumlah: z.number().int().min(1).max(20).optional() }),
  ranking_outlet: z.object({ ...zPeriode, kanal: zKanal, bandingkan: z.boolean().optional() }),
  stok_bahan: z.object({ bahan: z.string().min(1).max(60), outlet: zOutlet }),
  catat_pertanyaan_gagal: z.object({ alasan: z.string().min(1).max(300) }),
} as const

const jsonPeriode = {
  periode: { type: 'string', enum: KODE_PERIODE, description: 'Kata waktu. Pakai "rentang" + dari/sampai hanya bila Bos menyebut tanggal persis.' },
  dari: { type: 'string', description: 'YYYY-MM-DD, hanya untuk periode "rentang"' },
  sampai: { type: 'string', description: 'YYYY-MM-DD, hanya untuk periode "rentang"' },
}
const jsonOutlet = { outlet: { type: 'string', description: 'Nama outlet seperti diucapkan Bos (mis. "beji", "cibubur"). Kosongkan untuk semua outlet.' } }
const jsonKanal = { kanal: { type: 'string', enum: KODE_KANAL, description: 'Kanal penjualan. Default semua.' } }

const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[]): DefinisiAlat =>
  ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } } })

export const DEFINISI_ALAT: DefinisiAlat[] = [
  fn('omzet', 'Omzet kotor, omzet bersih, dan jumlah transaksi untuk satu periode, semua outlet atau satu outlet, opsional per kanal.', { ...jsonPeriode, ...jsonOutlet, ...jsonKanal }, ['periode']),
  fn('bandingkan_periode', 'Bandingkan omzet dua periode. Tanpa "pembanding", otomatis dibandingkan dengan rentang sama panjang sebelumnya (harian/mingguan: 7 hari sebelumnya).', { ...jsonPeriode, pembanding: { type: 'object', properties: jsonPeriode, required: ['periode'] }, ...jsonOutlet, ...jsonKanal }, ['periode']),
  fn('menu_terlaris', 'Menu paling laku atau paling sepi berdasarkan jumlah porsi terjual.', { ...jsonPeriode, ...jsonOutlet, ...jsonKanal, urutan: { type: 'string', enum: ['terlaris', 'tersepi'] }, jumlah: { type: 'integer', minimum: 1, maximum: 20 } }, ['periode']),
  fn('ranking_outlet', 'Peringkat semua outlet berdasarkan omzet kotor, beserta perubahan dibanding periode sebelumnya.', { ...jsonPeriode, ...jsonKanal, bandingkan: { type: 'boolean' } }, ['periode']),
  fn('stok_bahan', 'Saldo stok sistem satu bahan baku di semua lokasi atau satu lokasi, beserta tanggal opname terakhir.', { bahan: { type: 'string', description: 'Nama bahan seperti diucapkan Bos (mis. "sapi", "saos cabe")' }, ...jsonOutlet }, ['bahan']),
  fn('catat_pertanyaan_gagal', 'Panggil SEBELUM menjawab bila pertanyaan Bos tidak bisa dijawab dengan alat lain (mis. laba, HPP, gaji, absensi).', { alasan: { type: 'string', description: 'Ringkasan singkat apa yang ditanyakan dan kenapa tidak bisa' } }, ['alasan']),
]

export async function jalankanAlat(nama: string, argumenJson: string, deps: DepsAlat): Promise<Record<string, unknown>> {
  try {
    // Object.hasOwn, bukan `in`: "constructor"/"toString" tidak boleh lolos sebagai nama alat.
    if (!Object.hasOwn(SKEMA, nama)) return { status: 'galat', pesan: `Alat "${nama}" tidak ada` }
    let mentah: unknown
    try { mentah = JSON.parse(argumenJson || '{}') } catch { return { status: 'galat', pesan: 'Argumen alat bukan JSON yang valid' } }
    const hasil = SKEMA[nama as keyof typeof SKEMA].safeParse(mentah)
    if (!hasil.success) return { status: 'galat', pesan: `Argumen tidak valid: ${hasil.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}` }
    const a: any = hasil.data
    switch (nama) {
      case 'omzet': return await alatOmzet(deps.penjualan, a)
      case 'bandingkan_periode': return await alatBandingkan(deps.penjualan, a)
      case 'menu_terlaris': return await alatMenuTerlaris(deps.penjualan, a)
      case 'ranking_outlet': return await alatRankingOutlet(deps.penjualan, a)
      case 'stok_bahan': return await alatStokBahan(deps.stok, a)
      case 'catat_pertanyaan_gagal': await deps.catatGagal(a.alasan); return { status: 'ok' }
    }
    return { status: 'galat', pesan: `Alat "${nama}" tidak ada` }
  } catch (e: any) {
    return { status: 'galat', pesan: e?.message ?? 'Galat tak dikenal' }
  }
}
```

- [ ] **Step 4: Jalankan — harus lulus**

Run perintah Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/sukaBot/alat/registry.ts apps/admin-dashboard/src/lib/sukaBot/alat/registry.test.ts
git commit -m "feat(suka-bot): registry alat dengan validasi zod"
```

---

### Task 7: Klien LLM, prompt sistem, putaran agen

**Files:**
- Create: `apps/admin-dashboard/src/lib/sukaBot/llm.ts`, `apps/admin-dashboard/src/lib/sukaBot/prompt.ts`, `apps/admin-dashboard/src/lib/sukaBot/agen.ts`
- Test: `apps/admin-dashboard/src/lib/sukaBot/llm.test.ts`, `apps/admin-dashboard/src/lib/sukaBot/agen.test.ts`

**Interfaces:**
- Consumes: Task 6 (`DEFINISI_ALAT`, `DefinisiAlat`), Task 2 (`labelTanggal`), Task 3 (`jamWib`).
- Produces:
  - `interface PanggilanAlat { id: string; type: 'function'; function: { name: string; arguments: string } }`
  - `interface PesanLLM { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_calls?: PanggilanAlat[]; tool_call_id?: string }`
  - `type PanggilLLM = (pesan: PesanLLM[], alat: DefinisiAlat[]) => Promise<{ pesan: PesanLLM; tokenMasuk: number; tokenKeluar: number }>`
  - `buatPanggilLLM(env?: { AI_BASE_URL?: string; AI_API_KEY?: string; AI_MODEL?: string }, fetchFn?: typeof fetch): PanggilLLM`
  - `buatPromptSistem(hariIni: string, sekarang: Date, namaPengguna: string): string`
  - `jalankanAgen(o: { sistem: string; riwayat: PesanLLM[]; pertanyaan: string; panggilLLM: PanggilLLM; jalankan: (nama: string, argumen: string) => Promise<Record<string, unknown>>; maksPutaran?: number }): Promise<{ jawaban: string; tokenMasuk: number; tokenKeluar: number; alatDipakai: string[]; habisPutaran: boolean }>`

- [ ] **Step 1: Tulis test gagal**

`llm.test.ts`:
```ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { buatPanggilLLM } from './llm'

describe('buatPanggilLLM', () => {
  it('gagal jelas bila env belum diisi', () => {
    expect(() => buatPanggilLLM({})).toThrow('AI_BASE_URL/AI_API_KEY/AI_MODEL belum diisi')
  })
  it('POST /chat/completions dengan model, tools, suhu rendah; membaca pesan & token', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { role: 'assistant', content: 'halo' } }],
      usage: { prompt_tokens: 12, completion_tokens: 3 },
    }), { status: 200 }))
    const panggil = buatPanggilLLM({ AI_BASE_URL: 'http://9router:20128/v1/', AI_API_KEY: 'k', AI_MODEL: 'm' }, fetchFn as any)
    const r = await panggil([{ role: 'user', content: 'hai' }], [])
    const [url, init] = fetchFn.mock.calls[0] as any
    expect(url).toBe('http://9router:20128/v1/chat/completions')
    expect(init.headers.Authorization).toBe('Bearer k')
    expect(JSON.parse(init.body)).toMatchObject({ model: 'm', temperature: 0.2, messages: [{ role: 'user', content: 'hai' }] })
    expect(JSON.parse(init.body).tools).toBeUndefined()
    expect(r).toEqual({ pesan: { role: 'assistant', content: 'halo' }, tokenMasuk: 12, tokenKeluar: 3 })
  })
  it('HTTP gagal → error', async () => {
    const fetchFn = vi.fn(async () => new Response('limit', { status: 429 }))
    const panggil = buatPanggilLLM({ AI_BASE_URL: 'http://x/v1', AI_API_KEY: 'k', AI_MODEL: 'm' }, fetchFn as any)
    await expect(panggil([], [])).rejects.toThrow('LLM HTTP 429')
  })
})
```

`agen.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { jalankanAgen, type PanggilLLM } from './agen'

describe('jalankanAgen', () => {
  it('menjalankan alat lalu mengembalikan jawaban akhir', async () => {
    const urutan = [
      { pesan: { role: 'assistant' as const, content: null, tool_calls: [{ id: 'c1', type: 'function' as const, function: { name: 'omzet', arguments: '{"periode":"kemarin"}' } }] }, tokenMasuk: 100, tokenKeluar: 10 },
      { pesan: { role: 'assistant' as const, content: 'Omzet kemarin Rp 4.000.000, Bos.' }, tokenMasuk: 150, tokenKeluar: 20 },
    ]
    const panggilLLM: PanggilLLM = vi.fn(async () => urutan.shift()!)
    const jalankan = vi.fn(async () => ({ status: 'ok', omzet_kotor: 'Rp 4.000.000' }))
    const r = await jalankanAgen({ sistem: 'S', riwayat: [], pertanyaan: 'omzet kemarin?', panggilLLM, jalankan })
    expect(jalankan).toHaveBeenCalledWith('omzet', '{"periode":"kemarin"}')
    expect(r).toEqual({ jawaban: 'Omzet kemarin Rp 4.000.000, Bos.', tokenMasuk: 250, tokenKeluar: 30, alatDipakai: ['omzet'], habisPutaran: false })
    const pesanKedua = (panggilLLM as any).mock.calls[1][0]
    expect(pesanKedua.at(-1)).toEqual({ role: 'tool', tool_call_id: 'c1', content: JSON.stringify({ status: 'ok', omzet_kotor: 'Rp 4.000.000' }) })
    expect(pesanKedua[0]).toEqual({ role: 'system', content: 'S' })
  })
  it('berhenti setelah maksPutaran', async () => {
    const panggilLLM: PanggilLLM = vi.fn(async () => ({ pesan: { role: 'assistant' as const, content: null, tool_calls: [{ id: 'c', type: 'function' as const, function: { name: 'omzet', arguments: '{}' } }] }, tokenMasuk: 1, tokenKeluar: 1 }))
    const r = await jalankanAgen({ sistem: 'S', riwayat: [], pertanyaan: '?', panggilLLM, jalankan: async () => ({ status: 'galat' }), maksPutaran: 2 })
    expect(r.habisPutaran).toBe(true)
    expect(r.jawaban).toContain('belum bisa')
    expect(panggilLLM).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Jalankan — harus gagal**

Run: `cd apps/admin-dashboard && ../../node_modules/.bin/vitest run src/lib/sukaBot/llm.test.ts src/lib/sukaBot/agen.test.ts`
Expected: FAIL import tidak ditemukan.

- [ ] **Step 3: Implementasi**

`llm.ts`:
```ts
import type { DefinisiAlat } from './alat/registry'

export interface PanggilanAlat { id: string; type: 'function'; function: { name: string; arguments: string } }
export interface PesanLLM { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_calls?: PanggilanAlat[]; tool_call_id?: string }
export type PanggilLLM = (pesan: PesanLLM[], alat: DefinisiAlat[]) => Promise<{ pesan: PesanLLM; tokenMasuk: number; tokenKeluar: number }>

const BATAS_WAKTU_MS = 60_000

/** Klien endpoint OpenAI-compatible (9Router). Tanpa SDK — tidak menambah dependency. */
export function buatPanggilLLM(
  env: { AI_BASE_URL?: string; AI_API_KEY?: string; AI_MODEL?: string } = process.env,
  fetchFn: typeof fetch = fetch
): PanggilLLM {
  const base = env.AI_BASE_URL?.replace(/\/+$/, '')
  const key = env.AI_API_KEY
  const model = env.AI_MODEL
  if (!base || !key || !model) throw new Error('AI_BASE_URL/AI_API_KEY/AI_MODEL belum diisi')

  return async (pesan, alat) => {
    const res = await fetchFn(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: pesan,
        temperature: 0.2,
        ...(alat.length > 0 ? { tools: alat, tool_choice: 'auto' } : {}),
      }),
      signal: AbortSignal.timeout(BATAS_WAKTU_MS),
    })
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`)
    const json: any = await res.json()
    const m = json?.choices?.[0]?.message
    if (!m) throw new Error('LLM: respons tanpa pesan')
    const keluar: PesanLLM = { role: 'assistant', content: m.content ?? null }
    if (Array.isArray(m.tool_calls) && m.tool_calls.length > 0) keluar.tool_calls = m.tool_calls
    return { pesan: keluar, tokenMasuk: Number(json?.usage?.prompt_tokens) || 0, tokenKeluar: Number(json?.usage?.completion_tokens) || 0 }
  }
}
```

`prompt.ts`:
```ts
import { labelTanggal } from './periode'
import { jamWib } from './format'

export function buatPromptSistem(hariIni: string, sekarang: Date, namaPengguna: string): string {
  return [
    'Kamu adalah SUKA Bot, asisten data bisnis Suka Shawarma (jaringan outlet shawarma: outlet milik + outlet mitra).',
    `Kamu sedang mengobrol dengan ${namaPengguna}. Panggil dia "Bos". Bahasa Indonesia santai, singkat, ramah. Emoji secukupnya.`,
    `Hari ini ${labelTanggal(hariIni)}, pukul ${jamWib(sekarang)} WIB.`,
    '',
    'ATURAN WAJIB:',
    '1. Semua angka HARUS berasal dari hasil alat. Jangan pernah menebak, membulatkan sendiri, atau menghitung angka baru (kecuali menyalin selisih/persen yang sudah diberikan alat).',
    '2. Angka dulu, baru cerita. Selalu sebut periode (tanggal persis dari field "periode") dan sumbernya (field "sumber").',
    '3. Jika alat mengembalikan status "ambigu", tanyakan balik ke Bos pilihan mana, sebutkan kandidatnya. Jangan memilih sendiri.',
    '4. Jika alat mengembalikan "catatan", sampaikan catatannya (mis. angka berjalan, stok mungkin tidak akurat).',
    '5. Jangan menyimpulkan penyebab yang tidak ada di data. Boleh menyebut kemungkinan, tapi tegaskan itu dugaan.',
    '6. Kamu HANYA bisa membaca. Jangan pernah mengaku sudah mengubah, menutup, menyetujui, atau mengirim apa pun.',
    '7. Kamu hanya bisa menjawab soal penjualan (omzet, perbandingan periode, menu terlaris/tersepi, ranking outlet) dan stok bahan baku. Untuk hal lain (laba, HPP, waste, gaji, absensi, utang, dll): panggil alat catat_pertanyaan_gagal, lalu bilang jujur belum bisa dan sarankan halaman aplikasi yang relevan.',
    '8. Kata waktu: minggu dimulai hari Senin. Pakai periode "rentang" hanya jika Bos menyebut tanggal persis.',
    '9. Omzet yang dipakai default = omzet kotor. Sebut omzet bersih hanya bila Bos memintanya.',
  ].join('\n')
}
```

`agen.ts`:
```ts
import { DEFINISI_ALAT } from './alat/registry'
import type { PanggilLLM, PesanLLM } from './llm'

export type { PanggilLLM, PesanLLM } from './llm'

const JAWABAN_HABIS_PUTARAN = 'Maaf Bos, pertanyaan ini belum bisa saya jawab dengan tuntas. Coba dipecah jadi pertanyaan yang lebih sederhana ya.'

export async function jalankanAgen(o: {
  sistem: string
  riwayat: PesanLLM[]
  pertanyaan: string
  panggilLLM: PanggilLLM
  jalankan: (nama: string, argumen: string) => Promise<Record<string, unknown>>
  maksPutaran?: number
}) {
  const maks = o.maksPutaran ?? 6
  const pesan: PesanLLM[] = [{ role: 'system', content: o.sistem }, ...o.riwayat, { role: 'user', content: o.pertanyaan }]
  let tokenMasuk = 0
  let tokenKeluar = 0
  const alatDipakai: string[] = []

  for (let putaran = 0; putaran < maks; putaran++) {
    const r = await o.panggilLLM(pesan, DEFINISI_ALAT)
    tokenMasuk += r.tokenMasuk
    tokenKeluar += r.tokenKeluar
    const panggilan = r.pesan.tool_calls ?? []
    if (panggilan.length === 0) {
      return { jawaban: (r.pesan.content ?? '').trim(), tokenMasuk, tokenKeluar, alatDipakai, habisPutaran: false }
    }
    pesan.push(r.pesan)
    for (const p of panggilan) {
      alatDipakai.push(p.function.name)
      const hasil = await o.jalankan(p.function.name, p.function.arguments)
      pesan.push({ role: 'tool', tool_call_id: p.id, content: JSON.stringify(hasil) })
    }
  }
  return { jawaban: JAWABAN_HABIS_PUTARAN, tokenMasuk, tokenKeluar, alatDipakai, habisPutaran: true }
}
```

- [ ] **Step 4: Jalankan — harus lulus**

Run perintah Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/sukaBot/llm.ts apps/admin-dashboard/src/lib/sukaBot/llm.test.ts apps/admin-dashboard/src/lib/sukaBot/prompt.ts apps/admin-dashboard/src/lib/sukaBot/agen.ts apps/admin-dashboard/src/lib/sukaBot/agen.test.ts
git commit -m "feat(suka-bot): klien LLM OpenAI-compatible, prompt sistem, putaran agen"
```

---

### Task 8: Rekap harian (data + teks template)

**Files:**
- Create: `apps/admin-dashboard/src/lib/sukaBot/rekap.ts`
- Test: `apps/admin-dashboard/src/lib/sukaBot/rekap.test.ts`

**Interfaces:**
- Consumes: Task 4 (`KonteksPenjualan`, `hitungRanking`, `outletTerhitung`, `BarisRanking`), Task 2 (`labelTanggal`), Task 3 (`rupiah`, `persenPerubahan`, `teksPersen`, `jamWibAngka`), `addDaysStr`, `jakartaDate`.
- Produces:
  - `interface DataRekap { tanggal: string; pembanding: string; omzet: number; omzetPembanding: number; persen: number | null; transaksi: number; ranking: BarisRanking[]; menuTeratas: { nama: string; qty: number }[] }`
  - `tanggalRekapUntuk(sekarang: Date): string` — sebelum 05:00 WIB → H-2, selain itu H-1.
  - `hitungRekap(ctx: KonteksPenjualan, tanggal: string): Promise<DataRekap>`
  - `teksRekap(d: DataRekap): string`

- [ ] **Step 1: Tulis test gagal**

`rekap.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { tanggalRekapUntuk, hitungRekap, teksRekap, type DataRekap } from './rekap'

describe('tanggalRekapUntuk', () => {
  it('sebelum 05:00 WIB → H-2', () => {
    expect(tanggalRekapUntuk(new Date('2026-10-02T21:59:00Z'))).toBe('2026-10-01') // Sab 04:59 WIB 3 Okt
  })
  it('mulai 05:00 WIB → H-1', () => {
    expect(tanggalRekapUntuk(new Date('2026-10-02T22:00:00Z'))).toBe('2026-10-02') // Sab 05:00 WIB 3 Okt
  })
})

describe('hitungRekap', () => {
  it('total, transaksi, menu teratas dari semua outlet terhitung; ranking vs H-7', async () => {
    const ambilLaporan = vi.fn(async (r: any) => {
      const hari = r.dari === '2026-10-02' ? 1 : 0.5
      const omzet = r.outletIds.length * 1_000_000 * hari
      return { omzetKotor: omzet, omzetBersih: omzet, transaksi: r.outletIds.length * 20, menu: [{ nama: 'A', qty: 5, omzet: 1 }, { nama: 'B', qty: 9, omzet: 1 }, { nama: 'C', qty: 7, omzet: 1 }, { nama: 'D', qty: 1, omzet: 1 }] }
    })
    const d = await hitungRekap({
      ambilLaporan, hariIni: '2026-10-03', sekarang: new Date(),
      outlets: [
        { id: 'a', name: 'SUKA SHAWARMA BEJI', type: 'outlet', is_active: true },
        { id: 'b', name: 'MITRA CIBUBUR', type: 'mitra', is_active: true },
        { id: 't', name: 'outlet tes', type: 'test', is_active: true },
      ],
    }, '2026-10-02')
    expect(d).toMatchObject({ tanggal: '2026-10-02', pembanding: '2026-09-25', omzet: 2_000_000, omzetPembanding: 1_000_000, persen: 100, transaksi: 40 })
    expect(d.menuTeratas).toEqual([{ nama: 'B', qty: 9 }, { nama: 'C', qty: 7 }, { nama: 'A', qty: 5 }])
    expect(d.ranking).toHaveLength(2)
    expect(ambilLaporan).toHaveBeenCalledWith({ dari: '2026-10-02', sampai: '2026-10-02', outletIds: ['a', 'b'], kanal: ['all'] })
  })
})

describe('teksRekap', () => {
  it('menyusun rekap lengkap tanpa AI', () => {
    const d: DataRekap = {
      tanggal: '2026-10-02', pembanding: '2026-09-25', omzet: 48_200_000, omzetPembanding: 51_300_000, persen: -6, transaksi: 1240,
      ranking: [
        { peringkat: 1, nama: 'MITRA CIBUBUR', omzet: 6_100_000, omzetPembanding: 5_000_000, persen: 22 },
        { peringkat: 2, nama: 'SUKA SHAWARMA BEJI', omzet: 4_000_000, omzetPembanding: null, persen: null },
      ],
      menuTeratas: [{ nama: 'Original Sapi Jumbo', qty: 310 }],
    }
    expect(teksRekap(d)).toBe([
      'Rekap penjualan Jum 2 Okt 2026, Bos 👋',
      '',
      'Omzet kotor: Rp 48.200.000 (-6% vs Jum 25 Sep 2026: Rp 51.300.000)',
      'Transaksi: 1.240',
      '',
      'Ranking outlet:',
      '1. MITRA CIBUBUR — Rp 6.100.000 (+22%)',
      '2. SUKA SHAWARMA BEJI — Rp 4.000.000 (—)',
      '',
      'Menu terlaris:',
      '1. Original Sapi Jumbo — 310 porsi',
      '',
      'Sumber: Rangkuman Penjualan (omzet kotor, tanpa SS Online).',
    ].join('\n'))
  })
})
```

- [ ] **Step 2: Jalankan — harus gagal**

Run: `cd apps/admin-dashboard && ../../node_modules/.bin/vitest run src/lib/sukaBot/rekap.test.ts`
Expected: FAIL import tidak ditemukan.

- [ ] **Step 3: Implementasi**

`rekap.ts`:
```ts
import { addDaysStr, jakartaDate } from '@/lib/ownerDashboardCache'
import { hitungRanking, outletTerhitung, type BarisRanking, type KonteksPenjualan } from './alat/penjualan'
import { resolvePeriode, labelTanggal } from './periode'
import { rupiah, persenPerubahan, teksPersen, jamWibAngka } from './format'

export interface DataRekap {
  tanggal: string
  pembanding: string
  omzet: number
  omzetPembanding: number
  persen: number | null
  transaksi: number
  ranking: BarisRanking[]
  menuTeratas: { nama: string; qty: number }[]
}

const JAM_REKAP_SIAP = 5

/** Data "kemarin" dianggap cukup lengkap mulai 05:00 WIB; sebelum itu rekap yang tampil = hari sebelumnya. */
export function tanggalRekapUntuk(sekarang: Date): string {
  const hariIni = jakartaDate(sekarang)
  return addDaysStr(hariIni, jamWibAngka(sekarang) < JAM_REKAP_SIAP ? -2 : -1)
}

export async function hitungRekap(ctx: KonteksPenjualan, tanggal: string): Promise<DataRekap> {
  const pembanding = addDaysStr(tanggal, -7)
  const ids = outletTerhitung(ctx.outlets).map((o) => o.id)
  const p = resolvePeriode('rentang', addDaysStr(tanggal, 1), { dari: tanggal, sampai: tanggal })
  const q = resolvePeriode('rentang', addDaysStr(tanggal, 1), { dari: pembanding, sampai: pembanding })
  const [total, totalP, ranking] = await Promise.all([
    ctx.ambilLaporan({ dari: tanggal, sampai: tanggal, outletIds: ids, kanal: ['all'] }),
    ctx.ambilLaporan({ dari: pembanding, sampai: pembanding, outletIds: ids, kanal: ['all'] }),
    hitungRanking(ctx, p, q, ['all']),
  ])
  return {
    tanggal,
    pembanding,
    omzet: total.omzetKotor,
    omzetPembanding: totalP.omzetKotor,
    persen: persenPerubahan(total.omzetKotor, totalP.omzetKotor),
    transaksi: total.transaksi,
    ranking,
    menuTeratas: [...total.menu].sort((a, b) => b.qty - a.qty).slice(0, 3).map((m) => ({ nama: m.nama, qty: m.qty })),
  }
}

export function teksRekap(d: DataRekap): string {
  const baris = [
    `Rekap penjualan ${labelTanggal(d.tanggal)}, Bos 👋`,
    '',
    `Omzet kotor: ${rupiah(d.omzet)} (${teksPersen(d.persen)} vs ${labelTanggal(d.pembanding)}: ${rupiah(d.omzetPembanding)})`,
    `Transaksi: ${d.transaksi.toLocaleString('id-ID')}`,
    '',
    'Ranking outlet:',
    ...d.ranking.map((r) => `${r.peringkat}. ${r.nama} — ${rupiah(r.omzet)} (${teksPersen(r.persen)})`),
    '',
    'Menu terlaris:',
    ...d.menuTeratas.map((m, i) => `${i + 1}. ${m.nama} — ${m.qty.toLocaleString('id-ID')} porsi`),
    '',
    'Sumber: Rangkuman Penjualan (omzet kotor, tanpa SS Online).',
  ]
  return baris.join('\n')
}
```

- [ ] **Step 4: Jalankan — harus lulus**

Run perintah Step 2. Expected: PASS.

- [ ] **Step 5: Jalankan seluruh test SUKA Bot + type-check**

Run: `cd apps/admin-dashboard && ../../node_modules/.bin/vitest run src/lib/sukaBot && ../../node_modules/.bin/tsc --noEmit -p . 2>&1 | grep sukaBot`
Expected: semua test PASS; `grep` tidak mengeluarkan baris (nol type error di berkas SUKA Bot).

- [ ] **Step 6: Commit**

```bash
git add apps/admin-dashboard/src/lib/sukaBot/rekap.ts apps/admin-dashboard/src/lib/sukaBot/rekap.test.ts
git commit -m "feat(suka-bot): rekap harian kemarin dengan teks template"
```

---

### Task 9: Sesi, CORS, adapter data nyata, API route, middleware, Dockerfile

**Files:**
- Create: `apps/admin-dashboard/src/lib/sukaBot/server/sesi.ts`, `.../server/cors.ts`, `.../server/sumberData.ts`
- Create: `apps/admin-dashboard/src/app/api/asisten/chat/route.ts`, `.../rekap/route.ts`, `.../percakapan/route.ts`
- Modify: `apps/admin-dashboard/src/middleware.ts`
- Modify: `apps/admin-dashboard/Dockerfile` (stage runner, setelah baris `ARG ORDER_ONLINE_SUPABASE_URL` dan `ENV ORDER_ONLINE_SUPABASE_URL=...`)
- Test: `apps/admin-dashboard/src/lib/sukaBot/server/cors.test.ts`

**Interfaces:**
- Consumes: semua task 2–8; `getPosReport` dari `@/app/actions/posReport`; `createSupabaseServerClient`, `getVerifiedUserId` dari `@suka/auth`; `jakartaDate` dari `@/lib/ownerDashboardCache`.
- Produces (dipakai portal, Task 10):
  - `POST /api/asisten/chat` body `{ percakapanId?: string; pesan: string }` → 200 `{ percakapanId: string; jawaban: string }` | 401 | 403 | 429 `{ galat }` | 503 `{ galat }`
  - `GET /api/asisten/rekap` → 200 `{ rekap: { id, tanggal, versi, teks, dibuat_at } }`
  - `POST /api/asisten/rekap` body `{ tanggal: string }` → 200 `{ rekap }` (versi baru)
  - `GET /api/asisten/percakapan` → `{ percakapan: { id, judul, diperbarui_at }[] }`; `GET ?id=<uuid>` → `{ pesan: { peran, isi, dibuat_at }[] }`
  - Semua respons membawa header CORS bila origin diizinkan; `OPTIONS` → 204.

- [ ] **Step 1: Tulis test CORS gagal**

`server/cors.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { originDiizinkan, headerCors } from './cors'

describe('cors', () => {
  it('default: portal produksi & portal lokal', () => {
    expect(originDiizinkan('https://app.sukashawarma.com', undefined)).toBe(true)
    expect(originDiizinkan('http://localhost:3010', undefined)).toBe(true)
    expect(originDiizinkan('https://evil.sukashawarma.com', undefined)).toBe(false)
    expect(originDiizinkan(null, undefined)).toBe(false)
  })
  it('env menimpa default', () => {
    expect(originDiizinkan('https://portal.x', 'https://portal.x, https://y')).toBe(true)
    expect(originDiizinkan('https://app.sukashawarma.com', 'https://portal.x')).toBe(false)
  })
  it('header hanya untuk origin diizinkan', () => {
    expect(headerCors('https://app.sukashawarma.com', undefined)).toMatchObject({
      'Access-Control-Allow-Origin': 'https://app.sukashawarma.com',
      'Access-Control-Allow-Credentials': 'true',
      Vary: 'Origin',
    })
    expect(headerCors('https://evil.com', undefined)).toEqual({ Vary: 'Origin' })
  })
})
```

- [ ] **Step 2: Jalankan — harus gagal**

Run: `cd apps/admin-dashboard && ../../node_modules/.bin/vitest run src/lib/sukaBot/server/cors.test.ts`
Expected: FAIL import tidak ditemukan.

- [ ] **Step 3: Implementasi CORS & sesi**

`server/cors.ts`:
```ts
const DEFAULT_ORIGINS = ['https://app.sukashawarma.com', 'http://localhost:3010']

function daftar(env: string | undefined): string[] {
  return env ? env.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_ORIGINS
}

export function originDiizinkan(origin: string | null, env: string | undefined = process.env.SUKA_BOT_ALLOWED_ORIGINS): boolean {
  return !!origin && daftar(env).includes(origin)
}

export function headerCors(origin: string | null, env: string | undefined = process.env.SUKA_BOT_ALLOWED_ORIGINS): Record<string, string> {
  if (!originDiizinkan(origin, env)) return { Vary: 'Origin' }
  return {
    'Access-Control-Allow-Origin': origin!,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}
```

`server/sesi.ts`:
```ts
// Hanya kode server. Gerbang SUKA Bot: sesi login + is_owner_or_admin() + status aktif.
// Middleware admin-dashboard SENGAJA dilewati untuk /api/asisten (owner tidak punya
// akses app admin-dashboard di ROLE_APP_ACCESS) — jadi pemeriksaan ini satu-satunya gerbang.
import { cookies } from 'next/headers'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'

export async function sesiSukaBot() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({ getAll: () => cookieStore.getAll(), setAll: () => {} })
  const userId = await getVerifiedUserId(supabase)
  if (!userId) return null
  const [{ data: boleh, error }, { data: staff }] = await Promise.all([
    supabase.rpc('is_owner_or_admin'),
    supabase.from('outlet_staff').select('name, status').eq('id', userId).maybeSingle(),
  ])
  if (error || boleh !== true || staff?.status !== 'active') return null
  return { supabase, userId, nama: (staff?.name as string) || 'Bos' }
}
```

- [ ] **Step 4: Jalankan test CORS — harus lulus**

Run perintah Step 2. Expected: PASS.

- [ ] **Step 5: Adapter data nyata**

`server/sumberData.ts`:
```ts
// Adapter nyata untuk alat SUKA Bot. Semua query memakai `supabase` sesi penanya (bukan service role).
import { getPosReport } from '@/app/actions/posReport'
import type { AmbilLaporan, OutletInfo, KonteksPenjualan } from '../alat/penjualan'
import type { KonteksStok, BahanInfo, BarisStok } from '../alat/stok'

/** Rangkuman Penjualan yang sama dengan /dashboard/reports/pos (rumus + cache per hari). */
export const ambilLaporanRangkuman: AmbilLaporan = async ({ dari, sampai, outletIds, kanal }) => {
  // outlets kosong akan dibaca getPosReport sebagai "semua" (termasuk SS Online) — tolak.
  if (outletIds.length === 0) throw new Error('Daftar outlet kosong')
  const r: any = await getPosReport({
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

export async function ambilOutlets(supabase: any): Promise<OutletInfo[]> {
  const { data, error } = await supabase.from('outlets').select('id, name, type, is_active').order('name')
  if (error) throw new Error(`outlets: ${error.message}`)
  return (data ?? []).map((o: any) => ({ id: o.id, name: o.name, type: o.type ?? '', is_active: !!o.is_active }))
}

export function konteksStok(supabase: any, outlets: OutletInfo[], hariIni: string): KonteksStok {
  return {
    outlets,
    hariIni,
    daftarBahan: async (): Promise<BahanInfo[]> => {
      const { data, error } = await supabase
        .from('bahan_baku')
        .select('id, nama, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan')
        .eq('is_active', true)
        .order('nama')
      if (error) throw new Error(`bahan_baku: ${error.message}`)
      return data ?? []
    },
    barisStok: async (bahanId: string): Promise<BarisStok[]> => {
      const { data, error } = await supabase
        .from('monitoring_view_spv')
        .select('outlet_id, bahan_baku_id, current_qty, last_opname_date, saldo_is_gram')
        .eq('bahan_baku_id', bahanId)
      if (error) throw new Error(`monitoring_view_spv: ${error.message}`)
      const seen = new Set<string>()
      return (data ?? []).filter((r: any) => (seen.has(r.outlet_id) ? false : (seen.add(r.outlet_id), true)))
    },
  }
}

export function konteksPenjualan(outlets: OutletInfo[], hariIni: string, sekarang: Date): KonteksPenjualan {
  return { ambilLaporan: ambilLaporanRangkuman, outlets, hariIni, sekarang }
}
```

- [ ] **Step 6: Route chat**

`src/app/api/asisten/chat/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jakartaDate } from '@/lib/ownerDashboardCache'
import { sesiSukaBot } from '@/lib/sukaBot/server/sesi'
import { headerCors, originDiizinkan } from '@/lib/sukaBot/server/cors'
import { ambilOutlets, konteksPenjualan, konteksStok } from '@/lib/sukaBot/server/sumberData'
import { jalankanAlat } from '@/lib/sukaBot/alat/registry'
import { buatPanggilLLM, type PesanLLM } from '@/lib/sukaBot/llm'
import { buatPromptSistem } from '@/lib/sukaBot/prompt'
import { jalankanAgen } from '@/lib/sukaBot/agen'

export const dynamic = 'force-dynamic'

const BODY = z.object({ percakapanId: z.string().uuid().optional(), pesan: z.string().trim().min(1).max(1000) })
const RIWAYAT_MAKS = 20

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: headerCors(req.headers.get('origin')) })
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin')
  const cors = headerCors(origin)
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: cors })

  // Tolak POST lintas-origin yang tidak diizinkan (CORS saja tidak mencegah request terkirim).
  if (origin && !originDiizinkan(origin) && origin !== new URL(req.url).origin) return json({ galat: 'Origin tidak diizinkan' }, 403)

  const sesi = await sesiSukaBot()
  if (!sesi) return json({ galat: 'Khusus admin, owner, developer' }, 401)
  const { supabase, userId, nama } = sesi

  const parsed = BODY.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return json({ galat: 'Pesan tidak valid' }, 400)
  const { pesan } = parsed.data

  const sekarang = new Date()
  const hariIni = jakartaDate(sekarang)
  const batas = Number(process.env.SUKA_BOT_BATAS_HARIAN) || 100
  const { data: pakai } = await supabase.from('suka_bot_pemakaian').select('jumlah_pertanyaan').eq('user_id', userId).eq('tanggal', hariIni).maybeSingle()
  if ((pakai?.jumlah_pertanyaan ?? 0) >= batas) return json({ galat: `Batas ${batas} pertanyaan per hari sudah tercapai, Bos. Lanjut besok ya.` }, 429)

  let percakapanId = parsed.data.percakapanId
  if (percakapanId) {
    const { data } = await supabase.from('suka_bot_percakapan').select('id').eq('id', percakapanId).maybeSingle()
    if (!data) percakapanId = undefined
  }
  if (!percakapanId) {
    const { data, error } = await supabase.from('suka_bot_percakapan').insert({ judul: pesan.slice(0, 60) }).select('id').single()
    if (error) return json({ galat: 'Gagal membuat percakapan' }, 500)
    percakapanId = data.id as string
  }

  const { data: lama } = await supabase
    .from('suka_bot_pesan').select('peran, isi').eq('percakapan_id', percakapanId)
    .order('dibuat_at', { ascending: false }).limit(RIWAYAT_MAKS)
  const riwayat: PesanLLM[] = (lama ?? []).reverse().map((m: any) => ({ role: m.peran, content: m.isi }))

  await supabase.from('suka_bot_pesan').insert({ percakapan_id: percakapanId, peran: 'user', isi: pesan })

  try {
    const outlets = await ambilOutlets(supabase)
    const deps = {
      penjualan: konteksPenjualan(outlets, hariIni, sekarang),
      stok: konteksStok(supabase, outlets, hariIni),
      catatGagal: async (alasan: string) => { await supabase.from('suka_bot_gagal').insert({ pertanyaan: pesan, alasan }) },
    }
    const hasil = await jalankanAgen({
      sistem: buatPromptSistem(hariIni, sekarang, nama),
      riwayat,
      pertanyaan: pesan,
      panggilLLM: buatPanggilLLM(),
      jalankan: (n, a) => jalankanAlat(n, a, deps),
    })
    if (hasil.habisPutaran) await deps.catatGagal('habis_putaran')
    await supabase.from('suka_bot_pesan').insert({ percakapan_id: percakapanId, peran: 'assistant', isi: hasil.jawaban, meta: { alat: hasil.alatDipakai } })
    await supabase.from('suka_bot_percakapan').update({ diperbarui_at: new Date().toISOString() }).eq('id', percakapanId)
    await supabase.rpc('suka_bot_catat_pemakaian', { p_token_masuk: hasil.tokenMasuk, p_token_keluar: hasil.tokenKeluar })
    return json({ percakapanId, jawaban: hasil.jawaban })
  } catch (e: any) {
    console.error('[suka-bot] chat gagal:', e?.message)
    await supabase.from('suka_bot_gagal').insert({ pertanyaan: pesan, alasan: `galat_sistem: ${String(e?.message).slice(0, 200)}` })
    return json({ galat: 'SUKA Bot sedang tidak tersedia, coba lagi sebentar ya Bos.' }, 503)
  }
}
```

- [ ] **Step 7: Route rekap**

`src/app/api/asisten/rekap/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jakartaDate, isDateStr } from '@/lib/ownerDashboardCache'
import { sesiSukaBot } from '@/lib/sukaBot/server/sesi'
import { headerCors, originDiizinkan } from '@/lib/sukaBot/server/cors'
import { ambilOutlets, konteksPenjualan } from '@/lib/sukaBot/server/sumberData'
import { hitungRekap, teksRekap, tanggalRekapUntuk } from '@/lib/sukaBot/rekap'

export const dynamic = 'force-dynamic'

const KOLOM = 'id, tanggal, versi, teks, dibuat_at'

async function terbaru(supabase: any, tanggal: string) {
  const { data } = await supabase.from('suka_bot_rekap').select(KOLOM).eq('tanggal', tanggal).order('versi', { ascending: false }).limit(1).maybeSingle()
  return data
}

async function buatVersi(supabase: any, userId: string, tanggal: string, versi: number) {
  const sekarang = new Date()
  const outlets = await ambilOutlets(supabase)
  const data = await hitungRekap(konteksPenjualan(outlets, jakartaDate(sekarang), sekarang), tanggal)
  // Dua pembuka bersamaan: unique (tanggal, versi) memastikan hanya satu yang tersimpan.
  await supabase.from('suka_bot_rekap').insert({ tanggal, versi, data, teks: teksRekap(data), dibuat_oleh: userId })
  return terbaru(supabase, tanggal)
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: headerCors(req.headers.get('origin')) })
}

export async function GET(req: Request) {
  const cors = headerCors(req.headers.get('origin'))
  const sesi = await sesiSukaBot()
  if (!sesi) return NextResponse.json({ galat: 'Khusus admin, owner, developer' }, { status: 401, headers: cors })
  try {
    const tanggal = tanggalRekapUntuk(new Date())
    const ada = await terbaru(sesi.supabase, tanggal)
    const rekap = ada ?? (await buatVersi(sesi.supabase, sesi.userId, tanggal, 1))
    return NextResponse.json({ rekap }, { headers: cors })
  } catch (e: any) {
    console.error('[suka-bot] rekap gagal:', e?.message)
    return NextResponse.json({ galat: 'Rekap belum bisa dibuat, coba lagi sebentar.' }, { status: 503, headers: cors })
  }
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin')
  const cors = headerCors(origin)
  if (origin && !originDiizinkan(origin) && origin !== new URL(req.url).origin) return NextResponse.json({ galat: 'Origin tidak diizinkan' }, { status: 403, headers: cors })
  const sesi = await sesiSukaBot()
  if (!sesi) return NextResponse.json({ galat: 'Khusus admin, owner, developer' }, { status: 401, headers: cors })
  const parsed = z.object({ tanggal: z.string() }).safeParse(await req.json().catch(() => null))
  const hariIni = jakartaDate(new Date())
  if (!parsed.success || !isDateStr(parsed.data.tanggal) || parsed.data.tanggal >= hariIni) {
    return NextResponse.json({ galat: 'Tanggal rekap tidak valid' }, { status: 400, headers: cors })
  }
  try {
    const ada = await terbaru(sesi.supabase, parsed.data.tanggal)
    const rekap = await buatVersi(sesi.supabase, sesi.userId, parsed.data.tanggal, (ada?.versi ?? 0) + 1)
    return NextResponse.json({ rekap }, { headers: cors })
  } catch (e: any) {
    console.error('[suka-bot] perbarui rekap gagal:', e?.message)
    return NextResponse.json({ galat: 'Rekap belum bisa diperbarui.' }, { status: 503, headers: cors })
  }
}
```

- [ ] **Step 8: Route percakapan**

`src/app/api/asisten/percakapan/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sesiSukaBot } from '@/lib/sukaBot/server/sesi'
import { headerCors } from '@/lib/sukaBot/server/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: headerCors(req.headers.get('origin')) })
}

export async function GET(req: Request) {
  const cors = headerCors(req.headers.get('origin'))
  const sesi = await sesiSukaBot()
  if (!sesi) return NextResponse.json({ galat: 'Khusus admin, owner, developer' }, { status: 401, headers: cors })
  const id = new URL(req.url).searchParams.get('id')
  if (id) {
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ galat: 'id tidak valid' }, { status: 400, headers: cors })
    const { data } = await sesi.supabase.from('suka_bot_pesan').select('peran, isi, dibuat_at').eq('percakapan_id', id).order('dibuat_at')
    return NextResponse.json({ pesan: data ?? [] }, { headers: cors })
  }
  const { data } = await sesi.supabase.from('suka_bot_percakapan').select('id, judul, diperbarui_at').order('diperbarui_at', { ascending: false }).limit(20)
  return NextResponse.json({ percakapan: data ?? [] }, { headers: cors })
}
```

- [ ] **Step 9: Middleware — lewati `/api/asisten/`**

Ubah `apps/admin-dashboard/src/middleware.ts` — tambahkan tepat setelah blok `/public/`:
```ts
  // SUKA Bot: route memeriksa sesi + is_owner_or_admin() sendiri. enforceAppAccess
  // akan me-redirect role owner (tak punya admin-dashboard di ROLE_APP_ACCESS) dan
  // preflight CORS dari portal.
  if (request.nextUrl.pathname.startsWith('/api/asisten/')) {
    return NextResponse.next()
  }
```

- [ ] **Step 10: Dockerfile — env runner**

Di `apps/admin-dashboard/Dockerfile` stage `runner`, tambahkan setelah `ARG ORDER_ONLINE_SUPABASE_URL`:
```dockerfile
ARG AI_BASE_URL
ARG AI_API_KEY
ARG AI_MODEL
ARG SUKA_BOT_ALLOWED_ORIGINS
ARG SUKA_BOT_BATAS_HARIAN
```
dan setelah `ENV ORDER_ONLINE_SUPABASE_URL=$ORDER_ONLINE_SUPABASE_URL`:
```dockerfile
ENV AI_BASE_URL=$AI_BASE_URL
ENV AI_API_KEY=$AI_API_KEY
ENV AI_MODEL=$AI_MODEL
ENV SUKA_BOT_ALLOWED_ORIGINS=$SUKA_BOT_ALLOWED_ORIGINS
ENV SUKA_BOT_BATAS_HARIAN=$SUKA_BOT_BATAS_HARIAN
```

- [ ] **Step 11: Uji manual lokal**

1. Isi `apps/admin-dashboard/.env.local`: `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` (dari 9Router; jangan di-echo ke terminal).
2. `cd apps/admin-dashboard && yarn dev` (port 3005), login sebagai akun admin di portal lokal (3010).
3. Di DevTools konsol tab portal:
```js
await fetch('http://localhost:3005/api/asisten/rekap', { credentials: 'include' }).then(r => r.json())
await fetch('http://localhost:3005/api/asisten/chat', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pesan: 'omzet kemarin berapa?' }) }).then(r => r.json())
```
Expected: rekap berisi teks "Rekap penjualan …"; chat menjawab dengan angka + periode + sumber.
4. Login sebagai akun crew, ulangi → Expected: 401.

- [ ] **Step 12: Type-check, test, build**

Run: `cd apps/admin-dashboard && ../../node_modules/.bin/vitest run src/lib/sukaBot && ../../node_modules/.bin/tsc --noEmit -p . 2>&1 | grep -E "sukaBot|api/asisten|middleware"; yarn build`
Expected: test PASS; grep kosong; build sukses dengan rute `ƒ /api/asisten/chat`, `ƒ /api/asisten/rekap`, `ƒ /api/asisten/percakapan`.

- [ ] **Step 13: Commit**

```bash
git add apps/admin-dashboard/src/lib/sukaBot/server apps/admin-dashboard/src/app/api/asisten apps/admin-dashboard/src/middleware.ts apps/admin-dashboard/Dockerfile
git commit -m "feat(suka-bot): API chat, rekap, riwayat + gerbang sesi & CORS"
```

---

### Task 10: Avatar & panel chat di portal

**Files:**
- Create: `apps/portal/src/components/sukaBot/api.ts`, `AvatarSukaBot.tsx`, `PanelSukaBot.tsx`, `SukaBotWidget.tsx`, `SukaBotMount.tsx`
- Create: `apps/portal/src/app/asisten/page.tsx`
- Create: `apps/portal/public/suka-bot/README.md`
- Modify: `apps/portal/src/app/launcher/page.tsx` (import + render `SukaBotMount` di akhir JSX untuk 3 role)

**Interfaces:**
- Consumes: endpoint Task 9.
- Produces: komponen `SukaBotMount({ apiBase }: { apiBase: string })`, `PanelSukaBot({ apiBase, penuh }: { apiBase: string; penuh?: boolean })`.

Portal tidak punya test runner; verifikasi lewat browser (Step 7).

- [ ] **Step 1: Klien API**

`api.ts`:
```ts
export interface Rekap { id: string; tanggal: string; versi: number; teks: string; dibuat_at: string }

async function panggil<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.galat || 'SUKA Bot sedang tidak tersedia')
  return body as T
}

export const ambilRekap = (base: string) => panggil<{ rekap: Rekap }>(`${base}/api/asisten/rekap`)
export const perbaruiRekap = (base: string, tanggal: string) =>
  panggil<{ rekap: Rekap }>(`${base}/api/asisten/rekap`, { method: 'POST', body: JSON.stringify({ tanggal }) })
export const kirimPesan = (base: string, pesan: string, percakapanId?: string) =>
  panggil<{ percakapanId: string; jawaban: string }>(`${base}/api/asisten/chat`, { method: 'POST', body: JSON.stringify({ pesan, percakapanId }) })
```

- [ ] **Step 2: Avatar dengan fallback**

`AvatarSukaBot.tsx`:
```tsx
'use client'
import { useState } from 'react'

export type Pose = 'diam' | 'berpikir' | 'rekap' | 'bingung'

/** Gambar pose di /public/suka-bot/<pose>.webp. Sampai aset jadi: lingkaran oranye "SB". */
export default function AvatarSukaBot({ pose = 'diam', ukuran = 56 }: { pose?: Pose; ukuran?: number }) {
  const [gagal, setGagal] = useState(false)
  if (gagal) {
    return (
      <div style={{ width: ukuran, height: ukuran }} className="rounded-full bg-gradient-to-br from-suka-orange to-suka-brown text-white font-bold flex items-center justify-center shadow-lg select-none">
        SB
      </div>
    )
  }
  return (
    <img
      src={`/suka-bot/${pose}.webp`}
      alt="SUKA Bot"
      width={ukuran}
      height={ukuran}
      onError={() => setGagal(true)}
      className={`rounded-full shadow-lg ${pose === 'berpikir' ? 'animate-pulse' : 'motion-safe:animate-[bounce_3s_ease-in-out_infinite]'}`}
    />
  )
}
```

- [ ] **Step 3: Panel**

`PanelSukaBot.tsx`:
```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import AvatarSukaBot, { type Pose } from './AvatarSukaBot'
import { ambilRekap, kirimPesan, perbaruiRekap, type Rekap } from './api'

type Pesan = { peran: 'user' | 'assistant'; isi: string }

const jam = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

export default function PanelSukaBot({ apiBase, penuh = false, onRekap }: { apiBase: string; penuh?: boolean; onRekap?: (r: Rekap) => void }) {
  const [rekap, setRekap] = useState<Rekap | null>(null)
  const [pesan, setPesan] = useState<Pesan[]>([])
  const [input, setInput] = useState('')
  const [pose, setPose] = useState<Pose>('rekap')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const percakapanId = useRef<string | undefined>(undefined)
  const bawah = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSibuk(true)
    ambilRekap(apiBase)
      .then(({ rekap }) => { setRekap(rekap); onRekap?.(rekap) })
      .catch((e) => { setGalat(e.message); setPose('bingung') })
      .finally(() => setSibuk(false))
  }, [apiBase, onRekap])

  useEffect(() => { bawah.current?.scrollIntoView({ behavior: 'smooth' }) }, [pesan, rekap])

  async function kirim() {
    const teks = input.trim()
    if (!teks || sibuk) return
    setInput('')
    setGalat(null)
    setPesan((p) => [...p, { peran: 'user', isi: teks }])
    setSibuk(true)
    setPose('berpikir')
    try {
      const r = await kirimPesan(apiBase, teks, percakapanId.current)
      percakapanId.current = r.percakapanId
      setPesan((p) => [...p, { peran: 'assistant', isi: r.jawaban }])
      setPose('diam')
    } catch (e: any) {
      setGalat(e.message)
      setPose('bingung')
    } finally {
      setSibuk(false)
    }
  }

  async function perbarui() {
    if (!rekap || sibuk) return
    setSibuk(true)
    try {
      const { rekap: baru } = await perbaruiRekap(apiBase, rekap.tanggal)
      setRekap(baru)
      onRekap?.(baru)
    } catch (e: any) {
      setGalat(e.message)
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className={`flex flex-col bg-white rounded-2xl shadow-2xl border border-suka-orange/20 overflow-hidden ${penuh ? 'h-[calc(100vh-8rem)]' : 'w-[min(24rem,calc(100vw-2rem))] h-[min(36rem,calc(100vh-7rem))]'}`}>
      <div className="flex items-center gap-3 px-4 py-3 bg-suka-ink text-white">
        <AvatarSukaBot pose={pose} ukuran={40} />
        <div>
          <p className="font-bold leading-tight">SUKA Bot</p>
          <p className="text-xs opacity-75">{sibuk ? 'Lagi mikir…' : 'Siap bantu, Bos'}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
        {rekap && (
          <div className="bg-amber-50 border border-suka-orange/30 rounded-xl p-3">
            <p className="whitespace-pre-wrap text-suka-ink">{rekap.teks}</p>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <span>Dibuat {jam(rekap.dibuat_at)} WIB{rekap.versi > 1 ? ` · versi ${rekap.versi}` : ''}</span>
              <button onClick={perbarui} disabled={sibuk} className="text-suka-orange font-semibold disabled:opacity-40">Perbarui rekap</button>
            </div>
          </div>
        )}
        {pesan.map((m, i) => (
          <div key={i} className={`max-w-[85%] rounded-xl px-3 py-2 whitespace-pre-wrap ${m.peran === 'user' ? 'ml-auto bg-suka-orange text-white' : 'bg-gray-100 text-suka-ink'}`}>
            {m.isi}
          </div>
        ))}
        {galat && <p className="text-red-600 text-xs">{galat}</p>}
        <div ref={bawah} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); kirim() }} className="flex gap-2 p-3 border-t">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={1000}
          placeholder="Tanya omzet, ranking outlet, stok bahan…"
          className="flex-1 rounded-full border px-4 py-2 text-sm outline-none focus:border-suka-orange"
        />
        <button type="submit" disabled={sibuk || !input.trim()} className="rounded-full bg-suka-orange text-white px-4 text-sm font-semibold disabled:opacity-40">
          Kirim
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Widget melayang + titik merah + error boundary**

`SukaBotWidget.tsx`:
```tsx
'use client'
import { Component, useCallback, useEffect, useState, type ReactNode } from 'react'
import AvatarSukaBot from './AvatarSukaBot'
import PanelSukaBot from './PanelSukaBot'
import { ambilRekap, type Rekap } from './api'

const KUNCI_DIBACA = 'sukaBot.rekapDibaca'

const bacaDibaca = () => { try { return localStorage.getItem(KUNCI_DIBACA) } catch { return null } }
const tulisDibaca = (id: string) => { try { localStorage.setItem(KUNCI_DIBACA, id) } catch { /* abaikan */ } }

/** Kegagalan SUKA Bot tidak boleh merusak launcher (pintu login semua role). */
class Pengaman extends Component<{ children: ReactNode }, { rusak: boolean }> {
  state = { rusak: false }
  static getDerivedStateFromError() { return { rusak: true } }
  componentDidCatch(e: unknown) { console.error('[suka-bot] widget error:', e) }
  render() { return this.state.rusak ? null : this.props.children }
}

function Widget({ apiBase }: { apiBase: string }) {
  const [buka, setBuka] = useState(false)
  const [adaBaru, setAdaBaru] = useState(false)

  useEffect(() => {
    ambilRekap(apiBase).then(({ rekap }) => setAdaBaru(bacaDibaca() !== rekap.id)).catch(() => {})
  }, [apiBase])

  const saatRekap = useCallback((r: Rekap) => { tulisDibaca(r.id); setAdaBaru(false) }, [])

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {buka && <PanelSukaBot apiBase={apiBase} onRekap={saatRekap} />}
      <button onClick={() => setBuka((b) => !b)} aria-label={buka ? 'Tutup SUKA Bot' : 'Buka SUKA Bot'} className="relative">
        <AvatarSukaBot pose={adaBaru ? 'rekap' : 'diam'} />
        {adaBaru && !buka && <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-red-500 ring-2 ring-white" />}
      </button>
    </div>
  )
}

export default function SukaBotWidget({ apiBase }: { apiBase: string }) {
  return <Pengaman><Widget apiBase={apiBase} /></Pengaman>
}
```

`SukaBotMount.tsx`:
```tsx
'use client'
import dynamic from 'next/dynamic'

// Dimuat terpisah dari bundle launcher; hanya dirender untuk admin/owner/developer.
const SukaBotWidget = dynamic(() => import('./SukaBotWidget'), { ssr: false })

export default function SukaBotMount({ apiBase }: { apiBase: string }) {
  return <SukaBotWidget apiBase={apiBase} />
}
```

- [ ] **Step 5: Pasang di launcher + halaman penuh**

Di `apps/portal/src/app/launcher/page.tsx`:
1. Tambah import di atas: `import SukaBotMount from '@/components/sukaBot/SukaBotMount'`
2. Tambah konstanta setelah `const APP_URL = await getAppUrls()`:
```tsx
  // SUKA Bot: hanya admin/owner/developer (sama dengan is_owner_or_admin() di server).
  const bisaSukaBot = ['admin', 'owner', 'developer'].includes(staff.role)
```
3. Di akhir JSX yang di-`return`, ganti penutup:
```tsx
        </footer>
      </div>
    </main>
```
menjadi:
```tsx
        </footer>
      </div>
      {bisaSukaBot && <SukaBotMount apiBase={APP_URL['admin-dashboard']} />}
    </main>
```

`apps/portal/src/app/asisten/page.tsx`:
```tsx
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient, getOutletStaff, getVerifiedUserId } from '@suka/auth'
import PanelSukaBot from '@/components/sukaBot/PanelSukaBot'

export default async function AsistenPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({ getAll: () => cookieStore.getAll(), setAll: () => {} })
  const userId = await getVerifiedUserId(supabase)
  if (!userId) redirect('/')
  const { staff } = await getOutletStaff(supabase, userId)
  if (!staff || staff.status !== 'active' || !['admin', 'owner', 'developer'].includes(staff.role)) redirect('/launcher')

  const host = (await headers()).get('host') || ''
  const lokal = host.includes('localhost') || host.includes('127.0.0.1')
  const apiBase = lokal ? 'http://localhost:3005' : (process.env.NEXT_PUBLIC_APP_URL_ADMIN_DASHBOARD || 'https://admin.sukashawarma.com')

  return (
    <main className="min-h-screen bg-suka-cream p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <Link href="/launcher" className="text-sm text-suka-brown font-semibold">← Kembali ke portal</Link>
        <PanelSukaBot apiBase={apiBase} penuh />
      </div>
    </main>
  )
}
```

`apps/portal/public/suka-bot/README.md`:
```md
Aset avatar SUKA Bot (dibuat tim owner). Nama berkas WAJIB persis:
- diam.webp, berpikir.webp, rekap.webp, bingung.webp
Persegi, latar transparan, disarankan 256×256. Selama berkas belum ada,
widget menampilkan lingkaran oranye "SB".
```

- [ ] **Step 6: Type-check portal**

Sebelum Step 1 task ini, catat baseline: `cd apps/portal && ../../node_modules/.bin/tsc --noEmit -p . 2>&1 | grep -c "error TS"`.
Sekarang jalankan perintah yang sama.
Expected: jumlah sama dengan baseline, dan `../../node_modules/.bin/tsc --noEmit -p . 2>&1 | grep -E "sukaBot|asisten"` kosong.

- [ ] **Step 7: Uji di browser (lokal)**

1. Jalankan admin-dashboard (3005) & portal (3010) lokal; login sebagai admin.
2. Launcher: avatar "SB" muncul kanan bawah dengan titik merah.
3. Klik → panel terbuka, rekap tampil dengan "Dibuat HH:MM WIB"; titik merah hilang.
4. Tanya "ranking outlet kemarin" → jawaban berisi daftar + periode + sumber.
5. Tanya "laba kemarin berapa?" → jawaban jujur belum bisa; cek `select * from suka_bot_gagal order by dibuat_at desc limit 1` (sebagai developer) berisi pertanyaan itu.
6. Matikan admin-dashboard → muat ulang launcher: launcher tetap normal, avatar tetap ada, panel menampilkan pesan "tidak tersedia".
7. Login sebagai crew → avatar tidak muncul; buka `/asisten` → di-redirect ke `/launcher`.
8. Lebar 375px (mobile): panel tidak melebihi layar.

- [ ] **Step 8: Commit**

```bash
git add apps/portal/src/components/sukaBot apps/portal/src/app/asisten apps/portal/public/suka-bot/README.md apps/portal/src/app/launcher/page.tsx
git commit -m "feat(suka-bot): avatar & panel chat di portal untuk admin/owner/developer"
```

---

### Task 11: Verifikasi angka vs dashboard, deploy, dokumentasi

**Files:**
- Create: `docs/RUNBOOK-SUKA-BOT.md`
- Modify: `CLAUDE.md` (tambah section sesi), `docs/superpowers/specs/2026-10-03-suka-bot-design.md` (tandai status)

- [ ] **Step 1: Cocokkan angka (spec §11)**

Dengan admin-dashboard lokal tersambung DB produksi, untuk tiap rentang **kemarin**, **minggu ini**, **bulan lalu**:
1. Tanya SUKA Bot "omzet <rentang>".
2. Buka `/dashboard/reports/pos`, rentang sama, pilih **ke-21 outlet** bertipe outlet/mitra (bukan "Semua Cabang", yang ikut SS Online), channel semua → baca kartu **Gross Revenue**.
3. Harus sama sampai rupiah. Ulangi untuk satu outlet (Beji) dan satu kanal (GoFood).
4. Ranking kemarin: angka 3 outlet teratas = Rangkuman Penjualan dengan filter outlet itu saja.

Catat hasil di runbook. **Bila ada selisih: berhenti, jangan rilis** — telusuri dulu.

- [ ] **Step 2: Cocokkan stok**

Untuk 5 bahan (termasuk SAPI dan satu bahan dengan baris `saldo_is_gram = true`) × 3 outlet: jawaban "stok <bahan> di <outlet>" = tampilan app Stok › Monitoring untuk baris yang sama. Cari baris gram dengan:
```sql
select o.name, b.nama from monitoring_view_spv m join outlets o on o.id = m.outlet_id join bahan_baku b on b.id = m.bahan_baku_id where m.saldo_is_gram limit 5;
```

- [ ] **Step 3: Runbook deploy**

`docs/RUNBOOK-SUKA-BOT.md`:
```md
# Runbook SUKA Bot

## Prasyarat (sekali)
1. 9Router: buat/arahkan satu model untuk SUKA Bot di atas **API key berbayar**. Matikan
   fallback ke model lain dan fitur penghemat token (RTK) untuk model ini.
2. Pastikan container admin-dashboard bisa menjangkau 9Router:
   dari terminal container Coolify admin-dashboard jalankan
   `node -e "fetch(process.env.AI_BASE_URL + '/models', {headers:{Authorization:'Bearer '+process.env.AI_API_KEY}}).then(r=>console.log(r.status))"`
   → harus `200`. Endpoint 9Router tidak boleh terbuka ke internet tanpa API key.
3. Panel Coolify app admin-dashboard → tambahkan env: `AI_BASE_URL` (mis. `http://<host-9router>:20128/v1`),
   `AI_API_KEY`, `AI_MODEL`, `SUKA_BOT_ALLOWED_ORIGINS` (`https://app.sukashawarma.com`),
   `SUKA_BOT_BATAS_HARIAN` (`100`). Dockerfile sudah meneruskannya ke stage runner.
4. Batas kredit bulanan di akun penyedia API.

## Deploy
1. Redeploy **admin-dashboard** dulu, lalu **portal**.
2. Smoke test: login admin di portal → avatar → rekap muncul → tanya "omzet kemarin".
3. Login crew → avatar tidak muncul.

## Pemantauan
- Pertanyaan gagal (developer): `select pertanyaan, alasan, dibuat_at from suka_bot_gagal order by dibuat_at desc limit 50;`
- Pemakaian: `select tanggal, sum(jumlah_pertanyaan), sum(token_masuk), sum(token_keluar) from suka_bot_pemakaian group by 1 order by 1 desc;`
- Rekap: `select tanggal, versi, dibuat_at from suka_bot_rekap order by tanggal desc, versi desc limit 10;`

## Gejala → sebab
- Panel "tidak tersedia" terus: env AI_* kosong di stage runner / 9Router tak terjangkau / admin-dashboard down.
- 401 padahal admin: cookie SSO tidak terkirim — cek `NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com` di kedua app.
- Panel kosong tanpa galat di konsol: cek CORS — origin portal harus ada di `SUKA_BOT_ALLOWED_ORIGINS`.

## Hasil verifikasi angka (isi saat rilis)
| Rentang | Cakupan | SUKA Bot | Rangkuman Penjualan | Cocok? |
|---|---|---|---|---|
```

- [ ] **Step 4: Catat sesi di CLAUDE.md & spec**

Tambahkan section di `CLAUDE.md` (sebelum baris `**Last updated:**`), isi singkat: status, berkas utama, gotcha middleware owner, perlu redeploy admin-dashboard + portal, env baru. Ubah baris **Status** spec menjadi "Tahap 1 diimplementasi (lihat plan)".

- [ ] **Step 5: Commit**

```bash
git add docs/RUNBOOK-SUKA-BOT.md CLAUDE.md docs/superpowers/specs/2026-10-03-suka-bot-design.md
git commit -m "docs(suka-bot): runbook deploy, hasil verifikasi, catatan sesi"
```

---

## Self-Review

**Cakupan spec:**
| Spec | Task |
|---|---|
| K1 web saja | 10 |
| K2 avatar launcher + `/asisten` | 10 |
| K3 3 role, `is_owner_or_admin()` | 1 (RLS), 9 (sesi), 10 (render) |
| K4 hanya alat | 6, 7 |
| K5 9Router satu model | 7 (env), 11 (runbook) |
| K6 rekap ≥05:00, potret, perbarui, versi | 8, 9 |
| K7 riwayat per akun 90 hari | 1, 9 |
| K8 omzet kotor | 4, 9 (`grossRevenue`) |
| K9 otak di admin-dashboard, CORS | 9 |
| K10 persona & avatar | 7 (prompt), 10 |
| §4 T1–T5 | 4, 5 |
| §4 aturan stok (format, opname, ambigu) | 5 |
| §4 lingkup outlet daftar boleh | 4 (`outletTerhitung`) |
| §5 isi rekap | 8 |
| §6 definisi waktu | 2 |
| §7 log gagal | 6, 9 |
| §8 tabel + REVOKE anon | 1 |
| §11 verifikasi | 9 (401 crew), 10 (portal saat admin-dashboard mati), 11 (angka) |

**Konsistensi nama:** `KonteksPenjualan`, `OutletInfo`, `hitungRanking`, `outletTerhitung`, `BarisRanking` (Task 4) dipakai identik di Task 5, 6, 8, 9. `DEFINISI_ALAT`/`jalankanAlat`/`DepsAlat` (Task 6) dipakai di Task 7 & 9. `PesanLLM`/`PanggilLLM` didefinisikan di `llm.ts`, di-re-export dari `agen.ts`. Endpoint & bentuk respons Task 9 = yang dikonsumsi `api.ts` Task 10.
