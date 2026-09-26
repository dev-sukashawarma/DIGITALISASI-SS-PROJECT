# App Retail Tahap 3 — Voucher Aplikasi: Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin pusat bisa membuat voucher (5 jenis, 8 syarat), dan pelanggan aplikasi bisa memakainya saat checkout. Potongannya tercatat sebagai `discount_amount` pesanan.

**Architecture:** Dua tabel baru di skema `retail` (`vouchers`, `voucher_pemakaian`) + view ringkasan. Logika hitung ada di satu fungsi murni TypeScript di gateway (`lib/voucher.ts`), dipanggil oleh `checkout/validate`, `POST /orders`, dan endpoint baru `POST /api/v1/vouchers`. Webhook Xendit menandai pemakaian lunas. Admin-dashboard mengelola voucher lewat server action (pola Tahap 1). APK menyimpan pilihan voucher di `CartStore` dan menampilkan hasil hitungan gateway apa adanya.

**Tech Stack:** Postgres/Supabase · Next.js 16 + vitest (`apps/retail-gateway`, `apps/admin-dashboard`) · Kotlin/Compose + kotlinx.serialization + JUnit4 (`mobile/customer-app`)

**Spec:** `docs/superpowers/specs/2026-09-25-app-retail-tahap3-voucher-design.md`

## Global Constraints

- Kerjakan di worktree `D:/MIT/wt-voucher`, branch `feat/app-retail-voucher`. Sebelum setiap commit, jalankan `git -C D:/MIT/wt-voucher branch --show-current` dan pastikan hasilnya `feat/app-retail-voucher`. Checkout utama repo dipakai sesi lain.
- Semua balasan dan komentar kode dalam Bahasa Indonesia, mengikuti gaya berkas sekitar.
- Potongan ≤ subtotal dan ≤ `MAKS_POTONGAN_PERSEN` (50) dari `apps/retail-gateway/src/lib/pricing.ts`. Kalau melebihi, dijepit, bukan ditolak.
- Kuota dan batas per pelanggan hanya menghitung `voucher_pemakaian.lunas_at IS NOT NULL`. Pesanan lunas selalu dihormati; webhook tidak mengecek ulang kuota.
- Item gratis dicatat dengan **harga normal** dan catatan `Gratis voucher`, dan nilainya masuk `discount_amount`.
- Jam dan hari dihitung dalam WIB (UTC+7, tanpa DST).
- Klien lama (tanpa field voucher) → perilaku tidak berubah.
- 409 voucher: `{ error: 'voucher_tidak_berlaku', pesan: <alasan> }`.
- Tabel baru: `REVOKE ALL FROM anon, authenticated`. Tulis admin hanya lewat server action `requireRole(['owner','admin'])` → service client → `app_retail_log`.
- `kalimatSyarat` di gateway dan di admin **identik**. Ubah keduanya bersamaan (pola `jamBuka.ts`).
- Timestamp migration: cek dulu `SELECT version FROM supabase_migrations.schema_migrations WHERE version LIKE '20260925%'` dan pilih versi yang belum dipakai. Lint `scripts/migration-timestamp-lint.mjs` menolak timestamp > 2 hari ke depan.
- APK: `versionCode = 3`, `versionName = "1.2"`. Versi minimum di Pengaturan Aplikasi **tidak** dinaikkan.
- Build Android (Git Bash, dari `mobile/customer-app`): `export JAVA_HOME="C:/Program Files/Android/Android Studio1/jbr" TEMP="C:\\t" TMP="C:\\t" && ./gradlew :app:testDebugUnitTest --console=plain`.

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `supabase/migrations/20260925100000_app_retail_voucher.sql` | tabel, CHECK, view ringkasan, perluasan aksi log, akses |
| `supabase/verifikasi/app_retail_voucher/t1_skema.sql` | uji DB (ROLLBACK + kontrol negatif) |
| `apps/retail-gateway/src/lib/voucher.ts` (+ `.test.ts`) | tipe `Voucher`, `terapkanVoucher`, `kalimatSyarat` — murni |
| `apps/retail-gateway/src/lib/voucherDb.ts` (+ `.test.ts`) | baca voucher & konteks pelanggan dari DB, `nilaiVoucher` |
| `apps/retail-gateway/src/app/api/v1/vouchers/route.ts` (+ `.test.ts`) | daftar voucher publik |
| `apps/retail-gateway/src/app/api/v1/checkout/validate/route.ts` | terima voucher, kembalikan blok `voucher` |
| `apps/retail-gateway/src/app/api/v1/orders/route.ts` | voucher → item gratis, `discount_amount`, baris pemakaian, 409 |
| `apps/retail-gateway/src/app/api/webhooks/xendit/route.ts` | isi `lunas_at` |
| `apps/admin-dashboard/src/lib/appRetail/voucher.ts` (+ `.test.ts`) | salinan `kalimatSyarat`, `periksaVoucher`, `statusVoucher` |
| `apps/admin-dashboard/src/app/dashboard/app-retail/voucherActions.ts` | server action simpan/aktif/hapus |
| `apps/admin-dashboard/src/app/dashboard/app-retail/voucher/{page,VoucherView,PanelEditVoucher}.tsx` | halaman admin |
| `apps/admin-dashboard/src/components/layout/navConfig.ts` (+ test) | entri menu |
| `mobile/customer-app/.../data/api/Dto.kt`, `GatewayClient.kt`, `data/Repository.kt`, `data/CartStore.kt` | kontrak & penyimpanan voucher |
| `mobile/customer-app/.../ui/checkout/VoucherCheckout.kt` (+ test) | aturan kunci-bayar & teks |
| `mobile/customer-app/.../ui/checkout/{CheckoutViewModel,CheckoutScreen}.kt`, `ui/checkout/PemilihVoucherSheet.kt` | checkout |
| `mobile/customer-app/.../ui/payment/PaymentViewModel.kt` | kirim voucher, pesan 409 |
| `mobile/customer-app/.../ui/voucher/{VoucherScreen,VoucherViewModel}.kt` | halaman Voucher |
| `mobile/customer-app/.../navigation/AppNavigation.kt`, `ui/home/HomeScreen.kt`, `ui/profile/ProfileScreen.kt` | jalan masuk |

---

### Task 1: Skema database voucher

**Files:**
- Create: `supabase/migrations/20260925100000_app_retail_voucher.sql`
- Create: `supabase/verifikasi/app_retail_voucher/t1_skema.sql`

**Interfaces:**
- Produces: `retail.vouchers`, `retail.voucher_pemakaian`, view `retail.voucher_ringkasan(voucher_id, terpakai, total_potongan)`, dan nilai aksi log baru `voucher_buat | voucher_ubah | voucher_aktif | voucher_hapus`.

- [ ] **Step 1: Tulis uji DB yang gagal** — `supabase/verifikasi/app_retail_voucher/t1_skema.sql`:

```sql
-- Jalankan: supabase db query --linked -f supabase/verifikasi/app_retail_voucher/t1_skema.sql
-- Semua di dalam transaksi + ROLLBACK: nol perubahan nyata.
BEGIN;
DO $$
DECLARE v uuid; d uuid; c uuid; ok boolean;
BEGIN
  -- (a) persen tanpa nilai ditolak CHECK
  BEGIN
    INSERT INTO retail.vouchers (nama, jenis) VALUES ('uji', 'persen');
    RAISE EXCEPTION 'GAGAL (a): persen tanpa nilai lolos';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- (b) gratis_item tanpa menu ditolak
  BEGIN
    INSERT INTO retail.vouchers (nama, jenis) VALUES ('uji', 'gratis_item');
    RAISE EXCEPTION 'GAGAL (b): gratis_item tanpa menu lolos';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- (c) beli_x_gratis_y tanpa menu_ids ditolak
  BEGIN
    INSERT INTO retail.vouchers (nama, jenis, beli_qty, gratis_qty) VALUES ('uji', 'beli_x_gratis_y', 2, 1);
    RAISE EXCEPTION 'GAGAL (c): beli_x tanpa menu_ids lolos';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- (d) persen sah diterima; kode disimpan huruf besar & unik tanpa beda huruf
  INSERT INTO retail.vouchers (nama, jenis, nilai, kode) VALUES ('uji', 'persen', 10, 'HEMAT10') RETURNING id INTO v;
  BEGIN
    INSERT INTO retail.vouchers (nama, jenis, nilai, kode) VALUES ('uji2', 'persen', 10, 'hemat10');
    RAISE EXCEPTION 'GAGAL (d): kode kembar beda huruf lolos';
  EXCEPTION WHEN unique_violation OR check_violation THEN NULL; END;

  -- (e) voucher yang punya pemakaian tidak bisa dihapus
  SELECT id INTO d FROM retail.order_drafts LIMIT 1;
  SELECT customer_id INTO c FROM retail.order_drafts WHERE id = d;
  INSERT INTO retail.voucher_pemakaian (voucher_id, draft_id, customer_id, potongan) VALUES (v, d, c, 1000);
  BEGIN
    DELETE FROM retail.vouchers WHERE id = v;
    RAISE EXCEPTION 'GAGAL (e): voucher terpakai terhapus';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;

  -- (f) ringkasan hanya menghitung yang lunas
  SELECT (terpakai = 0) INTO ok FROM retail.voucher_ringkasan WHERE voucher_id = v;
  IF NOT ok THEN RAISE EXCEPTION 'GAGAL (f): belum lunas ikut terhitung'; END IF;
  UPDATE retail.voucher_pemakaian SET lunas_at = now() WHERE voucher_id = v;
  SELECT (terpakai = 1 AND total_potongan = 1000) INTO ok FROM retail.voucher_ringkasan WHERE voucher_id = v;
  IF NOT ok THEN RAISE EXCEPTION 'GAGAL (f2): lunas tidak terhitung'; END IF;

  -- (g) aksi log baru diterima
  INSERT INTO public.app_retail_log (aksi, oleh, sasaran_id, data)
  VALUES ('voucher_buat', (SELECT id FROM public.outlet_staff LIMIT 1), v, '{}'::jsonb);

  -- (h) anon & authenticated tak punya hak apa pun
  IF has_table_privilege('anon', 'retail.vouchers', 'SELECT')
     OR has_table_privilege('authenticated', 'retail.vouchers', 'SELECT')
     OR has_table_privilege('authenticated', 'retail.voucher_pemakaian', 'INSERT') THEN
    RAISE EXCEPTION 'GAGAL (h): hak akses klien terbuka';
  END IF;

  RAISE NOTICE 'LULUS t1_skema';
END $$;
ROLLBACK;
```

- [ ] **Step 2: Jalankan, pastikan gagal** — `supabase db query --linked -f supabase/verifikasi/app_retail_voucher/t1_skema.sql`. Expected: galat `relation "retail.vouchers" does not exist`.

- [ ] **Step 3: Tulis migration** — `supabase/migrations/20260925100000_app_retail_voucher.sql` (cek timestamp dulu, lihat Global Constraints):

```sql
-- App Retail Tahap 3: voucher aplikasi pelanggan.
-- Spec: docs/superpowers/specs/2026-09-25-app-retail-tahap3-voucher-design.md
-- Sengaja TIDAK menumpang public.promos (harga otomatis POS tanpa identitas
-- pelanggan; digabung berarti voucher aplikasi bisa ikut menyala di kasir).

CREATE TABLE IF NOT EXISTS retail.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL CHECK (char_length(btrim(nama)) BETWEEN 1 AND 60),
  deskripsi text NULL CHECK (deskripsi IS NULL OR char_length(deskripsi) <= 200),
  -- NULL = publik. Disimpan huruf besar supaya keunikan tak membedakan huruf.
  kode text NULL CHECK (kode IS NULL OR kode ~ '^[A-Z0-9]{3,20}$'),
  jenis text NOT NULL CHECK (jenis IN ('persen','nominal','gratis_item','beli_x_gratis_y','harga_spesial')),
  nilai numeric NULL,
  maks_potongan numeric NULL CHECK (maks_potongan IS NULL OR maks_potongan > 0),
  menu_item_id uuid NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
  beli_qty int NULL CHECK (beli_qty IS NULL OR beli_qty >= 1),
  gratis_qty int NULL CHECK (gratis_qty IS NULL OR gratis_qty >= 1),
  harga_spesial numeric NULL CHECK (harga_spesial IS NULL OR harga_spesial >= 0),
  mulai timestamptz NULL,
  selesai timestamptz NULL,
  kuota_total int NULL CHECK (kuota_total IS NULL OR kuota_total >= 1),
  batas_per_pelanggan int NULL CHECK (batas_per_pelanggan IS NULL OR batas_per_pelanggan >= 1),
  min_belanja numeric NULL CHECK (min_belanja IS NULL OR min_belanja >= 0),
  khusus_pesanan_pertama boolean NOT NULL DEFAULT false,
  outlet_ids uuid[] NULL,
  hari smallint[] NULL CHECK (hari IS NULL OR hari <@ ARRAY[1,2,3,4,5,6,7]::smallint[]),
  jam_mulai time NULL,
  jam_selesai time NULL,
  menu_ids uuid[] NULL,
  kategori_ids uuid[] NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  CHECK (selesai IS NULL OR mulai IS NULL OR selesai > mulai),
  CHECK ((jam_mulai IS NULL) = (jam_selesai IS NULL)),
  -- Satu jenis tidak boleh berisi nilai yang tidak lengkap.
  CHECK (jenis <> 'persen' OR (nilai > 0 AND nilai <= 100)),
  CHECK (jenis <> 'nominal' OR nilai > 0),
  CHECK (jenis <> 'gratis_item' OR menu_item_id IS NOT NULL),
  CHECK (jenis <> 'beli_x_gratis_y' OR (beli_qty IS NOT NULL AND gratis_qty IS NOT NULL AND cardinality(menu_ids) >= 1)),
  CHECK (jenis <> 'harga_spesial' OR (menu_item_id IS NOT NULL AND harga_spesial IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS vouchers_kode_uk ON retail.vouchers (kode) WHERE kode IS NOT NULL;

CREATE TABLE IF NOT EXISTS retail.voucher_pemakaian (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES retail.vouchers(id) ON DELETE RESTRICT,
  draft_id uuid NOT NULL UNIQUE REFERENCES retail.order_drafts(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES retail.customers(id) ON DELETE CASCADE,
  potongan numeric NOT NULL CHECK (potongan >= 0),
  dibuat_at timestamptz NOT NULL DEFAULT now(),
  lunas_at timestamptz NULL
);
CREATE INDEX IF NOT EXISTS voucher_pemakaian_lunas_idx
  ON retail.voucher_pemakaian (voucher_id, customer_id) WHERE lunas_at IS NOT NULL;

CREATE OR REPLACE VIEW retail.voucher_ringkasan WITH (security_invoker = true) AS
SELECT voucher_id,
       count(*) FILTER (WHERE lunas_at IS NOT NULL)::int AS terpakai,
       COALESCE(sum(potongan) FILTER (WHERE lunas_at IS NOT NULL), 0) AS total_potongan
FROM retail.voucher_pemakaian
GROUP BY voucher_id;

-- Aksi log baru (CHECK asal: 20260924100000).
ALTER TABLE public.app_retail_log DROP CONSTRAINT IF EXISTS app_retail_log_aksi_check;
ALTER TABLE public.app_retail_log ADD CONSTRAINT app_retail_log_aksi_check CHECK (aksi IN (
  'pengaturan_ubah','tutup_sementara','buka_sekarang','jam_ubah','menu_habis_ubah','refund_selesai',
  'voucher_buat','voucher_ubah','voucher_aktif','voucher_hapus'));

REVOKE ALL ON retail.vouchers, retail.voucher_pemakaian, retail.voucher_ringkasan FROM anon, authenticated;
ALTER TABLE retail.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail.voucher_pemakaian ENABLE ROW LEVEL SECURITY;
-- Tanpa policy: hanya service role (gateway & server action admin) yang menyentuh.
```

