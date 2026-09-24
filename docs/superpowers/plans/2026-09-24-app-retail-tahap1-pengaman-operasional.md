# App Retail Tahap 1 — Pengaman Operasional: Rencana Implementasi

> **Untuk agen pelaksana:** SUB-SKILL WAJIB: pakai superpowers:subagent-driven-development (disarankan) atau superpowers:executing-plans, task demi task. Langkah memakai checkbox (`- [ ]`).

**Tujuan:** Pelanggan tidak bisa lagi membayar di luar jam, di outlet yang ditutup sementara, atau untuk menu yang habis di outlet itu; pesanan yang dibatalkan setelah bayar masuk antrean refund; pusat bisa memantau pesanan tertahan dan mengatur semuanya dari admin-dashboard.

**Arsitektur:** Empat tabel baru (aditif) + satu trigger di `orders`. Gateway menghitung status outlet lewat satu fungsi murni `statusOutlet` (disalin identik ke admin-dashboard) dan menegakkannya di `checkout/validate` + `orders`. Katalog menghormati daftar habis milik POS (`kiosk_settings`) dan `available_outlets`. Admin-dashboard menulis lewat server action `requireRole` → service client → `app_retail_log`. APK membaca field baru secara opsional (kompatibel mundur) dan membawa cek versi minimum.

**Tech Stack:** Supabase Postgres · Next.js (retail-gateway, admin-dashboard) · Vitest · Kotlin/Jetpack Compose + Ktor (customer-app) · JUnit4.

**Spec:** [docs/superpowers/specs/2026-09-24-app-retail-tahap1-pengaman-operasional-design.md](../specs/2026-09-24-app-retail-tahap1-pengaman-operasional-design.md)

## Batasan Global

- Zona waktu semua perhitungan jam: **Asia/Jakarta** (UTC+7, tanpa DST). Jangan pakai jam lokal server.
- Bawaan: `menit_pesan_terakhir = 30`, `menit_tertahan = 10`, `estimasi_siap = '15–20 menit'`, `versi_minimum_android = 1`.
- `CHECK`: `menit_pesan_terakhir` 0..180 · `menit_tertahan` 1..120 · `estimasi_siap` ≤ 40 char · `versi_minimum_android` ≥ 1 · `alasan` tutup ≤ 120 char.
- Semua tabel baru: `REVOKE ALL FROM anon, authenticated`; SELECT hanya `TO authenticated USING (is_owner_or_admin())`; tanpa policy tulis. Tulis hanya via server action (`requireRole(['owner','admin'])` → `createServiceClient()`).
- Fungsi trigger: `SECURITY DEFINER SET search_path = public, retail`.
- Migration timestamp: `20260924100000` (sudah dicek kosong). **Jangan** pakai timestamp 2030.
- `is_active` di `GET /api/v1/outlets` **tetap berarti lama**; field baru semuanya aditif & opsional.
- `kiosk_settings.value` bertipe **TEXT berisi array JSON** (`'["uuid",...]'`); PK `(outlet_id, key)`; POS membaca: baris outlet sendiri, bila tak ada → baris `PUSAT_OUTLET_ID = '550e8400-e29b-41d4-a716-446655440001'`.
- Bahasa UI & pesan: Bahasa Indonesia.
- Cek branch sebelum commit (`git branch --show-current`); otomasi repo pernah memindah branch di tengah sesi. Jangan commit berkas di luar daftar "Files" task.
- Ada sesi lain yang sedang mengubah `ProfileScreen.kt`, `HomeHeader.kt`, `MenuScreen.kt`, `HistoryScreen.kt` (belum di-commit, 24 Sep). Sebelum Task 11–12, pastikan perubahan itu sudah di-commit atau koordinasikan; jangan menimpanya.

## Peta Berkas

| Berkas | Tanggung jawab |
|---|---|
| `supabase/migrations/20260924100000_app_retail_pengaman_operasional.sql` | 4 tabel, trigger refund, RLS, seed |
| `supabase/verifikasi/app_retail_tahap1/t1_skema.sql` | uji SQL (ROLLBACK) + kontrol negatif |
| `apps/retail-gateway/src/lib/jamBuka.ts` (+test) | fungsi murni `statusOutlet` |
| `apps/retail-gateway/src/lib/menuHabisOutlet.ts` (+test) | fungsi murni penyaring katalog per outlet |
| `apps/retail-gateway/src/lib/pengaturanApp.ts` (+test) | baca `app_pengaturan` + bawaan |
| `apps/retail-gateway/src/lib/statusOutletDb.ts` | loader DB → `statusOutlet` |
| `apps/retail-gateway/src/lib/catalog.ts` | pakai `menuHabisOutlet` |
| `apps/retail-gateway/src/app/api/v1/{outlets,config,checkout/validate,orders}/route.ts` | wiring |
| `apps/admin-dashboard/src/lib/appRetail/jamBuka.ts` (+test) | salinan identik gateway |
| `apps/admin-dashboard/src/lib/appRetail/{menuHabis,pengaturanForm,tutupSementara,pesananTertahan}.ts` (+test) | fungsi murni admin |
| `apps/admin-dashboard/src/app/dashboard/app-retail/pengamanActions.ts` | server action tahap 1 (+ log) |
| `apps/admin-dashboard/src/app/dashboard/app-retail/outlet/*` | UI jam, tutup sementara, menu habis |
| `apps/admin-dashboard/src/app/dashboard/app-retail/pesanan/*` | halaman Pesanan Aplikasi |
| `apps/admin-dashboard/src/app/dashboard/app-retail/pengaturan/*` | halaman Pengaturan Aplikasi |
| `apps/admin-dashboard/src/components/layout/navConfig.ts` (+test) | 2 entri nav baru |
| `mobile/customer-app/.../data/api/{Dto,GatewayClient}.kt`, `data/Repository.kt` | config + field outlet |
| `mobile/customer-app/.../ui/config/*` | cek versi, estimasi, CS |
| `mobile/customer-app/.../ui/home/StatusOutletLabel.kt` (+test) | teks status outlet |

---

### Task 1: Migration — tabel, trigger refund, RLS

**Files:**
- Create: `supabase/migrations/20260924100000_app_retail_pengaman_operasional.sql`
- Create: `supabase/verifikasi/app_retail_tahap1/t1_skema.sql`

**Interfaces:**
- Produces: tabel `public.app_pengaturan`, `public.outlet_tutup_sementara`, `retail.refund_pesanan`, `public.app_retail_log`; fungsi `retail.catat_refund_pesanan()`; trigger `trg_catat_refund_pesanan` di `public.orders`.

- [ ] **Step 1: Tulis uji SQL dulu** (`t1_skema.sql`). Semua di dalam transaksi + `ROLLBACK`; menulis ke tabel nyata tapi tak meninggalkan jejak.

```sql
-- Jalankan: supabase db query --linked -f supabase/verifikasi/app_retail_tahap1/t1_skema.sql
-- Harus berakhir tanpa exception. Kontrol negatif di bagian akhir WAJIB gagal
-- bila dibuka komentarnya (buktikan asersi bisa gagal).
BEGIN;

DO $$
DECLARE
  v_outlet uuid := 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'; -- outlet tes
  v_customer uuid;
  v_order uuid := gen_random_uuid();
  v_order2 uuid := gen_random_uuid();
  v_n int;
BEGIN
  -- 1. Seed pengaturan ada & sesuai bawaan
  SELECT count(*) INTO v_n FROM app_pengaturan WHERE id = 1 AND menit_pesan_terakhir = 30 AND menit_tertahan = 10;
  IF v_n <> 1 THEN RAISE EXCEPTION 'seed app_pengaturan salah'; END IF;

  -- 2. CHECK menolak nilai di luar batas
  BEGIN
    UPDATE app_pengaturan SET menit_tertahan = 0 WHERE id = 1;
    RAISE EXCEPTION 'CHECK menit_tertahan tidak menolak 0';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- 3. Trigger refund: pesanan app yang draft-nya dibayar lalu dibatalkan -> 1 baris
  SELECT id INTO v_customer FROM retail.customers LIMIT 1;
  INSERT INTO orders (id, outlet_id, status, sales_source, channel, total_amount)
    VALUES (v_order, v_outlet, 'preparing', 'app', 'app', 30000);
  INSERT INTO retail.order_drafts (client_order_id, customer_id, outlet_id, items, subtotal, discount_amount, total_amount, status, pos_order_id, paid_at, expires_at)
    VALUES (gen_random_uuid(), v_customer, v_outlet, '[]'::jsonb, 30000, 0, 30000, 'dibayar', v_order, now(), now() + interval '15 min');
  UPDATE orders SET status = 'cancelled' WHERE id = v_order;
  SELECT count(*) INTO v_n FROM retail.refund_pesanan WHERE order_id = v_order AND status = 'perlu' AND nominal = 30000;
  IF v_n <> 1 THEN RAISE EXCEPTION 'trigger refund tidak membuat baris (n=%)', v_n; END IF;

  -- 4. Batal dua kali -> tetap 1 baris
  UPDATE orders SET status = 'preparing' WHERE id = v_order;
  UPDATE orders SET status = 'cancelled' WHERE id = v_order;
  SELECT count(*) INTO v_n FROM retail.refund_pesanan WHERE order_id = v_order;
  IF v_n <> 1 THEN RAISE EXCEPTION 'refund ganda (n=%)', v_n; END IF;

  -- 5. Pesanan POS (bukan app) dibatalkan -> 0 baris
  INSERT INTO orders (id, outlet_id, status, sales_source, total_amount)
    VALUES (v_order2, v_outlet, 'preparing', 'pos', 10000);
  UPDATE orders SET status = 'cancelled' WHERE id = v_order2;
  SELECT count(*) INTO v_n FROM retail.refund_pesanan WHERE order_id = v_order2;
  IF v_n <> 0 THEN RAISE EXCEPTION 'pesanan POS ikut masuk refund'; END IF;

  -- 6. RLS: authenticated non-admin tak bisa membaca
  -- (diuji terpisah di Step 5 dengan SET LOCAL ROLE, karena DO block berjalan sebagai postgres)

  -- KONTROL NEGATIF: buka komentar baris di bawah -> WAJIB gagal
  -- IF (SELECT count(*) FROM retail.refund_pesanan WHERE order_id = v_order) <> 99 THEN RAISE EXCEPTION 'kontrol negatif jalan'; END IF;
END $$;

ROLLBACK;
```

> Kolom `orders` yang wajib diisi bisa lebih banyak dari di atas. Sebelum menjalankan, cek:
> `select column_name from information_schema.columns where table_name='orders' and is_nullable='NO' and column_default is null;` — tambahkan kolom itu ke kedua INSERT dengan nilai uji yang wajar. Lakukan hal yang sama untuk `retail.order_drafts`.

- [ ] **Step 2: Jalankan uji, pastikan GAGAL** (tabel belum ada).

Run: `supabase db query --linked -f supabase/verifikasi/app_retail_tahap1/t1_skema.sql`
Expected: error `relation "app_pengaturan" does not exist`.

- [ ] **Step 3: Tulis migration**

```sql
-- App Retail Tahap 1 -- pengaman operasional (spec 2026-09-24).
-- Aditif: 4 tabel baru + 1 trigger di orders. Tak mengubah kolom yang ada.

-- 1. Pengaturan aplikasi (satu baris)
CREATE TABLE IF NOT EXISTS public.app_pengaturan (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  menit_pesan_terakhir int NOT NULL DEFAULT 30 CHECK (menit_pesan_terakhir BETWEEN 0 AND 180),
  menit_tertahan int NOT NULL DEFAULT 10 CHECK (menit_tertahan BETWEEN 1 AND 120),
  estimasi_siap text NOT NULL DEFAULT '15–20 menit' CHECK (char_length(estimasi_siap) BETWEEN 1 AND 40),
  wa_cs text NULL CHECK (wa_cs IS NULL OR wa_cs ~ '^62[0-9]{8,13}$'),
  versi_minimum_android int NOT NULL DEFAULT 1 CHECK (versi_minimum_android >= 1),
  url_syarat text NULL CHECK (url_syarat IS NULL OR url_syarat ~ '^https://'),
  url_privasi text NULL CHECK (url_privasi IS NULL OR url_privasi ~ '^https://'),
  diubah_oleh uuid NULL,
  diubah_pada timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.app_pengaturan (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2. Tutup sementara (outlet_id NULL = semua outlet). Tak pernah dihapus.
CREATE TABLE IF NOT EXISTS public.outlet_tutup_sementara (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  sampai timestamptz NOT NULL,
  alasan text NULL CHECK (alasan IS NULL OR char_length(alasan) <= 120),
  dibuat_oleh uuid NOT NULL,
  dibuat_pada timestamptz NOT NULL DEFAULT now(),
  dicabut_oleh uuid NULL,
  dicabut_pada timestamptz NULL,
  CHECK (sampai > dibuat_pada)
);
CREATE INDEX IF NOT EXISTS outlet_tutup_sementara_aktif_idx
  ON public.outlet_tutup_sementara (outlet_id, sampai) WHERE dicabut_pada IS NULL;

-- 3. Antrean refund
CREATE TABLE IF NOT EXISTS retail.refund_pesanan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  draft_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  outlet_id uuid NOT NULL,
  nominal numeric NOT NULL CHECK (nominal >= 0),
  status text NOT NULL DEFAULT 'perlu' CHECK (status IN ('perlu','sudah')),
  catatan text NULL,
  diproses_oleh uuid NULL,
  diproses_pada timestamptz NULL,
  dibuat_pada timestamptz NOT NULL DEFAULT now(),
  CHECK (status = 'perlu' OR (catatan IS NOT NULL AND diproses_pada IS NOT NULL))
);

-- 4. Log perubahan (INSERT saja)
CREATE TABLE IF NOT EXISTS public.app_retail_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  aksi text NOT NULL CHECK (aksi IN ('pengaturan_ubah','tutup_sementara','buka_sekarang','jam_ubah','menu_habis_ubah','refund_selesai')),
  sasaran_id uuid NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  oleh uuid NOT NULL,
  pada timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_retail_log_pada_idx ON public.app_retail_log (pada DESC);

-- 5. Trigger: pesanan aplikasi yang dibatalkan SETELAH dibayar -> antrean refund.
-- Trigger (bukan route gateway) karena sinyal POS -> gateway fire-and-forget.
CREATE OR REPLACE FUNCTION retail.catat_refund_pesanan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, retail
AS $$
BEGIN
  INSERT INTO retail.refund_pesanan (order_id, draft_id, customer_id, outlet_id, nominal)
  SELECT NEW.id, d.id, d.customer_id, d.outlet_id, d.total_amount
  FROM retail.order_drafts d
  WHERE d.pos_order_id = NEW.id AND d.status = 'dibayar'
  ON CONFLICT (order_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_catat_refund_pesanan ON public.orders;
CREATE TRIGGER trg_catat_refund_pesanan
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' AND NEW.sales_source = 'app')
  EXECUTE FUNCTION retail.catat_refund_pesanan();

-- 6. Hak akses. Default privileges Supabase memberi ALL ke tabel baru.
REVOKE ALL ON public.app_pengaturan, public.outlet_tutup_sementara, public.app_retail_log FROM anon, authenticated;
REVOKE ALL ON retail.refund_pesanan FROM anon, authenticated;
GRANT SELECT ON public.app_pengaturan, public.outlet_tutup_sementara, public.app_retail_log TO authenticated;
GRANT SELECT ON retail.refund_pesanan TO authenticated;

ALTER TABLE public.app_pengaturan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlet_tutup_sementara ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_retail_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail.refund_pesanan ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_pengaturan_baca ON public.app_pengaturan FOR SELECT TO authenticated USING (public.is_owner_or_admin());
CREATE POLICY outlet_tutup_sementara_baca ON public.outlet_tutup_sementara FOR SELECT TO authenticated USING (public.is_owner_or_admin());
CREATE POLICY app_retail_log_baca ON public.app_retail_log FOR SELECT TO authenticated USING (public.is_owner_or_admin());
CREATE POLICY refund_pesanan_baca ON retail.refund_pesanan FOR SELECT TO authenticated USING (public.is_owner_or_admin());

REVOKE ALL ON FUNCTION retail.catat_refund_pesanan() FROM PUBLIC, anon, authenticated;
```