Sebelum menulis ulang CHECK log, pastikan nama constraint aslinya dengan `SELECT conname FROM pg_constraint WHERE conrelid = 'public.app_retail_log'::regclass AND contype='c';`. Kalau namanya bukan `app_retail_log_aksi_check`, pakai nama yang ada di `DROP CONSTRAINT`.

- [ ] **Step 4: Apply & stempel** — lewat jalur yang dipakai repo ini (lihat memori `supabase-exec-sql-ddl-route`: `supabase db query --linked -f <berkas>`, lalu verifikasi katalog), kemudian stempel:

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20260925100000', 'app_retail_voucher', ARRAY[]::text[]) ON CONFLICT DO NOTHING;
SELECT version FROM supabase_migrations.schema_migrations WHERE version = '20260925100000';
```
Expected: satu baris. Verifikasi katalog: `SELECT to_regclass('retail.vouchers'), to_regclass('retail.voucher_pemakaian'), to_regclass('retail.voucher_ringkasan');` → ketiganya tidak NULL.

- [ ] **Step 5: Jalankan uji, pastikan lulus** — Expected: `NOTICE: LULUS t1_skema`. Kontrol negatif: ubah sementara asersi (h) menjadi `IF NOT has_table_privilege(...)`, jalankan, pastikan `GAGAL (h)` muncul, lalu kembalikan.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260925100000_app_retail_voucher.sql supabase/verifikasi/app_retail_voucher/t1_skema.sql
git commit -m "feat(db): skema voucher aplikasi (retail.vouchers, voucher_pemakaian)"
```

---

### Task 2: Logika voucher murni di gateway

**Files:**
- Create: `apps/retail-gateway/src/lib/voucher.ts`
- Test: `apps/retail-gateway/src/lib/voucher.test.ts`

**Interfaces:**
- Consumes: `ItemPesanan`, `MAKS_POTONGAN_PERSEN` (`lib/pricing.ts`); `MenuApp` (`lib/catalog.ts`: `id, name, price, is_available, category_id`).
- Produces:

```ts
export type JenisVoucher = 'persen' | 'nominal' | 'gratis_item' | 'beli_x_gratis_y' | 'harga_spesial'
export type Voucher = {
  id: string; nama: string; deskripsi: string | null; kode: string | null; jenis: JenisVoucher
  nilai: number | null; maks_potongan: number | null; menu_item_id: string | null
  beli_qty: number | null; gratis_qty: number | null; harga_spesial: number | null
  mulai: string | null; selesai: string | null
  kuota_total: number | null; batas_per_pelanggan: number | null; min_belanja: number | null
  khusus_pesanan_pertama: boolean; outlet_ids: string[] | null
  hari: number[] | null; jam_mulai: string | null; jam_selesai: string | null
  menu_ids: string[] | null; kategori_ids: string[] | null; is_active: boolean
}
export type KonteksVoucher = {
  outletId: string | null          // null = tanpa keranjang (halaman daftar)
  sekarang: Date
  jumlahLunasTotal: number
  jumlahLunasPelanggan: number
  pelangganSudahPernahBayar: boolean
  katalog: MenuApp[] | null        // null = tanpa keranjang
}
export type HasilVoucher =
  | { berlaku: true; potongan: number; itemGratis: ItemPesanan[] }
  | { berlaku: false; alasan: string }
export const CATATAN_GRATIS = 'Gratis voucher'
export function terapkanVoucher(v: Voucher, items: ItemPesanan[] | null, k: KonteksVoucher): HasilVoucher
export function kalimatSyarat(v: Voucher, namaMenu: Record<string, string>): string
export function rp(n: number): string   // "Rp12.000"
```

- [ ] **Step 1: Tulis test yang gagal** — `apps/retail-gateway/src/lib/voucher.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { terapkanVoucher, kalimatSyarat, rp, CATATAN_GRATIS, type Voucher, type KonteksVoucher } from './voucher'
import type { MenuApp } from './catalog'
import type { ItemPesanan } from './pricing'

const menu = (id: string, price: number, extra: Partial<MenuApp> = {}): MenuApp => ({
  id, name: `Menu ${id}`, description: null, price, image_url: null, is_available: true,
  category_id: 'kat-utama', sort_order: null, category_name: null, category_sort_order: null, ...extra,
})
const KATALOG = [menu('A', 30000), menu('B', 20000), menu('M', 10000, { category_id: 'kat-minum' })]
const item = (id: string, price: number, qty: number): ItemPesanan => ({ menu_item_id: id, name: `Menu ${id}`, unit_price: price, quantity: qty })

const dasar = (x: Partial<Voucher>): Voucher => ({
  id: 'v1', nama: 'Uji', deskripsi: null, kode: null, jenis: 'persen', nilai: 10, maks_potongan: null,
  menu_item_id: null, beli_qty: null, gratis_qty: null, harga_spesial: null, mulai: null, selesai: null,
  kuota_total: null, batas_per_pelanggan: null, min_belanja: null, khusus_pesanan_pertama: false,
  outlet_ids: null, hari: null, jam_mulai: null, jam_selesai: null, menu_ids: null, kategori_ids: null,
  is_active: true, ...x,
})
// Kamis 2026-09-24 15:00 WIB = 08:00 UTC
const k = (x: Partial<KonteksVoucher> = {}): KonteksVoucher => ({
  outletId: 'o1', sekarang: new Date('2026-09-24T08:00:00Z'), jumlahLunasTotal: 0,
  jumlahLunasPelanggan: 0, pelangganSudahPernahBayar: false, katalog: KATALOG, ...x,
})

describe('terapkanVoucher: jenis', () => {
  it('persen dengan batas maks', () => {
    const h = terapkanVoucher(dasar({ nilai: 20, maks_potongan: 5000 }), [item('A', 30000, 2)], k())
    expect(h).toEqual({ berlaku: true, potongan: 5000, itemGratis: [] })
  })
  it('persen hanya dari item yang cocok kategori', () => {
    const h = terapkanVoucher(dasar({ nilai: 50, kategori_ids: ['kat-minum'] }), [item('A', 30000, 1), item('M', 10000, 2)], k())
    expect(h).toMatchObject({ berlaku: true, potongan: 10000 })
  })
  it('nominal tidak melebihi basis', () => {
    const h = terapkanVoucher(dasar({ jenis: 'nominal', nilai: 15000 }), [item('A', 30000, 1)], k())
    expect(h).toMatchObject({ berlaku: true, potongan: 15000 })
  })
  it('gratis_item menambah item harga normal dan nilainya jadi potongan', () => {
    const h = terapkanVoucher(dasar({ jenis: 'gratis_item', menu_item_id: 'M', gratis_qty: 1 }), [item('A', 30000, 1)], k())
    expect(h).toEqual({ berlaku: true, potongan: 10000,
      itemGratis: [{ menu_item_id: 'M', name: 'Menu M', unit_price: 10000, quantity: 1, note: CATATAN_GRATIS }] })
  })
  it('gratis_item ditolak bila menu gratis habis', () => {
    const katalog = [menu('A', 30000), menu('M', 10000, { is_available: false })]
    const h = terapkanVoucher(dasar({ jenis: 'gratis_item', menu_item_id: 'M' }), [item('A', 30000, 1)], k({ katalog }))
    expect(h).toEqual({ berlaku: false, alasan: 'Menu gratis sedang habis' })
  })
  it('beli 2 gratis 1 per kelipatan, Y = menu X termurah bila kosong', () => {
    const v = dasar({ jenis: 'beli_x_gratis_y', beli_qty: 2, gratis_qty: 1, menu_ids: ['A', 'B'] })
    const h = terapkanVoucher(v, [item('A', 30000, 3), item('B', 20000, 2)], k())
    expect(h).toMatchObject({ berlaku: true, potongan: 40000 })
    expect((h as { itemGratis: ItemPesanan[] }).itemGratis).toEqual([
      { menu_item_id: 'B', name: 'Menu B', unit_price: 20000, quantity: 2, note: CATATAN_GRATIS },
    ])
  })
  it('beli X kurang jumlah memberi alasan', () => {
    const v = dasar({ jenis: 'beli_x_gratis_y', beli_qty: 2, gratis_qty: 1, menu_ids: ['A'] })
    expect(terapkanVoucher(v, [item('A', 30000, 1)], k())).toEqual({ berlaku: false, alasan: 'Tambahkan 1 lagi menu promo ini' })
  })
  it('harga_spesial', () => {
    const v = dasar({ jenis: 'harga_spesial', menu_item_id: 'A', harga_spesial: 25000 })
    expect(terapkanVoucher(v, [item('A', 30000, 2)], k())).toMatchObject({ berlaku: true, potongan: 10000 })
  })
  it('harga_spesial tanpa menunya di keranjang', () => {
    const v = dasar({ jenis: 'harga_spesial', menu_item_id: 'A', harga_spesial: 25000 })
    expect(terapkanVoucher(v, [item('B', 20000, 1)], k())).toEqual({ berlaku: false, alasan: 'Tambahkan Menu A ke keranjang' })
  })
  it('potongan dijepit 50% subtotal', () => {
    const h = terapkanVoucher(dasar({ jenis: 'nominal', nilai: 25000 }), [item('A', 30000, 1)], k())
    expect(h).toMatchObject({ berlaku: true, potongan: 15000 })
  })
  it('item gratis di atas 50% juga dijepit', () => {
    const h = terapkanVoucher(dasar({ jenis: 'gratis_item', menu_item_id: 'A' }), [item('M', 10000, 1)], k())
    // subtotal = 10000 + 30000 gratis = 40000 → maks 20000
    expect(h).toMatchObject({ berlaku: true, potongan: 20000 })
  })
})

describe('terapkanVoucher: syarat', () => {
  const beli = [item('A', 30000, 1)]
  it('nonaktif', () => expect(terapkanVoucher(dasar({ is_active: false }), beli, k())).toEqual({ berlaku: false, alasan: 'Voucher sudah tidak aktif' }))
  it('belum mulai', () => expect(terapkanVoucher(dasar({ mulai: '2026-10-01T00:00:00+07:00' }), beli, k())).toEqual({ berlaku: false, alasan: 'Berlaku mulai 1 Okt' }))
  it('sudah berakhir', () => expect(terapkanVoucher(dasar({ selesai: '2026-09-24T07:00:00Z' }), beli, k())).toEqual({ berlaku: false, alasan: 'Voucher sudah berakhir' }))
  it('outlet lain', () => expect(terapkanVoucher(dasar({ outlet_ids: ['o2'] }), beli, k())).toEqual({ berlaku: false, alasan: 'Tidak berlaku di outlet ini' }))
  it('hari WIB', () => expect(terapkanVoucher(dasar({ hari: [6, 7] }), beli, k())).toEqual({ berlaku: false, alasan: 'Hanya berlaku hari Sab, Min' }))
  it('jam WIB', () => expect(terapkanVoucher(dasar({ jam_mulai: '17:00:00', jam_selesai: '20:00:00' }), beli, k())).toEqual({ berlaku: false, alasan: 'Hanya berlaku pukul 17.00–20.00' }))
  it('jam lewat tengah malam', () => {
    // 23.30 WIB Kamis = 16:30 UTC
    const v = dasar({ jam_mulai: '22:00:00', jam_selesai: '02:00:00' })
    expect(terapkanVoucher(v, beli, k({ sekarang: new Date('2026-09-24T16:30:00Z') }))).toMatchObject({ berlaku: true })
  })
  it('hari dihitung WIB, bukan UTC', () => {
    // Jumat 01.00 WIB = Kamis 18:00 UTC → harus terbaca Jumat (5)
    const v = dasar({ hari: [5] })
    expect(terapkanVoucher(v, beli, k({ sekarang: new Date('2026-09-24T18:00:00Z') }))).toMatchObject({ berlaku: true })
  })
  it('khusus pesanan pertama', () => expect(terapkanVoucher(dasar({ khusus_pesanan_pertama: true }), beli, k({ pelangganSudahPernahBayar: true }))).toEqual({ berlaku: false, alasan: 'Khusus pesanan pertama' }))
  it('batas per pelanggan', () => expect(terapkanVoucher(dasar({ batas_per_pelanggan: 1 }), beli, k({ jumlahLunasPelanggan: 1 }))).toEqual({ berlaku: false, alasan: 'Sudah kamu pakai' }))
  it('kuota habis', () => expect(terapkanVoucher(dasar({ kuota_total: 5 }), beli, k({ jumlahLunasTotal: 5 }))).toEqual({ berlaku: false, alasan: 'Kuota voucher sudah habis' }))
  it('min belanja', () => expect(terapkanVoucher(dasar({ min_belanja: 42000 }), beli, k())).toEqual({ berlaku: false, alasan: 'Kurang Rp12.000 lagi' }))
  it('menu tertentu tidak ada di keranjang', () => expect(terapkanVoucher(dasar({ menu_ids: ['B'] }), beli, k())).toEqual({ berlaku: false, alasan: 'Tambahkan menu yang termasuk promo ini' }))
  it('tanpa keranjang hanya cek syarat umum', () => {
    expect(terapkanVoucher(dasar({ min_belanja: 999999 }), null, k({ outletId: null, katalog: null }))).toEqual({ berlaku: true, potongan: 0, itemGratis: [] })
  })
  it('potongan nol tidak berlaku', () => {
    const v = dasar({ jenis: 'harga_spesial', menu_item_id: 'A', harga_spesial: 40000 })
    expect(terapkanVoucher(v, [item('A', 30000, 1)], k())).toEqual({ berlaku: false, alasan: 'Voucher ini tidak memberi potongan untuk keranjangmu' })
  })
  it('item gratis dari klien tidak dihitung sebagai belanja', () => {
    const v = dasar({ min_belanja: 30000 })
    const h = terapkanVoucher(v, [item('A', 20000, 1), { ...item('B', 20000, 1), note: CATATAN_GRATIS }], k())
    expect(h).toEqual({ berlaku: false, alasan: 'Kurang Rp10.000 lagi' })
  })
})

describe('kalimatSyarat', () => {
  it('menggabungkan jenis dan syarat', () => {
    const v = dasar({ nilai: 20, maks_potongan: 15000, min_belanja: 50000, selesai: '2026-10-31T16:59:59Z', batas_per_pelanggan: 1 })
    expect(kalimatSyarat(v, {})).toBe('Potongan 20% maks Rp15.000 · min. belanja Rp50.000 · maks 1× per pelanggan · s.d. 31 Okt')
  })
  it('gratis item memakai nama menu', () => {
    expect(kalimatSyarat(dasar({ jenis: 'gratis_item', menu_item_id: 'M' }), { M: 'Es Teh' })).toBe('Gratis 1× Es Teh')
  })
  it('rp', () => expect(rp(1234567)).toBe('Rp1.234.567'))
})
```

- [ ] **Step 2: Jalankan, pastikan gagal** — `cd apps/retail-gateway && npx vitest run src/lib/voucher.test.ts` (kalau `npx` rusak, pakai `./node_modules/.bin/vitest` dari root repo worktree). Expected: FAIL `Cannot find module './voucher'`.

- [ ] **Step 3: Implementasi** — `apps/retail-gateway/src/lib/voucher.ts`:

```ts
/**
 * Aturan voucher aplikasi -- SATU sumber hitungan untuk validate, pembuatan
 * pesanan, dan daftar voucher. Murni: tanpa DB, tanpa jam sistem.
 *
 * `kalimatSyarat` punya salinan identik di
 * apps/admin-dashboard/src/lib/appRetail/voucher.ts -- ubah keduanya bersamaan.
 * Spec: docs/superpowers/specs/2026-09-25-app-retail-tahap3-voucher-design.md
 */
import { MAKS_POTONGAN_PERSEN, type ItemPesanan } from './pricing'
import type { MenuApp } from './catalog'

export type JenisVoucher = 'persen' | 'nominal' | 'gratis_item' | 'beli_x_gratis_y' | 'harga_spesial'
export type Voucher = {
  id: string; nama: string; deskripsi: string | null; kode: string | null; jenis: JenisVoucher
  nilai: number | null; maks_potongan: number | null; menu_item_id: string | null
  beli_qty: number | null; gratis_qty: number | null; harga_spesial: number | null
  mulai: string | null; selesai: string | null
  kuota_total: number | null; batas_per_pelanggan: number | null; min_belanja: number | null
  khusus_pesanan_pertama: boolean; outlet_ids: string[] | null
  hari: number[] | null; jam_mulai: string | null; jam_selesai: string | null
  menu_ids: string[] | null; kategori_ids: string[] | null; is_active: boolean
}
export type KonteksVoucher = {
  outletId: string | null
  sekarang: Date
  jumlahLunasTotal: number
  jumlahLunasPelanggan: number
  pelangganSudahPernahBayar: boolean
  katalog: MenuApp[] | null
}
export type HasilVoucher =
  | { berlaku: true; potongan: number; itemGratis: ItemPesanan[] }
  | { berlaku: false; alasan: string }

export const CATATAN_GRATIS = 'Gratis voucher'

const WIB_MS = 7 * 60 * 60 * 1000
const NAMA_HARI = ['', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export function rp(n: number): string {
  return 'Rp' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function wib(d: Date): Date {
  return new Date(d.getTime() + WIB_MS)
}
/** 1 = Senin ... 7 = Minggu, dalam WIB. */
function hariWib(d: Date): number {
  return ((wib(d).getUTCDay() + 6) % 7) + 1
}
function menitWib(d: Date): number {
  const w = wib(d)
  return w.getUTCHours() * 60 + w.getUTCMinutes()
}
function keMenit(jam: string): number {
  const [h, m] = jam.split(':')
  return Number(h) * 60 + Number(m)
}
function jamTampil(jam: string): string {
  return jam.slice(0, 5).replace(':', '.')
}
function tanggalTampil(iso: string): string {
  const w = wib(new Date(iso))
  return `${w.getUTCDate()} ${NAMA_BULAN[w.getUTCMonth()]}`
}
function dalamJam(v: Voucher, sekarang: Date): boolean {
  if (!v.jam_mulai || !v.jam_selesai) return true
  const m = menitWib(sekarang)
  const a = keMenit(v.jam_mulai)
  const b = keMenit(v.jam_selesai)
  return a <= b ? m >= a && m < b : m >= a || m < b
}

/** Syarat yang tidak butuh keranjang. Urutan = urutan alasan yang ditampilkan. */
function cekSyaratUmum(v: Voucher, k: KonteksVoucher): string | null {
  if (!v.is_active) return 'Voucher sudah tidak aktif'
  const t = k.sekarang.getTime()
  if (v.mulai && t < new Date(v.mulai).getTime()) return `Berlaku mulai ${tanggalTampil(v.mulai)}`
  if (v.selesai && t >= new Date(v.selesai).getTime()) return 'Voucher sudah berakhir'
  if (k.outletId && v.outlet_ids && v.outlet_ids.length > 0 && !v.outlet_ids.includes(k.outletId))
    return 'Tidak berlaku di outlet ini'
  if (v.hari && v.hari.length > 0 && !v.hari.includes(hariWib(k.sekarang)))
    return `Hanya berlaku hari ${[...v.hari].sort().map((h) => NAMA_HARI[h]).join(', ')}`
  if (!dalamJam(v, k.sekarang))
    return `Hanya berlaku pukul ${jamTampil(v.jam_mulai!)}–${jamTampil(v.jam_selesai!)}`
  if (v.khusus_pesanan_pertama && k.pelangganSudahPernahBayar) return 'Khusus pesanan pertama'
  if (v.batas_per_pelanggan != null && k.jumlahLunasPelanggan >= v.batas_per_pelanggan)
    return v.batas_per_pelanggan === 1 ? 'Sudah kamu pakai' : `Sudah kamu pakai ${v.batas_per_pelanggan}×`
  if (v.kuota_total != null && k.jumlahLunasTotal >= v.kuota_total) return 'Kuota voucher sudah habis'
  return null
}

export function terapkanVoucher(v: Voucher, items: ItemPesanan[] | null, k: KonteksVoucher): HasilVoucher {
  const umum = cekSyaratUmum(v, k)
  if (umum) return { berlaku: false, alasan: umum }
  if (items === null || k.katalog === null) return { berlaku: true, potongan: 0, itemGratis: [] }

  // Item gratis selalu disusun ulang oleh server -- yang dikirim klien diabaikan.
  const belanja = items.filter((it) => it.note !== CATATAN_GRATIS)
  const peta = new Map(k.katalog.map((m) => [m.id, m]))
  const subtotalBelanja = belanja.reduce((s, it) => s + it.unit_price * it.quantity, 0)

  if (v.min_belanja != null && subtotalBelanja < v.min_belanja)
    return { berlaku: false, alasan: `Kurang ${rp(v.min_belanja - subtotalBelanja)} lagi` }

  const adaFilter = (v.menu_ids?.length ?? 0) > 0 || (v.kategori_ids?.length ?? 0) > 0
  const cocok = (it: ItemPesanan) =>
    !adaFilter ||
    (v.menu_ids ?? []).includes(it.menu_item_id) ||
    (v.kategori_ids ?? []).includes(peta.get(it.menu_item_id)?.category_id ?? '')
  const itemCocok = belanja.filter(cocok)
  if (adaFilter && itemCocok.length === 0 && v.jenis !== 'gratis_item' && v.jenis !== 'harga_spesial')
    return { berlaku: false, alasan: 'Tambahkan menu yang termasuk promo ini' }

  let potongan = 0
  let itemGratis: ItemPesanan[] = []
  const gratis = (menuId: string, qty: number): ItemPesanan[] | null => {
    const m = peta.get(menuId)
    if (!m || !m.is_available) return null
    return [{ menu_item_id: m.id, name: m.name, unit_price: m.price, quantity: qty, note: CATATAN_GRATIS }]
  }

  switch (v.jenis) {
    case 'persen': {
      const basis = itemCocok.reduce((s, it) => s + it.unit_price * it.quantity, 0)
      potongan = Math.round((basis * (v.nilai ?? 0)) / 100)
      if (v.maks_potongan != null) potongan = Math.min(potongan, v.maks_potongan)
      break
    }
    case 'nominal': {
      const basis = itemCocok.reduce((s, it) => s + it.unit_price * it.quantity, 0)
      potongan = Math.min(v.nilai ?? 0, basis)
      break
    }
    case 'gratis_item': {
      const g = gratis(v.menu_item_id!, v.gratis_qty ?? 1)
      if (!g) return { berlaku: false, alasan: 'Menu gratis sedang habis' }
      itemGratis = g
      potongan = g[0].unit_price * g[0].quantity
      break
    }
    case 'beli_x_gratis_y': {
      const beliX = v.beli_qty ?? 1
      const jumlahX = itemCocok.reduce((s, it) => s + it.quantity, 0)
      const kelipatan = Math.floor(jumlahX / beliX)
      if (kelipatan === 0) return { berlaku: false, alasan: `Tambahkan ${beliX - jumlahX} lagi menu promo ini` }
      const idY = v.menu_item_id ?? [...itemCocok].sort((a, b) => a.unit_price - b.unit_price)[0].menu_item_id
      const g = gratis(idY, kelipatan * (v.gratis_qty ?? 1))
      if (!g) return { berlaku: false, alasan: 'Menu gratis sedang habis' }
      itemGratis = g
      potongan = g[0].unit_price * g[0].quantity
      break
    }
    case 'harga_spesial': {
      const target = belanja.filter((it) => it.menu_item_id === v.menu_item_id)
      if (target.length === 0) {
        const nama = peta.get(v.menu_item_id!)?.name ?? 'menu promo'
        return { berlaku: false, alasan: `Tambahkan ${nama} ke keranjang` }
      }
      potongan = target.reduce((s, it) => s + Math.max(0, it.unit_price - (v.harga_spesial ?? 0)) * it.quantity, 0)
      break
    }
  }

  const subtotal = subtotalBelanja + itemGratis.reduce((s, it) => s + it.unit_price * it.quantity, 0)
  potongan = Math.min(potongan, subtotal, Math.floor((subtotal * MAKS_POTONGAN_PERSEN) / 100))
  if (potongan <= 0) return { berlaku: false, alasan: 'Voucher ini tidak memberi potongan untuk keranjangmu' }
  return { berlaku: true, potongan, itemGratis }
}

/** Kalimat syarat untuk pelanggan & pratinjau admin. Salinan identik di admin. */
export function kalimatSyarat(v: Voucher, namaMenu: Record<string, string>): string {
  const nama = (id: string | null) => (id && namaMenu[id]) || 'menu promo'
  const bagian: string[] = []
  switch (v.jenis) {
    case 'persen':
      bagian.push(`Potongan ${v.nilai}%` + (v.maks_potongan != null ? ` maks ${rp(v.maks_potongan)}` : ''))
      break
    case 'nominal':
      bagian.push(`Potongan ${rp(v.nilai ?? 0)}`)
      break
    case 'gratis_item':
      bagian.push(`Gratis ${v.gratis_qty ?? 1}× ${nama(v.menu_item_id)}`)
      break
    case 'beli_x_gratis_y':
      bagian.push(`Beli ${v.beli_qty} gratis ${v.gratis_qty}` + (v.menu_item_id ? ` ${nama(v.menu_item_id)}` : ''))
      break
    case 'harga_spesial':
      bagian.push(`${nama(v.menu_item_id)} jadi ${rp(v.harga_spesial ?? 0)}`)
      break
  }
  if (v.min_belanja != null) bagian.push(`min. belanja ${rp(v.min_belanja)}`)
  if ((v.menu_ids?.length ?? 0) > 0 || (v.kategori_ids?.length ?? 0) > 0) bagian.push('menu tertentu')
  if (v.khusus_pesanan_pertama) bagian.push('khusus pesanan pertama')
  if (v.batas_per_pelanggan != null) bagian.push(`maks ${v.batas_per_pelanggan}× per pelanggan`)
  if (v.hari && v.hari.length > 0) bagian.push(`hari ${[...v.hari].sort().map((h) => NAMA_HARI[h]).join(', ')}`)
  if (v.jam_mulai && v.jam_selesai) bagian.push(`pukul ${jamTampil(v.jam_mulai)}–${jamTampil(v.jam_selesai)}`)
  if ((v.outlet_ids?.length ?? 0) > 0) bagian.push('outlet tertentu')
  if (v.selesai) bagian.push(`s.d. ${tanggalTampil(v.selesai)}`)
  return bagian.join(' · ')
}
```

- [ ] **Step 4: Jalankan, pastikan lulus** — `npx vitest run src/lib/voucher.test.ts`. Expected: semua PASS. Lalu `npx tsc --noEmit` di `apps/retail-gateway` → 0 error.

- [ ] **Step 5: Commit**

```bash
git add apps/retail-gateway/src/lib/voucher.ts apps/retail-gateway/src/lib/voucher.test.ts
git commit -m "feat(retail-gateway): logika voucher murni (5 jenis, 8 syarat, WIB)"
```

---

### Task 3: Akses DB voucher di gateway

**Files:**
- Create: `apps/retail-gateway/src/lib/voucherDb.ts`
- Test: `apps/retail-gateway/src/lib/voucherDb.test.ts`

**Interfaces:**
- Consumes: `Voucher`, `KonteksVoucher`, `HasilVoucher`, `terapkanVoucher` (Task 2); `createRetailClient` (`lib/supabase.ts`); `MenuApp`, `ItemPesanan`.
- Produces:

```ts
export const KOLOM_VOUCHER: string
export function normalisasiVoucher(b: Record<string, unknown>): Voucher
export function normalisasiKode(kode: string): string          // trim + huruf besar
export type PilihVoucher = { voucherId?: string | null; kodeVoucher?: string | null }
export async function ambilVoucher(retail: RetailClient, pilih: PilihVoucher): Promise<Voucher | null>
export async function konteksPelanggan(retail: RetailClient, voucherId: string, customerId: string):
  Promise<Pick<KonteksVoucher, 'jumlahLunasTotal' | 'jumlahLunasPelanggan' | 'pelangganSudahPernahBayar'>>
export type NilaiVoucher =
  | { ada: false }                                              // tak ada voucher diminta
  | { ada: true; voucher: Voucher | null; hasil: HasilVoucher } // voucher null = kode tak dikenal
export async function nilaiVoucher(input: {
  retail: RetailClient; pilih: PilihVoucher; customerId: string; outletId: string
  items: ItemPesanan[]; katalog: MenuApp[]; sekarang: Date
}): Promise<NilaiVoucher>
// RetailClient = ReturnType<typeof createRetailClient>
```

Galat DB di dalam `nilaiVoucher` **dilempar** (pemanggil yang menerjemahkannya jadi pesan). `numeric` dari PostgREST bisa tiba sebagai string, jadi `normalisasiVoucher` wajib `Number()`.

- [ ] **Step 1: Tulis test yang gagal** — `voucherDb.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { normalisasiVoucher, normalisasiKode, nilaiVoucher } from './voucherDb'

const baris = {
  id: 'v1', nama: 'Uji', deskripsi: null, kode: 'HEMAT', jenis: 'nominal', nilai: '5000', maks_potongan: null,
  menu_item_id: null, beli_qty: null, gratis_qty: null, harga_spesial: null, mulai: null, selesai: null,
  kuota_total: 10, batas_per_pelanggan: null, min_belanja: '20000', khusus_pesanan_pertama: false,
  outlet_ids: null, hari: null, jam_mulai: null, jam_selesai: null, menu_ids: null, kategori_ids: null, is_active: true,
}

describe('normalisasi', () => {
  it('numeric string jadi number', () => {
    const v = normalisasiVoucher(baris)
    expect(v.nilai).toBe(5000)
    expect(v.min_belanja).toBe(20000)
    expect(v.maks_potongan).toBeNull()
  })
  it('kode', () => expect(normalisasiKode('  hemat10 ')).toBe('HEMAT10'))
})

/** Klien palsu: `from(tabel)` mengembalikan rantai yang berakhir ke `hasil[tabel]`. */
function klien(hasil: Record<string, unknown>) {
  const rantai = (tabel: string): any => {
    const r: any = {}
    for (const f of ['select', 'eq', 'is', 'not', 'in', 'limit']) r[f] = vi.fn(() => r)
    r.maybeSingle = vi.fn(async () => hasil[tabel])
    r.then = (ok: (x: unknown) => unknown) => Promise.resolve(hasil[tabel + ':count'] ?? { count: 0, error: null }).then(ok)
    return r
  }
  return { from: vi.fn(rantai) } as any
}

describe('nilaiVoucher', () => {
  const dasar = { customerId: 'c1', outletId: 'o1', items: [{ menu_item_id: 'A', name: 'A', unit_price: 30000, quantity: 1 }],
    katalog: [{ id: 'A', name: 'A', description: null, price: 30000, image_url: null, is_available: true, category_id: null, sort_order: null, category_name: null, category_sort_order: null }],
    sekarang: new Date('2026-09-24T08:00:00Z') }
  it('tanpa pilihan → ada:false', async () => {
    expect(await nilaiVoucher({ retail: klien({}), pilih: {}, ...dasar })).toEqual({ ada: false })
  })
  it('kode tak dikenal → voucher null + alasan', async () => {
    const r = await nilaiVoucher({ retail: klien({ vouchers: { data: null, error: null } }), pilih: { kodeVoucher: 'x' }, ...dasar })
    expect(r).toEqual({ ada: true, voucher: null, hasil: { berlaku: false, alasan: 'Kode voucher tidak ditemukan' } })
  })
  it('voucher ditemukan → dihitung', async () => {
    const r = await nilaiVoucher({ retail: klien({ vouchers: { data: baris, error: null } }), pilih: { voucherId: 'v1' }, ...dasar })
    expect(r).toMatchObject({ ada: true, hasil: { berlaku: true, potongan: 5000 } })
  })
  it('galat DB dilempar', async () => {
    await expect(nilaiVoucher({ retail: klien({ vouchers: { data: null, error: { message: 'mati' } } }), pilih: { voucherId: 'v1' }, ...dasar }))
      .rejects.toThrow('mati')
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal** — `npx vitest run src/lib/voucherDb.test.ts` → FAIL (modul belum ada).

- [ ] **Step 3: Implementasi** — `voucherDb.ts`:

```ts
import type { createRetailClient } from './supabase'
import type { MenuApp } from './catalog'
import type { ItemPesanan } from './pricing'
import { terapkanVoucher, type Voucher, type KonteksVoucher, type HasilVoucher, type JenisVoucher } from './voucher'