- [ ] **Step 4: Terapkan ke DB** lewat berkas (bukan SQL inline — memori `supabase-db-query-ddl-silent-noop`), lalu stempel dan verifikasi ke katalog.

```bash
supabase db query --linked -f supabase/migrations/20260924100000_app_retail_pengaman_operasional.sql
supabase db query --linked "insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260924100000','app_retail_pengaman_operasional',array['-- lihat berkas']) on conflict do nothing"
supabase db query --linked "select to_regclass('public.app_pengaturan'), to_regclass('public.outlet_tutup_sementara'), to_regclass('retail.refund_pesanan'), to_regclass('public.app_retail_log'), (select tgname from pg_trigger where tgname='trg_catat_refund_pesanan'), (select prosecdef from pg_proc where proname='catat_refund_pesanan'), (select version from supabase_migrations.schema_migrations where version='20260924100000')"
```
Expected: empat nama tabel, `trg_catat_refund_pesanan`, `t`, `20260924100000`.

- [ ] **Step 5: Jalankan uji + kontrol negatif + uji RLS**

Run: `supabase db query --linked -f supabase/verifikasi/app_retail_tahap1/t1_skema.sql` → Expected: sukses tanpa exception.
Buka komentar baris KONTROL NEGATIF, jalankan lagi → Expected: `ERROR: kontrol negatif jalan`. Kembalikan komentarnya.
Uji RLS (transaksi + ROLLBACK), menyamar sebagai crew aktif:

```sql
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT id FROM outlet_staff WHERE role='crew' AND status='active' LIMIT 1), 'role','authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT (SELECT count(*) FROM app_pengaturan) pengaturan, (SELECT count(*) FROM retail.refund_pesanan) refund, (SELECT count(*) FROM app_retail_log) log;
ROLLBACK;
```
Expected: `0, 0, 0`. Ulangi dengan `role='admin'` → `pengaturan = 1`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260924100000_app_retail_pengaman_operasional.sql supabase/verifikasi/app_retail_tahap1/t1_skema.sql
git commit -m "feat(app-retail): tabel pengaman operasional + trigger antrean refund"
```

---

### Task 2: Gateway — fungsi murni `statusOutlet`

**Files:**
- Create: `apps/retail-gateway/src/lib/jamBuka.ts`
- Test: `apps/retail-gateway/src/lib/jamBuka.test.ts`

**Interfaces:**
- Produces:
```ts
export type AlasanStatus = 'buka' | 'nonaktif' | 'tutup_sementara' | 'belum_buka' | 'sudah_tutup' | 'lewat_pesan_terakhir'
export type TutupSementara = { sampai: Date; alasan: string | null }
export type StatusOutlet = { bisaPesan: boolean; alasan: AlasanStatus; bukaLagi: Date | null; pesanTerakhir: Date | null; alasanTutup: string | null }
export function statusOutlet(input: { sekarang: Date; openHour: string | null; closeHour: string | null; isActive: boolean; tutupSementara: TutupSementara[]; menitPesanTerakhir: number }): StatusOutlet
export function pesanStatus(s: StatusOutlet): string   // kalimat untuk pelanggan
```

- [ ] **Step 1: Tulis test yang gagal**

```ts
import { describe, it, expect } from 'vitest'
import { statusOutlet, pesanStatus } from './jamBuka'

// Semua waktu dinyatakan dalam WIB (+07:00) agar uji tak tergantung zona server.
const wib = (s: string) => new Date(`${s}+07:00`)
const dasar = {
  openHour: '14:00:00', closeHour: '22:00:00', isActive: true,
  tutupSementara: [], menitPesanTerakhir: 30,
}

describe('statusOutlet', () => {
  it('buka di tengah jam operasional', () => {
    const s = statusOutlet({ ...dasar, sekarang: wib('2026-09-24T15:00:00') })
    expect(s.bisaPesan).toBe(true)
    expect(s.alasan).toBe('buka')
    expect(s.pesanTerakhir?.toISOString()).toBe(wib('2026-09-24T21:30:00').toISOString())
  })

  it('belum buka pagi hari, buka lagi hari yang sama', () => {
    const s = statusOutlet({ ...dasar, sekarang: wib('2026-09-24T09:00:00') })
    expect(s.bisaPesan).toBe(false)
    expect(s.alasan).toBe('belum_buka')
    expect(s.bukaLagi?.toISOString()).toBe(wib('2026-09-24T14:00:00').toISOString())
  })

  it('00.30 WIB (masih 17.30 UTC hari sebelumnya) dihitung sebagai pagi WIB', () => {
    const s = statusOutlet({ ...dasar, sekarang: wib('2026-09-25T00:30:00') })
    expect(s.alasan).toBe('belum_buka')
    expect(s.bukaLagi?.toISOString()).toBe(wib('2026-09-25T14:00:00').toISOString())
  })

  it('lewat pesan terakhir: 21.45 ditolak, buka lagi besok', () => {
    const s = statusOutlet({ ...dasar, sekarang: wib('2026-09-24T21:45:00') })
    expect(s.bisaPesan).toBe(false)
    expect(s.alasan).toBe('lewat_pesan_terakhir')
    expect(s.bukaLagi?.toISOString()).toBe(wib('2026-09-25T14:00:00').toISOString())
  })

  it('tepat di batas pesan terakhir 21.30 sudah ditolak', () => {
    expect(statusOutlet({ ...dasar, sekarang: wib('2026-09-24T21:30:00') }).bisaPesan).toBe(false)
  })

  it('sesudah jam tutup', () => {
    const s = statusOutlet({ ...dasar, sekarang: wib('2026-09-24T23:00:00') })
    expect(s.alasan).toBe('sudah_tutup')
    expect(s.bukaLagi?.toISOString()).toBe(wib('2026-09-25T14:00:00').toISOString())
  })

  it('tanpa data jam = buka sepanjang hari', () => {
    const s = statusOutlet({ ...dasar, openHour: null, closeHour: null, sekarang: wib('2026-09-24T03:00:00') })
    expect(s.bisaPesan).toBe(true)
    expect(s.pesanTerakhir).toBeNull()
  })

  it('jam tutup lewat tengah malam (18.00-02.00)', () => {
    const malam = { ...dasar, openHour: '18:00:00', closeHour: '02:00:00' }
    expect(statusOutlet({ ...malam, sekarang: wib('2026-09-25T00:30:00') }).bisaPesan).toBe(true)
    expect(statusOutlet({ ...malam, sekarang: wib('2026-09-25T01:45:00') }).alasan).toBe('lewat_pesan_terakhir')
    expect(statusOutlet({ ...malam, sekarang: wib('2026-09-25T10:00:00') }).alasan).toBe('belum_buka')
  })

  it('nonaktif menang atas segalanya', () => {
    const s = statusOutlet({ ...dasar, isActive: false, sekarang: wib('2026-09-24T15:00:00') })
    expect(s.alasan).toBe('nonaktif')
    expect(s.bisaPesan).toBe(false)
  })

  it('tutup sementara menang atas jam buka; yang sampai-nya terjauh berlaku', () => {
    const s = statusOutlet({
      ...dasar, sekarang: wib('2026-09-24T15:00:00'),
      tutupSementara: [
        { sampai: wib('2026-09-24T18:00:00'), alasan: 'Stok habis' },
        { sampai: wib('2026-09-26T14:00:00'), alasan: 'Renovasi' },
      ],
    })
    expect(s.alasan).toBe('tutup_sementara')
    expect(s.bukaLagi?.toISOString()).toBe(wib('2026-09-26T14:00:00').toISOString())
    expect(s.alasanTutup).toBe('Renovasi')
  })

  it('tutup sementara yang sudah lewat diabaikan (aktif lagi otomatis)', () => {
    const s = statusOutlet({
      ...dasar, sekarang: wib('2026-09-24T15:00:00'),
      tutupSementara: [{ sampai: wib('2026-09-24T14:59:00'), alasan: null }],
    })
    expect(s.bisaPesan).toBe(true)
  })
})