type RetailClient = ReturnType<typeof createRetailClient>

export const KOLOM_VOUCHER =
  'id, nama, deskripsi, kode, jenis, nilai, maks_potongan, menu_item_id, beli_qty, gratis_qty, harga_spesial, ' +
  'mulai, selesai, kuota_total, batas_per_pelanggan, min_belanja, khusus_pesanan_pertama, outlet_ids, hari, ' +
  'jam_mulai, jam_selesai, menu_ids, kategori_ids, is_active'

const angka = (x: unknown): number | null => (x === null || x === undefined ? null : Number(x))
const teks = (x: unknown): string | null => (typeof x === 'string' ? x : null)
const daftar = <T>(x: unknown): T[] | null => (Array.isArray(x) ? (x as T[]) : null)

export function normalisasiVoucher(b: Record<string, unknown>): Voucher {
  return {
    id: String(b.id), nama: String(b.nama), deskripsi: teks(b.deskripsi), kode: teks(b.kode),
    jenis: b.jenis as JenisVoucher,
    nilai: angka(b.nilai), maks_potongan: angka(b.maks_potongan), menu_item_id: teks(b.menu_item_id),
    beli_qty: angka(b.beli_qty), gratis_qty: angka(b.gratis_qty), harga_spesial: angka(b.harga_spesial),
    mulai: teks(b.mulai), selesai: teks(b.selesai),
    kuota_total: angka(b.kuota_total), batas_per_pelanggan: angka(b.batas_per_pelanggan), min_belanja: angka(b.min_belanja),
    khusus_pesanan_pertama: b.khusus_pesanan_pertama === true, outlet_ids: daftar<string>(b.outlet_ids),
    hari: daftar<number>(b.hari)?.map(Number) ?? null, jam_mulai: teks(b.jam_mulai), jam_selesai: teks(b.jam_selesai),
    menu_ids: daftar<string>(b.menu_ids), kategori_ids: daftar<string>(b.kategori_ids), is_active: b.is_active === true,
  }
}

export function normalisasiKode(kode: string): string {
  return kode.trim().toUpperCase()
}

export type PilihVoucher = { voucherId?: string | null; kodeVoucher?: string | null }

export async function ambilVoucher(retail: RetailClient, pilih: PilihVoucher): Promise<Voucher | null> {
  let q = retail.from('vouchers').select(KOLOM_VOUCHER)
  q = pilih.voucherId ? q.eq('id', pilih.voucherId) : q.eq('kode', normalisasiKode(pilih.kodeVoucher ?? ''))
  const { data, error } = await q.maybeSingle()
  if (error) throw new Error(error.message)
  return data ? normalisasiVoucher(data as Record<string, unknown>) : null
}

async function hitung(p: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number> {
  const { count, error } = await p
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function konteksPelanggan(retail: RetailClient, voucherId: string, customerId: string) {
  const [jumlahLunasTotal, jumlahLunasPelanggan, sudahBayar] = await Promise.all([
    hitung(retail.from('voucher_pemakaian').select('id', { count: 'exact', head: true })
      .eq('voucher_id', voucherId).not('lunas_at', 'is', null)),
    hitung(retail.from('voucher_pemakaian').select('id', { count: 'exact', head: true })
      .eq('voucher_id', voucherId).eq('customer_id', customerId).not('lunas_at', 'is', null)),
    hitung(retail.from('order_drafts').select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId).eq('status', 'dibayar')),
  ])
  return { jumlahLunasTotal, jumlahLunasPelanggan, pelangganSudahPernahBayar: sudahBayar > 0 }
}

export type NilaiVoucher =
  | { ada: false }
  | { ada: true; voucher: Voucher | null; hasil: HasilVoucher }

export async function nilaiVoucher(input: {
  retail: RetailClient; pilih: PilihVoucher; customerId: string; outletId: string
  items: ItemPesanan[]; katalog: MenuApp[]; sekarang: Date
}): Promise<NilaiVoucher> {
  const { retail, pilih } = input
  if (!pilih.voucherId && !(pilih.kodeVoucher && pilih.kodeVoucher.trim())) return { ada: false }
  const voucher = await ambilVoucher(retail, pilih)
  if (!voucher) return { ada: true, voucher: null, hasil: { berlaku: false, alasan: 'Kode voucher tidak ditemukan' } }
  const kp = await konteksPelanggan(retail, voucher.id, input.customerId)
  const konteks: KonteksVoucher = { outletId: input.outletId, sekarang: input.sekarang, katalog: input.katalog, ...kp }
  return { ada: true, voucher, hasil: terapkanVoucher(voucher, input.items, konteks) }
}
```

- [ ] **Step 4: Jalankan, pastikan lulus** — `npx vitest run src/lib/voucherDb.test.ts` → PASS; `npx tsc --noEmit` → 0 error. Kalau klien palsu di test tidak cocok dengan rantai nyata (mis. `.not()` dipanggil setelah `.eq()`), perbaiki klien palsunya, bukan kodenya.

- [ ] **Step 5: Commit**

```bash
git add apps/retail-gateway/src/lib/voucherDb.ts apps/retail-gateway/src/lib/voucherDb.test.ts
git commit -m "feat(retail-gateway): baca voucher & konteks pelanggan dari DB"
```

---

### Task 4: Endpoint `POST /api/v1/vouchers`

**Files:**
- Create: `apps/retail-gateway/src/app/api/v1/vouchers/route.ts`
- Test: `apps/retail-gateway/src/app/api/v1/vouchers/route.test.ts`

**Interfaces:**
- Consumes: `requireCustomer` (`lib/auth`), `createRetailClient`, `createServiceClient`, `ambilKatalog`, `KOLOM_VOUCHER`, `normalisasiVoucher`, `konteksPelanggan`, `terapkanVoucher`, `kalimatSyarat`.
- Produces (respons 200):

```json
{ "vouchers": [ { "id": "…", "nama": "…", "deskripsi": null, "jenis": "persen",
   "kalimat_syarat": "Potongan 20% …", "selesai": null, "status": "berlaku" | "belum", "alasan": "…"? } ] }
```

Aturan: hanya voucher `kode IS NULL AND is_active = true` yang **belum berakhir** (`selesai IS NULL OR selesai > now()`). Urutan: `berlaku` dulu, lalu `belum`; di dalamnya urut `created_at` terbaru. Body opsional `{ outlet_id?, items? }`. Tanpa `outlet_id`+`items` → tanpa keranjang (`katalog: null`, `outletId: null`). Galat DB → 502 `{ error: 'Gagal memuat voucher' }`.

- [ ] **Step 1: Tulis test yang gagal** — `route.test.ts` (pola mock sama dengan `notifications/route.test.ts`):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import * as auth from '@/lib/auth'
import * as supabase from '@/lib/supabase'
import * as voucherDb from '@/lib/voucherDb'

vi.mock('@/lib/auth')
vi.mock('@/lib/supabase')
vi.mock('@/lib/catalog', () => ({ ambilKatalog: vi.fn(async () => []) }))
vi.mock('@/lib/voucherDb', async (asli) => ({ ...(await asli<typeof voucherDb>()), konteksPelanggan: vi.fn() }))

const baris = (x: Record<string, unknown>) => ({
  id: 'v', nama: 'V', deskripsi: null, kode: null, jenis: 'nominal', nilai: 5000, maks_potongan: null, menu_item_id: null,
  beli_qty: null, gratis_qty: null, harga_spesial: null, mulai: null, selesai: null, kuota_total: null,
  batas_per_pelanggan: null, min_belanja: null, khusus_pesanan_pertama: false, outlet_ids: null, hari: null,
  jam_mulai: null, jam_selesai: null, menu_ids: null, kategori_ids: null, is_active: true, ...x,
})

function retailDengan(data: unknown[], error: unknown = null) {
  const r: any = {}
  for (const f of ['select', 'is', 'eq', 'or', 'order']) r[f] = vi.fn(() => r)
  r.then = (ok: (x: unknown) => unknown) => Promise.resolve({ data, error }).then(ok)
  return { from: vi.fn(() => r) } as any
}
const req = (body?: unknown) => new Request('https://x/api/v1/vouchers', { method: 'POST', body: body ? JSON.stringify(body) : undefined })

describe('POST /api/v1/vouchers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(voucherDb.konteksPelanggan).mockResolvedValue({ jumlahLunasTotal: 0, jumlahLunasPelanggan: 0, pelangganSudahPernahBayar: false })
    vi.mocked(supabase.createServiceClient).mockReturnValue({ from: vi.fn(() => ({ select: vi.fn(() => ({ in: vi.fn(async () => ({ data: [], error: null })) })) })) } as any)
  })
  it('401 tanpa sesi', async () => {
    vi.mocked(auth.requireCustomer).mockResolvedValue(null)
    expect((await POST(req())).status).toBe(401)
  })
  it('berlaku didahulukan, alasan ikut', async () => {
    vi.mocked(auth.requireCustomer).mockResolvedValue({ customerId: 'c1' })
    vi.mocked(voucherDb.konteksPelanggan)
      .mockResolvedValueOnce({ jumlahLunasTotal: 0, jumlahLunasPelanggan: 1, pelangganSudahPernahBayar: true })
      .mockResolvedValueOnce({ jumlahLunasTotal: 0, jumlahLunasPelanggan: 0, pelangganSudahPernahBayar: true })
    vi.mocked(supabase.createRetailClient).mockReturnValue(retailDengan([
      baris({ id: 'habis', batas_per_pelanggan: 1 }), baris({ id: 'ok' }),
    ]))
    const res = await POST(req())
    const body = await res.json()
    expect(body.vouchers.map((v: { id: string }) => v.id)).toEqual(['ok', 'habis'])
    expect(body.vouchers[1]).toMatchObject({ status: 'belum', alasan: 'Sudah kamu pakai', kalimat_syarat: 'Potongan Rp5.000 · maks 1× per pelanggan' })
  })
  it('502 saat DB galat', async () => {
    vi.mocked(auth.requireCustomer).mockResolvedValue({ customerId: 'c1' })
    vi.mocked(supabase.createRetailClient).mockReturnValue(retailDengan([], { message: 'mati' }))
    expect((await POST(req())).status).toBe(502)
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal** — `npx vitest run src/app/api/v1/vouchers` → FAIL.

- [ ] **Step 3: Implementasi** — `route.ts`:

```ts
import { NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/auth'
import { createRetailClient, createServiceClient } from '@/lib/supabase'
import { ambilKatalog } from '@/lib/catalog'
import { KOLOM_VOUCHER, normalisasiVoucher, konteksPelanggan } from '@/lib/voucherDb'
import { terapkanVoucher, kalimatSyarat } from '@/lib/voucher'
import type { ItemPesanan } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

/**
 * Daftar voucher PUBLIK untuk halaman Voucher dan pemilih di checkout.
 * Voucher rahasia (ber-kode) tidak pernah ikut di sini.
 */
export async function POST(request: Request) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })

  let body: { outlet_id?: string; items?: ItemPesanan[] } = {}
  try {
    const teks = await request.text()
    if (teks) body = JSON.parse(teks)
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 })
  }
  const pakaiKeranjang = !!body.outlet_id && Array.isArray(body.items) && body.items.length > 0

  try {
    const retail = createRetailClient()
    const sekarangIso = new Date().toISOString()
    const { data, error } = await retail
      .from('vouchers')
      .select(KOLOM_VOUCHER + ', created_at')
      .is('kode', null)
      .eq('is_active', true)
      .or(`selesai.is.null,selesai.gt.${sekarangIso}`)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)

    const vouchers = (data ?? []).map((b) => normalisasiVoucher(b as Record<string, unknown>))
    const katalog = pakaiKeranjang ? await ambilKatalog(body.outlet_id!, true) : null

    const idMenu = [...new Set(vouchers.map((v) => v.menu_item_id).filter((x): x is string => !!x))]
    const namaMenu: Record<string, string> = {}
    if (idMenu.length > 0) {
      const { data: menu, error: eMenu } = await createServiceClient().from('menu_items').select('id, name').in('id', idMenu)
      if (eMenu) throw new Error(eMenu.message)
      for (const m of menu ?? []) namaMenu[m.id as string] = m.name as string
    }

    const sekarang = new Date()
    const hasil = await Promise.all(vouchers.map(async (v) => {
      const kp = await konteksPelanggan(retail, v.id, sesi.customerId)
      const h = terapkanVoucher(v, pakaiKeranjang ? body.items! : null, {
        outletId: pakaiKeranjang ? body.outlet_id! : null, sekarang, katalog, ...kp,
      })
      return {
        id: v.id, nama: v.nama, deskripsi: v.deskripsi, jenis: v.jenis,
        kalimat_syarat: kalimatSyarat(v, namaMenu), selesai: v.selesai,
        status: h.berlaku ? 'berlaku' : 'belum',
        ...(h.berlaku ? {} : { alasan: h.alasan }),
      }
    }))
    // Urutan stabil: berlaku dulu, sisanya mempertahankan urutan terbaru.
    hasil.sort((a, b) => Number(b.status === 'berlaku') - Number(a.status === 'berlaku'))
    return NextResponse.json({ vouchers: hasil })
  } catch (e) {
    console.error('gagal memuat voucher', e)
    return NextResponse.json({ error: 'Gagal memuat voucher' }, { status: 502 })
  }
}
```

- [ ] **Step 4: Jalankan, pastikan lulus** — test route PASS, `npx tsc --noEmit` 0 error.

- [ ] **Step 5: Commit**

```bash
git add apps/retail-gateway/src/app/api/v1/vouchers
git commit -m "feat(retail-gateway): endpoint daftar voucher publik"
```

---

### Task 5: Voucher di validate, pembuatan pesanan, dan webhook

**Files:**
- Modify: `apps/retail-gateway/src/app/api/v1/checkout/validate/route.ts`
- Modify: `apps/retail-gateway/src/app/api/v1/orders/route.ts`
- Modify: `apps/retail-gateway/src/app/api/webhooks/xendit/route.ts`
- Create: `apps/retail-gateway/src/lib/rincianVoucher.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: `nilaiVoucher`, `NilaiVoucher`, `PilihVoucher` (Task 3); `hitungTotal`, `ItemPesanan`, `RincianHarga` (`pricing.ts`).
- Produces:

```ts
// lib/rincianVoucher.ts
export type BlokVoucher = { id: string | null; nama: string | null; status: 'berlaku' | 'belum' | 'tidak_ada';
  alasan?: string; potongan: number; item_gratis: ItemPesanan[] }
export function rincianDenganVoucher(items: ItemPesanan[], nv: NilaiVoucher):
  { itemsAkhir: ItemPesanan[]; rincian: RincianHarga; blok: BlokVoucher | null }
```
- Validate respons (ok:true) ditambah `voucher: BlokVoucher | null`. Body request: `voucher_id?`, `kode_voucher?`.
- Orders body: `voucher_id?`, `kode_voucher?`. Tidak berlaku → 409 `{ error: 'voucher_tidak_berlaku', pesan }`.

- [ ] **Step 1: Test `rincianDenganVoucher` yang gagal** — `lib/rincianVoucher.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { rincianDenganVoucher } from './rincianVoucher'

const A = { menu_item_id: 'A', name: 'A', unit_price: 30000, quantity: 1 }
const G = { menu_item_id: 'M', name: 'M', unit_price: 10000, quantity: 1, note: 'Gratis voucher' }
const v = { id: 'v1', nama: 'Uji' } as any

describe('rincianDenganVoucher', () => {
  it('tanpa voucher = hitungTotal tanpa diskon', () => {
    expect(rincianDenganVoucher([A], { ada: false })).toEqual({
      itemsAkhir: [A], rincian: { subtotal: 30000, discountAmount: 0, total: 30000 }, blok: null })
  })
  it('berlaku: item gratis ditambahkan, potongan jadi discount', () => {
    const r = rincianDenganVoucher([A], { ada: true, voucher: v, hasil: { berlaku: true, potongan: 10000, itemGratis: [G] } })
    expect(r.itemsAkhir).toEqual([A, G])
    expect(r.rincian).toEqual({ subtotal: 40000, discountAmount: 10000, total: 30000 })
    expect(r.blok).toEqual({ id: 'v1', nama: 'Uji', status: 'berlaku', potongan: 10000, item_gratis: [G] })
  })
  it('belum berlaku: harga normal, blok membawa alasan', () => {
    const r = rincianDenganVoucher([A], { ada: true, voucher: v, hasil: { berlaku: false, alasan: 'Kuota voucher sudah habis' } })
    expect(r.rincian.discountAmount).toBe(0)
    expect(r.blok).toEqual({ id: 'v1', nama: 'Uji', status: 'belum', alasan: 'Kuota voucher sudah habis', potongan: 0, item_gratis: [] })
  })
  it('kode tak dikenal', () => {
    const r = rincianDenganVoucher([A], { ada: true, voucher: null, hasil: { berlaku: false, alasan: 'Kode voucher tidak ditemukan' } })
    expect(r.blok).toMatchObject({ id: null, nama: null, status: 'tidak_ada' })
  })
  it('item gratis kiriman klien dibuang', () => {
    expect(rincianDenganVoucher([A, G], { ada: false }).itemsAkhir).toEqual([A])
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal.**

- [ ] **Step 3: Implementasi `lib/rincianVoucher.ts`:**

```ts
import { hitungTotal, type ItemPesanan, type RincianHarga } from './pricing'
import { CATATAN_GRATIS } from './voucher'
import type { NilaiVoucher } from './voucherDb'

export type BlokVoucher = {
  id: string | null; nama: string | null; status: 'berlaku' | 'belum' | 'tidak_ada'
  alasan?: string; potongan: number; item_gratis: ItemPesanan[]
}

/**
 * Menyusun item akhir + rincian harga. Item bercatatan "Gratis voucher" dari
 * klien SELALU dibuang -- hanya server yang boleh menambahkan item gratis.
 */
export function rincianDenganVoucher(items: ItemPesanan[], nv: NilaiVoucher) {
  const belanja = items.filter((it) => it.note !== CATATAN_GRATIS)
  if (!nv.ada) return { itemsAkhir: belanja, rincian: hitungTotal(belanja, 0), blok: null as BlokVoucher | null }

  const dasar = { id: nv.voucher?.id ?? null, nama: nv.voucher?.nama ?? null }
  if (!nv.hasil.berlaku) {
    return {
      itemsAkhir: belanja,
      rincian: hitungTotal(belanja, 0),
      blok: { ...dasar, status: nv.voucher ? 'belum' : 'tidak_ada', alasan: nv.hasil.alasan, potongan: 0, item_gratis: [] } as BlokVoucher,
    }
  }
  const itemsAkhir = [...belanja, ...nv.hasil.itemGratis]
  const subtotal = itemsAkhir.reduce((s, it) => s + it.unit_price * it.quantity, 0)
  const rincian: RincianHarga = { subtotal, discountAmount: nv.hasil.potongan, total: subtotal - nv.hasil.potongan }
  return {
    itemsAkhir, rincian,
    blok: { ...dasar, status: 'berlaku', potongan: nv.hasil.potongan, item_gratis: nv.hasil.itemGratis } as BlokVoucher,
  }
}
```

- [ ] **Step 4: Jalankan test lib → PASS.**

- [ ] **Step 5: Ubah `checkout/validate/route.ts`.** Hapus `const DISKON_PILOT_PERSEN = 0`. Tambah import `createRetailClient`, `nilaiVoucher`, `type NilaiVoucher` (dari `@/lib/voucherDb`), `rincianDenganVoucher`, `CATATAN_GRATIS`. Tipe body jadi `{ outlet_id?: string; items?: ItemPesanan[]; voucher_id?: string; kode_voucher?: string }`. **Sebelum** `periksaKeranjang`, buang item gratis kiriman klien: `const itemsBelanja = body.items.filter((it) => it.note !== CATATAN_GRATIS)` (import `CATATAN_GRATIS`), lalu pakai `itemsBelanja` untuk `periksaKeranjang`. Ganti dua baris terakhir menjadi:

```ts
  let nv: NilaiVoucher
  try {
    nv = await nilaiVoucher({
      retail: createRetailClient(), pilih: { voucherId: body.voucher_id, kodeVoucher: body.kode_voucher },
      customerId: sesi.customerId, outletId: body.outlet_id, items: itemsBelanja, katalog, sekarang: new Date(),
    })
  } catch (e) {
    console.error('gagal memeriksa voucher', e)
    nv = { ada: true as const, voucher: null, hasil: { berlaku: false as const, alasan: 'Voucher tidak dapat dicek, coba lagi' } }
  }
  const { rincian, blok } = rincianDenganVoucher(itemsBelanja, nv)
  return NextResponse.json({ ok: true, ...rincian, voucher: blok })
```

Catatan: galat voucher tidak menggagalkan validate — pesanannya tetap bisa lanjut kalau voucher dilepas. Blok dengan `voucher: null` tapi alasan galat akan berstatus `tidak_ada`; itu disengaja (APK menampilkan alasannya dan mengunci Bayar sampai voucher dilepas).

- [ ] **Step 6: Ubah `orders/route.ts`.** Hapus `DISKON_PILOT_PERSEN`. Body tambah `voucher_id?: string; kode_voucher?: string`. Import `nilaiVoucher`, `type NilaiVoucher`, `rincianDenganVoucher`, `CATATAN_GRATIS`. `itemsTepercaya` disusun dari `body.items.filter((it) => it.note !== CATATAN_GRATIS)` (buang item gratis klien sebelum `periksaKeranjang` juga). Ganti `const rincian = hitungTotal(itemsTepercaya, DISKON_PILOT_PERSEN)` dengan:

```ts
  let nv: NilaiVoucher
  try {
    nv = await nilaiVoucher({
      retail, pilih: { voucherId: body.voucher_id, kodeVoucher: body.kode_voucher },
      customerId: sesi.customerId, outletId: body.outlet_id, items: itemsTepercaya, katalog, sekarang: new Date(),
    })
  } catch (e) {
    console.error('gagal memeriksa voucher', e)
    return NextResponse.json({ error: 'voucher_tidak_berlaku', pesan: 'Voucher tidak dapat dicek, coba lagi' }, { status: 409 })
  }
  // Tidak ada tagihan yang terbit dengan harga yang salah.
  if (nv.ada && !nv.hasil.berlaku) {
    return NextResponse.json({ error: 'voucher_tidak_berlaku', pesan: nv.hasil.alasan }, { status: 409 })
  }
  const { itemsAkhir, rincian } = rincianDenganVoucher(itemsTepercaya, nv)
```

Ganti `items: itemsTepercaya` di insert draft menjadi `items: itemsAkhir`. Tepat setelah draft berhasil dibuat (setelah blok `if (draftError || !draft) {...}`) dan **sebelum** `buatQris`, sisipkan:

```ts
  // Baris pemakaian dicatat SEBELUM tagihan: kalau gagal, tak ada QRIS yang
  // terbit untuk pesanan berdiskon yang tak tercatat pemakaiannya.
  if (nv.ada && nv.hasil.berlaku && nv.voucher) {
    const { error: pakaiError } = await retail.from('voucher_pemakaian').insert({
      voucher_id: nv.voucher.id, draft_id: draft.id, customer_id: sesi.customerId, potongan: nv.hasil.potongan,
    })
    if (pakaiError) return await gagalkanDraft(retail, draft.id, body.client_order_id, pakaiError)
  }
```

Hapus import `hitungTotal` bila tak dipakai lagi di berkas itu.

- [ ] **Step 7: Ubah webhook.** Di `webhooks/xendit/route.ts`, tepat setelah blok `if (peristiwa.status === 'gagal') {...}` dan **sebelum** `if (draft.pos_order_id)`, sisipkan:

```ts
  // Tandai pemakaian voucher lunas. Idempoten dan berjalan juga pada webhook
  // kembar, supaya kegagalan sesaat di sini sembuh pada kiriman ulang Xendit.
  // Kuota TIDAK dicek ulang: pesanan yang sudah lunas selalu dihormati.
  const { error: lunasError } = await retail
    .from('voucher_pemakaian')
    .update({ lunas_at: new Date().toISOString() })
    .eq('draft_id', draft.id)
    .is('lunas_at', null)
  if (lunasError) console.error('GAGAL MENANDAI VOUCHER LUNAS', { draft_id: draft.id, error: lunasError })
```

- [ ] **Step 8: Semua test gateway + type-check.** `cd apps/retail-gateway && npx vitest run && npx tsc --noEmit`. Expected: semua PASS (termasuk `orderPayload.test.ts` & `pricing.test.ts` lama), 0 error. `grep -rn DISKON_PILOT_PERSEN apps/retail-gateway/src` → kosong.

- [ ] **Step 9: Commit**

```bash
git add apps/retail-gateway/src
git commit -m "feat(retail-gateway): voucher di validate, pembuatan pesanan (409 bila tak berlaku), dan lunas di webhook"
```

---

### Task 6: Pustaka voucher di admin-dashboard

**Files:**
- Create: `apps/admin-dashboard/src/lib/appRetail/voucher.ts`
- Test: `apps/admin-dashboard/src/lib/appRetail/voucher.test.ts`

**Interfaces:**
- Produces:

```ts
export type JenisVoucher, Voucher               // identik gateway (Task 2)
export function rp(n: number): string            // identik
export function kalimatSyarat(v: Voucher, namaMenu: Record<string, string>): string  // identik
export type StatusVoucher = 'aktif' | 'terjadwal' | 'berakhir' | 'nonaktif' | 'kuota_habis'
export function statusVoucher(v: Voucher, terpakai: number, sekarang: Date): StatusVoucher
export type InputVoucher = Omit<Voucher, 'id'>
export function periksaVoucher(i: InputVoucher): string | null   // cermin CHECK Task 1
export const LABEL_JENIS: Record<JenisVoucher, string>
export const LABEL_STATUS: Record<StatusVoucher, string>
```

- [ ] **Step 1: Test yang gagal** — `voucher.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { kalimatSyarat, statusVoucher, periksaVoucher, rp, type Voucher } from './voucher'

const dasar = (x: Partial<Voucher> = {}): Voucher => ({
  id: 'v1', nama: 'Uji', deskripsi: null, kode: null, jenis: 'persen', nilai: 10, maks_potongan: null,
  menu_item_id: null, beli_qty: null, gratis_qty: null, harga_spesial: null, mulai: null, selesai: null,
  kuota_total: null, batas_per_pelanggan: null, min_belanja: null, khusus_pesanan_pertama: false,
  outlet_ids: null, hari: null, jam_mulai: null, jam_selesai: null, menu_ids: null, kategori_ids: null,
  is_active: true, ...x,
})

describe('kalimatSyarat (WAJIB identik dengan retail-gateway/src/lib/voucher.test.ts)', () => {
  it('menggabungkan jenis dan syarat', () => {
    const v = dasar({ nilai: 20, maks_potongan: 15000, min_belanja: 50000, selesai: '2026-10-31T16:59:59Z', batas_per_pelanggan: 1 })
    expect(kalimatSyarat(v, {})).toBe('Potongan 20% maks Rp15.000 · min. belanja Rp50.000 · maks 1× per pelanggan · s.d. 31 Okt')
  })
  it('gratis item memakai nama menu', () => {
    expect(kalimatSyarat(dasar({ jenis: 'gratis_item', menu_item_id: 'M' }), { M: 'Es Teh' })).toBe('Gratis 1× Es Teh')
  })
  it('rp', () => expect(rp(1234567)).toBe('Rp1.234.567'))
})

describe('statusVoucher', () => {
  const t = new Date('2026-09-24T08:00:00Z')
  it('nonaktif menang', () => expect(statusVoucher(dasar({ is_active: false }), 0, t)).toBe('nonaktif'))
  it('terjadwal', () => expect(statusVoucher(dasar({ mulai: '2026-10-01T00:00:00Z' }), 0, t)).toBe('terjadwal'))
  it('berakhir', () => expect(statusVoucher(dasar({ selesai: '2026-09-01T00:00:00Z' }), 0, t)).toBe('berakhir'))
  it('kuota habis', () => expect(statusVoucher(dasar({ kuota_total: 3 }), 3, t)).toBe('kuota_habis'))
  it('aktif', () => expect(statusVoucher(dasar(), 0, t)).toBe('aktif'))
})

describe('periksaVoucher', () => {
  const { id: _id, ...i } = dasar()
  it('sah', () => expect(periksaVoucher(i)).toBeNull())
  it('nama kosong', () => expect(periksaVoucher({ ...i, nama: ' ' })).toBe('Nama voucher wajib diisi (maks 60 huruf).'))
  it('persen di luar 1–100', () => expect(periksaVoucher({ ...i, nilai: 120 })).toBe('Persen potongan harus 1–100.'))
  it('gratis item tanpa menu', () => expect(periksaVoucher({ ...i, jenis: 'gratis_item' })).toBe('Pilih menu yang digratiskan.'))
  it('beli x tanpa menu x', () => expect(periksaVoucher({ ...i, jenis: 'beli_x_gratis_y', beli_qty: 2, gratis_qty: 1 })).toBe('Pilih menu yang harus dibeli.'))
  it('harga spesial tanpa harga', () => expect(periksaVoucher({ ...i, jenis: 'harga_spesial', menu_item_id: 'A' })).toBe('Isi menu dan harga spesialnya.'))
  it('kode tidak sah', () => expect(periksaVoucher({ ...i, kode: 'ab' })).toBe('Kode 3–20 huruf/angka tanpa spasi.'))
  it('selesai sebelum mulai', () => expect(periksaVoucher({ ...i, mulai: '2026-10-02T00:00:00Z', selesai: '2026-10-01T00:00:00Z' })).toBe('Tanggal selesai harus setelah tanggal mulai.'))
  it('jam separuh', () => expect(periksaVoucher({ ...i, jam_mulai: '10:00' })).toBe('Isi jam mulai dan jam selesai, atau kosongkan keduanya.'))
})
```

- [ ] **Step 2: Jalankan, pastikan gagal** — `cd apps/admin-dashboard && npx vitest run src/lib/appRetail/voucher.test.ts`.

- [ ] **Step 3: Implementasi** — `voucher.ts`. Salin **persis** dari `apps/retail-gateway/src/lib/voucher.ts` bagian berikut: tipe `JenisVoucher` dan `Voucher`, konstanta `WIB_MS`, `NAMA_HARI`, `NAMA_BULAN`, fungsi `rp`, `wib`, `jamTampil`, `tanggalTampil`, dan `kalimatSyarat` (tanpa `terapkanVoucher` dan tanpa import gateway). Header komentar: `Salinan identik dari apps/retail-gateway/src/lib/voucher.ts (kalimatSyarat) -- ubah keduanya bersamaan.` Lalu tambahkan:

```ts
export type StatusVoucher = 'aktif' | 'terjadwal' | 'berakhir' | 'nonaktif' | 'kuota_habis'