describe('pesanStatus', () => {
  it('menyebut jam buka dalam format 14.00', () => {
    const s = statusOutlet({ ...dasar, sekarang: wib('2026-09-24T09:00:00') })
    expect(pesanStatus(s)).toBe('Outlet belum buka. Buka pukul 14.00.')
  })
  it('tutup sementara menyebut tanggal dan alasan', () => {
    const s = statusOutlet({
      ...dasar, sekarang: wib('2026-09-24T15:00:00'),
      tutupSementara: [{ sampai: wib('2026-09-26T14:00:00'), alasan: 'Renovasi' }],
    })
    expect(pesanStatus(s)).toBe('Outlet tutup sementara (Renovasi). Buka lagi 26 Sep pukul 14.00.')
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd apps/retail-gateway && yarn vitest run src/lib/jamBuka.test.ts`
Expected: FAIL — `Cannot find module './jamBuka'`.

- [ ] **Step 3: Implementasi**

```ts
/**
 * Status pesan-bisa-tidaknya sebuah outlet di aplikasi.
 *
 * SATU sumber aturan untuk gateway (penegak) dan admin-dashboard (tampilan);
 * salinannya di admin WAJIB identik -- lihat apps/admin-dashboard/src/lib/appRetail/jamBuka.ts.
 *
 * Semua jam dihitung di Asia/Jakarta (UTC+7, tanpa DST). Menghitung dengan
 * jam server (UTC) membuat 00.00-07.00 WIB terbaca sebagai "kemarin" --
 * pelajaran drop-ship 2026-09-11.
 */
export type AlasanStatus =
  | 'buka' | 'nonaktif' | 'tutup_sementara' | 'belum_buka' | 'sudah_tutup' | 'lewat_pesan_terakhir'
export type TutupSementara = { sampai: Date; alasan: string | null }
export type StatusOutlet = {
  bisaPesan: boolean
  alasan: AlasanStatus
  bukaLagi: Date | null
  pesanTerakhir: Date | null
  alasanTutup: string | null
}

const WIB_MS = 7 * 60 * 60 * 1000
const MENIT_MS = 60 * 1000
const HARI_MS = 24 * 60 * MENIT_MS

/** Menit sejak 00.00 dari 'HH:MM[:SS]'; null bila tak terbaca. */
function keMenit(jam: string | null): number | null {
  if (!jam) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(jam)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** Awal hari (00.00 WIB) yang memuat `t`, dalam epoch ms. */
function awalHariWib(t: number): number {
  return Math.floor((t + WIB_MS) / HARI_MS) * HARI_MS - WIB_MS
}

export function statusOutlet(input: {
  sekarang: Date
  openHour: string | null
  closeHour: string | null
  isActive: boolean
  tutupSementara: TutupSementara[]
  menitPesanTerakhir: number
}): StatusOutlet {
  const kosong = { bukaLagi: null, pesanTerakhir: null, alasanTutup: null }
  const t = input.sekarang.getTime()

  if (!input.isActive) return { bisaPesan: false, alasan: 'nonaktif', ...kosong }

  const berlaku = input.tutupSementara
    .filter((x) => x.sampai.getTime() > t)
    .sort((a, b) => b.sampai.getTime() - a.sampai.getTime())[0]
  if (berlaku) {
    return { bisaPesan: false, alasan: 'tutup_sementara', bukaLagi: berlaku.sampai, pesanTerakhir: null, alasanTutup: berlaku.alasan }
  }

  const buka = keMenit(input.openHour)
  const tutup = keMenit(input.closeHour)
  if (buka === null || tutup === null) return { bisaPesan: true, alasan: 'buka', ...kosong }

  const hariIni = awalHariWib(t)
  const lewatTengahMalam = tutup <= buka
  // Sesi yang sedang/terakhir berjalan: mulai hari ini, atau kemarin bila sesi
  // melewati tengah malam dan kita masih di bagian dini harinya.
  const menitSekarang = Math.floor((t - hariIni) / MENIT_MS)
  const mulaiHari = lewatTengahMalam && menitSekarang < tutup ? hariIni - HARI_MS : hariIni
  const mulai = mulaiHari + buka * MENIT_MS
  const selesai = mulaiHari + (lewatTengahMalam ? tutup + 24 * 60 : tutup) * MENIT_MS
  const batasPesan = selesai - input.menitPesanTerakhir * MENIT_MS
  const bukaBerikut = t < mulai ? mulai : mulai + HARI_MS

  if (t < mulai) return { bisaPesan: false, alasan: 'belum_buka', bukaLagi: new Date(mulai), pesanTerakhir: null, alasanTutup: null }
  if (t >= selesai) return { bisaPesan: false, alasan: 'sudah_tutup', bukaLagi: new Date(bukaBerikut), pesanTerakhir: null, alasanTutup: null }
  if (t >= batasPesan) {
    return { bisaPesan: false, alasan: 'lewat_pesan_terakhir', bukaLagi: new Date(bukaBerikut), pesanTerakhir: new Date(batasPesan), alasanTutup: null }
  }
  return { bisaPesan: true, alasan: 'buka', bukaLagi: null, pesanTerakhir: new Date(batasPesan), alasanTutup: null }
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function jamWib(d: Date): string {
  const w = new Date(d.getTime() + WIB_MS)
  return `${String(w.getUTCHours()).padStart(2, '0')}.${String(w.getUTCMinutes()).padStart(2, '0')}`
}
function tanggalWib(d: Date): string {
  const w = new Date(d.getTime() + WIB_MS)
  return `${w.getUTCDate()} ${BULAN[w.getUTCMonth()]}`
}

/** Kalimat untuk pelanggan. Dipakai sebagai `pesan` di balasan gateway. */
export function pesanStatus(s: StatusOutlet): string {
  switch (s.alasan) {
    case 'buka': return 'Outlet buka.'
    case 'nonaktif': return 'Outlet sedang tidak melayani pesanan.'
    case 'tutup_sementara': {
      const alasan = s.alasanTutup ? ` (${s.alasanTutup})` : ''
      return `Outlet tutup sementara${alasan}. Buka lagi ${tanggalWib(s.bukaLagi!)} pukul ${jamWib(s.bukaLagi!)}.`
    }
    case 'belum_buka': return `Outlet belum buka. Buka pukul ${jamWib(s.bukaLagi!)}.`
    case 'sudah_tutup': return `Outlet sudah tutup. Buka lagi pukul ${jamWib(s.bukaLagi!)}.`
    case 'lewat_pesan_terakhir':
      return `Pesanan terakhir hari ini pukul ${jamWib(s.pesanTerakhir!)}. Buka lagi pukul ${jamWib(s.bukaLagi!)}.`
  }
}
```

- [ ] **Step 4: Jalankan test**

Run: `cd apps/retail-gateway && yarn vitest run src/lib/jamBuka.test.ts`
Expected: PASS semua (13 test).

- [ ] **Step 5: Commit**

```bash
git add apps/retail-gateway/src/lib/jamBuka.ts apps/retail-gateway/src/lib/jamBuka.test.ts
git commit -m "feat(retail-gateway): statusOutlet -- jam buka, pesan terakhir, tutup sementara (WIB)"
```

---

### Task 3: Gateway — menu habis per outlet di katalog

**Files:**
- Create: `apps/retail-gateway/src/lib/menuHabisOutlet.ts`
- Test: `apps/retail-gateway/src/lib/menuHabisOutlet.test.ts`
- Modify: `apps/retail-gateway/src/lib/catalog.ts` (select + penyaring sebelum `cache.set`)

**Interfaces:**
- Consumes: `MenuApp` dari `catalog.ts`.
- Produces:
```ts
export const PUSAT_OUTLET_ID = '550e8400-e29b-41d4-a716-446655440001'
export type BarisKiosk = { outlet_id: string; key: string; value: string | null }
export function idsDariKiosk(baris: BarisKiosk[], outletId: string, key: string): string[]
export function terapkanKetersediaanOutlet<T extends { id: string; is_available: boolean; available_outlets?: unknown }>(items: T[], outletId: string, kiosk: BarisKiosk[]): T[]
```

- [ ] **Step 1: Test yang gagal**

```ts
import { describe, it, expect } from 'vitest'
import { idsDariKiosk, terapkanKetersediaanOutlet, PUSAT_OUTLET_ID } from './menuHabisOutlet'

const O = 'outlet-a'
const item = (id: string, ubah: Record<string, unknown> = {}) => ({ id, is_available: true, available_outlets: null, ...ubah })

describe('idsDariKiosk', () => {
  it('baris outlet sendiri menang atas PUSAT', () => {
    const b = [
      { outlet_id: PUSAT_OUTLET_ID, key: 'unavailable_menu_ids', value: '["x"]' },
      { outlet_id: O, key: 'unavailable_menu_ids', value: '["y"]' },
    ]
    expect(idsDariKiosk(b, O, 'unavailable_menu_ids')).toEqual(['y'])
  })
  it('tanpa baris outlet, jatuh ke PUSAT (perilaku POS)', () => {
    const b = [{ outlet_id: PUSAT_OUTLET_ID, key: 'unavailable_menu_ids', value: '["x"]' }]
    expect(idsDariKiosk(b, O, 'unavailable_menu_ids')).toEqual(['x'])
  })
  it('nilai rusak atau bukan array -> kosong, tidak melempar', () => {
    expect(idsDariKiosk([{ outlet_id: O, key: 'k', value: 'bukan json' }], O, 'k')).toEqual([])
    expect(idsDariKiosk([{ outlet_id: O, key: 'k', value: '{"a":1}' }], O, 'k')).toEqual([])
  })
})

describe('terapkanKetersediaanOutlet', () => {
  it('buang item yang available_outlets tak memuat outlet ini', () => {
    const hasil = terapkanKetersediaanOutlet([item('a', { available_outlets: ['lain'] }), item('b')], O, [])
    expect(hasil.map((i) => i.id)).toEqual(['b'])
  })
  it('available_outlets kosong [] berarti semua outlet (sama dengan POS)', () => {
    expect(terapkanKetersediaanOutlet([item('a', { available_outlets: [] })], O, []).length).toBe(1)
  })
  it('unavailable menandai habis, item tetap dikirim', () => {
    const kiosk = [{ outlet_id: O, key: 'unavailable_menu_ids', value: '["a"]' }]
    const hasil = terapkanKetersediaanOutlet([item('a')], O, kiosk)
    expect(hasil).toHaveLength(1)
    expect(hasil[0].is_available).toBe(false)
  })
  it('auto_unavailable dikalahkan force_available; manual unavailable tidak', () => {
    const kiosk = [
      { outlet_id: O, key: 'auto_unavailable_menu_ids', value: '["a","b"]' },
      { outlet_id: O, key: 'force_available_menu_ids', value: '["a","c"]' },
      { outlet_id: O, key: 'unavailable_menu_ids', value: '["c"]' },
    ]
    const hasil = terapkanKetersediaanOutlet([item('a'), item('b'), item('c')], O, kiosk)
    expect(hasil.map((i) => [i.id, i.is_available])).toEqual([['a', true], ['b', false], ['c', false]])
  })
  it('tak pernah menyalakan item yang is_available=false secara global', () => {
    const kiosk = [{ outlet_id: O, key: 'force_available_menu_ids', value: '["a"]' }]
    expect(terapkanKetersediaanOutlet([item('a', { is_available: false })], O, kiosk)[0].is_available).toBe(false)
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd apps/retail-gateway && yarn vitest run src/lib/menuHabisOutlet.test.ts` → FAIL (modul tak ada).

- [ ] **Step 3: Implementasi**

```ts
/**
 * Ketersediaan menu per outlet, dibaca PERSIS seperti POS kiosk
 * (apps/pos-kasir/app/page.tsx), supaya kasir dan aplikasi tak pernah
 * bertentangan ("habis di kasir, dijual di aplikasi").
 *
 * - `menu_items.available_outlets` terisi & tak memuat outlet -> item dibuang.
 * - `kiosk_settings` (TEXT berisi array JSON), baris outlet sendiri menang,
 *   bila tak ada jatuh ke baris PUSAT. Tak ada baris outlet_id NULL (PK).
 * - habis = manual unavailable ATAU (auto unavailable DAN tidak force available).
 */
export const PUSAT_OUTLET_ID = '550e8400-e29b-41d4-a716-446655440001'

export type BarisKiosk = { outlet_id: string; key: string; value: string | null }

function parseIds(raw: string | null): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function idsDariKiosk(baris: BarisKiosk[], outletId: string, key: string): string[] {
  const milikOutlet = baris.find((b) => b.key === key && b.outlet_id === outletId)
  if (milikOutlet) return parseIds(milikOutlet.value)
  const pusat = baris.find((b) => b.key === key && b.outlet_id === PUSAT_OUTLET_ID)
  return pusat ? parseIds(pusat.value) : []
}

export function terapkanKetersediaanOutlet<
  T extends { id: string; is_available: boolean; available_outlets?: unknown },
>(items: T[], outletId: string, kiosk: BarisKiosk[]): T[] {
  const manual = new Set(idsDariKiosk(kiosk, outletId, 'unavailable_menu_ids'))
  const auto = new Set(idsDariKiosk(kiosk, outletId, 'auto_unavailable_menu_ids'))
  const paksa = new Set(idsDariKiosk(kiosk, outletId, 'force_available_menu_ids'))

  return items
    .filter((i) => {
      const daftar = i.available_outlets
      return !(Array.isArray(daftar) && daftar.length > 0 && !daftar.includes(outletId))
    })
    .map((i) => {
      const habis = manual.has(i.id) || (auto.has(i.id) && !paksa.has(i.id))
      return habis && i.is_available ? { ...i, is_available: false } : i
    })
}
```

- [ ] **Step 4: Jalankan test** → Expected: PASS (8 test).

- [ ] **Step 5: Sambungkan ke `catalog.ts`**

Di `ambilKatalog`, tambahkan `available_outlets` ke daftar kolom `select`, lalu ganti blok setelah `if (error) { ... }`:

```ts
  // Daftar habis milik POS untuk outlet ini + PUSAT. Gagal membacanya =
  // katalog gagal: menjual menu yang ditandai habis lebih buruk daripada
  // layar galat (uang sudah diterima).
  const { data: kiosk, error: kioskError } = await db
    .from('kiosk_settings')
    .select('outlet_id, key, value')
    .in('outlet_id', [outletId, PUSAT_OUTLET_ID])
    .in('key', ['unavailable_menu_ids', 'auto_unavailable_menu_ids', 'force_available_menu_ids'])
  if (kioskError) {
    if (tersimpan && Date.now() - tersimpan.pada < UMUR_BASI_MAKS_MS) return tersimpan.data
    throw new Error(`Gagal mengambil ketersediaan outlet: ${kioskError.message}`)
  }

  const tersaring = terapkanKetersediaanOutlet(
    (data ?? []) as Array<{ id: string; is_available: boolean; available_outlets?: unknown }>,
    outletId,
    (kiosk ?? []) as BarisKiosk[],
  )
  const bersih = bersihkanKatalog(tersaring)
  cache.set(outletId, { pada: Date.now(), data: bersih })
  return bersih
```
Tambahkan import: `import { terapkanKetersediaanOutlet, PUSAT_OUTLET_ID, type BarisKiosk } from './menuHabisOutlet'`. Hapus komentar lama "Konsekuensi yang tetap berlaku: `is_available` global..." (sudah tak benar).

- [ ] **Step 6: Seluruh test gateway + type-check**

Run: `cd apps/retail-gateway && yarn test && yarn type-check`
Expected: semua PASS, 0 error.

- [ ] **Step 7: Commit**

```bash
git add apps/retail-gateway/src/lib/menuHabisOutlet.ts apps/retail-gateway/src/lib/menuHabisOutlet.test.ts apps/retail-gateway/src/lib/catalog.ts
git commit -m "fix(retail-gateway): katalog hormati menu habis per outlet (kiosk_settings) & available_outlets"
```

---

### Task 4: Gateway — pengaturan aplikasi + `GET /api/v1/config`

**Files:**
- Create: `apps/retail-gateway/src/lib/pengaturanApp.ts`
- Test: `apps/retail-gateway/src/lib/pengaturanApp.test.ts`
- Create: `apps/retail-gateway/src/app/api/v1/config/route.ts`

**Interfaces:**
- Produces:
```ts
export type PengaturanApp = { menitPesanTerakhir: number; estimasiSiap: string; waCs: string | null; versiMinimumAndroid: number; urlSyarat: string | null; urlPrivasi: string | null }
export const PENGATURAN_BAWAAN: PengaturanApp
export function petakanPengaturan(baris: unknown): PengaturanApp   // murni
export async function ambilPengaturan(): Promise<PengaturanApp>     // cache 60 dtk, tak pernah melempar
```

- [ ] **Step 1: Test yang gagal**

```ts
import { describe, it, expect } from 'vitest'
import { petakanPengaturan, PENGATURAN_BAWAAN } from './pengaturanApp'

describe('petakanPengaturan', () => {
  it('memetakan baris DB', () => {
    expect(petakanPengaturan({
      menit_pesan_terakhir: 45, estimasi_siap: '10 menit', wa_cs: '6281234567890',
      versi_minimum_android: 3, url_syarat: 'https://a', url_privasi: null,
    })).toEqual({
      menitPesanTerakhir: 45, estimasiSiap: '10 menit', waCs: '6281234567890',
      versiMinimumAndroid: 3, urlSyarat: 'https://a', urlPrivasi: null,
    })
  })
  it('baris kosong / rusak -> bawaan, bukan buka 24 jam', () => {
    expect(petakanPengaturan(null)).toEqual(PENGATURAN_BAWAAN)
    expect(petakanPengaturan({ menit_pesan_terakhir: 'abc' }).menitPesanTerakhir).toBe(30)
  })
})
```

- [ ] **Step 2: Jalankan → FAIL.** `yarn vitest run src/lib/pengaturanApp.test.ts`

- [ ] **Step 3: Implementasi `pengaturanApp.ts`**

```ts
import { createServiceClient } from './supabase'

export type PengaturanApp = {
  menitPesanTerakhir: number
  estimasiSiap: string
  waCs: string | null
  versiMinimumAndroid: number
  urlSyarat: string | null
  urlPrivasi: string | null
}

export const PENGATURAN_BAWAAN: PengaturanApp = {
  menitPesanTerakhir: 30,
  estimasiSiap: '15–20 menit',
  waCs: null,
  versiMinimumAndroid: 1,
  urlSyarat: null,
  urlPrivasi: null,
}

const angka = (v: unknown, cadangan: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : cadangan
const teks = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v : null)

export function petakanPengaturan(baris: unknown): PengaturanApp {
  if (typeof baris !== 'object' || baris === null) return PENGATURAN_BAWAAN
  const r = baris as Record<string, unknown>
  return {
    menitPesanTerakhir: angka(r.menit_pesan_terakhir, PENGATURAN_BAWAAN.menitPesanTerakhir),
    estimasiSiap: teks(r.estimasi_siap) ?? PENGATURAN_BAWAAN.estimasiSiap,
    waCs: teks(r.wa_cs),
    versiMinimumAndroid: angka(r.versi_minimum_android, 1),
    urlSyarat: teks(r.url_syarat),
    urlPrivasi: teks(r.url_privasi),
  }
}

let tersimpan: { pada: number; data: PengaturanApp } | null = null
const UMUR_MS = 60 * 1000

/**
 * Tak pernah melempar. DB gagal -> nilai terakhir, atau bawaan.
 * Bawaan (30 menit) = tetap ada batas; JANGAN jatuh ke "buka 24 jam".
 */
export async function ambilPengaturan(): Promise<PengaturanApp> {
  if (tersimpan && Date.now() - tersimpan.pada < UMUR_MS) return tersimpan.data
  try {
    const { data, error } = await createServiceClient()
      .from('app_pengaturan')
      .select('menit_pesan_terakhir, estimasi_siap, wa_cs, versi_minimum_android, url_syarat, url_privasi')
      .eq('id', 1)
      .maybeSingle()
    if (error) throw error
    tersimpan = { pada: Date.now(), data: petakanPengaturan(data) }
    return tersimpan.data
  } catch (e) {
    console.error('gagal membaca app_pengaturan', e)
    return tersimpan?.data ?? PENGATURAN_BAWAAN
  }
}
```

- [ ] **Step 4: Buat `app/api/v1/config/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { ambilPengaturan } from '@/lib/pengaturanApp'

export const dynamic = 'force-dynamic'

/** Publik (tanpa sesi): dibaca aplikasi sebelum login untuk cek versi minimum. */
export async function GET() {
  const p = await ambilPengaturan()
  return NextResponse.json(
    {
      estimasi_siap: p.estimasiSiap,
      wa_cs: p.waCs,
      versi_minimum_android: p.versiMinimumAndroid,
      url_syarat: p.urlSyarat,
      url_privasi: p.urlPrivasi,
    },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  )
}
```

- [ ] **Step 5: Test + type-check** → `yarn test && yarn type-check` PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/retail-gateway/src/lib/pengaturanApp.ts apps/retail-gateway/src/lib/pengaturanApp.test.ts apps/retail-gateway/src/app/api/v1/config/route.ts
git commit -m "feat(retail-gateway): pengaturan aplikasi + GET /api/v1/config"
```

---

### Task 5: Gateway — tegakkan status outlet (outlets, validate, orders)

**Files:**
- Create: `apps/retail-gateway/src/lib/statusOutletDb.ts`
- Modify: `apps/retail-gateway/src/app/api/v1/outlets/route.ts`
- Modify: `apps/retail-gateway/src/app/api/v1/checkout/validate/route.ts:31-58`
- Modify: `apps/retail-gateway/src/app/api/v1/orders/route.ts:119-139`

**Interfaces:**
- Consumes: `statusOutlet`, `pesanStatus`, `StatusOutlet` (Task 2); `ambilPengaturan` (Task 4).
- Produces:
```ts
export async function tutupSementaraAktif(outletIds: string[]): Promise<Map<string, TutupSementara[]>>  // kunci '*' = semua outlet
export async function statusUntuk(outlet: { id: string; open_hour: string | null; close_hour: string | null; is_active: boolean }, peta?: Map<string, TutupSementara[]>): Promise<StatusOutlet>
// `peta` dari tutupSementaraAktif() dipakai ulang di GET /outlets agar 21 outlet = 1 kueri, bukan 21.
```

- [ ] **Step 1: `statusOutletDb.ts`**

```ts
import { createServiceClient } from './supabase'
import { statusOutlet, type StatusOutlet, type TutupSementara } from './jamBuka'
import { ambilPengaturan } from './pengaturanApp'

/**
 * Tutup sementara yang masih berlaku. Kunci '*' = baris outlet_id NULL (semua).
 * MELEMPAR bila DB gagal: pemanggil di jalur pembayaran harus gagal-tertutup.
 */
export async function tutupSementaraAktif(outletIds: string[]): Promise<Map<string, TutupSementara[]>> {
  const { data, error } = await createServiceClient()
    .from('outlet_tutup_sementara')
    .select('outlet_id, sampai, alasan')
    .is('dicabut_pada', null)
    .gt('sampai', new Date().toISOString())
    .or(`outlet_id.is.null,outlet_id.in.(${outletIds.join(',')})`)
  if (error) throw new Error(`Gagal membaca tutup sementara: ${error.message}`)

  const peta = new Map<string, TutupSementara[]>()
  for (const r of data ?? []) {
    const kunci = r.outlet_id ?? '*'
    const daftar = peta.get(kunci) ?? []
    daftar.push({ sampai: new Date(r.sampai), alasan: r.alasan })
    peta.set(kunci, daftar)
  }
  return peta
}

export async function statusUntuk(
  outlet: { id: string; open_hour: string | null; close_hour: string | null; is_active: boolean },
  peta?: Map<string, TutupSementara[]>,
): Promise<StatusOutlet> {
  const [pengaturan, tutup] = await Promise.all([
    ambilPengaturan(),
    peta ? Promise.resolve(peta) : tutupSementaraAktif([outlet.id]),
  ])
  return statusOutlet({
    sekarang: new Date(),
    openHour: outlet.open_hour,
    closeHour: outlet.close_hour,
    isActive: outlet.is_active,
    tutupSementara: [...(tutup.get(outlet.id) ?? []), ...(tutup.get('*') ?? [])],
    menitPesanTerakhir: pengaturan.menitPesanTerakhir,
  })
}
```

- [ ] **Step 2: `outlets/route.ts`** — ganti isi fungsi `GET`:

```ts
export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('outlets')
    .select('id, name, address, lat, lng, is_active, open_hour, close_hour')
    .eq('app_enabled', true)
    .neq('type', 'marketplace')
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Gagal memuat outlet' }, { status: 502 })
  }

  const outlets = data ?? []
  let peta
  try {
    peta = await tutupSementaraAktif(outlets.map((o) => o.id))
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal memuat outlet' }, { status: 502 })
  }

  const hasil = await Promise.all(outlets.map(async (o) => {
    const s = await statusUntuk(o, peta)
    return {
      ...o,
      // `is_active` sengaja TIDAK diubah artinya: APK versionCode 1 membacanya.
      bisa_pesan: s.bisaPesan,
      alasan: s.alasan,
      buka_lagi: s.bukaLagi?.toISOString() ?? null,
      pesan_terakhir: s.pesanTerakhir?.toISOString() ?? null,
      alasan_tutup: s.alasanTutup,
      pesan_status: s.bisaPesan ? null : pesanStatus(s),
    }
  }))
  return NextResponse.json({ outlets: hasil })
}
```
Import: `import { tutupSementaraAktif, statusUntuk } from '@/lib/statusOutletDb'` dan `import { pesanStatus } from '@/lib/jamBuka'`.

- [ ] **Step 3: `checkout/validate/route.ts`** — ubah select outlet menjadi `'id, name, app_enabled, is_active, open_hour, close_hour'`, lalu ganti blok `if (outlet.is_active === false) {...}` dengan:

```ts
  let status
  try {
    status = await statusUntuk(outlet)
  } catch (e) {
    console.error('gagal menghitung status outlet', e)
    return NextResponse.json({ error: 'Gagal memeriksa outlet' }, { status: 502 })
  }
  if (!status.bisaPesan) {
    return NextResponse.json(
      { ok: false, alasan: 'outlet_tutup', pesan: pesanStatus(status) },
      { status: 200 },
    )
  }
```

- [ ] **Step 4: `orders/route.ts`** — ubah select outlet sama seperti Step 3. Pisahkan blok gabungan menjadi:

```ts
  if (!outlet || outlet.app_enabled !== true) {
    return NextResponse.json({ error: 'Outlet sedang tidak bisa menerima pesanan' }, { status: 409 })
  }

  // Titik pembuatan tagihan QRIS -- penjaga terakhir. `validate` saja tidak
  // cukup: aplikasi lama atau pelanggan yang membuka menu sejak 21.25 tetap
  // bisa langsung memanggil endpoint ini.
  let status
  try {
    status = await statusUntuk(outlet)
  } catch (e) {
    console.error('gagal menghitung status outlet', e)
    return NextResponse.json({ error: 'Gagal memeriksa outlet' }, { status: 502 })
  }
  if (!status.bisaPesan) {
    return NextResponse.json(
      { error: 'outlet_tutup', alasan: 'outlet_tutup', pesan: pesanStatus(status) },
      { status: 409 },
    )
  }
```
Catatan: jalur idempoten di awal route (draft `client_order_id` yang sudah ada) **tidak** diubah — pesanan yang tagihannya sudah dibuat tetap bisa diselesaikan.

- [ ] **Step 5: Uji manual endpoint lokal** (butuh `.env.local` gateway)

Run: `cd apps/retail-gateway && yarn dev` lalu
`curl -s localhost:3000/api/v1/outlets | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s).outlets[0];console.log(o.name,o.bisa_pesan,o.alasan,o.pesan_status)})"`
Expected: pukul 14.00–21.29 WIB → `true buka null`; di luar itu `false` + kalimat "Buka pukul 14.00".
`curl -s localhost:3000/api/v1/config` → JSON dengan `versi_minimum_android: 1`.

- [ ] **Step 6: Test + type-check + build**

Run: `yarn test && yarn type-check && yarn build` → PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/retail-gateway/src/lib/statusOutletDb.ts apps/retail-gateway/src/app/api/v1/outlets/route.ts apps/retail-gateway/src/app/api/v1/checkout/validate/route.ts apps/retail-gateway/src/app/api/v1/orders/route.ts
git commit -m "feat(retail-gateway): tegakkan jam buka & tutup sementara di outlets, validate, dan orders"
```

---

### Task 6: Admin — fungsi murni + server action pengaman

**Files:**
- Create: `apps/admin-dashboard/src/lib/appRetail/jamBuka.ts` + `jamBuka.test.ts` — **salin identik** dari Task 2 (isi & test sama persis; ubah hanya komentar kepala menunjuk ke salinan gateway).
- Create: `apps/admin-dashboard/src/lib/appRetail/menuHabis.ts` + test
- Create: `apps/admin-dashboard/src/lib/appRetail/pengaturanForm.ts` + test
- Create: `apps/admin-dashboard/src/lib/appRetail/tutupSementara.ts` + test
- Create: `apps/admin-dashboard/src/app/dashboard/app-retail/pengamanActions.ts`

**Interfaces:**
- Produces:
```ts
// menuHabis.ts
export function gabungDaftarHabis(daftarLama: string | null, idMenuAplikasi: string[], idHabisBaru: string[]): string   // JSON array TEXT
// pengaturanForm.ts
export type InputPengaturan = { menitPesanTerakhir: number; menitTertahan: number; estimasiSiap: string; waCs: string; versiMinimumAndroid: number; urlSyarat: string; urlPrivasi: string }
export function periksaPengaturan(i: InputPengaturan): string | null   // pesan galat atau null
export function normalisasiWa(nilai: string): string | null            // '0812…' -> '62812…'
// tutupSementara.ts
export type PilihanSampai = 'tutup_hari_ini' | 'besok_buka' | 'kustom'
export function hitungSampai(p: PilihanSampai, sekarang: Date, closeHour: string | null, openHour: string | null, kustom: Date | null): Date
// pengamanActions.ts ('use server')
export async function ubahJamOutlet(outletId: string, openHour: string, closeHour: string): Promise<void>
export async function tutupSementara(outletId: string | null, sampai: string, alasan: string): Promise<void>
export async function bukaSekarang(tutupId: string): Promise<void>
export async function simpanMenuHabis(outletId: string, idMenuAplikasi: string[], idHabis: string[]): Promise<void>
export async function simpanPengaturan(input: InputPengaturan): Promise<void>
export async function tandaiRefundSelesai(refundId: string, catatan: string): Promise<void>
```

- [ ] **Step 1: Salin `jamBuka.ts` + test dari gateway, jalankan** — `cd apps/admin-dashboard && yarn vitest run src/lib/appRetail/jamBuka.test.ts` → PASS (13).

- [ ] **Step 2: Test gagal untuk tiga modul baru**

```ts
// menuHabis.test.ts
import { describe, it, expect } from 'vitest'
import { gabungDaftarHabis } from './menuHabis'

describe('gabungDaftarHabis', () => {
  it('mempertahankan id non-aplikasi (milik POS) yang sudah ada', () => {
    const hasil = JSON.parse(gabungDaftarHabis('["pos-only","app-1"]', ['app-1', 'app-2'], ['app-2']))
    expect(hasil.sort()).toEqual(['app-2', 'pos-only'])
  })
  it('nilai lama null/rusak dianggap kosong', () => {
    expect(JSON.parse(gabungDaftarHabis(null, ['a'], ['a']))).toEqual(['a'])
    expect(JSON.parse(gabungDaftarHabis('rusak', ['a'], []))).toEqual([])
  })
  it('tanpa duplikat', () => {
    expect(JSON.parse(gabungDaftarHabis('["a"]', ['a'], ['a']))).toEqual(['a'])
  })
})
```

```ts
// pengaturanForm.test.ts
import { describe, it, expect } from 'vitest'
import { periksaPengaturan, normalisasiWa, type InputPengaturan } from './pengaturanForm'

const sah: InputPengaturan = {
  menitPesanTerakhir: 30, menitTertahan: 10, estimasiSiap: '15–20 menit',
  waCs: '081234567890', versiMinimumAndroid: 1, urlSyarat: '', urlPrivasi: 'https://x.id/privasi',
}
describe('periksaPengaturan', () => {
  it('input sah -> null', () => expect(periksaPengaturan(sah)).toBeNull())
  it('batas CHECK DB', () => {
    expect(periksaPengaturan({ ...sah, menitPesanTerakhir: 181 })).toMatch(/0–180/)
    expect(periksaPengaturan({ ...sah, menitTertahan: 0 })).toMatch(/1–120/)
    expect(periksaPengaturan({ ...sah, estimasiSiap: '' })).toMatch(/Estimasi/)
    expect(periksaPengaturan({ ...sah, versiMinimumAndroid: 0 })).toMatch(/Versi/)
  })
  it('URL wajib https bila diisi', () => {
    expect(periksaPengaturan({ ...sah, urlSyarat: 'http://x.id' })).toMatch(/https/)
  })
  it('WA tak sah ditolak, kosong boleh', () => {
    expect(periksaPengaturan({ ...sah, waCs: '12345' })).toMatch(/WhatsApp/)
    expect(periksaPengaturan({ ...sah, waCs: '' })).toBeNull()
  })
})
describe('normalisasiWa', () => {
  it('08.. / +62.. / 62.. -> 62..', () => {
    expect(normalisasiWa('0812-3456-7890')).toBe('6281234567890')
    expect(normalisasiWa('+62 812 3456 7890')).toBe('6281234567890')
    expect(normalisasiWa('')).toBeNull()
  })
})
```

```ts
// tutupSementara.test.ts
import { describe, it, expect } from 'vitest'
import { hitungSampai } from './tutupSementara'

const wib = (s: string) => new Date(`${s}+07:00`)
describe('hitungSampai', () => {
  it('tutup hari ini = jam tutup hari ini', () => {
    expect(hitungSampai('tutup_hari_ini', wib('2026-09-24T15:00:00'), '22:00:00', '14:00:00', null).toISOString())
      .toBe(wib('2026-09-24T22:00:00').toISOString())
  })
  it('besok buka = jam buka besok', () => {
    expect(hitungSampai('besok_buka', wib('2026-09-24T15:00:00'), '22:00:00', '14:00:00', null).toISOString())
      .toBe(wib('2026-09-25T14:00:00').toISOString())
  })
  it('kustom dipakai apa adanya; di masa lalu melempar', () => {
    const k = wib('2026-09-26T10:00:00')
    expect(hitungSampai('kustom', wib('2026-09-24T15:00:00'), null, null, k)).toEqual(k)
    expect(() => hitungSampai('kustom', wib('2026-09-24T15:00:00'), null, null, wib('2026-09-24T14:00:00'))).toThrow()
  })
  it('tutup hari ini setelah jam tutup melempar (tak ada artinya)', () => {
    expect(() => hitungSampai('tutup_hari_ini', wib('2026-09-24T23:00:00'), '22:00:00', '14:00:00', null)).toThrow()
  })
})
```

Run: `yarn vitest run src/lib/appRetail/menuHabis.test.ts src/lib/appRetail/pengaturanForm.test.ts src/lib/appRetail/tutupSementara.test.ts` → FAIL.

- [ ] **Step 3: Implementasi tiga modul**

```ts
// menuHabis.ts
/**
 * `kiosk_settings.unavailable_menu_ids` dipakai BERSAMA dengan POS. Admin
 * hanya mengatur menu aplikasi; id lain di daftar (menu POS saja) WAJIB
 * dipertahankan, kalau tidak dialog ini diam-diam "menjual lagi" menu kasir.
 */
export function gabungDaftarHabis(daftarLama: string | null, idMenuAplikasi: string[], idHabisBaru: string[]): string {
  let lama: string[] = []
  try {
    const v = daftarLama ? JSON.parse(daftarLama) : []
    lama = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch { lama = [] }
  const aplikasi = new Set(idMenuAplikasi)
  const dipertahankan = lama.filter((id) => !aplikasi.has(id))
  return JSON.stringify([...new Set([...dipertahankan, ...idHabisBaru])])
}
```

```ts
// pengaturanForm.ts
export type InputPengaturan = {
  menitPesanTerakhir: number
  menitTertahan: number
  estimasiSiap: string
  waCs: string
  versiMinimumAndroid: number
  urlSyarat: string
  urlPrivasi: string
}

export function normalisasiWa(nilai: string): string | null {
  const angka = nilai.replace(/[^0-9]/g, '')
  if (angka === '') return null
  if (angka.startsWith('0')) return `62${angka.slice(1)}`
  return angka
}

/** Cermin CHECK di migration 20260924100000 -- ubah keduanya bersamaan. */
export function periksaPengaturan(i: InputPengaturan): string | null {
  if (!Number.isInteger(i.menitPesanTerakhir) || i.menitPesanTerakhir < 0 || i.menitPesanTerakhir > 180)
    return 'Batas pesan terakhir harus 0–180 menit.'
  if (!Number.isInteger(i.menitTertahan) || i.menitTertahan < 1 || i.menitTertahan > 120)
    return 'Batas tertahan harus 1–120 menit.'
  const est = i.estimasiSiap.trim()
  if (est.length < 1 || est.length > 40) return 'Estimasi waktu siap wajib diisi (maks 40 huruf).'
  if (!Number.isInteger(i.versiMinimumAndroid) || i.versiMinimumAndroid < 1) return 'Versi minimum minimal 1.'
  const wa = normalisasiWa(i.waCs)
  if (wa !== null && !/^62[0-9]{8,13}$/.test(wa)) return 'Nomor WhatsApp CS tidak sah.'
  for (const url of [i.urlSyarat, i.urlPrivasi]) {
    if (url.trim() !== '' && !url.trim().startsWith('https://')) return 'Link harus diawali https://'
  }
  return null
}
```

```ts
// tutupSementara.ts
import { statusOutlet } from './jamBuka'

export type PilihanSampai = 'tutup_hari_ini' | 'besok_buka' | 'kustom'

const WIB_MS = 7 * 60 * 60 * 1000
const HARI_MS = 24 * 60 * 60 * 1000

function jamPadaTanggalWib(dasar: Date, jam: string, tambahHari: number): Date {
  const awal = Math.floor((dasar.getTime() + WIB_MS) / HARI_MS) * HARI_MS - WIB_MS
  const [h, m] = jam.split(':').map(Number)
  return new Date(awal + tambahHari * HARI_MS + (h * 60 + m) * 60 * 1000)
}

export function hitungSampai(
  p: PilihanSampai, sekarang: Date, closeHour: string | null, openHour: string | null, kustom: Date | null,
): Date {
  let hasil: Date
  if (p === 'kustom') {
    if (!kustom) throw new Error('Pilih tanggal & jam.')
    hasil = kustom
  } else if (p === 'tutup_hari_ini') {
    if (!closeHour) throw new Error('Outlet ini belum punya jam tutup.')
    hasil = jamPadaTanggalWib(sekarang, closeHour, 0)
  } else {
    if (!openHour) throw new Error('Outlet ini belum punya jam buka.')
    // "Besok buka" = pembukaan berikutnya menurut aturan yang sama dengan gateway.
    const s = statusOutlet({
      sekarang, openHour, closeHour, isActive: true, tutupSementara: [], menitPesanTerakhir: 0,
    })
    hasil = s.bukaLagi ?? jamPadaTanggalWib(sekarang, openHour, 1)
  }
  if (hasil.getTime() <= sekarang.getTime()) throw new Error('Waktu "sampai" sudah lewat.')
  return hasil
}
```

> Catatan untuk "besok buka" saat outlet sedang buka: `statusOutlet` mengembalikan `bukaLagi = null` ketika status `buka`, sehingga jatuh ke `jamPadaTanggalWib(..., 1)` = jam buka besok. Itu yang diinginkan.

- [ ] **Step 4: Jalankan tiga test** → PASS.

- [ ] **Step 5: `pengamanActions.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import { gabungDaftarHabis } from '@/lib/appRetail/menuHabis'
import { periksaPengaturan, normalisasiWa, type InputPengaturan } from '@/lib/appRetail/pengaturanForm'

/**
 * Semua aksi tahap 1: cek role DI SERVER -> service client -> log.
 * 'use server' BUKAN privat (setiap export = endpoint POST); guard halaman
 * berjalan di browser dan tak melindungi action ini (Session 2026-07-20).
 */
const PERAN = ['owner', 'admin']

type Aksi = 'pengaturan_ubah' | 'tutup_sementara' | 'buka_sekarang' | 'jam_ubah' | 'menu_habis_ubah' | 'refund_selesai'

async function catat(db: ReturnType<typeof createServiceClient>, aksi: Aksi, oleh: string, sasaranId: string | null, data: unknown) {
  const { error } = await db.from('app_retail_log').insert({ aksi, oleh, sasaran_id: sasaranId, data })
  // Log gagal = aksi dianggap gagal dilaporkan; perubahan sudah terjadi, jadi
  // galat dilempar supaya admin tahu jejaknya tak tercatat.
  if (error) throw new Error(`Perubahan tersimpan, tapi log gagal ditulis: ${error.message}`)
}

function segarkan() {
  revalidatePath('/dashboard/app-retail')
  revalidatePath('/dashboard/app-retail/outlet')
  revalidatePath('/dashboard/app-retail/pesanan')
  revalidatePath('/dashboard/app-retail/pengaturan')
}

const JAM = /^([01]\d|2[0-3]):[0-5]\d$/

export async function ubahJamOutlet(outletId: string, openHour: string, closeHour: string) {
  const { userId } = await requireRole(PERAN)
  if (!JAM.test(openHour) || !JAM.test(closeHour)) throw new Error('Format jam harus HH:MM.')
  if (openHour === closeHour) throw new Error('Jam buka dan tutup tidak boleh sama.')
  const db = createServiceClient()
  const { data: lama } = await db.from('outlets').select('open_hour, close_hour').eq('id', outletId).maybeSingle()
  const { data, error } = await db.from('outlets')
    .update({ open_hour: `${openHour}:00`, close_hour: `${closeHour}:00` })
    .eq('id', outletId).select('id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('Outlet tidak ditemukan.')
  await catat(db, 'jam_ubah', userId, outletId, { sebelum: lama, sesudah: { openHour, closeHour } })
  segarkan()
}

export async function tutupSementara(outletId: string | null, sampaiIso: string, alasan: string) {
  const { userId } = await requireRole(PERAN)
  const sampai = new Date(sampaiIso)
  if (!Number.isFinite(sampai.getTime()) || sampai.getTime() <= Date.now()) throw new Error('Waktu "sampai" sudah lewat.')
  const rapi = alasan.trim()
  if (rapi.length > 120) throw new Error('Alasan maksimal 120 huruf.')
  const db = createServiceClient()
  const { data, error } = await db.from('outlet_tutup_sementara')
    .insert({ outlet_id: outletId, sampai: sampai.toISOString(), alasan: rapi || null, dibuat_oleh: userId })
    .select('id').single()
  if (error) throw new Error(error.message)
  await catat(db, 'tutup_sementara', userId, outletId, { id: data.id, sampai: sampai.toISOString(), alasan: rapi || null })
  segarkan()
}

export async function bukaSekarang(tutupId: string) {
  const { userId } = await requireRole(PERAN)
  const db = createServiceClient()
  const { data, error } = await db.from('outlet_tutup_sementara')
    .update({ dicabut_oleh: userId, dicabut_pada: new Date().toISOString() })
    .eq('id', tutupId).is('dicabut_pada', null).select('id, outlet_id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('Penutupan ini sudah tidak aktif.')
  await catat(db, 'buka_sekarang', userId, data[0].outlet_id, { id: tutupId })
  segarkan()
}

export async function simpanMenuHabis(outletId: string, idMenuAplikasi: string[], idHabis: string[]) {
  const { userId } = await requireRole(PERAN)
  const db = createServiceClient()
  const { data: lama, error: bacaError } = await db.from('kiosk_settings')
    .select('value').eq('outlet_id', outletId).eq('key', 'unavailable_menu_ids').maybeSingle()
  if (bacaError) throw new Error(bacaError.message)
  const nilai = gabungDaftarHabis(lama?.value ?? null, idMenuAplikasi, idHabis)
  const { error } = await db.from('kiosk_settings')
    .upsert({ outlet_id: outletId, key: 'unavailable_menu_ids', value: nilai }, { onConflict: 'outlet_id,key' })
  if (error) throw new Error(error.message)
  await catat(db, 'menu_habis_ubah', userId, outletId, { sebelum: lama?.value ?? null, sesudah: nilai })
  segarkan()
}

export async function simpanPengaturan(input: InputPengaturan) {
  const { userId } = await requireRole(PERAN)
  const galat = periksaPengaturan(input)
  if (galat) throw new Error(galat)
  const db = createServiceClient()
  const { data: lama } = await db.from('app_pengaturan').select('*').eq('id', 1).maybeSingle()
  const baru = {
    menit_pesan_terakhir: input.menitPesanTerakhir,
    menit_tertahan: input.menitTertahan,
    estimasi_siap: input.estimasiSiap.trim(),
    wa_cs: normalisasiWa(input.waCs),
    versi_minimum_android: input.versiMinimumAndroid,
    url_syarat: input.urlSyarat.trim() || null,
    url_privasi: input.urlPrivasi.trim() || null,
    diubah_oleh: userId,
    diubah_pada: new Date().toISOString(),
  }
  const { error } = await db.from('app_pengaturan').update(baru).eq('id', 1)
  if (error) throw new Error(error.message)
  await catat(db, 'pengaturan_ubah', userId, null, { sebelum: lama, sesudah: baru })
  segarkan()
}

export async function tandaiRefundSelesai(refundId: string, catatan: string) {
  const { userId } = await requireRole(PERAN)
  const rapi = catatan.trim()
  if (rapi === '') throw new Error('Catatan/referensi transfer wajib diisi.')
  const db = createServiceClient()
  const retail = db.schema('retail')
  const { data, error } = await retail.from('refund_pesanan')
    .update({ status: 'sudah', catatan: rapi, diproses_oleh: userId, diproses_pada: new Date().toISOString() })
    .eq('id', refundId).eq('status', 'perlu')
    .select('id, customer_id, order_id, nominal')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('Refund ini sudah diproses.')
  const r = data[0]
  const { error: notifError } = await retail.from('customer_notifications').insert({
    customer_id: r.customer_id,
    order_id: r.order_id,
    type: 'order_status',
    title: 'Dana dikembalikan',
    body: `Dana Rp ${Number(r.nominal).toLocaleString('id-ID')} untuk pesananmu sudah dikembalikan.`,
    data: { refund_id: r.id },
  })
  if (notifError) console.error('notifikasi refund gagal', notifError)
  await catat(db, 'refund_selesai', userId, r.order_id, { refund_id: r.id, nominal: r.nominal, catatan: rapi })
  segarkan()
}
```

> Sebelum memakai kolom `customer_notifications`, cocokkan dengan skema nyata:
> `select column_name from information_schema.columns where table_schema='retail' and table_name='customer_notifications'`. Sesuaikan nama kolom insert di atas bila berbeda.

- [ ] **Step 6: Test + type-check** — `cd apps/admin-dashboard && yarn test && yarn type-check`. Expected: test baru PASS; jumlah kegagalan lain **sama dengan baseline** (catat baseline sebelum mulai: `yarn test 2>&1 | tail -5`).

- [ ] **Step 7: Commit**

```bash
git add apps/admin-dashboard/src/lib/appRetail/jamBuka.ts apps/admin-dashboard/src/lib/appRetail/jamBuka.test.ts apps/admin-dashboard/src/lib/appRetail/menuHabis.ts apps/admin-dashboard/src/lib/appRetail/menuHabis.test.ts apps/admin-dashboard/src/lib/appRetail/pengaturanForm.ts apps/admin-dashboard/src/lib/appRetail/pengaturanForm.test.ts apps/admin-dashboard/src/lib/appRetail/tutupSementara.ts apps/admin-dashboard/src/lib/appRetail/tutupSementara.test.ts apps/admin-dashboard/src/app/dashboard/app-retail/pengamanActions.ts
git commit -m "feat(admin-dashboard): server action pengaman App Retail (requireRole + log)"
```

---

### Task 7: Admin — Outlet Aplikasi: jam, tutup sementara, menu habis

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/app-retail/outlet/page.tsx`
- Modify: `apps/admin-dashboard/src/app/dashboard/app-retail/outlet/OutletAppView.tsx`
- Create: `apps/admin-dashboard/src/app/dashboard/app-retail/outlet/DialogTutupSementara.tsx`
- Create: `apps/admin-dashboard/src/app/dashboard/app-retail/outlet/DialogMenuHabis.tsx`
- Create: `apps/admin-dashboard/src/app/dashboard/app-retail/outlet/DialogJam.tsx`

**Interfaces:**
- Consumes: `statusOutlet` (admin salinan), `hitungSampai`, action `ubahJamOutlet`, `tutupSementara`, `bukaSekarang`, `simpanMenuHabis`.
- Produces: props `OutletAppView({ outlets, jumlahMenuTayang, tutupAktif, menuAplikasi, daftarHabis, menitPesanTerakhir })` dengan
```ts
type TutupAktif = { id: string; outlet_id: string | null; sampai: string; alasan: string | null }
type MenuRingkas = { id: string; name: string }
```

- [ ] **Step 1: `page.tsx` memuat data tambahan** (server component). Setelah kueri yang sudah ada, tambahkan (pakai service client setelah `requireRole`, karena tabel baru hanya bisa dibaca owner/admin dan halaman ini memang untuk mereka):

```ts
import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'

  await requireRole(['owner', 'admin'])
  const svc = createServiceClient()
  const [tutupRes, menuRes, kioskRes, pengaturanRes] = await Promise.all([
    svc.from('outlet_tutup_sementara').select('id, outlet_id, sampai, alasan')
      .is('dicabut_pada', null).gt('sampai', new Date().toISOString()),
    svc.from('menu_items').select('id, name').eq('tampil_di_app', true).order('sort_order'),
    svc.from('kiosk_settings').select('outlet_id, value').eq('key', 'unavailable_menu_ids'),
    svc.from('app_pengaturan').select('menit_pesan_terakhir').eq('id', 1).maybeSingle(),
  ])
  const daftarHabis: Record<string, string[]> = {}
  for (const r of kioskRes.data ?? []) {
    try { const v = JSON.parse(r.value ?? '[]'); daftarHabis[r.outlet_id] = Array.isArray(v) ? v : [] } catch { daftarHabis[r.outlet_id] = [] }
  }
```
Tambahkan `open_hour, close_hour` ke select outlets yang sudah ada, lalu teruskan ke `OutletAppView` sebagai `tutupAktif={tutupRes.data ?? []}`, `menuAplikasi={menuRes.data ?? []}`, `daftarHabis`, `menitPesanTerakhir={pengaturanRes.data?.menit_pesan_terakhir ?? 30}`. Perluas tipe `OutletApp` di `lib/appRetail/kesiapanOutlet.ts` dengan `open_hour: string | null; close_hour: string | null` (opsional agar test lama tetap jalan).

- [ ] **Step 2: Kolom baru di tabel `OutletAppView`** — import `statusOutlet, pesanStatus` dari `@/lib/appRetail/jamBuka`, action `bukaSekarang` dari `../pengamanActions`, dan ketiga dialog. Tambahkan dua `<th>`: "Status sekarang", "Aksi". Isi per baris:

```tsx
const tutupOutlet = tutupAktif.filter((t) => t.outlet_id === o.id || t.outlet_id === null)
const s = statusOutlet({
  sekarang: new Date(), openHour: o.open_hour ?? null, closeHour: o.close_hour ?? null,
  isActive: o.is_active, menitPesanTerakhir,
  tutupSementara: tutupOutlet.map((t) => ({ sampai: new Date(t.sampai), alasan: t.alasan })),
})
// ...
<td className="py-3 px-4">
  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.bisaPesan ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
    {s.bisaPesan ? 'Bisa pesan' : pesanStatus(s)}
  </span>
  <p className="text-[11px] text-slate-400 mt-0.5">
    Jam {o.open_hour?.slice(0, 5) ?? '—'}–{o.close_hour?.slice(0, 5) ?? '—'}
  </p>
</td>
<td className="py-3 px-4 whitespace-nowrap space-x-1">
  <button type="button" onClick={() => setDialog({ jenis: 'jam', outlet: o })} className="text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200 cursor-pointer">Jam</button>
  {tutupOutlet.some((t) => t.outlet_id === o.id)
    ? <button type="button" onClick={() => jalankanBuka(tutupOutlet.find((t) => t.outlet_id === o.id)!.id)} className="text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-600 text-white cursor-pointer">Buka sekarang</button>
    : <button type="button" onClick={() => setDialog({ jenis: 'tutup', outlet: o })} className="text-[11px] font-bold px-2 py-1 rounded-lg border border-red-200 text-red-700 cursor-pointer">Tutup sementara</button>}
  <button type="button" onClick={() => setDialog({ jenis: 'habis', outlet: o })} className="text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200 cursor-pointer">Menu habis ({(daftarHabis[o.id] ?? []).filter((id) => menuAplikasi.some((m) => m.id === id)).length})</button>
</td>
```
State: `const [dialog, setDialog] = useState<{ jenis: 'jam' | 'tutup' | 'habis' | 'tutup_semua'; outlet: OutletApp | null } | null>(null)`. `jalankanBuka(id)` memanggil `bukaSekarang(id)` di dalam `mulai(async () => {...})` dengan penanganan galat yang sama seperti `jalankan`. Di atas tabel: tombol **Tutup semua outlet** → `setDialog({ jenis: 'tutup_semua', outlet: null })`; bila ada baris `tutupAktif` dengan `outlet_id === null`, tampilkan banner merah "Semua outlet ditutup s/d …" + tombol **Buka sekarang** untuk id itu.

- [ ] **Step 3: `DialogTutupSementara.tsx`**

```tsx
'use client'
import { useState, useTransition } from 'react'
import { hitungSampai, type PilihanSampai } from '@/lib/appRetail/tutupSementara'
import { tutupSementara } from '../pengamanActions'

export default function DialogTutupSementara({ outlet, onTutup }: {
  outlet: { id: string; name: string; open_hour?: string | null; close_hour?: string | null } | null // null = semua outlet
  onTutup: () => void
}) {
  const [pilihan, setPilihan] = useState<PilihanSampai>('tutup_hari_ini')
  const [kustom, setKustom] = useState('')
  const [alasan, setAlasan] = useState('')
  const [galat, setGalat] = useState('')
  const [bekerja, mulai] = useTransition()

  function simpan() {
    setGalat('')
    let sampai: Date
    try {
      // Untuk "semua outlet", jam tutup/buka memakai 22:00/14:00 (semua outlet sama per 2026-09-23);
      // pilihan kustom tetap tersedia bila berbeda.
      sampai = hitungSampai(
        pilihan, new Date(),
        outlet ? outlet.close_hour ?? null : '22:00:00',
        outlet ? outlet.open_hour ?? null : '14:00:00',
        kustom ? new Date(`${kustom}:00+07:00`) : null,
      )
    } catch (e) { setGalat(e instanceof Error ? e.message : 'Waktu tidak sah'); return }
    mulai(async () => {
      try { await tutupSementara(outlet?.id ?? null, sampai.toISOString(), alasan); onTutup() }
      catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal menutup outlet') }
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3">
        <p className="font-bold text-slate-900">Tutup sementara {outlet ? outlet.name : 'SEMUA outlet'}</p>
        {(['tutup_hari_ini', 'besok_buka', 'kustom'] as const).map((p) => (
          <label key={p} className="flex items-center gap-2 text-sm">
            <input type="radio" checked={pilihan === p} onChange={() => setPilihan(p)} />
            {p === 'tutup_hari_ini' ? 'Sampai jam tutup hari ini' : p === 'besok_buka' ? 'Sampai buka berikutnya' : 'Sampai tanggal & jam…'}
          </label>
        ))}
        {pilihan === 'kustom' && (
          <input type="datetime-local" value={kustom} onChange={(e) => setKustom(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        )}
        <input value={alasan} maxLength={120} onChange={(e) => setAlasan(e.target.value)}
          placeholder="Alasan untuk pelanggan (opsional), mis. Renovasi"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        <p className="text-[11px] text-slate-500">Outlet akan aktif lagi otomatis setelah waktu ini.</p>
        {galat && <p className="text-sm text-red-600">{galat}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onTutup} className="flex-1 py-2 rounded-xl border border-slate-200 font-bold text-sm cursor-pointer">Batal</button>
          <button type="button" disabled={bekerja} onClick={simpan} className="flex-1 py-2 rounded-xl bg-red-600 text-white font-bold text-sm cursor-pointer disabled:opacity-60">Tutup</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `DialogJam.tsx`** — dua `<input type="time">` (nilai awal `open_hour.slice(0,5)` / `close_hour.slice(0,5)`), tombol Simpan memanggil `ubahJamOutlet(outlet.id, buka, tutup)`. Bila `tutup <= buka`, tampilkan konfirmasi "Jam tutup melewati tengah malam?" sebelum menyimpan:

```tsx
'use client'
import { useState, useTransition } from 'react'
import { ubahJamOutlet } from '../pengamanActions'

export default function DialogJam({ outlet, onTutup }: {
  outlet: { id: string; name: string; open_hour?: string | null; close_hour?: string | null }
  onTutup: () => void
}) {
  const [buka, setBuka] = useState(outlet.open_hour?.slice(0, 5) ?? '14:00')
  const [tutup, setTutup] = useState(outlet.close_hour?.slice(0, 5) ?? '22:00')
  const [yakinMalam, setYakinMalam] = useState(false)
  const [galat, setGalat] = useState('')
  const [bekerja, mulai] = useTransition()
  const lewatMalam = tutup <= buka

  function simpan() {
    if (lewatMalam && !yakinMalam) { setGalat('Centang konfirmasi bila jam tutup memang lewat tengah malam.'); return }
    setGalat('')
    mulai(async () => {
      try { await ubahJamOutlet(outlet.id, buka, tutup); onTutup() }
      catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal menyimpan jam') }
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3">
        <p className="font-bold text-slate-900">Jam buka {outlet.name}</p>
        <p className="text-[11px] text-slate-500">Berlaku setiap hari. Pesan terakhir mengikuti setelan di Pengaturan Aplikasi.</p>
        <div className="flex gap-2 items-center text-sm">
          <input type="time" value={buka} onChange={(e) => setBuka(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1" />
          <span>–</span>
          <input type="time" value={tutup} onChange={(e) => setTutup(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1" />
        </div>
        {lewatMalam && (
          <label className="flex items-center gap-2 text-sm text-amber-700">
            <input type="checkbox" checked={yakinMalam} onChange={(e) => setYakinMalam(e.target.checked)} />
            Jam tutup melewati tengah malam
          </label>
        )}
        {galat && <p className="text-sm text-red-600">{galat}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onTutup} className="flex-1 py-2 rounded-xl border border-slate-200 font-bold text-sm cursor-pointer">Batal</button>
          <button type="button" disabled={bekerja} onClick={simpan} className="flex-1 py-2 rounded-xl bg-amber-500 text-white font-bold text-sm cursor-pointer disabled:opacity-60">Simpan</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: `DialogMenuHabis.tsx`**

```tsx
'use client'
import { useState, useTransition } from 'react'
import { simpanMenuHabis } from '../pengamanActions'

export default function DialogMenuHabis({ outlet, menuAplikasi, habisSekarang, onTutup }: {
  outlet: { id: string; name: string }
  menuAplikasi: { id: string; name: string }[]
  habisSekarang: string[]
  onTutup: () => void
}) {
  const [habis, setHabis] = useState(() => new Set(habisSekarang.filter((id) => menuAplikasi.some((m) => m.id === id))))
  const [galat, setGalat] = useState('')
  const [bekerja, mulai] = useTransition()

  function balik(id: string) {
    setHabis((lama) => { const baru = new Set(lama); if (baru.has(id)) baru.delete(id); else baru.add(id); return baru })
  }
  function simpan() {
    setGalat('')
    mulai(async () => {
      try { await simpanMenuHabis(outlet.id, menuAplikasi.map((m) => m.id), [...habis]); onTutup() }
      catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal menyimpan') }
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3 max-h-[80vh] flex flex-col">
        <p className="font-bold text-slate-900">Menu habis di {outlet.name}</p>
        <p className="text-[11px] text-slate-500">Daftar ini SAMA dengan yang dipakai kasir/kiosk outlet. Tidak kembali otomatis — nyalakan lagi saat stok ada.</p>
        <div className="overflow-y-auto divide-y divide-slate-100">
          {menuAplikasi.map((m) => (
            <label key={m.id} className="flex items-center justify-between py-2 text-sm">
              <span>{m.name}</span>
              <input type="checkbox" checked={habis.has(m.id)} onChange={() => balik(m.id)} />
            </label>
          ))}
        </div>
        {galat && <p className="text-sm text-red-600">{galat}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onTutup} className="flex-1 py-2 rounded-xl border border-slate-200 font-bold text-sm cursor-pointer">Batal</button>
          <button type="button" disabled={bekerja} onClick={simpan} className="flex-1 py-2 rounded-xl bg-amber-500 text-white font-bold text-sm cursor-pointer disabled:opacity-60">Simpan ({habis.size} habis)</button>
        </div>
      </div>
    </div>
  )
}
```
Render ketiga dialog di akhir `OutletAppView` berdasarkan `dialog.jenis`; `onTutup={() => setDialog(null)}`.

- [ ] **Step 6: Type-check + build + uji manual**

Run: `cd apps/admin-dashboard && yarn type-check && yarn build`.
Manual (dev server, login ADMIN): ubah jam outlet tes → status berubah; tutup sementara outlet tes "sampai jam tutup hari ini" → badge merah, `GET /api/v1/outlets` (gateway) menunjukkan `alasan: tutup_sementara` untuk outlet itu (outlet tes perlu `app_enabled` sementara; kembalikan setelahnya); **Buka sekarang** → kembali "Bisa pesan"; menu habis centang 1 menu → `kiosk_settings` outlet tes berisi id itu **dan id lama tetap ada**.

- [ ] **Step 7: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/app-retail/outlet apps/admin-dashboard/src/lib/appRetail/kesiapanOutlet.ts
git commit -m "feat(admin-dashboard): Outlet Aplikasi -- jam buka, tutup sementara, menu habis per outlet"
```

---

### Task 8: Admin — halaman Pesanan Aplikasi

**Files:**
- Create: `apps/admin-dashboard/src/lib/appRetail/pesananTertahan.ts` + test
- Create: `apps/admin-dashboard/src/app/dashboard/app-retail/pesanan/page.tsx`
- Create: `apps/admin-dashboard/src/app/dashboard/app-retail/pesanan/PesananAppView.tsx`
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.ts` (+ `navConfig.test.ts` snapshot)

**Interfaces:**
- Consumes: `tandaiRefundSelesai` (Task 6).
- Produces:
```ts
export type PesananApp = { id: string; order_number: number | null; outlet_id: string; status: string; kitchen_receipt_printed: boolean | null; created_at: string; total_amount: number }
export function tertahan(p: PesananApp, sekarang: Date, menitTertahan: number): boolean
export function urutkanPesanan(ps: PesananApp[], sekarang: Date, menitTertahan: number): PesananApp[]  // tertahan dulu, lalu terbaru
```

- [ ] **Step 1: Test gagal**

```ts
import { describe, it, expect } from 'vitest'
import { tertahan, urutkanPesanan, type PesananApp } from './pesananTertahan'

const p = (ubah: Partial<PesananApp>): PesananApp => ({
  id: 'x', order_number: 1, outlet_id: 'o', status: 'preparing', kitchen_receipt_printed: false,
  created_at: '2026-09-24T08:00:00Z', total_amount: 30000, ...ubah,
})
const jam = (s: string) => new Date(s)

describe('tertahan', () => {
  it('preparing, belum "Mulai Masak", lewat batas -> tertahan', () => {
    expect(tertahan(p({}), jam('2026-09-24T08:11:00Z'), 10)).toBe(true)
  })
  it('belum lewat batas -> tidak', () => {
    expect(tertahan(p({}), jam('2026-09-24T08:09:59Z'), 10)).toBe(false)
  })
  it('sudah "Mulai Masak" (kitchen_receipt_printed) -> tidak', () => {
    expect(tertahan(p({ kitchen_receipt_printed: true }), jam('2026-09-24T09:00:00Z'), 10)).toBe(false)
  })
  it('selesai / batal -> tidak', () => {
    expect(tertahan(p({ status: 'completed' }), jam('2026-09-24T09:00:00Z'), 10)).toBe(false)
    expect(tertahan(p({ status: 'cancelled' }), jam('2026-09-24T09:00:00Z'), 10)).toBe(false)
  })
})

describe('urutkanPesanan', () => {
  it('tertahan di atas, sisanya terbaru dulu', () => {
    const lama = p({ id: 'lama', created_at: '2026-09-24T07:00:00Z' })            // tertahan
    const baru = p({ id: 'baru', created_at: '2026-09-24T08:55:00Z' })            // belum lewat
    const selesai = p({ id: 'selesai', status: 'completed', created_at: '2026-09-24T08:58:00Z' })
    expect(urutkanPesanan([baru, selesai, lama], jam('2026-09-24T09:00:00Z'), 10).map((x) => x.id))
      .toEqual(['lama', 'selesai', 'baru'])
  })
})
```

- [ ] **Step 2: Jalankan → FAIL.**

- [ ] **Step 3: Implementasi**

```ts
export type PesananApp = {
  id: string
  order_number: number | null
  outlet_id: string
  status: string
  kitchen_receipt_printed: boolean | null
  created_at: string
  total_amount: number
}

/**
 * Pesanan aplikasi masuk POS dengan status 'preparing' TANPA cetak dapur;
 * tombol POS "Mulai Masak" yang men-set kitchen_receipt_printed. Jadi belum
 * ditekan setelah N menit = outlet belum menyadari pesanan ini.
 */
export function tertahan(p: PesananApp, sekarang: Date, menitTertahan: number): boolean {
  if (p.status !== 'preparing' || p.kitchen_receipt_printed === true) return false
  return sekarang.getTime() - new Date(p.created_at).getTime() >= menitTertahan * 60 * 1000
}

export function urutkanPesanan(ps: PesananApp[], sekarang: Date, menitTertahan: number): PesananApp[] {
  return [...ps].sort((a, b) => {
    const ta = tertahan(a, sekarang, menitTertahan) ? 1 : 0
    const tb = tertahan(b, sekarang, menitTertahan) ? 1 : 0
    if (ta !== tb) return tb - ta
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}
```

- [ ] **Step 4: Test → PASS.**

- [ ] **Step 5: `pesanan/page.tsx`** (server component)

```tsx
import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import PesananAppView from './PesananAppView'

export const dynamic = 'force-dynamic'

const WIB_MS = 7 * 60 * 60 * 1000
function awalHariIniWibIso(): string {
  const HARI = 24 * 60 * 60 * 1000
  return new Date(Math.floor((Date.now() + WIB_MS) / HARI) * HARI - WIB_MS).toISOString()
}

export default async function Page() {
  await requireRole(['owner', 'admin'])
  const db = createServiceClient()
  const retail = db.schema('retail')
  const [pesananRes, outletRes, refundPerluRes, refundSudahRes, pengaturanRes] = await Promise.all([
    db.from('orders')
      .select('id, order_number, outlet_id, status, kitchen_receipt_printed, created_at, total_amount')
      .eq('sales_source', 'app').gte('created_at', awalHariIniWibIso())
      .order('created_at', { ascending: false }).range(0, 499),
    db.from('outlets').select('id, name, phone').eq('app_enabled', true),
    retail.from('refund_pesanan').select('id, order_id, outlet_id, customer_id, nominal, dibuat_pada')
      .eq('status', 'perlu').order('dibuat_pada', { ascending: true }).range(0, 199),
    retail.from('refund_pesanan').select('id, order_id, outlet_id, nominal, catatan, diproses_pada')
      .eq('status', 'sudah').order('diproses_pada', { ascending: false }).range(0, 49),
    db.from('app_pengaturan').select('menit_tertahan').eq('id', 1).maybeSingle(),
  ])
  const idPelanggan = [...new Set((refundPerluRes.data ?? []).map((r) => r.customer_id))]
  const pelangganRes = idPelanggan.length
    ? await retail.from('customers').select('id, name, phone').in('id', idPelanggan)
    : { data: [] as { id: string; name: string | null; phone: string | null }[] }

  return (
    <PesananAppView
      pesanan={pesananRes.data ?? []}
      outlets={outletRes.data ?? []}
      refundPerlu={refundPerluRes.data ?? []}
      refundSudah={refundSudahRes.data ?? []}
      pelanggan={pelangganRes.data ?? []}
      menitTertahan={pengaturanRes.data?.menit_tertahan ?? 10}
      galat={[pesananRes.error, outletRes.error, refundPerluRes.error].filter(Boolean).map((e) => e!.message)}
    />
  )
}
```
> Cek dulu nama kolom telepon outlet: `select column_name from information_schema.columns where table_name='outlets' and column_name ilike '%phone%'`. Bila tak ada, hapus `phone` dari select dan kolom telepon di view.

- [ ] **Step 6: `PesananAppView.tsx`** — tiga tab (`Hari ini` / `Perlu dikembalikan (n)` / `Selesai dikembalikan`):

```tsx
'use client'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { tertahan, urutkanPesanan, type PesananApp } from '@/lib/appRetail/pesananTertahan'
import { tandaiRefundSelesai } from '../pengamanActions'

type Outlet = { id: string; name: string; phone?: string | null }
type RefundPerlu = { id: string; order_id: string; outlet_id: string; customer_id: string; nominal: number; dibuat_pada: string }
type RefundSudah = { id: string; order_id: string; outlet_id: string; nominal: number; catatan: string | null; diproses_pada: string | null }
type Pelanggan = { id: string; name: string | null; phone: string | null }

const rp = (n: number) => `Rp ${Number(n).toLocaleString('id-ID')}`
const jamWib = (iso: string) => new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })

export default function PesananAppView(props: {
  pesanan: PesananApp[]; outlets: Outlet[]; refundPerlu: RefundPerlu[]; refundSudah: RefundSudah[]
  pelanggan: Pelanggan[]; menitTertahan: number; galat: string[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'hari' | 'perlu' | 'sudah'>(props.refundPerlu.length > 0 ? 'perlu' : 'hari')
  const [sekarang, setSekarang] = useState(() => new Date())
  const [catatan, setCatatan] = useState<Record<string, string>>({})
  const [galat, setGalat] = useState('')
  const [bekerja, mulai] = useTransition()

  // Segarkan tiap 60 dtk: status "tertahan" bergantung waktu, dan pesanan baru masuk.
  useEffect(() => {
    const t = setInterval(() => { setSekarang(new Date()); router.refresh() }, 60_000)
    return () => clearInterval(t)
  }, [router])

  const namaOutlet = (id: string) => props.outlets.find((o) => o.id === id)?.name ?? '—'
  const urut = urutkanPesanan(props.pesanan, sekarang, props.menitTertahan)
  const jumlahTertahan = urut.filter((p) => tertahan(p, sekarang, props.menitTertahan)).length

  function selesai(id: string) {
    setGalat('')
    mulai(async () => {
      try { await tandaiRefundSelesai(id, catatan[id] ?? '') }
      catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal menyimpan') }
    })
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Pesanan Aplikasi</h1>
        <p className="text-sm text-slate-500">Merah = sudah dibayar tapi belum ditekan "Mulai Masak" lebih dari {props.menitTertahan} menit. Telepon outlet.</p>
      </div>
      {[...props.galat, galat].filter(Boolean).map((g) => <p key={g} className="text-sm text-red-600">{g}</p>)}
      <div className="flex gap-2">
        {([['hari', `Hari ini${jumlahTertahan ? ` · ${jumlahTertahan} tertahan` : ''}`], ['perlu', `Perlu dikembalikan (${props.refundPerlu.length})`], ['sudah', 'Selesai dikembalikan']] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`text-sm font-bold px-3 py-1.5 rounded-full cursor-pointer ${tab === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{label}</button>
        ))}
      </div>

      {tab === 'hari' && (
        <table className="w-full text-sm bg-white rounded-xl border border-slate-200">
          <thead><tr className="bg-slate-50 text-left text-slate-500">
            <th className="p-3">Jam</th><th className="p-3">No.</th><th className="p-3">Outlet</th><th className="p-3">Status</th><th className="p-3 text-right">Total</th>
          </tr></thead>
          <tbody>
            {urut.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">Belum ada pesanan aplikasi hari ini.</td></tr>}
            {urut.map((p) => {
              const merah = tertahan(p, sekarang, props.menitTertahan)
              const outlet = props.outlets.find((o) => o.id === p.outlet_id)
              return (
                <tr key={p.id} className={`border-t border-slate-100 ${merah ? 'bg-red-50' : ''}`}>
                  <td className="p-3">{jamWib(p.created_at)}</td>
                  <td className="p-3">#{p.order_number ?? '—'}</td>
                  <td className="p-3">{namaOutlet(p.outlet_id)}{merah && outlet?.phone && <a className="block text-[11px] text-red-700 font-bold" href={`tel:${outlet.phone}`}>Telepon {outlet.phone}</a>}</td>
                  <td className={`p-3 font-bold ${merah ? 'text-red-700' : 'text-slate-600'}`}>{merah ? 'TERTAHAN' : p.status}</td>
                  <td className="p-3 text-right">{rp(p.total_amount)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {tab === 'perlu' && (
        <div className="space-y-2">
          {props.refundPerlu.length === 0 && <p className="text-sm text-slate-400">Tidak ada dana yang perlu dikembalikan.</p>}
          {props.refundPerlu.map((r) => {
            const pl = props.pelanggan.find((x) => x.id === r.customer_id)
            return (
              <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between"><p className="font-bold">{rp(r.nominal)} · {namaOutlet(r.outlet_id)}</p><p className="text-xs text-slate-400">dibatalkan {new Date(r.dibuat_pada).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p></div>
                <p className="text-sm">{pl?.name ?? 'Pelanggan'} {pl?.phone && <a className="text-emerald-700 font-bold" href={`https://wa.me/${pl.phone.replace(/^0/, '62').replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer">WhatsApp {pl.phone}</a>}</p>
                <div className="flex gap-2">
                  <input value={catatan[r.id] ?? ''} onChange={(e) => setCatatan({ ...catatan, [r.id]: e.target.value })}
                    placeholder="Catatan / no. referensi transfer (wajib)" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  <button type="button" disabled={bekerja || !(catatan[r.id] ?? '').trim()} onClick={() => selesai(r.id)}
                    className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold disabled:opacity-50 cursor-pointer">Sudah dikembalikan</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'sudah' && (
        <table className="w-full text-sm bg-white rounded-xl border border-slate-200">
          <thead><tr className="bg-slate-50 text-left text-slate-500"><th className="p-3">Diproses</th><th className="p-3">Outlet</th><th className="p-3 text-right">Nominal</th><th className="p-3">Catatan</th></tr></thead>
          <tbody>{props.refundSudah.map((r) => (
            <tr key={r.id} className="border-t border-slate-100">
              <td className="p-3">{r.diproses_pada ? new Date(r.diproses_pada).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '—'}</td>
              <td className="p-3">{namaOutlet(r.outlet_id)}</td><td className="p-3 text-right">{rp(r.nominal)}</td><td className="p-3">{r.catatan}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Nav** — di `navConfig.ts`, setelah entri `'/dashboard/app-retail/outlet'`, tambahkan:

```ts
      { href: '/dashboard/app-retail/pesanan', label: 'Pesanan Aplikasi', shortLabel: 'Pesanan App', icon: ShoppingCart, roles: ['OWNER', 'ADMIN'] },
```
(`ShoppingCart` dari `lucide-react`; tambahkan ke import bila belum ada.) Perbarui snapshot rute OWNER & ADMIN di `navConfig.test.ts` dengan menambahkan `'/dashboard/app-retail/pesanan'`. Test "setiap href punya page.tsx" otomatis memverifikasi halaman ada.

- [ ] **Step 8: Test + type-check + build** → `yarn vitest run src/lib/appRetail/pesananTertahan.test.ts src/components/layout/navConfig.test.ts && yarn type-check && yarn build`.

- [ ] **Step 9: Commit**

```bash
git add apps/admin-dashboard/src/lib/appRetail/pesananTertahan.ts apps/admin-dashboard/src/lib/appRetail/pesananTertahan.test.ts apps/admin-dashboard/src/app/dashboard/app-retail/pesanan apps/admin-dashboard/src/components/layout/navConfig.ts apps/admin-dashboard/src/components/layout/navConfig.test.ts
git commit -m "feat(admin-dashboard): halaman Pesanan Aplikasi -- pesanan tertahan & antrean refund"
```

---

### Task 9: Admin — halaman Pengaturan Aplikasi + riwayat perubahan

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/app-retail/pengaturan/page.tsx`
- Create: `apps/admin-dashboard/src/app/dashboard/app-retail/pengaturan/PengaturanAppView.tsx`
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.ts` (+ test)

**Interfaces:**
- Consumes: `simpanPengaturan`, `InputPengaturan`, `periksaPengaturan` (Task 6).

- [ ] **Step 1: `page.tsx`**

```tsx
import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import PengaturanAppView from './PengaturanAppView'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireRole(['owner', 'admin'])
  const db = createServiceClient()
  const [pRes, logRes] = await Promise.all([
    db.from('app_pengaturan').select('*').eq('id', 1).maybeSingle(),
    db.from('app_retail_log').select('id, aksi, sasaran_id, data, oleh, pada').order('pada', { ascending: false }).range(0, 19),
  ])
  const idStaf = [...new Set((logRes.data ?? []).map((l) => l.oleh))]
  const stafRes = idStaf.length ? await db.from('outlet_staff').select('id, name').in('id', idStaf) : { data: [] }
  return <PengaturanAppView awal={pRes.data} log={logRes.data ?? []} staf={stafRes.data ?? []} galat={pRes.error?.message ?? null} />
}
```

- [ ] **Step 2: `PengaturanAppView.tsx`** — formulir 7 kolom berbasis `InputPengaturan`, validasi `periksaPengaturan` sebelum memanggil `simpanPengaturan`, lalu tabel riwayat:

```tsx
'use client'
import { useState, useTransition } from 'react'
import { periksaPengaturan, type InputPengaturan } from '@/lib/appRetail/pengaturanForm'
import { simpanPengaturan } from '../pengamanActions'

const LABEL_AKSI: Record<string, string> = {
  pengaturan_ubah: 'Ubah pengaturan', tutup_sementara: 'Tutup sementara', buka_sekarang: 'Buka sekarang',
  jam_ubah: 'Ubah jam buka', menu_habis_ubah: 'Ubah menu habis', refund_selesai: 'Refund selesai',
}

export default function PengaturanAppView({ awal, log, staf, galat: galatMuat }: {
  awal: Record<string, unknown> | null
  log: { id: number; aksi: string; sasaran_id: string | null; pada: string; oleh: string }[]
  staf: { id: string; name: string | null }[]
  galat: string | null
}) {
  const [f, setF] = useState<InputPengaturan>({
    menitPesanTerakhir: Number(awal?.menit_pesan_terakhir ?? 30),
    menitTertahan: Number(awal?.menit_tertahan ?? 10),
    estimasiSiap: String(awal?.estimasi_siap ?? '15–20 menit'),
    waCs: String(awal?.wa_cs ?? ''),
    versiMinimumAndroid: Number(awal?.versi_minimum_android ?? 1),
    urlSyarat: String(awal?.url_syarat ?? ''),
    urlPrivasi: String(awal?.url_privasi ?? ''),
  })
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null)
  const [bekerja, mulai] = useTransition()

  function simpan() {
    const g = periksaPengaturan(f)
    if (g) { setPesan({ ok: false, teks: g }); return }
    mulai(async () => {
      try { await simpanPengaturan(f); setPesan({ ok: true, teks: 'Tersimpan. Berlaku di aplikasi paling lambat 1 menit.' }) }
      catch (e) { setPesan({ ok: false, teks: e instanceof Error ? e.message : 'Gagal menyimpan' }) }
    })
  }

  const baris = (label: string, bantuan: string, input: React.ReactNode) => (
    <label className="block space-y-1">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      {input}
      <span className="block text-[11px] text-slate-500">{bantuan}</span>
    </label>
  )
  const kelas = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm'

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-slate-900">Pengaturan Aplikasi</h1>
      {galatMuat && <p className="text-sm text-red-600">{galatMuat}</p>}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        {baris('Batas pesan terakhir (menit sebelum tutup)', 'Mis. 30 = outlet tutup 22.00, pesanan terakhir 21.30.',
          <input type="number" className={kelas} value={f.menitPesanTerakhir} onChange={(e) => setF({ ...f, menitPesanTerakhir: Number(e.target.value) })} />)}
        {baris('Batas pesanan tertahan (menit)', 'Pesanan dibayar yang belum ditekan "Mulai Masak" selama ini ditandai merah.',
          <input type="number" className={kelas} value={f.menitTertahan} onChange={(e) => setF({ ...f, menitTertahan: Number(e.target.value) })} />)}
        {baris('Estimasi waktu siap', 'Tampil ke pelanggan setelah bayar. Maks 40 huruf.',
          <input className={kelas} maxLength={40} value={f.estimasiSiap} onChange={(e) => setF({ ...f, estimasiSiap: e.target.value })} />)}
        {baris('WhatsApp CS', 'Tempat pelanggan menghubungi soal pesanan/refund. Kosongkan untuk menyembunyikan tombol.',
          <input className={kelas} value={f.waCs} placeholder="08…" onChange={(e) => setF({ ...f, waCs: e.target.value })} />)}
        {baris('Versi minimum Android (versionCode)', 'Aplikasi di bawah versi ini dipaksa update. Naikkan hanya setelah versi baru tersedia di Play Store.',
          <input type="number" className={kelas} value={f.versiMinimumAndroid} onChange={(e) => setF({ ...f, versiMinimumAndroid: Number(e.target.value) })} />)}
        {baris('Link Syarat & Ketentuan', 'Wajib https://', <input className={kelas} value={f.urlSyarat} onChange={(e) => setF({ ...f, urlSyarat: e.target.value })} />)}
        {baris('Link Kebijakan Privasi', 'Wajib https:// — diminta Play Store karena aplikasi memakai izin lokasi.',
          <input className={kelas} value={f.urlPrivasi} onChange={(e) => setF({ ...f, urlPrivasi: e.target.value })} />)}
        {pesan && <p className={`text-sm ${pesan.ok ? 'text-emerald-700' : 'text-red-600'}`}>{pesan.teks}</p>}
        <button type="button" disabled={bekerja} onClick={simpan} className="px-4 py-2 rounded-xl bg-amber-500 text-white font-bold text-sm cursor-pointer disabled:opacity-60">Simpan</button>
      </div>

      <div className="space-y-2">
        <h2 className="font-bold text-slate-900">Riwayat perubahan</h2>
        <table className="w-full text-sm bg-white rounded-xl border border-slate-200">
          <tbody>{log.map((l) => (
            <tr key={l.id} className="border-t border-slate-100 first:border-0">
              <td className="p-3 text-slate-500 whitespace-nowrap">{new Date(l.pada).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</td>
              <td className="p-3 font-semibold">{LABEL_AKSI[l.aksi] ?? l.aksi}</td>
              <td className="p-3">{staf.find((s) => s.id === l.oleh)?.name ?? l.oleh.slice(0, 8)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Nav** — tambahkan setelah entri Splash:

```ts
      { href: '/dashboard/app-retail/pengaturan', label: 'Pengaturan Aplikasi', shortLabel: 'Setelan App', icon: Settings2, roles: ['OWNER', 'ADMIN'] },
```
(`Settings2` dari `lucide-react`.) Perbarui snapshot `navConfig.test.ts`.

- [ ] **Step 4: Test + type-check + build**, uji manual: ubah batas pesan terakhir → log bertambah 1 baris "Ubah pengaturan" dengan nama admin; isi `wa_cs` "0812…" → tersimpan "62812…".

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/app-retail/pengaturan apps/admin-dashboard/src/components/layout/navConfig.ts apps/admin-dashboard/src/components/layout/navConfig.test.ts
git commit -m "feat(admin-dashboard): halaman Pengaturan Aplikasi + riwayat perubahan"
```

---

### Task 10: APK — config & cek versi minimum

**Files:**
- Modify: `mobile/customer-app/app/src/main/java/com/sukashawarma/customer/data/api/Dto.kt`
- Modify: `.../data/api/GatewayClient.kt` (setelah `splash()`)
- Modify: `.../data/Repository.kt`
- Create: `.../ui/config/KonfigurasiApp.kt` (fungsi murni + layar)
- Test: `mobile/customer-app/app/src/test/java/com/sukashawarma/customer/ui/config/KonfigurasiAppTest.kt`
- Modify: `.../navigation/AppNavigation.kt` (`CustomerAppRoot`)
- Modify: `mobile/customer-app/app/build.gradle.kts:58-59`

**Interfaces:**
- Produces:
```kotlin
@Serializable data class ConfigDto(estimasiSiap: String = "15–20 menit", waCs: String? = null, versiMinimumAndroid: Int = 1, urlSyarat: String? = null, urlPrivasi: String? = null)
fun perluUpdate(versiTerpasang: Int, config: ConfigDto?): Boolean
suspend fun Repository.config(): GatewayResult<ConfigDto>
@Composable fun LayarPerbaruiAplikasi()
val LocalConfigApp: ProvidableCompositionLocal<ConfigDto>   // dibaca Task 12
```

- [ ] **Step 1: Test gagal**

```kotlin
package com.sukashawarma.customer.ui.config

import com.sukashawarma.customer.data.api.ConfigDto
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class KonfigurasiAppTest {
    @Test fun `versi di bawah minimum wajib update`() = assertTrue(perluUpdate(1, ConfigDto(versiMinimumAndroid = 2)))
    @Test fun `versi sama atau lebih tinggi tidak`() {
        assertFalse(perluUpdate(2, ConfigDto(versiMinimumAndroid = 2)))
        assertFalse(perluUpdate(3, ConfigDto(versiMinimumAndroid = 2)))
    }
    @Test fun `config gagal dimuat tidak mengunci pelanggan`() = assertFalse(perluUpdate(1, null))
}
```

- [ ] **Step 2: Jalankan → FAIL.**

```bash
cd mobile/customer-app && JAVA_HOME="C:/Program Files/Android/Android Studio1/jbr" TEMP="C:\\t" TMP="C:\\t" ./gradlew :app:testDebugUnitTest --tests "*KonfigurasiAppTest" --console=plain
```
Expected: gagal kompilasi `Unresolved reference 'ConfigDto'`.

- [ ] **Step 3: DTO, client, repository**

Di `Dto.kt` (dekat `SplashDto`):
```kotlin
@Serializable
data class ConfigDto(
    @SerialName("estimasi_siap") val estimasiSiap: String = "15–20 menit",
    @SerialName("wa_cs") val waCs: String? = null,
    @SerialName("versi_minimum_android") val versiMinimumAndroid: Int = 1,
    @SerialName("url_syarat") val urlSyarat: String? = null,
    @SerialName("url_privasi") val urlPrivasi: String? = null,
)
```
Di `GatewayClient.kt`, setelah `splash()`:
```kotlin
    suspend fun config(): GatewayResult<ConfigDto> {
        return try {
            val response = client.get("$baseUrl/api/v1/config")
            hasil(response)
        } catch (e: Exception) {
            GatewayResult.Gagal(GatewayError.Jaringan(e))
        }
    }
```
Di `Repository.kt`: `suspend fun config(): GatewayResult<ConfigDto> = gateway.config()` (import `ConfigDto`).

- [ ] **Step 4: `ui/config/KonfigurasiApp.kt`**

```kotlin
package com.sukashawarma.customer.ui.config

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.sukashawarma.customer.data.api.ConfigDto

/** Config gagal dimuat -> TIDAK memaksa update: pelanggan tak boleh terkunci karena jaringan. */
fun perluUpdate(versiTerpasang: Int, config: ConfigDto?): Boolean =
    config != null && versiTerpasang < config.versiMinimumAndroid

/** Config yang sedang berlaku; bawaan dipakai sampai/bila gateway gagal. */
val LocalConfigApp = staticCompositionLocalOf { ConfigDto() }

@Composable
fun LayarPerbaruiAplikasi() {
    val konteks = LocalContext.current
    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Perbarui aplikasi", style = MaterialTheme.typography.titleLarge)
        Text(
            "Versi aplikasi ini sudah tidak didukung. Perbarui dari Play Store untuk lanjut memesan.",
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
        )
        Button(onClick = {
            konteks.startActivity(
                Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=${konteks.packageName}"))
            )
        }) { Text("Buka Play Store") }
    }
}
```

- [ ] **Step 5: Pasang di `CustomerAppRoot`** (`navigation/AppNavigation.kt`). Di awal fungsi, setelah deklarasi viewModel:

```kotlin
    var config by remember { mutableStateOf<ConfigDto?>(null) }
    LaunchedEffect(Unit) {
        (container.repository.config() as? GatewayResult.Sukses)?.let { config = it.data }
    }
    if (perluUpdate(BuildConfig.VERSION_CODE, config)) {
        LayarPerbaruiAplikasi()
        return
    }
```
lalu bungkus konten `Scaffold` yang sudah ada dengan `CompositionLocalProvider(LocalConfigApp provides (config ?: ConfigDto())) { ... }`. Import yang diperlukan: `BuildConfig`, `ConfigDto`, `GatewayResult`, `perluUpdate`, `LayarPerbaruiAplikasi`, `LocalConfigApp`, `CompositionLocalProvider`, `LaunchedEffect`, `mutableStateOf`, `remember`, `setValue`, `getValue`.

- [ ] **Step 6: `versionCode = 2`, `versionName = "1.1"`** di `app/build.gradle.kts`.

- [ ] **Step 7: Test + build** — `./gradlew :app:testDebugUnitTest :app:assembleDebug --console=plain` → BUILD SUCCESSFUL, semua test lulus.

- [ ] **Step 8: Uji di HP** — install (`:app:installDebug`); set `versi_minimum_android = 99` di halaman Pengaturan Aplikasi → buka ulang aplikasi (tunggu ≤ 60 dtk cache gateway) → layar "Perbarui aplikasi". Kembalikan ke 1 → aplikasi normal. Matikan internet → aplikasi tetap terbuka (tidak terkunci).

- [ ] **Step 9: Commit**

```bash
git add mobile/customer-app/app/build.gradle.kts mobile/customer-app/app/src/main/java/com/sukashawarma/customer/data mobile/customer-app/app/src/main/java/com/sukashawarma/customer/ui/config mobile/customer-app/app/src/main/java/com/sukashawarma/customer/navigation/AppNavigation.kt mobile/customer-app/app/src/test/java/com/sukashawarma/customer/ui/config
git commit -m "feat(customer-app): config gateway + paksa update versi minimum (versionCode 2)"
```

---

### Task 11: APK — status outlet (tutup / tutup sementara / pesan terakhir)

**Files:**
- Modify: `.../data/api/Dto.kt` (`OutletDto`)
- Create: `.../ui/home/StatusOutletLabel.kt`
- Test: `.../test/.../ui/home/StatusOutletLabelTest.kt`
- Modify: `.../ui/home/OutletPickerScreen.kt` (chip status di kartu)
- Modify: `.../ui/components/HomeHeader.kt` (baris bawah nama outlet)
- Modify: `.../ui/checkout/ValidasiPesan.kt:51-53`
- Modify: layar tempat tombol tambah & checkout (`MenuScreen.kt`, `HomeScreen.kt`, `CartScreen.kt`/`CheckoutScreen.kt`) — nonaktif bila `bisaPesan == false`

**Interfaces:**
- Produces:
```kotlin
// OutletDto (tambahan, semua opsional)
@SerialName("bisa_pesan") val bisaPesan: Boolean? = null
@SerialName("pesan_status") val pesanStatus: String? = null
@SerialName("pesan_terakhir") val pesanTerakhir: String? = null
fun OutletDto.bolehPesan(): Boolean                   // bisaPesan ?: isActive
fun labelStatusOutlet(o: OutletDto): String           // "Buka · pesan terakhir 21.30" | pesanStatus | "Tutup"
```

- [ ] **Step 1: Test gagal**

```kotlin
package com.sukashawarma.customer.ui.home

import com.sukashawarma.customer.data.api.OutletDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StatusOutletLabelTest {
    private fun o(bisa: Boolean?, aktif: Boolean = true, pesan: String? = null, terakhir: String? = null) =
        OutletDto(id = "a", name = "A", isActive = aktif, bisaPesan = bisa, pesanStatus = pesan, pesanTerakhir = terakhir)

    @Test fun `gateway lama tanpa bisa_pesan jatuh ke isActive`() {
        assertTrue(o(null, aktif = true).bolehPesan())
        assertFalse(o(null, aktif = false).bolehPesan())
    }
    @Test fun `bisa_pesan false menang atas isActive`() = assertFalse(o(false, aktif = true).bolehPesan())

    @Test fun `label buka menyebut pesan terakhir dalam WIB`() =
        assertEquals("Buka · pesan terakhir 21.30", labelStatusOutlet(o(true, terakhir = "2026-09-24T14:30:00.000Z")))

    @Test fun `label tutup memakai kalimat gateway`() =
        assertEquals("Outlet belum buka. Buka pukul 14.00.", labelStatusOutlet(o(false, pesan = "Outlet belum buka. Buka pukul 14.00.")))

    @Test fun `tutup tanpa kalimat gateway`() = assertEquals("Tutup", labelStatusOutlet(o(false)))
}
```

- [ ] **Step 2: Jalankan → FAIL.** `./gradlew :app:testDebugUnitTest --tests "*StatusOutletLabelTest"`

- [ ] **Step 3: Tambahkan field ke `OutletDto`** (setelah `isActive`):

```kotlin
    // Field tahap 1 (2026-09-24). Opsional: gateway lama tak mengirimnya.
    @SerialName("bisa_pesan") val bisaPesan: Boolean? = null,
    @SerialName("pesan_status") val pesanStatus: String? = null,
    @SerialName("pesan_terakhir") val pesanTerakhir: String? = null,
```

- [ ] **Step 4: `StatusOutletLabel.kt`**

```kotlin
package com.sukashawarma.customer.ui.home

import com.sukashawarma.customer.data.api.OutletDto
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val WIB: ZoneId = ZoneId.of("Asia/Jakarta")
private val JAM = DateTimeFormatter.ofPattern("HH.mm")

/** Gateway lama (tanpa `bisa_pesan`) = perilaku lama: ikut `isActive`. */
fun OutletDto.bolehPesan(): Boolean = bisaPesan ?: isActive

fun labelStatusOutlet(o: OutletDto): String {
    if (o.bolehPesan()) {
        val terakhir = o.pesanTerakhir?.let {
            runCatching { JAM.format(Instant.parse(it).atZone(WIB)) }.getOrNull()
        }
        return if (terakhir != null) "Buka · pesan terakhir $terakhir" else "Buka"
    }
    return o.pesanStatus ?: "Tutup"
}
```
> `java.time` butuh minSdk 26 atau desugaring. `minSdk = 24` → cek `coreLibraryDesugaringEnabled` di `app/build.gradle.kts`. Bila belum aktif, tambahkan `compileOptions { isCoreLibraryDesugaringEnabled = true }` dan dependency `coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.2")`.

- [ ] **Step 5: Test → PASS.**

- [ ] **Step 6: Tampilkan & tegakkan di UI**
  - `OutletPickerScreen.kt` `BarisOutletCard`: chip status memakai `outlet.bolehPesan()` untuk warna (hijau/abu) dan `labelStatusOutlet(outlet)` untuk teks (ganti `if (outlet.isActive) "Buka" else "Belum Buka"`).
  - `HomeHeader.kt`: parameter `buka` di pemanggil diisi `outlet.bolehPesan()`; baris keterangan di bawah nama = `labelStatusOutlet(outlet)` bila tidak boleh pesan, selain itu tetap "Ambil sendiri di outlet ini".
  - Tombol `+` di kartu menu (`MenuScreen.kt`, `HomeScreen.kt`) dan tombol checkout (`CartScreen.kt`/`CheckoutScreen.kt`): `enabled = state.outlet?.bolehPesan() != false`. Saat nonaktif tampilkan `labelStatusOutlet(outlet)` di bawah tombol checkout. **Menu tetap bisa dilihat.**
  - `HomeScreen.kt`/`MenuScreen.kt`: cabang `state.outlet != null && !state.outlet!!.isActive -> OutletClosedScreen(...)` **tetap** memakai `isActive` (outlet dinonaktifkan permanen), bukan `bolehPesan()` — tutup karena jam hanya menonaktifkan pemesanan.
  - `ValidasiPesan.kt`: ganti cabang `"outlet_tutup"` menjadi `"outlet_tutup" -> pesanDariGateway ?: "Outlet sedang tutup, jadi pesanan belum bisa diproses."`, dan perbarui test ValidasiPesan yang ada bila mengharapkan kalimat lama.

- [ ] **Step 7: Test + build + uji di HP** — atur jam outlet tes (atau Empang) agar tutup sekarang dari admin → Pilih Outlet menampilkan "Outlet belum buka. Buka pukul …", tombol + dan checkout nonaktif, menu tetap tampil; tutup sementara → kalimat "tutup sementara (alasan)". Kembalikan jam.

- [ ] **Step 8: Commit** (pastikan tak ada perubahan sesi lain yang ikut: `git diff --stat` hanya berkas task ini)

```bash
git add <berkas task ini saja>
git commit -m "feat(customer-app): tampilkan & tegakkan status outlet (jam, tutup sementara, pesan terakhir)"
```

---

### Task 12: APK — estimasi siap, WhatsApp CS, S&K/privasi

**Files:**
- Modify: `.../ui/orders/OrderStatusScreen.kt:315`
- Modify: `.../ui/payment/SuccessScreen.kt:411`
- Modify: `.../ui/profile/ProfileScreen.kt`
- Create: `.../ui/config/TautanApp.kt`
- Test: `.../test/.../ui/config/TautanAppTest.kt`

**Interfaces:**
- Consumes: `LocalConfigApp` (Task 10).
- Produces: `fun tautanWa(waCs: String?, teks: String): String?`

- [ ] **Step 1: Test gagal**

```kotlin
package com.sukashawarma.customer.ui.config

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TautanAppTest {
    @Test fun `wa kosong tidak menampilkan tautan`() = assertNull(tautanWa(null, "Halo"))
    @Test fun `teks di-encode`() =
        assertEquals("https://wa.me/6281234567890?text=Pesanan%20%2312", tautanWa("6281234567890", "Pesanan #12"))
}
```

- [ ] **Step 2: → FAIL. Step 3: `TautanApp.kt`**

```kotlin
package com.sukashawarma.customer.ui.config

import java.net.URLEncoder

fun tautanWa(waCs: String?, teks: String): String? {
    if (waCs.isNullOrBlank()) return null
    val isi = URLEncoder.encode(teks, "UTF-8").replace("+", "%20")
    return "https://wa.me/$waCs?text=$isi"
}
```

- [ ] **Step 4: → PASS. Step 5: pakai di layar**
  - `OrderStatusScreen.kt:315`: `TahapPesanan.DITERIMA -> "Estimasi Siap: ~${LocalConfigApp.current.estimasiSiap}"`. Baris `DIBUAT -> "~5-10 mnt"` dibiarkan (tahap memasak; di luar cakupan).
  - `SuccessScreen.kt:411`: `text = LocalConfigApp.current.estimasiSiap`.
  - `ProfileScreen.kt`: tambah baris menu "Hubungi CS" (tampil hanya bila `tautanWa(config.waCs, "Halo CS Suka Shawarma") != null`, membuka `Intent.ACTION_VIEW`), "Syarat & Ketentuan" dan "Kebijakan Privasi" (tampil hanya bila URL terisi). Ikuti komponen baris menu yang sudah ada di layar itu.
  - Layar status saat pesanan `cancelled`: tombol "Hubungi CS" dengan teks `"Pesanan #<nomor> dibatalkan, saya ingin menanyakan pengembalian dana."`.

- [ ] **Step 6: Test + build + uji di HP** — isi WA CS & URL di admin → Profil menampilkan tiga baris, ketuk membuka WhatsApp/browser; kosongkan → barisnya hilang.

- [ ] **Step 7: Commit**

```bash
git add <berkas task ini saja>
git commit -m "feat(customer-app): estimasi siap, WhatsApp CS, S&K & privasi dari pengaturan"
```

---

### Task 13: Rilis

- [ ] **Step 1:** Tunjukkan ke owner isi `kiosk_settings.unavailable_menu_ids` per outlet (nama menu, bukan id) dan minta konfirmasi mana yang masih berlaku. Kondisi 24 Sep: MITRA CICURUG 1 menu, MITRA PEKAYON 1, outlet tes 1, DRAMAGA 4. Bersihkan yang basi lewat dialog Menu habis (tercatat di log) **sebelum** gateway dideploy.
- [ ] **Step 2:** Redeploy `retail-gateway` → cek `curl https://retail.sukashawarma.com/api/v1/config` dan `/api/v1/outlets` memuat `bisa_pesan`.
- [ ] **Step 3:** Redeploy `admin-dashboard` → buka ketiga halaman sebagai ADMIN dan OWNER; login role lain (mis. purchasing) → aksi ditolak server.
- [ ] **Step 4:** Uji ujung-ke-ujung: outlet tes dinyalakan sementara → pesan & bayar kecil → batalkan di POS → muncul di "Perlu dikembalikan" → "Sudah dikembalikan" → notifikasi di aplikasi → matikan lagi outlet tes.
- [ ] **Step 5:** Isi WA CS, URL S&K & privasi di Pengaturan Aplikasi. Build & rilis APK versionCode 2. **Jangan** naikkan `versi_minimum_android` sampai versi 2 benar-benar tersedia di Play Store.
- [ ] **Step 6:** Catat sesi di `CLAUDE.md` (pola entri Session yang ada): apa yang live, redeploy yang sudah/belum, sisa manual.