export const LABEL_JENIS: Record<JenisVoucher, string> = {
  persen: 'Potongan persen', nominal: 'Potongan Rupiah', gratis_item: 'Gratis item',
  beli_x_gratis_y: 'Beli X gratis Y', harga_spesial: 'Harga spesial menu',
}
export const LABEL_STATUS: Record<StatusVoucher, string> = {
  aktif: 'Aktif', terjadwal: 'Terjadwal', berakhir: 'Berakhir', nonaktif: 'Nonaktif', kuota_habis: 'Kuota habis',
}

export function statusVoucher(v: Voucher, terpakai: number, sekarang: Date): StatusVoucher {
  if (!v.is_active) return 'nonaktif'
  const t = sekarang.getTime()
  if (v.selesai && t >= new Date(v.selesai).getTime()) return 'berakhir'
  if (v.mulai && t < new Date(v.mulai).getTime()) return 'terjadwal'
  if (v.kuota_total != null && terpakai >= v.kuota_total) return 'kuota_habis'
  return 'aktif'
}

export type InputVoucher = Omit<Voucher, 'id'>

/** Cermin CHECK migration 20260925100000 -- ubah keduanya bersamaan. */
export function periksaVoucher(i: InputVoucher): string | null {
  const nama = i.nama.trim()
  if (nama.length < 1 || nama.length > 60) return 'Nama voucher wajib diisi (maks 60 huruf).'
  if (i.deskripsi && i.deskripsi.length > 200) return 'Deskripsi maksimal 200 huruf.'
  if (i.kode !== null && !/^[A-Z0-9]{3,20}$/.test(i.kode)) return 'Kode 3–20 huruf/angka tanpa spasi.'
  switch (i.jenis) {
    case 'persen':
      if (i.nilai == null || i.nilai <= 0 || i.nilai > 100) return 'Persen potongan harus 1–100.'
      break
    case 'nominal':
      if (i.nilai == null || i.nilai <= 0) return 'Nilai potongan harus lebih dari 0.'
      break
    case 'gratis_item':
      if (!i.menu_item_id) return 'Pilih menu yang digratiskan.'
      break
    case 'beli_x_gratis_y':
      if (!i.menu_ids || i.menu_ids.length === 0) return 'Pilih menu yang harus dibeli.'
      if (!i.beli_qty || i.beli_qty < 1 || !i.gratis_qty || i.gratis_qty < 1) return 'Isi jumlah beli dan jumlah gratis (minimal 1).'
      break
    case 'harga_spesial':
      if (!i.menu_item_id || i.harga_spesial == null || i.harga_spesial < 0) return 'Isi menu dan harga spesialnya.'
      break
  }
  if (i.maks_potongan != null && i.maks_potongan <= 0) return 'Maksimal potongan harus lebih dari 0.'
  if (i.mulai && i.selesai && new Date(i.selesai) <= new Date(i.mulai)) return 'Tanggal selesai harus setelah tanggal mulai.'
  if ((i.jam_mulai === null) !== (i.jam_selesai === null)) return 'Isi jam mulai dan jam selesai, atau kosongkan keduanya.'
  for (const [n, pesan] of [[i.kuota_total, 'Kuota'], [i.batas_per_pelanggan, 'Batas per pelanggan']] as const) {
    if (n != null && (!Number.isInteger(n) || n < 1)) return `${pesan} minimal 1.`
  }
  if (i.min_belanja != null && i.min_belanja < 0) return 'Minimal belanja tidak boleh negatif.'
  return null
}
```

- [ ] **Step 4: Jalankan → PASS**; lalu bandingkan fungsi `kalimatSyarat` kedua berkas: `diff <(sed -n '/export function kalimatSyarat/,/^}/p' apps/retail-gateway/src/lib/voucher.ts) <(sed -n '/export function kalimatSyarat/,/^}/p' apps/admin-dashboard/src/lib/appRetail/voucher.ts)` → tanpa output.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/lib/appRetail/voucher.ts apps/admin-dashboard/src/lib/appRetail/voucher.test.ts
git commit -m "feat(admin-dashboard): pustaka voucher (kalimat syarat, status, validasi form)"
```

---

### Task 7: Halaman admin "Voucher Aplikasi"

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/app-retail/voucherActions.ts`
- Create: `apps/admin-dashboard/src/app/dashboard/app-retail/voucher/page.tsx`
- Create: `apps/admin-dashboard/src/app/dashboard/app-retail/voucher/VoucherView.tsx`
- Create: `apps/admin-dashboard/src/app/dashboard/app-retail/voucher/PanelEditVoucher.tsx`
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.ts` (setelah baris `/dashboard/app-retail/splash`)
- Modify: `apps/admin-dashboard/src/components/layout/navConfig.test.ts` (snapshot rute OWNER & ADMIN)

**Interfaces:**
- Consumes: `requireRole` (`@/lib/authz`), `createServiceClient` (`@/lib/supabase/server`), semua ekspor Task 6.
- Produces (server action):

```ts
export async function simpanVoucher(input: InputVoucher, id: string | null): Promise<{ id: string }>
export async function ubahAktifVoucher(id: string, aktif: boolean): Promise<void>
export async function hapusVoucher(id: string): Promise<void>
```

- [ ] **Step 1: Server action** — `voucherActions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import { periksaVoucher, type InputVoucher } from '@/lib/appRetail/voucher'

/**
 * 'use server' BUKAN privat -- setiap export adalah endpoint POST. Role dicek
 * DI SINI, bukan hanya di halaman (Session 2026-07-20).
 * `catat` sengaja TIDAK diekspor: fungsi async yang diekspor dari berkas ini
 * akan jadi endpoint publik.
 */
const PERAN = ['owner', 'admin']
type Aksi = 'voucher_buat' | 'voucher_ubah' | 'voucher_aktif' | 'voucher_hapus'

async function catat(db: ReturnType<typeof createServiceClient>, aksi: Aksi, oleh: string, sasaranId: string, data: unknown) {
  const { error } = await db.from('app_retail_log').insert({ aksi, oleh, sasaran_id: sasaranId, data })
  if (error) throw new Error(`Perubahan tersimpan, tapi log gagal ditulis: ${error.message}`)
}

function rapikan(i: InputVoucher): InputVoucher {
  const kode = i.kode?.trim().toUpperCase() || null
  const kosongJadiNull = <T,>(a: T[] | null) => (a && a.length > 0 ? a : null)
  return {
    ...i, nama: i.nama.trim(), deskripsi: i.deskripsi?.trim() || null, kode,
    outlet_ids: kosongJadiNull(i.outlet_ids), hari: kosongJadiNull(i.hari),
    menu_ids: kosongJadiNull(i.menu_ids), kategori_ids: kosongJadiNull(i.kategori_ids),
  }
}

export async function simpanVoucher(input: InputVoucher, id: string | null): Promise<{ id: string }> {
  const { userId } = await requireRole(PERAN)
  const data = rapikan(input)
  const galat = periksaVoucher(data)
  if (galat) throw new Error(galat)
  const retail = createServiceClient().schema('retail')
  const db = createServiceClient()
  if (id) {
    const { data: lama } = await retail.from('vouchers').select('*').eq('id', id).maybeSingle()
    const { data: hasil, error } = await retail.from('vouchers')
      .update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select('id')
    if (error) throw new Error(error.code === '23505' ? 'Kode voucher sudah dipakai voucher lain.' : error.message)
    if (!hasil?.length) throw new Error('Voucher tidak ditemukan.')
    await catat(db, 'voucher_ubah', userId, id, { sebelum: lama, sesudah: data })
    revalidatePath('/dashboard/app-retail/voucher')
    return { id }
  }
  const { data: baru, error } = await retail.from('vouchers')
    .insert({ ...data, created_by: userId }).select('id').single()
  if (error) throw new Error(error.code === '23505' ? 'Kode voucher sudah dipakai voucher lain.' : error.message)
  await catat(db, 'voucher_buat', userId, baru.id as string, data)
  revalidatePath('/dashboard/app-retail/voucher')
  return { id: baru.id as string }
}

export async function ubahAktifVoucher(id: string, aktif: boolean): Promise<void> {
  const { userId } = await requireRole(PERAN)
  const db = createServiceClient()
  const { data, error } = await db.schema('retail').from('vouchers')
    .update({ is_active: aktif, updated_at: new Date().toISOString() }).eq('id', id).select('id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('Voucher tidak ditemukan.')
  await catat(db, 'voucher_aktif', userId, id, { is_active: aktif })
  revalidatePath('/dashboard/app-retail/voucher')
}

export async function hapusVoucher(id: string): Promise<void> {
  const { userId } = await requireRole(PERAN)
  const db = createServiceClient()
  const { data, error } = await db.schema('retail').from('vouchers').delete().eq('id', id).select('id')
  // 23503 = masih dirujuk voucher_pemakaian (FK RESTRICT).
  if (error) throw new Error(error.code === '23503' ? 'Voucher sudah pernah dipakai. Nonaktifkan saja.' : error.message)
  if (!data?.length) throw new Error('Voucher tidak ditemukan.')
  await catat(db, 'voucher_hapus', userId, id, {})
  revalidatePath('/dashboard/app-retail/voucher')
}
```

- [ ] **Step 2: Halaman server** — `voucher/page.tsx`:

```tsx
import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import VoucherView from './VoucherView'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireRole(['owner', 'admin'])
  const db = createServiceClient()
  const retail = db.schema('retail')
  const [vRes, rRes, menuRes, katRes, outRes] = await Promise.all([
    retail.from('vouchers').select('*').order('created_at', { ascending: false }),
    retail.from('voucher_ringkasan').select('voucher_id, terpakai, total_potongan'),
    db.from('menu_items').select('id, name').eq('tampil_di_app', true).order('name'),
    db.from('categories').select('id, name').order('name'),
    db.from('outlets').select('id, name').eq('app_enabled', true).order('name'),
  ])
  return (
    <VoucherView
      vouchers={vRes.data ?? []}
      ringkasan={rRes.data ?? []}
      menu={(menuRes.data ?? []) as { id: string; name: string }[]}
      kategori={(katRes.data ?? []) as { id: string; name: string }[]}
      outlet={(outRes.data ?? []) as { id: string; name: string }[]}
      galat={[vRes.error, rRes.error, menuRes.error, katRes.error, outRes.error].filter(Boolean).map((e) => e!.message)}
    />
  )
}
```

Sebelum menulis ini, pastikan nama tabel kategori menu dengan `grep -rn "from('categories')" apps/admin-dashboard/src | head -3`. Kalau tabelnya bernama lain, pakai nama itu.

- [ ] **Step 3: Tampilan daftar** — `VoucherView.tsx`. Ikuti struktur `banner/BannerView.tsx` (client component, `useTransition`, toast/galat inline yang sama dengan berkas itu). Isi minimal:

```tsx
'use client'

import { useState, useTransition } from 'react'
import PanelEditVoucher from './PanelEditVoucher'
import { ubahAktifVoucher, hapusVoucher } from '../voucherActions'
import { kalimatSyarat, statusVoucher, rp, LABEL_JENIS, LABEL_STATUS, type Voucher } from '@/lib/appRetail/voucher'

type Opsi = { id: string; name: string }
type Ringkas = { voucher_id: string; terpakai: number; total_potongan: number | string }

export default function VoucherView(props: {
  vouchers: Record<string, unknown>[]; ringkasan: Ringkas[]; menu: Opsi[]; kategori: Opsi[]; outlet: Opsi[]; galat: string[]
}) {
  const [edit, setEdit] = useState<Voucher | 'baru' | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)
  const [sibuk, mulai] = useTransition()
  const namaMenu = Object.fromEntries(props.menu.map((m) => [m.id, m.name]))
  const peta = new Map(props.ringkasan.map((r) => [r.voucher_id, r]))
  const vouchers = props.vouchers as unknown as Voucher[]
  const sekarang = new Date()

  const jalankan = (f: () => Promise<void>) =>
    mulai(async () => {
      setPesan(null)
      try { await f() } catch (e) { setPesan(e instanceof Error ? e.message : String(e)) }
    })

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Voucher Aplikasi</h1>
          <p className="text-sm text-muted-foreground">Voucher untuk pelanggan aplikasi. Potongan masuk baris &quot;Potongan&quot; outlet.</p>
        </div>
        <button className="rounded-lg bg-suka-orange px-4 py-2 text-sm font-semibold text-white" onClick={() => setEdit('baru')}>
          + Voucher baru
        </button>
      </div>
      {[...props.galat, ...(pesan ? [pesan] : [])].map((g) => (
        <p key={g} className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{g}</p>
      ))}
      {vouchers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada voucher.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr><th className="p-3">Voucher</th><th className="p-3">Jenis</th><th className="p-3">Status</th><th className="p-3">Terpakai</th><th className="p-3">Total potongan</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {vouchers.map((v) => {
                const r = peta.get(v.id)
                const terpakai = r?.terpakai ?? 0
                const status = statusVoucher(v, terpakai, sekarang)
                return (
                  <tr key={v.id} className="border-t align-top">
                    <td className="p-3">
                      <div className="font-semibold">{v.nama}</div>
                      <div className="text-xs text-muted-foreground">{v.kode ? `Kode ${v.kode}` : 'Publik'} · {kalimatSyarat(v, namaMenu)}</div>
                    </td>
                    <td className="p-3">{LABEL_JENIS[v.jenis]}</td>
                    <td className="p-3">{LABEL_STATUS[status]}</td>
                    <td className="p-3">{terpakai}{v.kuota_total != null ? ` / ${v.kuota_total}` : ''}</td>
                    <td className="p-3">{rp(Number(r?.total_potongan ?? 0))}</td>
                    <td className="space-x-2 whitespace-nowrap p-3 text-right">
                      <button className="text-suka-brown underline" onClick={() => setEdit(v)}>Ubah</button>
                      <button disabled={sibuk} className="underline" onClick={() => jalankan(() => ubahAktifVoucher(v.id, !v.is_active))}>
                        {v.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      {terpakai === 0 && (
                        <button disabled={sibuk} className="text-red-600 underline"
                          onClick={() => { if (confirm(`Hapus voucher "${v.nama}"?`)) jalankan(() => hapusVoucher(v.id)) }}>
                          Hapus
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <PanelEditVoucher
          awal={edit === 'baru' ? null : edit}
          menu={props.menu} kategori={props.kategori} outlet={props.outlet}
          onTutup={() => setEdit(null)}
        />
      )}
    </div>
  )
}
```

Sesuaikan kelas warna dengan yang dipakai `BannerView.tsx` bila `bg-suka-orange` tidak tersedia di app ini.

Catatan: tombol Hapus hanya disembunyikan untuk voucher yang sudah terpakai lunas. Voucher yang hanya punya pemakaian belum lunas tetap ditolak FK dengan pesan "Nonaktifkan saja" — itu benar.

- [ ] **Step 4: Panel edit** — `PanelEditVoucher.tsx`. Form terkendali atas `InputVoucher`. Fungsi bantu murni wajib ada di berkas ini:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { simpanVoucher } from '../voucherActions'
import { kalimatSyarat, periksaVoucher, LABEL_JENIS, type InputVoucher, type JenisVoucher, type Voucher } from '@/lib/appRetail/voucher'

type Opsi = { id: string; name: string }
const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

const KOSONG: InputVoucher = {
  nama: '', deskripsi: null, kode: null, jenis: 'persen', nilai: null, maks_potongan: null, menu_item_id: null,
  beli_qty: null, gratis_qty: null, harga_spesial: null, mulai: null, selesai: null, kuota_total: null,
  batas_per_pelanggan: null, min_belanja: null, khusus_pesanan_pertama: false, outlet_ids: null, hari: null,
  jam_mulai: null, jam_selesai: null, menu_ids: null, kategori_ids: null, is_active: true,
}

/** '' -> null; selain itu angka. Kolom angka kosong berarti "tanpa batas", bukan 0. */
const angka = (s: string): number | null => (s.trim() === '' ? null : Number(s.replace(/\./g, '')))
/** <input type="datetime-local"> dibaca sebagai WIB. */
const dariLokalWib = (s: string): string | null => (s ? new Date(`${s}:00+07:00`).toISOString() : null)
const keLokalWib = (iso: string | null): string =>
  iso ? new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 16) : ''

export default function PanelEditVoucher(props: {
  awal: Voucher | null; menu: Opsi[]; kategori: Opsi[]; outlet: Opsi[]; onTutup: () => void
}) {
  const [f, setF] = useState<InputVoucher>(() => {
    if (!props.awal) return KOSONG
    const { id: _id, ...sisa } = props.awal
    return sisa
  })
  const [galat, setGalat] = useState<string | null>(null)
  const [sibuk, mulai] = useTransition()
  const ubah = <K extends keyof InputVoucher>(k: K, v: InputVoucher[K]) => setF((x) => ({ ...x, [k]: v }))
  const namaMenu = Object.fromEntries(props.menu.map((m) => [m.id, m.name]))
  const pratinjau = periksaVoucher(f) === null ? kalimatSyarat({ id: 'pratinjau', ...f }, namaMenu) : null

  const simpan = () => mulai(async () => {
    setGalat(null)
    try { await simpanVoucher(f, props.awal?.id ?? null); props.onTutup() }
    catch (e) { setGalat(e instanceof Error ? e.message : String(e)) }
  })

  // ... render: panel samping/modal mengikuti PanelEditBanner.tsx, berisi:
  // 1. "Jenis & nilai": <select> jenis (LABEL_JENIS); lalu isian sesuai jenis:
  //    persen -> nilai (%), maks_potongan (Rp)
  //    nominal -> nilai (Rp)
  //    gratis_item -> menu_item_id (<select> props.menu), gratis_qty
  //    beli_x_gratis_y -> menu_ids (checkbox props.menu, label "Menu yang harus dibeli"),
  //                       beli_qty, gratis_qty, menu_item_id opsional ("Menu gratis — kosong = menu yang dibeli termurah")
  //    harga_spesial -> menu_item_id, harga_spesial (Rp)
  // 2. "Umum": nama, deskripsi, kode (kosong = publik; tampilkan helper
  //    "Kosongkan untuk voucher publik yang tampil di aplikasi")
  // 3. "Syarat" (semua opsional): mulai/selesai (datetime-local WIB via dariLokalWib/keLokalWib),
  //    kuota_total, batas_per_pelanggan, min_belanja, khusus_pesanan_pertama (checkbox),
  //    outlet_ids (checkbox props.outlet, kosong = semua outlet), hari (7 checkbox HARI, nilai 1..7),
  //    jam_mulai/jam_selesai (<input type="time">), menu_ids & kategori_ids (checkbox; untuk
  //    beli_x_gratis_y bagian menu_ids sudah dipakai di atas, sembunyikan di sini).
  // 4. Kotak pratinjau: `pratinjau ?? periksaVoucher(f)` -- tampilkan kalimat bila sah, pesan galat bila tidak.
  // 5. Tombol Simpan (disabled bila sibuk atau periksaVoucher(f) !== null) dan Batal (props.onTutup).
  // Semua input angka memakai `angka(e.target.value)`; semua input teks jam memakai nilai 'HH:MM' atau null.
}
```

Tulis JSX lengkapnya untuk kelima bagian di atas; komentar `// ... render` hanyalah daftar isi yang **wajib** diwujudkan, bukan kode akhir. Jangan menambah isian di luar daftar itu.

- [ ] **Step 5: Menu navigasi** — di `navConfig.ts`, setelah baris `/dashboard/app-retail/splash`, tambah:

```ts
      { href: '/dashboard/app-retail/voucher', label: 'Voucher Aplikasi', shortLabel: 'Voucher App', icon: TicketPercent, roles: ['OWNER', 'ADMIN'] },
```
dan import `TicketPercent` dari `lucide-react` di baris import ikon yang sudah ada. Perbarui snapshot rute OWNER & ADMIN di `navConfig.test.ts` dengan menambahkan `'/dashboard/app-retail/voucher'` di posisi yang sesuai.

- [ ] **Step 6: Verifikasi** — `cd apps/admin-dashboard && npx vitest run src/lib/appRetail src/components/layout/navConfig.test.ts && npx tsc --noEmit`. Expected: PASS; tsc tanpa error baru (bandingkan dengan `git stash`-less baseline: jalankan tsc sekali sebelum Task 7 dan catat jumlah error pre-existing).

- [ ] **Step 7: Commit**

```bash
git add apps/admin-dashboard/src/app/dashboard/app-retail/voucherActions.ts apps/admin-dashboard/src/app/dashboard/app-retail/voucher apps/admin-dashboard/src/components/layout/navConfig.ts apps/admin-dashboard/src/components/layout/navConfig.test.ts
git commit -m "feat(admin-dashboard): halaman Voucher Aplikasi"
```

---

### Task 8: APK — kontrak data & penyimpanan voucher

**Files:**
- Modify: `mobile/customer-app/app/src/main/java/com/sukashawarma/customer/data/api/Dto.kt`
- Modify: `mobile/customer-app/app/src/main/java/com/sukashawarma/customer/data/api/GatewayClient.kt`
- Modify: `mobile/customer-app/app/src/main/java/com/sukashawarma/customer/data/Repository.kt`
- Modify: `mobile/customer-app/app/src/main/java/com/sukashawarma/customer/data/CartStore.kt`
- Test: `mobile/customer-app/app/src/test/java/com/sukashawarma/customer/data/CartStoreVoucherTest.kt`
- Test: `mobile/customer-app/app/src/test/java/com/sukashawarma/customer/data/api/VoucherDtoTest.kt`

**Interfaces:**
- Produces:

```kotlin
// Dto.kt
@Serializable data class VoucherDto(val id: String, val nama: String, val deskripsi: String? = null,
  val jenis: String, @SerialName("kalimat_syarat") val kalimatSyarat: String, val selesai: String? = null,
  val status: String, val alasan: String? = null)
@Serializable data class VouchersRequest(@SerialName("outlet_id") val outletId: String? = null,
  val items: List<CartItemPayload>? = null)
@Serializable data class VouchersResponse(val vouchers: List<VoucherDto>)
@Serializable data class VoucherCheckoutDto(val id: String? = null, val nama: String? = null,
  val status: String, val alasan: String? = null, val potongan: Double = 0.0,
  @SerialName("item_gratis") val itemGratis: List<CartItemPayload> = emptyList())
// CheckoutValidateRequest + CreateOrderRequest: tambah
//   @SerialName("voucher_id") val voucherId: String? = null,
//   @SerialName("kode_voucher") val kodeVoucher: String? = null
// CheckoutValidateResponse: tambah val voucher: VoucherCheckoutDto? = null

// CartStore.kt
@Serializable data class PilihanVoucher(val id: String? = null, val kode: String? = null, val nama: String)
fun CartStore.voucher(): PilihanVoucher?
fun CartStore.pasangVoucher(v: PilihanVoucher)
fun CartStore.lepasVoucher()

// GatewayClient: suspend fun vouchers(request: VouchersRequest): GatewayResult<VouchersResponse>
// Repository:
suspend fun vouchers(outletId: String? = null, items: List<CartItemPayload>? = null): GatewayResult<List<VoucherDto>>
suspend fun validasiCheckout(outletId: String, items: List<CartItemPayload>, voucher: PilihanVoucher? = null): GatewayResult<CheckoutValidateResponse>
suspend fun buatPesanan(clientOrderId: String, outletId: String, items: List<CartItemPayload>, telepon: String? = null, voucher: PilihanVoucher? = null): GatewayResult<CreateOrderResponse>
```

- [ ] **Step 1: Test yang gagal.** `CartStoreVoucherTest.kt`:

```kotlin
package com.sukashawarma.customer.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CartStoreVoucherTest {
    private class Memori : CartPersistence {
        var isi: String? = null
        override fun muat() = isi
        override fun simpan(isi: String) { this.isi = isi }
    }

    @Test
    fun `voucher bertahan lintas proses`() {
        val p = Memori()
        CartStore(p).pasangVoucher(PilihanVoucher(id = "v1", nama = "Hemat"))
        assertEquals(PilihanVoucher(id = "v1", nama = "Hemat"), CartStore(p).voucher())
    }

    @Test
    fun `kosongkan keranjang ikut melepas voucher`() {
        val c = CartStore(Memori())
        c.pasangVoucher(PilihanVoucher(kode = "HEMAT", nama = "HEMAT"))
        c.kosongkan()
        assertNull(c.voucher())
    }

    @Test
    fun `lepas voucher`() {
        val c = CartStore(Memori())
        c.pasangVoucher(PilihanVoucher(id = "v1", nama = "Hemat"))
        c.lepasVoucher()
        assertNull(c.voucher())
    }

    @Test
    fun `keranjang lama tanpa field voucher tetap terbaca`() {
        val p = Memori().apply { isi = """{"outletId":"o1","baris":[]}""" }
        assertNull(CartStore(p).voucher())
        assertEquals("o1", CartStore(p).outletId())
    }
}
```

`VoucherDtoTest.kt`:

```kotlin
package com.sukashawarma.customer.data.api

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class VoucherDtoTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `request tanpa voucher tidak mengirim field voucher`() {
        val teks = json.encodeToString(CheckoutValidateRequest(outletId = "o1", items = emptyList()))
        assertFalse(teks.contains("voucher"))
    }

    @Test
    fun `blok voucher validate terbaca`() {
        val r = json.decodeFromString<CheckoutValidateResponse>(
            """{"ok":true,"subtotal":40000,"discountAmount":10000,"total":30000,
               "voucher":{"id":"v1","nama":"Uji","status":"berlaku","potongan":10000,
               "item_gratis":[{"menu_item_id":"M","name":"Es Teh","unit_price":10000,"quantity":1,"note":"Gratis voucher"}]}}"""
        )
        assertEquals("berlaku", r.voucher?.status)
        assertEquals("Es Teh", r.voucher?.itemGratis?.single()?.name)
    }

    @Test
    fun `daftar voucher terbaca`() {
        val r = json.decodeFromString<VouchersResponse>(
            """{"vouchers":[{"id":"v1","nama":"Uji","jenis":"persen","kalimat_syarat":"Potongan 10%","status":"belum","alasan":"Sudah kamu pakai"}]}"""
        )
        assertEquals("Sudah kamu pakai", r.vouchers.single().alasan)
    }
}
```

Sebelum menulis test DTO, cek nama field `CartItemPayload` di `Dto.kt` (`@SerialName("menu_item_id")`, `unit_price`, dsb.) dan sesuaikan JSON test bila berbeda.

- [ ] **Step 2: Jalankan, pastikan gagal** — `./gradlew :app:testDebugUnitTest --tests "*Voucher*" --console=plain` → galat kompilasi (tipe belum ada).

- [ ] **Step 3: Implementasi.**
  - `Dto.kt`: tambahkan kelas-kelas di bagian Interfaces. Pada `CheckoutValidateRequest` dan `CreateOrderRequest`, tambah dua field voucher sebagai parameter **terakhir** dengan default `null`. Pada `CheckoutValidateResponse`, tambah `val voucher: VoucherCheckoutDto? = null`. Pastikan instance `Json` di `GatewayClient` tidak memakai `encodeDefaults = true` (kalau iya, tambahkan `explicitNulls = false`), supaya gateway lama tidak menerima field baru.
  - `GatewayClient.kt`: tambah `vouchers(request)` meniru `checkoutValidate` (POST `"$baseUrl/api/v1/vouchers"`, `sisipkanOtorisasi()`, `setBody(request)`, `hasil(response)`, `catch` → `GatewayError.Jaringan`).
  - `Repository.kt`: tambah `vouchers(...)` yang memetakan `VouchersResponse` ke `List<VoucherDto>`, dan perluas `validasiCheckout` serta `buatPesanan` dengan parameter `voucher: PilihanVoucher? = null` yang diteruskan sebagai `voucherId = voucher?.id, kodeVoucher = voucher?.kode`.
  - `CartStore.kt`: `IsiKeranjang` tambah `val voucher: PilihanVoucher? = null`; tambah `fun voucher() = isi.voucher`, `fun pasangVoucher(v: PilihanVoucher) { isi = isi.copy(voucher = v); tulis() }`, `fun lepasVoucher() { isi = isi.copy(voucher = null); tulis() }`. `kosongkan()` juga mengosongkan voucher. Ganti outlet (`pakaiOutlet`) **tidak** melepas voucher; validate yang memutuskan berlaku atau tidak.

- [ ] **Step 4: Jalankan semua unit test** — `./gradlew :app:testDebugUnitTest --console=plain` → semua lulus (baseline 166 + test baru).

- [ ] **Step 5: Commit**

```bash
git add mobile/customer-app/app/src
git commit -m "feat(customer-app): kontrak API & penyimpanan voucher di keranjang"
```

---

### Task 9: APK — voucher di checkout dan pembayaran

**Files:**
- Create: `mobile/customer-app/app/src/main/java/com/sukashawarma/customer/ui/checkout/VoucherCheckout.kt`
- Create: `mobile/customer-app/app/src/main/java/com/sukashawarma/customer/ui/checkout/PemilihVoucherSheet.kt`
- Modify: `.../ui/checkout/CheckoutViewModel.kt`, `.../ui/checkout/CheckoutScreen.kt`, `.../ui/payment/PaymentViewModel.kt`
- Test: `mobile/customer-app/app/src/test/java/com/sukashawarma/customer/ui/checkout/VoucherCheckoutTest.kt`

**Interfaces:**
- Consumes: `PilihanVoucher`, `VoucherCheckoutDto`, `VoucherDto`, `Repository.vouchers/validasiCheckout/buatPesanan` (Task 8).
- Produces:

```kotlin
// VoucherCheckout.kt
fun alasanKunciVoucher(pilihan: PilihanVoucher?, blok: VoucherCheckoutDto?): String?
fun labelPotonganVoucher(blok: VoucherCheckoutDto?): String   // "Potongan voucher" / "Potongan Promo"
// CheckoutState tambah: voucher: PilihanVoucher? = null, blokVoucher: VoucherCheckoutDto? = null
//   bolehLanjut juga mensyaratkan alasanKunciVoucher(voucher, blokVoucher) == null
// CheckoutViewModel tambah: fun pasangVoucher(v: PilihanVoucher), fun lepasVoucher(),
//   suspend fun daftarVoucher(): GatewayResult<List<VoucherDto>>
```

- [ ] **Step 1: Test yang gagal** — `VoucherCheckoutTest.kt`:

```kotlin
package com.sukashawarma.customer.ui.checkout

import com.sukashawarma.customer.data.PilihanVoucher
import com.sukashawarma.customer.data.api.GatewayError
import com.sukashawarma.customer.data.api.VoucherCheckoutDto
import com.sukashawarma.customer.ui.payment.pesanBayar
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class VoucherCheckoutTest {
    private val pilih = PilihanVoucher(id = "v1", nama = "Hemat")

    @Test
    fun `tanpa voucher tidak mengunci`() = assertNull(alasanKunciVoucher(null, null))

    @Test
    fun `voucher berlaku tidak mengunci`() =
        assertNull(alasanKunciVoucher(pilih, VoucherCheckoutDto(id = "v1", status = "berlaku", potongan = 5000.0)))

    @Test
    fun `voucher belum berlaku mengunci dengan alasan gateway`() =
        assertEquals("Kurang Rp12.000 lagi",
            alasanKunciVoucher(pilih, VoucherCheckoutDto(id = "v1", status = "belum", alasan = "Kurang Rp12.000 lagi")))

    @Test
    fun `voucher terpasang tapi gateway lama tidak mengirim blok`() =
        assertEquals("Voucher belum bisa dicek. Lepas voucher untuk melanjutkan.", alasanKunciVoucher(pilih, null))

    @Test
    fun `label potongan`() {
        assertEquals("Potongan voucher", labelPotonganVoucher(VoucherCheckoutDto(status = "berlaku")))
        assertEquals("Potongan Promo", labelPotonganVoucher(null))
    }

    @Test
    fun `pesan 409 voucher memakai kalimat gateway`() =
        assertEquals("Kuota voucher sudah habis",
            pesanBayar(GatewayError.Kode("voucher_tidak_berlaku", "Kuota voucher sudah habis")))
}
```

- [ ] **Step 2: Jalankan, pastikan gagal.**

- [ ] **Step 3: Implementasi `VoucherCheckout.kt`:**

```kotlin
package com.sukashawarma.customer.ui.checkout

import com.sukashawarma.customer.data.PilihanVoucher
import com.sukashawarma.customer.data.api.VoucherCheckoutDto

/**
 * Alasan tombol Bayar dikunci karena voucher; null = tidak dikunci.
 *
 * Voucher yang tidak berlaku lagi SENGAJA tidak dilepas diam-diam: pelanggan
 * memilihnya dengan sengaja, jadi ia yang memutuskan melepas atau memenuhi
 * syaratnya.
 */
fun alasanKunciVoucher(pilihan: PilihanVoucher?, blok: VoucherCheckoutDto?): String? = when {
    pilihan == null -> null
    blok == null -> "Voucher belum bisa dicek. Lepas voucher untuk melanjutkan."
    blok.status == "berlaku" -> null
    else -> blok.alasan ?: "Voucher tidak berlaku untuk pesanan ini."
}

fun labelPotonganVoucher(blok: VoucherCheckoutDto?): String =
    if (blok?.status == "berlaku") "Potongan voucher" else "Potongan Promo"
```

Di `PaymentViewModel.kt` `pesanBayar`, tambah cabang sebelum `else`:

```kotlin
    galat is GatewayError.Kode && galat.kode == "voucher_tidak_berlaku" ->
        galat.pesan
```

- [ ] **Step 4: CheckoutViewModel.** Tambah `voucher` & `blokVoucher` ke `CheckoutState`, dan ubah `bolehLanjut` jadi `... && alasan == null && alasanKunciVoucher(voucher, blokVoucher) == null`. Di `validasi()`: baca `val voucher = cart.voucher()`, kirim `repository.validasiCheckout(outletId, payload, voucher)`, lalu simpan `voucher = voucher, blokVoucher = r.voucher` di kedua cabang `r.ok`. Tambah:

```kotlin
    fun pasangVoucher(v: PilihanVoucher) { cart.pasangVoucher(v); validasi() }
    fun lepasVoucher() { cart.lepasVoucher(); validasi() }
    suspend fun daftarVoucher(): GatewayResult<List<VoucherDto>> {
        val outletId = cart.outletId()
        val items = cart.isi().flatMap { it.kePayloadList() }
        return repository.vouchers(outletId, items.takeIf { it.isNotEmpty() })
    }
```

- [ ] **Step 5: PaymentViewModel.** Di `bayar()`, ganti panggilan menjadi `repository.buatPesanan(clientOrderId, outletId, baris.flatMap { it.kePayloadList() }, voucher = cart.voucher())`. `totalTagihan` awal yang saat ini diambil dari `cart.subtotal()` tetap dipakai hanya sebagai tampilan sementara; setelah sukses gunakan `r.totalAmount` bila state menampilkannya (periksa pemakaian `totalTagihan` di `PaymentWaitScreen` dan ganti ke `r.totalAmount.roundToLong()` setelah respons, supaya QRIS dan angka yang tampil sama).

- [ ] **Step 6: PemilihVoucherSheet.kt** — `ModalBottomSheet` Material3 dengan tanda tangan:

```kotlin
@Composable
fun PemilihVoucherSheet(
    muatDaftar: suspend () -> GatewayResult<List<VoucherDto>>,
    onPilih: (PilihanVoucher) -> Unit,
    onTutup: () -> Unit
)
```
Isi: saat dibuka, panggil `muatDaftar()` sekali (`LaunchedEffect(Unit)`); tampilkan `MemuatState` / `ErrorState` (komponen yang sudah ada di `ui/components`) / daftar. Tiap kartu: `nama`, `kalimatSyarat`, dan untuk `status == "belum"` teks `alasan` berwarna `SukaMuted` dengan kartu `alpha(0.5f)` dan tidak bisa diketuk. Kartu `berlaku` diketuk → `onPilih(PilihanVoucher(id = v.id, nama = v.nama))`. Di bawah daftar: `OutlinedTextField` "Punya kode?" + tombol "Pakai" → `onPilih(PilihanVoucher(kode = kode.trim().uppercase(), nama = kode.trim().uppercase()))` (tombol mati bila kode kosong). Voucher berlaku ditampilkan di atas (gateway sudah mengurutkan; jangan diurut ulang).

- [ ] **Step 7: CheckoutScreen.kt** — di atas blok rincian harga (sekitar baris ~517, blok `state.potongan?.takeIf { it > 0 }`):
  - Baris "Pakai voucher" (ikon `Icons.Filled.LocalOffer`). Bila `state.voucher != null`: tampilkan nama voucher + tombol "Lepas" (`viewModel.lepasVoucher()`); bila `alasanKunciVoucher(...)` tidak null, tampilkan alasannya di bawahnya dengan warna merah. Bila null: "Pakai voucher ›" membuka `PemilihVoucherSheet(muatDaftar = viewModel::daftarVoucher, onPilih = { viewModel.pasangVoucher(it); tutup }, onTutup = ...)`.
  - Label baris potongan diganti `labelPotonganVoucher(state.blokVoucher)`.
  - Bila `state.blokVoucher?.itemGratis` tidak kosong, tampilkan tiap item di daftar pesanan sebagai baris tersendiri `"${it.quantity}× ${it.name}"` dengan label hijau **"Gratis"**, tanpa tombol ubah jumlah atau hapus.

- [ ] **Step 8: Uji & pasang** — `./gradlew :app:testDebugUnitTest --console=plain` → lulus semua. Kompilasi berhasil (`:app:assembleDebug`).

- [ ] **Step 9: Commit**

```bash
git add mobile/customer-app/app/src
git commit -m "feat(customer-app): pakai voucher di checkout, kunci bayar bila tak berlaku, item gratis"
```

---

### Task 10: APK — halaman Voucher, jalan masuk, dan versi 1.2

**Files:**
- Create: `mobile/customer-app/app/src/main/java/com/sukashawarma/customer/ui/voucher/VoucherViewModel.kt`
- Create: `mobile/customer-app/app/src/main/java/com/sukashawarma/customer/ui/voucher/VoucherScreen.kt`
- Modify: `.../navigation/AppNavigation.kt` (tambah `Rute.VOUCHER` dan `composable`)
- Modify: `.../ui/home/HomeScreen.kt` (parameter `onBukaVoucher: () -> Unit = {}`)
- Modify: `.../ui/profile/ProfileScreen.kt` (parameter `onBukaVoucher: () -> Unit = {}`)
- Modify: `mobile/customer-app/app/build.gradle.kts` (`versionCode = 3`, `versionName = "1.2"`)
- Test: `mobile/customer-app/app/src/test/java/com/sukashawarma/customer/ui/voucher/VoucherViewModelTest.kt`

**Interfaces:**
- Consumes: `Repository.vouchers()`, `CartStore.pasangVoucher`, `VoucherDto`, `PilihanVoucher`.
- Produces:

```kotlin
data class VoucherState(val memuat: Boolean = true, val galat: GatewayError? = null, val vouchers: List<VoucherDto> = emptyList())
class VoucherViewModel(private val muat: suspend () -> GatewayResult<List<VoucherDto>>, private val cart: CartStore) : ViewModel() {
  val state: StateFlow<VoucherState>
  fun muatUlang()
  fun pakai(v: VoucherDto)   // cart.pasangVoucher(PilihanVoucher(id = v.id, nama = v.nama))
}
```

- [ ] **Step 1: Test yang gagal** — `VoucherViewModelTest.kt`. Cari dulu cara test ViewModel lain di repo ini (`grep -rln "Dispatchers.setMain" app/src/test`) dan ikuti pola `MainDispatcherRule`/`setMain` yang sama. Kasus:

```kotlin
    @Test
    fun `memuat daftar lalu pakai memasang voucher di keranjang`() = runTest {
        val cart = CartStore.diMemori()
        val v = VoucherDto(id = "v1", nama = "Hemat", jenis = "persen", kalimatSyarat = "Potongan 10%", status = "berlaku")
        val vm = VoucherViewModel(muat = { GatewayResult.Sukses(listOf(v)) }, cart = cart)
        advanceUntilIdle()
        assertEquals(listOf(v), vm.state.value.vouchers)
        vm.pakai(v)
        assertEquals(PilihanVoucher(id = "v1", nama = "Hemat"), cart.voucher())
    }

    @Test
    fun `galat ditampilkan`() = runTest {
        val vm = VoucherViewModel(muat = { GatewayResult.Gagal(GatewayError.Server(502)) }, cart = CartStore.diMemori())
        advanceUntilIdle()
        assertEquals(GatewayError.Server(502), vm.state.value.galat)
    }
```

- [ ] **Step 2: Jalankan, pastikan gagal.**

- [ ] **Step 3: Implementasi `VoucherViewModel.kt`** (muat di `init`, pola sama dengan ViewModel lain):

```kotlin
package com.sukashawarma.customer.ui.voucher

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sukashawarma.customer.data.CartStore
import com.sukashawarma.customer.data.PilihanVoucher
import com.sukashawarma.customer.data.api.GatewayError
import com.sukashawarma.customer.data.api.GatewayResult
import com.sukashawarma.customer.data.api.VoucherDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class VoucherState(
    val memuat: Boolean = true,
    val galat: GatewayError? = null,
    val vouchers: List<VoucherDto> = emptyList()
)

class VoucherViewModel(
    private val muat: suspend () -> GatewayResult<List<VoucherDto>>,
    private val cart: CartStore
) : ViewModel() {
    private val _state = MutableStateFlow(VoucherState())
    val state: StateFlow<VoucherState> = _state.asStateFlow()

    init { muatUlang() }

    fun muatUlang() {
        _state.value = _state.value.copy(memuat = true, galat = null)
        viewModelScope.launch {
            _state.value = when (val h = muat()) {
                is GatewayResult.Sukses -> VoucherState(memuat = false, vouchers = h.data)
                is GatewayResult.Gagal -> VoucherState(memuat = false, galat = h.error)
            }
        }
    }

    fun pakai(v: VoucherDto) = cart.pasangVoucher(PilihanVoucher(id = v.id, nama = v.nama))
}
```

- [ ] **Step 4: `VoucherScreen.kt`** — `@Composable fun VoucherScreen(viewModel: VoucherViewModel, onKembali: () -> Unit, onSetelahPakai: () -> Unit)`. Header bergaya layar Riwayat (judul "Voucher", sub "Promo yang bisa kamu pakai", tombol kembali). Isi: `MemuatState` / `ErrorState(onCobaLagi = viewModel::muatUlang)` / `EmptyState(judul = "Belum ada voucher", penjelasan = "Voucher baru akan muncul di sini.")` / `LazyColumn` kartu voucher: `nama`, `kalimatSyarat`, `deskripsi` bila ada, dan tombol **Pakai**. Tombol hanya aktif bila `status == "berlaku"`; bila `belum`, tampilkan `alasan` redup di bawahnya. Pakai → `viewModel.pakai(v)` lalu `onSetelahPakai()`.

- [ ] **Step 5: Navigasi & jalan masuk.** Di `AppNavigation.kt`, tambah `const val VOUCHER = "voucher"` di objek `Rute`, lalu:

```kotlin
            composable(Rute.VOUCHER) {
                val vm = viewModel { VoucherViewModel(muat = { container.repository.vouchers() }, cart = container.cartStore) }
                VoucherScreen(
                    viewModel = vm,
                    onKembali = { navController.popBackStack() },
                    onSetelahPakai = {
                        navController.navigate(Rute.MENU) { launchSingleTop = true }
                    }
                )
            }
```
Sesuaikan `container.cartStore` dan cara membuat ViewModel dengan pola `composable` lain di berkas yang sama (lihat blok `Rute.CHECKOUT`). Teruskan `onBukaVoucher = { navController.navigate(Rute.VOUCHER) }` ke `HomeScreen` dan `ProfileScreen`.
  - `HomeScreen`: tambahkan kartu/tombol "Voucher untukmu" di bawah carousel banner (sebelum "Menu Terlaris") yang memanggil `onBukaVoucher`.
  - `ProfileScreen`: tambahkan `ProfileMenuItem(icon = Icons.Filled.LocalOffer, title = "Voucher Saya", subtitle = "Promo yang bisa kamu pakai", onClick = onBukaVoucher)` di bagian PENGATURAN AKUN setelah "Riwayat Pesanan".

- [ ] **Step 6: Versi** — `app/build.gradle.kts`: `versionCode = 3`, `versionName = "1.2"`.

- [ ] **Step 7: Uji** — `./gradlew :app:testDebugUnitTest :app:assembleDebug --console=plain` → lulus.

- [ ] **Step 8: Commit**

```bash
git add mobile/customer-app/app
git commit -m "feat(customer-app): halaman Voucher dari Beranda & Profil; versi 1.2"
```

---

### Task 11: Deploy & uji ujung ke ujung (manual, butuh owner)

Tidak ada kode baru. Setiap langkah yang menyentuh produksi **minta konfirmasi owner dulu**.

- [ ] **Step 1:** Merge `feat/app-retail-voucher` ke `main` dan push (dengan izin owner).
- [ ] **Step 2:** Redeploy `retail-gateway`, lalu cek `POST /api/v1/vouchers` (dengan token pelanggan) → `{"vouchers":[]}`. Pastikan checkout tanpa voucher tetap berjalan (APK 1.1 lama).
- [ ] **Step 3:** Redeploy `admin-dashboard`. Buat voucher uji **rahasia** (kode `UJIVOUCHER`, nominal Rp 1, `outlet_ids` = outlet tes) supaya pelanggan sungguhan tidak melihatnya.
- [ ] **Step 4:** Nyalakan outlet tes (`app_enabled`), pasang APK 1.2 di HP, masukkan kode → cek baris "Potongan voucher −Rp1" → bayar → verifikasi DB:

```sql
SELECT o.total_amount, o.discount_amount FROM orders o
 JOIN retail.order_drafts d ON d.pos_order_id = o.id
 JOIN retail.voucher_pemakaian p ON p.draft_id = d.id
 WHERE p.voucher_id = (SELECT id FROM retail.vouchers WHERE kode = 'UJIVOUCHER');
SELECT lunas_at FROM retail.voucher_pemakaian WHERE voucher_id = (SELECT id FROM retail.vouchers WHERE kode = 'UJIVOUCHER');
```
Expected: `discount_amount = 1`, `lunas_at` terisi, dan admin menampilkan "terpakai 1".
- [ ] **Step 5:** Uji voucher `gratis_item` yang sama di outlet tes: item gratis tampil "Gratis" di checkout, tercetak `…|NOTE|Gratis voucher` di struk dapur, dan `order_items` memuat item itu dengan harga normal.
- [ ] **Step 6:** Nonaktifkan voucher uji, matikan lagi outlet tes, lalu catat hasilnya di entri sesi CLAUDE.md.
- [ ] **Step 7:** Rilis APK 1.2 ke Play Store (keputusan owner).
