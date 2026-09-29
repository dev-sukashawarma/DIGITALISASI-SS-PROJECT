# Voucher Prabayar — Rencana 1: DB & Gateway

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pelanggan bisa membeli paket voucher prabayar lewat gateway, menebusnya (sekaligus atau dicicil, sendirian atau bercampur belanja biasa), dan sistem menangani batal, hangus, dan pengingat, semuanya dengan pembukuan yang benar di database.

**Architecture:** Tabel dan RPC baru di skema `retail` (semua logika uang dan slot di dalam RPC `SECURITY DEFINER`, hanya `service_role` yang boleh memanggil). Satu kolom nullable aditif `public.order_items.voucher_tebus_id`. Gateway (Next.js) hanya menjadi lapisan tipis: memvalidasi, memanggil RPC, dan berbicara dengan Xendit. Pesanan tebus dibuat oleh RPC baru `retail.selesaikan_tebus`, **bukan** `atomic_insert_order`.

**Tech Stack:** PostgreSQL/Supabase (plpgsql, pg_cron), Next.js 16 route handlers, TypeScript, vitest, Xendit QRIS/Invoice.

**Spec:** `docs/superpowers/specs/2026-09-29-app-retail-voucher-prabayar-design.md` (baca §2, §3, §4, §7b sebelum mulai). Rencana 2 (admin & POS) dan Rencana 3 (APK) bergantung pada rencana ini dan **belum** ditulis.

## Global Constraints

- **Uang di muka.** Slot hanya boleh berubah lewat RPC di §Task 3–5. Tidak ada `UPDATE` langsung ke `retail.voucher_milik_slot` dari kode gateway.
- **`orders.total_amount` pesanan tebus = Σ `order_items.subtotal` penuh** (nilai slot + item tambahan). `order_drafts.total_amount` = hanya yang ditagih Xendit. Keduanya sengaja berbeda.
- **Jangan menulis ulang `public.atomic_insert_order`** dan jangan menyentuh `trg_process_bom_stok` (banyak salinan; tertimpa migration 2030 saat replay).
- **Migration:** timestamp hari ini atau sesudahnya, **jangan** 2030 (CI `scripts/migration-timestamp-lint.mjs` menolak). Nama timestamp di rencana ini (`20260929200000` dst.) **wajib dicek dulu**: `ls supabase/migrations | cut -c1-14 | sort | uniq -d` dan `ls supabase/migrations | tail -5`; geser bila bentrok. Timestamp `20260929100000` sudah dipakai sesi lain.
- **DDL di tabel panas** (`public.orders`, `public.order_items`): awali `SET LOCAL lock_timeout = '5s'`, tambah FK/CHECK dengan `NOT VALID` lalu `VALIDATE CONSTRAINT` terpisah, jangan `CREATE INDEX` non-concurrent.
- **Menerapkan migration ke DB produksi bersama butuh izin eksplisit owner, per migration.** Uji dulu dengan pola transaksi-rollback (§Task 2 Step 3). Setelah apply: verifikasi ground-truth ke katalog (`pg_proc`, `pg_constraint`), stempel `schema_migrations` hanya bila `supabase migration list` menunjukkan versi itu remote-only tanpa berkas; **jangan** `migration repair --status reverted`.
- **RPC:** `SECURITY DEFINER`, `SET search_path = public, retail`, `REVOKE ALL FROM PUBLIC, anon, authenticated`, `GRANT EXECUTE TO service_role`. Kegagalan bisnis di RPC yang menulis berkali-kali memakai `RAISE EXCEPTION 'voucher_prabayar:<kode>'` (agar seluruh transaksi rollback); jangan `RETURN` setelah menulis sebagian.
- **CHECK pada kolom nullable** wajib `IS NOT NULL` eksplisit (CHECK hanya menolak FALSE, bukan NULL).
- **Uji SQL** memakai pola repo: satu blok `DO $$ … $$` yang berakhir `RAISE EXCEPTION 'HASIL Tn: LULUS …'`. "Error" berisi `LULUS` = sukses, dan seluruh perubahan otomatis rollback. Pesan berisi `GAGAL` = gagal.
- **Klien tidak pernah menentukan nilai rupiah slot.** Nilai selalu dari database. Aplikasi pelanggan tidak menampilkan nilai per slot, hanya nama dan jumlah.
- **Commit** diakhiri: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Kerjakan di branch fitur/worktree (working tree utama sedang kotor oleh pekerjaan lain): `git switch -c feat/voucher-prabayar-db-gateway`.
- Gateway: `apps/retail-gateway`, test `yarn workspace @suka/retail-gateway test`, type-check `yarn workspace @suka/retail-gateway type-check`. **Jangan** `yarn install` polos di root (lihat CLAUDE.md).

## Struktur Berkas

| Berkas | Tanggung jawab |
|---|---|
| `supabase/migrations/20260929200000_voucher_prabayar_tabel.sql` | Tabel `retail.voucher_paket`, `_slot`, `_slot_menu`, `voucher_milik`, `voucher_milik_slot`, `voucher_tebus`, `voucher_tebus_item`, view `voucher_paket_terjual`, kolom `order_drafts.tebus_id` |
| `supabase/migrations/20260929205000_voucher_prabayar_order_items.sql` | Kolom `public.order_items.voucher_tebus_id` (+ FK NOT VALID/VALIDATE) |
| `supabase/migrations/20260929210000_voucher_prabayar_rpc_paket_beli.sql` | RPC `simpan_paket`, `beli_voucher_reserve`, `beli_voucher_lunas` |
| `supabase/migrations/20260929215000_voucher_prabayar_payment_method.sql` | CHECK `orders_payment_method_check` menerima `'voucher'` untuk `sales_source='app'` |
| `supabase/migrations/20260929220000_voucher_prabayar_rpc_tebus.sql` | RPC `tahan_tebus`, `selesaikan_tebus`, `lepas_tebus` + trigger batal |
| `supabase/migrations/20260929230000_voucher_prabayar_harian.sql` | Fungsi `proses_voucher_harian` + jadwal pg_cron |
| `supabase/verifikasi/voucher_prabayar/t1_paket.sql` … `t4_harian.sql` | Uji SQL per migration |
| `apps/retail-gateway/src/lib/voucherPrabayar.ts` (+ `.test.ts`) | Fungsi murni: fee, validasi pilihan, kode galat, `periksaPilihan`, `susunPayloadTebus` |
| `apps/retail-gateway/src/lib/voucherPrabayarDb.ts` | Pembungkus RPC dan pembaca data |
| `apps/retail-gateway/src/app/api/v1/voucher-paket/route.ts` | `GET` paket yang dijual |
| `apps/retail-gateway/src/app/api/v1/voucher-paket/[id]/beli/route.ts` | `POST` beli |
| `apps/retail-gateway/src/app/api/v1/voucher-saya/route.ts` | `GET` voucher milik pelanggan |
| Modifikasi: `checkout/validate/route.ts`, `orders/route.ts`, `webhooks/xendit/route.ts`, `cron/expire-drafts/route.ts` | Jalur tebus |

---

### Task 1: Verifikasi prasyarat (baca-saja, tanpa perubahan)

**Files:** tidak ada kode. Hasil dicatat di komentar PR/commit.

Tujuan: memastikan asumsi rencana cocok dengan DB live sebelum satu baris pun ditulis. Jalankan dari root repo (`D:\MIT\CLAUDE CODE PROJECT\SS DIGITAL PROJECT`) di Git Bash.

- [ ] **Step 1: Definisi live `orders_payment_method_check`**

```bash
supabase db query --linked "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.orders'::regclass AND conname='orders_payment_method_check';"
```
Expected: satu baris. Definisinya harus memuat `'cash'`, `'qris'`, `'card'`, `'va'`, `website`. **Bila tidak** (mis. sudah berubah), hentikan dan revisi Task 5 sebelum lanjut.

- [ ] **Step 2: Daftar kolom `atomic_insert_order` live vs repo**

```bash
supabase db query --linked "SELECT pg_get_functiondef('public.atomic_insert_order(jsonb,jsonb)'::regprocedure);"
```
Expected: `INSERT INTO public.orders (outlet_id, client_order_id, customer_name, customer_phone, cashier_name, notes, payment_method, total_amount, discount_amount, promo_subsidy, payment_proof_url, amount_received, change_amount, status, kitchen_receipt_printed, source, channel, sales_source, external_order_id, is_endorse, scheduled_promo_names, created_at, updated_at)`. Daftar kolom `INSERT INTO public.order_items` harus memuat minimal `order_id, menu_item_id, menu_item_name, quantity, unit_price, subtotal, package_choices`. **Bila berbeda**, sesuaikan kolom di Task 6 (`selesaikan_tebus`) dengan daftar live ini.

- [ ] **Step 3: Prasyarat lain**

```bash
supabase db query --linked "SELECT count(*) AS pelanggan FROM retail.customers;"
supabase db query --linked "SELECT count(*) AS outlet_tes FROM public.outlets WHERE type='test';"
supabase db query --linked "SELECT count(*) AS menu_tampil FROM public.menu_items WHERE tampil_di_app AND is_available;"
supabase db query --linked "SELECT extname FROM pg_extension WHERE extname='pg_cron';"
supabase db query --linked "SELECT column_name FROM information_schema.columns WHERE table_schema='retail' AND table_name='customer_notifications' ORDER BY ordinal_position;"
```
Expected: `pelanggan` ≥ 1, `outlet_tes` ≥ 1, `menu_tampil` ≥ 3, `pg_cron` ada, kolom notifikasi memuat `customer_id, order_id, type, title, body, data`. Uji SQL Task 2–7 bergantung pada ketiga fixture itu. Bila `pelanggan` = 0, buat satu akun pelanggan uji lewat aplikasi/auth, jangan menyisipkan langsung ke `retail.customers` (FK ke `auth.users`).

- [ ] **Step 4: Cek timestamp bentrok**

```bash
ls supabase/migrations | cut -c1-14 | sort | uniq -d
ls supabase/migrations | grep -E "^20260929|^2026093|^2026100" 
```
Bila ada berkas `202609292*`, geser semua timestamp di rencana ini ke jam kosong berikutnya secara konsisten.

- [ ] **Step 5: Buat branch kerja**

```bash
git switch -c feat/voucher-prabayar-db-gateway
```

---

### Task 2: Migration tabel

**Files:**
- Create: `supabase/migrations/20260929200000_voucher_prabayar_tabel.sql`
- Create: `supabase/migrations/20260929205000_voucher_prabayar_order_items.sql`
- Create: `supabase/verifikasi/voucher_prabayar/t1_tabel.sql`

**Interfaces:**
- Produces: tabel `retail.voucher_paket(id, nama, deskripsi, harga, beli_mulai, beli_selesai, tebus_sampai, tebus_hari, kuota_total, batas_per_pelanggan, is_active, created_at, updated_at, created_by)`, `retail.voucher_paket_slot(id, paket_id, urut, nama, jumlah, nilai_per_unit)`, `retail.voucher_paket_slot_menu(slot_id, menu_item_id)`, `retail.voucher_milik(id, paket_id, customer_id, client_beli_id, status_bayar, harga_dibayar, payment_ref, payment_url, qr_string, bayar_expires_at, dibeli_at, lunas_at, kedaluwarsa_at, diperpanjang_at, diperpanjang_alasan, fee_riil)`, `retail.voucher_milik_slot(id, milik_id, slot_id, nilai, fee_bagian, status)`, `retail.voucher_tebus(id, milik_id, outlet_id, client_order_id, order_id, status, dibuat_at)`, `retail.voucher_tebus_item(id, tebus_id, milik_slot_id, menu_item_id, nilai, fee_dibebankan, order_item_id)`, view `retail.voucher_paket_terjual(paket_id, terjual)`, kolom `retail.order_drafts.tebus_id uuid NULL`, kolom `public.order_items.voucher_tebus_id uuid NULL`.

- [ ] **Step 1: Tulis migration tabel**

`supabase/migrations/20260929200000_voucher_prabayar_tabel.sql`:

```sql
-- App Retail: voucher prabayar (spec 2026-09-29). Tabel & view saja; logika di migration berikutnya.
-- Semua tabel: tanpa policy, hanya service role. Default privileges Supabase memberi ALL ke tabel baru,
-- jadi REVOKE eksplisit di bawah.

CREATE TABLE IF NOT EXISTS retail.voucher_paket (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL CHECK (char_length(btrim(nama)) BETWEEN 1 AND 60),
  deskripsi text NULL CHECK (deskripsi IS NULL OR char_length(deskripsi) <= 200),
  harga numeric NOT NULL CHECK (harga > 0 AND harga = trunc(harga)),
  beli_mulai timestamptz NULL,
  beli_selesai timestamptz NULL,
  tebus_sampai timestamptz NULL,
  tebus_hari int NULL CHECK (tebus_hari IS NULL OR tebus_hari > 0),
  kuota_total int NULL CHECK (kuota_total IS NULL OR kuota_total >= 1),
  batas_per_pelanggan int NULL CHECK (batas_per_pelanggan IS NULL OR batas_per_pelanggan >= 1),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  CHECK (beli_selesai IS NULL OR beli_mulai IS NULL OR beli_selesai > beli_mulai),
  CHECK (tebus_sampai IS NOT NULL OR tebus_hari IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS retail.voucher_paket_slot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paket_id uuid NOT NULL REFERENCES retail.voucher_paket(id) ON DELETE CASCADE,
  urut int NOT NULL CHECK (urut >= 1),
  nama text NOT NULL CHECK (char_length(btrim(nama)) BETWEEN 1 AND 40),
  jumlah int NOT NULL CHECK (jumlah >= 1),
  nilai_per_unit numeric NOT NULL CHECK (nilai_per_unit > 0 AND nilai_per_unit = trunc(nilai_per_unit)),
  UNIQUE (paket_id, urut)
);

CREATE TABLE IF NOT EXISTS retail.voucher_paket_slot_menu (
  slot_id uuid NOT NULL REFERENCES retail.voucher_paket_slot(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
  PRIMARY KEY (slot_id, menu_item_id)
);

CREATE TABLE IF NOT EXISTS retail.voucher_milik (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paket_id uuid NOT NULL REFERENCES retail.voucher_paket(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES retail.customers(id) ON DELETE CASCADE,
  client_beli_id uuid NOT NULL UNIQUE,
  status_bayar text NOT NULL DEFAULT 'menunggu_bayar'
    CHECK (status_bayar IN ('menunggu_bayar','lunas','gagal','kadaluarsa')),
  harga_dibayar numeric NOT NULL CHECK (harga_dibayar > 0),
  payment_ref text NULL,
  payment_url text NULL,
  qr_string text NULL,
  bayar_expires_at timestamptz NOT NULL,
  dibeli_at timestamptz NOT NULL DEFAULT now(),
  lunas_at timestamptz NULL,
  kedaluwarsa_at timestamptz NULL,
  diperpanjang_at timestamptz NULL,
  diperpanjang_alasan text NULL,
  fee_riil numeric NULL CHECK (fee_riil IS NULL OR fee_riil >= 0),
  CHECK ((status_bayar = 'lunas') = (lunas_at IS NOT NULL AND kedaluwarsa_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS voucher_milik_pelanggan_idx ON retail.voucher_milik (customer_id, status_bayar);
CREATE INDEX IF NOT EXISTS voucher_milik_paket_idx ON retail.voucher_milik (paket_id, status_bayar);

CREATE TABLE IF NOT EXISTS retail.voucher_milik_slot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milik_id uuid NOT NULL REFERENCES retail.voucher_milik(id) ON DELETE CASCADE,
  slot_id uuid NOT NULL REFERENCES retail.voucher_paket_slot(id) ON DELETE RESTRICT,
  nilai numeric NOT NULL CHECK (nilai > 0),
  fee_bagian numeric NOT NULL DEFAULT 0 CHECK (fee_bagian >= 0),
  status text NOT NULL DEFAULT 'tersedia' CHECK (status IN ('tersedia','ditahan','terpakai','hangus'))
);
CREATE INDEX IF NOT EXISTS voucher_milik_slot_milik_idx ON retail.voucher_milik_slot (milik_id, slot_id, status);

CREATE TABLE IF NOT EXISTS retail.voucher_tebus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milik_id uuid NOT NULL REFERENCES retail.voucher_milik(id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.outlets(id),
  client_order_id uuid NOT NULL UNIQUE,
  order_id uuid NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu','aktif','dibatalkan')),
  dibuat_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'aktif' OR order_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS voucher_tebus_milik_idx ON retail.voucher_tebus (milik_id, status);
CREATE INDEX IF NOT EXISTS voucher_tebus_order_idx ON retail.voucher_tebus (order_id);

CREATE TABLE IF NOT EXISTS retail.voucher_tebus_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tebus_id uuid NOT NULL REFERENCES retail.voucher_tebus(id) ON DELETE CASCADE,
  milik_slot_id uuid NOT NULL REFERENCES retail.voucher_milik_slot(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
  nilai numeric NOT NULL CHECK (nilai > 0),
  fee_dibebankan numeric NOT NULL DEFAULT 0 CHECK (fee_dibebankan >= 0),
  order_item_id uuid NULL REFERENCES public.order_items(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS voucher_tebus_item_tebus_idx ON retail.voucher_tebus_item (tebus_id);

-- Terjual = lunas + menunggu bayar yang belum lewat batas (menahan kuota selama 15 menit).
CREATE OR REPLACE VIEW retail.voucher_paket_terjual WITH (security_invoker = true) AS
SELECT paket_id,
       count(*) FILTER (
         WHERE status_bayar = 'lunas' OR (status_bayar = 'menunggu_bayar' AND bayar_expires_at > now())
       )::int AS terjual
FROM retail.voucher_milik
GROUP BY paket_id;

-- Draft pembayaran tebus campur menunjuk ke tebus-nya (tanpa FK: tebus bisa lebih dulu dibuat).
ALTER TABLE retail.order_drafts ADD COLUMN IF NOT EXISTS tebus_id uuid NULL;

REVOKE ALL ON retail.voucher_paket, retail.voucher_paket_slot, retail.voucher_paket_slot_menu,
  retail.voucher_milik, retail.voucher_milik_slot, retail.voucher_tebus, retail.voucher_tebus_item,
  retail.voucher_paket_terjual FROM anon, authenticated;
GRANT ALL ON retail.voucher_paket, retail.voucher_paket_slot, retail.voucher_paket_slot_menu,
  retail.voucher_milik, retail.voucher_milik_slot, retail.voucher_tebus, retail.voucher_tebus_item,
  retail.voucher_paket_terjual TO service_role;
ALTER TABLE retail.voucher_paket ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail.voucher_paket_slot ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail.voucher_paket_slot_menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail.voucher_milik ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail.voucher_milik_slot ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail.voucher_tebus ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail.voucher_tebus_item ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Tulis migration kolom `order_items`**

`supabase/migrations/20260929205000_voucher_prabayar_order_items.sql`:

```sql
-- Satu-satunya perubahan tabel POS: kolom nullable aditif. Penanda item yang dibayar voucher.
-- Tabel panas: lock singkat, FK ditambah NOT VALID lalu divalidasi terpisah.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS voucher_tebus_id uuid NULL;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_voucher_tebus_fk
  FOREIGN KEY (voucher_tebus_id) REFERENCES retail.voucher_tebus(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.order_items VALIDATE CONSTRAINT order_items_voucher_tebus_fk;

COMMENT ON COLUMN public.order_items.voucher_tebus_id IS
  'Diisi hanya pada item yang dibayar dari voucher prabayar (retail.voucher_tebus). NULL = item biasa.';
```

- [ ] **Step 3: Tulis uji `t1_tabel.sql`**

`supabase/verifikasi/voucher_prabayar/t1_tabel.sql`:

```sql
-- t1_tabel.sql — harapan "HASIL T1: LULUS". Dijalankan bersama migration di satu transaksi (lihat Step 4).
DO $$
DECLARE v_paket uuid; v_slot uuid; v_menu uuid; v_ok boolean;
BEGIN
  SELECT id INTO v_menu FROM public.menu_items WHERE tampil_di_app AND is_available LIMIT 1;
  IF v_menu IS NULL THEN RAISE EXCEPTION 'GAGAL: tak ada menu fixture'; END IF;

  INSERT INTO retail.voucher_paket (nama, harga, tebus_hari) VALUES ('UJI T1', 100000, 30) RETURNING id INTO v_paket;
  INSERT INTO retail.voucher_paket_slot (paket_id, urut, nama, jumlah, nilai_per_unit)
    VALUES (v_paket, 1, 'Makanan', 2, 30000) RETURNING id INTO v_slot;
  INSERT INTO retail.voucher_paket_slot_menu (slot_id, menu_item_id) VALUES (v_slot, v_menu);

  -- (a) harga desimal ditolak
  BEGIN
    INSERT INTO retail.voucher_paket (nama, harga, tebus_hari) VALUES ('X', 100.5, 30);
    RAISE EXCEPTION 'GAGAL (a): harga desimal lolos';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- (b) paket tanpa jendela tebus ditolak
  BEGIN
    INSERT INTO retail.voucher_paket (nama, harga) VALUES ('X', 1000);
    RAISE EXCEPTION 'GAGAL (b): paket tanpa jendela tebus lolos';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- (c) status 'lunas' tanpa lunas_at/kedaluwarsa_at ditolak
  BEGIN
    INSERT INTO retail.voucher_milik (paket_id, customer_id, client_beli_id, status_bayar, harga_dibayar, bayar_expires_at)
      SELECT v_paket, id, gen_random_uuid(), 'lunas', 100000, now() FROM retail.customers LIMIT 1;
    RAISE EXCEPTION 'GAGAL (c): lunas tanpa tanggal lolos';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- (d) tebus 'aktif' tanpa order ditolak
  BEGIN
    INSERT INTO retail.voucher_tebus (milik_id, outlet_id, client_order_id, status)
      SELECT m.id, (SELECT id FROM public.outlets WHERE type='test' LIMIT 1), gen_random_uuid(), 'aktif'
      FROM retail.voucher_milik m LIMIT 1;
    -- bila tak ada milik, insert tak menghasilkan baris: tak ada yang diuji, lanjut.
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- (e) kolom baru ada dan nullable
  SELECT is_nullable = 'YES' INTO v_ok FROM information_schema.columns
   WHERE table_schema='public' AND table_name='order_items' AND column_name='voucher_tebus_id';
  IF v_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'GAGAL (e): order_items.voucher_tebus_id tak ada/tidak nullable'; END IF;

  -- (f) anon/authenticated tak punya hak
  IF has_table_privilege('anon', 'retail.voucher_milik', 'SELECT')
     OR has_table_privilege('authenticated', 'retail.voucher_milik_slot', 'SELECT') THEN
    RAISE EXCEPTION 'GAGAL (f): anon/authenticated masih punya hak tabel voucher';
  END IF;

  RAISE EXCEPTION 'HASIL T1: LULUS (skema, CHECK, kolom order_items, hak akses)';
END $$;
```

- [ ] **Step 4: Jalankan migration + uji dalam satu transaksi yang dirollback**

```bash
supabase db query --linked "BEGIN; $(cat supabase/migrations/20260929200000_voucher_prabayar_tabel.sql) $(cat supabase/migrations/20260929205000_voucher_prabayar_order_items.sql) $(cat supabase/verifikasi/voucher_prabayar/t1_tabel.sql)"
```
Expected: galat berisi `HASIL T1: LULUS`. Transaksi dibatalkan oleh `RAISE`, jadi **tidak ada perubahan permanen**. Bila galat lain (mis. `lock_timeout`, `relation does not exist`), perbaiki dan ulangi. Kontrol negatif: hapus sementara satu CHECK di migration (mis. `harga = trunc(harga)`), jalankan lagi, harus muncul `GAGAL (a)`; kembalikan.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260929200000_voucher_prabayar_tabel.sql supabase/migrations/20260929205000_voucher_prabayar_order_items.sql supabase/verifikasi/voucher_prabayar/t1_tabel.sql
git commit -m "feat(voucher-prabayar): tabel retail + kolom order_items.voucher_tebus_id"
```

(Migration belum di-apply ke produksi. Apply dilakukan sekali di Task 8 setelah semua RPC lulus uji, dengan izin owner.)

---

### Task 3: RPC paket dan pembelian

**Files:**
- Create: `supabase/migrations/20260929210000_voucher_prabayar_rpc_paket_beli.sql`
- Create: `supabase/verifikasi/voucher_prabayar/t2_paket_beli.sql`

**Interfaces:**
- Consumes: tabel Task 2.
- Produces (semua di skema `retail`):
  - `simpan_paket(p jsonb) RETURNS uuid` — `p` = `{ id?, nama, deskripsi?, harga, beli_mulai?, beli_selesai?, tebus_sampai?, tebus_hari?, kuota_total?, batas_per_pelanggan?, is_active?, dibuat_oleh?, slots: [{ nama, jumlah, nilai_per_unit, menu_ids: [uuid] }] }`. Kode galat: `harga_tidak_valid`, `slot_kosong`, `slot_tanpa_menu`, `total_slot_tidak_sama_harga`, `menu_tidak_tampil_di_app`, `struktur_terkunci`, `paket_tidak_ditemukan`.
  - `beli_voucher_reserve(p_paket uuid, p_customer uuid, p_client_beli uuid) RETURNS jsonb` — `{ ok: true, milik_id, ada, status_bayar }` atau `{ ok: false, kode }` dengan kode `tidak_sah`, `paket_tidak_tersedia`, `belum_dibuka`, `sudah_ditutup`, `kuota_habis`, `batas_pelanggan`.
  - `beli_voucher_lunas(p_milik uuid, p_fee numeric DEFAULT NULL) RETURNS jsonb` — `{ ok: true, sudah?: true, fee }` atau `{ ok: false, kode: 'tidak_ditemukan' }`.

- [ ] **Step 1: Tulis uji `t2_paket_beli.sql` (gagal dulu)**

```sql
-- t2_paket_beli.sql — harapan "HASIL T2: LULUS".
DO $$
DECLARE
  v_cust uuid; v_cust2 uuid; v_menu1 uuid; v_menu2 uuid; v_paket uuid; v_r jsonb; v_milik uuid; v_n int;
  v_client uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_cust FROM retail.customers ORDER BY created_at LIMIT 1;
  SELECT id INTO v_cust2 FROM retail.customers ORDER BY created_at OFFSET 1 LIMIT 1;
  SELECT id INTO v_menu1 FROM public.menu_items WHERE tampil_di_app AND is_available ORDER BY id LIMIT 1;
  SELECT id INTO v_menu2 FROM public.menu_items WHERE tampil_di_app AND is_available ORDER BY id OFFSET 1 LIMIT 1;
  IF v_cust IS NULL OR v_menu1 IS NULL OR v_menu2 IS NULL THEN RAISE EXCEPTION 'GAGAL: fixture kurang'; END IF;

  -- (a) simpan_paket sah
  v_paket := retail.simpan_paket(jsonb_build_object(
    'nama','UJI T2','harga',100000,'tebus_hari',30,'kuota_total',1,'batas_per_pelanggan',1,
    'slots', jsonb_build_array(
      jsonb_build_object('nama','Makanan','jumlah',2,'nilai_per_unit',30000,'menu_ids',jsonb_build_array(v_menu1)),
      jsonb_build_object('nama','Minuman','jumlah',2,'nilai_per_unit',10000,'menu_ids',jsonb_build_array(v_menu2)),
      jsonb_build_object('nama','Snack','jumlah',1,'nilai_per_unit',20000,'menu_ids',jsonb_build_array(v_menu1,v_menu2)))));
  SELECT count(*) INTO v_n FROM retail.voucher_paket_slot WHERE paket_id = v_paket;
  IF v_n <> 3 THEN RAISE EXCEPTION 'GAGAL (a): slot=%', v_n; END IF;

  -- (b) total slot != harga ditolak
  BEGIN
    PERFORM retail.simpan_paket(jsonb_build_object('nama','X','harga',90000,'tebus_hari',30,
      'slots', jsonb_build_array(jsonb_build_object('nama','A','jumlah',2,'nilai_per_unit',30000,'menu_ids',jsonb_build_array(v_menu1)))));
    RAISE EXCEPTION 'GAGAL (b): total tak sama lolos';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%total_slot_tidak_sama_harga%' THEN RAISE; END IF;
  END;

  -- (c) slot tanpa menu ditolak
  BEGIN
    PERFORM retail.simpan_paket(jsonb_build_object('nama','X','harga',30000,'tebus_hari',30,
      'slots', jsonb_build_array(jsonb_build_object('nama','A','jumlah',1,'nilai_per_unit',30000,'menu_ids','[]'::jsonb))));
    RAISE EXCEPTION 'GAGAL (c): slot tanpa menu lolos';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%slot_tanpa_menu%' THEN RAISE; END IF;
  END;

  -- (d) reserve: ok, idempoten, kuota 1 habis untuk pelanggan lain
  v_r := retail.beli_voucher_reserve(v_paket, v_cust, v_client);
  IF NOT (v_r->>'ok')::boolean THEN RAISE EXCEPTION 'GAGAL (d1): %', v_r; END IF;
  v_milik := (v_r->>'milik_id')::uuid;
  v_r := retail.beli_voucher_reserve(v_paket, v_cust, v_client);
  IF (v_r->>'milik_id')::uuid <> v_milik OR NOT (v_r->>'ada')::boolean THEN RAISE EXCEPTION 'GAGAL (d2): tidak idempoten %', v_r; END IF;
  IF v_cust2 IS NOT NULL THEN
    v_r := retail.beli_voucher_reserve(v_paket, v_cust2, gen_random_uuid());
    IF (v_r->>'ok')::boolean OR v_r->>'kode' <> 'kuota_habis' THEN RAISE EXCEPTION 'GAGAL (d3): kuota %', v_r; END IF;
  END IF;

  -- (e) client_beli_id milik orang lain ditolak
  IF v_cust2 IS NOT NULL THEN
    v_r := retail.beli_voucher_reserve(v_paket, v_cust2, v_client);
    IF (v_r->>'ok')::boolean OR v_r->>'kode' <> 'tidak_sah' THEN RAISE EXCEPTION 'GAGAL (e): %', v_r; END IF;
  END IF;

  -- (f) lunas: 5 unit slot, kedaluwarsa ~30 hari, fee estimasi 0,7% = 700, jumlah fee_bagian ~ 700, idempoten
  v_r := retail.beli_voucher_lunas(v_milik);
  IF NOT (v_r->>'ok')::boolean THEN RAISE EXCEPTION 'GAGAL (f1): %', v_r; END IF;
  SELECT count(*) INTO v_n FROM retail.voucher_milik_slot WHERE milik_id = v_milik AND status = 'tersedia';
  IF v_n <> 5 THEN RAISE EXCEPTION 'GAGAL (f2): unit=%', v_n; END IF;
  IF (SELECT round(sum(fee_bagian)) FROM retail.voucher_milik_slot WHERE milik_id = v_milik) <> 700 THEN
    RAISE EXCEPTION 'GAGAL (f3): fee_bagian tak berjumlah 700'; END IF;
  IF (SELECT sum(nilai) FROM retail.voucher_milik_slot WHERE milik_id = v_milik) <> 100000 THEN
    RAISE EXCEPTION 'GAGAL (f4): nilai tak berjumlah harga'; END IF;
  IF (SELECT kedaluwarsa_at FROM retail.voucher_milik WHERE id = v_milik) NOT BETWEEN now() + interval '29 days' AND now() + interval '31 days' THEN
    RAISE EXCEPTION 'GAGAL (f5): kedaluwarsa tak sekitar 30 hari'; END IF;
  v_r := retail.beli_voucher_lunas(v_milik);
  SELECT count(*) INTO v_n FROM retail.voucher_milik_slot WHERE milik_id = v_milik;
  IF v_n <> 5 OR NOT COALESCE((v_r->>'sudah')::boolean, false) THEN RAISE EXCEPTION 'GAGAL (f6): lunas ganda menambah unit'; END IF;

  -- (g) struktur terkunci setelah ada penjualan; daftar menu tetap boleh berubah
  BEGIN
    PERFORM retail.simpan_paket(jsonb_build_object('id',v_paket,'nama','UJI T2','harga',100000,'tebus_hari',30,
      'slots', jsonb_build_array(
        jsonb_build_object('nama','Makanan','jumlah',1,'nilai_per_unit',60000,'menu_ids',jsonb_build_array(v_menu1)),
        jsonb_build_object('nama','Minuman','jumlah',2,'nilai_per_unit',10000,'menu_ids',jsonb_build_array(v_menu2)),
        jsonb_build_object('nama','Snack','jumlah',1,'nilai_per_unit',20000,'menu_ids',jsonb_build_array(v_menu1)))));
    RAISE EXCEPTION 'GAGAL (g1): struktur berubah lolos';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%struktur_terkunci%' THEN RAISE; END IF;
  END;
  PERFORM retail.simpan_paket(jsonb_build_object('id',v_paket,'nama','UJI T2 (menu diubah)','harga',100000,'tebus_hari',30,
    'slots', jsonb_build_array(
      jsonb_build_object('nama','Makanan','jumlah',2,'nilai_per_unit',30000,'menu_ids',jsonb_build_array(v_menu1,v_menu2)),
      jsonb_build_object('nama','Minuman','jumlah',2,'nilai_per_unit',10000,'menu_ids',jsonb_build_array(v_menu2)),
      jsonb_build_object('nama','Snack','jumlah',1,'nilai_per_unit',20000,'menu_ids',jsonb_build_array(v_menu1,v_menu2)))));
  IF (SELECT count(*) FROM retail.voucher_paket_slot_menu m JOIN retail.voucher_paket_slot s ON s.id = m.slot_id
      WHERE s.paket_id = v_paket AND s.urut = 1) <> 2 THEN RAISE EXCEPTION 'GAGAL (g2): daftar menu tak berubah'; END IF;

  RAISE EXCEPTION 'HASIL T2: LULUS (paket, kuota, idempotensi, lunas 5 unit, fee 700, kunci struktur)';
END $$;
```

- [ ] **Step 2: Jalankan uji terhadap fungsi yang belum ada — harus gagal**

```bash
supabase db query --linked "BEGIN; $(cat supabase/migrations/20260929200000_voucher_prabayar_tabel.sql) $(cat supabase/migrations/20260929205000_voucher_prabayar_order_items.sql) $(cat supabase/verifikasi/voucher_prabayar/t2_paket_beli.sql)"
```
Expected: galat `function retail.simpan_paket(jsonb) does not exist` (bukan `LULUS`).

- [ ] **Step 3: Tulis migration RPC**

`supabase/migrations/20260929210000_voucher_prabayar_rpc_paket_beli.sql`:

```sql
-- App Retail: voucher prabayar — RPC paket & pembelian (spec 2026-09-29 §3, §4).

-- 1. simpan_paket: tulis paket + slot + menu secara atomik.
CREATE OR REPLACE FUNCTION retail.simpan_paket(p jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, retail AS $$
DECLARE
  v_id uuid := NULLIF(p->>'id', '')::uuid;
  v_harga numeric := (p->>'harga')::numeric;
  v_total numeric := 0;
  v_terkunci boolean := false;
  v_slot jsonb; v_menu text; v_slot_id uuid; v_urut int := 0; v_n int;
BEGIN
  IF v_harga IS NULL OR v_harga <= 0 OR v_harga <> trunc(v_harga) THEN
    RAISE EXCEPTION 'voucher_prabayar:harga_tidak_valid';
  END IF;
  IF jsonb_typeof(p->'slots') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'slots') = 0 THEN
    RAISE EXCEPTION 'voucher_prabayar:slot_kosong';
  END IF;

  FOR v_slot IN SELECT * FROM jsonb_array_elements(p->'slots') LOOP
    IF jsonb_typeof(v_slot->'menu_ids') IS DISTINCT FROM 'array' OR jsonb_array_length(v_slot->'menu_ids') = 0 THEN
      RAISE EXCEPTION 'voucher_prabayar:slot_tanpa_menu';
    END IF;
    v_total := v_total + (v_slot->>'jumlah')::int * (v_slot->>'nilai_per_unit')::numeric;
  END LOOP;
  IF v_total <> v_harga THEN RAISE EXCEPTION 'voucher_prabayar:total_slot_tidak_sama_harga'; END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p->'slots') AS s(v), jsonb_array_elements_text(s.v->'menu_ids') AS m(id)
    WHERE NOT EXISTS (SELECT 1 FROM public.menu_items mi WHERE mi.id = m.id::uuid AND mi.tampil_di_app = true)
  ) THEN RAISE EXCEPTION 'voucher_prabayar:menu_tidak_tampil_di_app'; END IF;

  IF v_id IS NULL THEN
    INSERT INTO retail.voucher_paket (nama, deskripsi, harga, beli_mulai, beli_selesai, tebus_sampai, tebus_hari,
                                      kuota_total, batas_per_pelanggan, is_active, created_by)
    VALUES (p->>'nama', NULLIF(p->>'deskripsi',''), v_harga, NULLIF(p->>'beli_mulai','')::timestamptz,
            NULLIF(p->>'beli_selesai','')::timestamptz, NULLIF(p->>'tebus_sampai','')::timestamptz,
            NULLIF(p->>'tebus_hari','')::int, NULLIF(p->>'kuota_total','')::int,
            NULLIF(p->>'batas_per_pelanggan','')::int, COALESCE((p->>'is_active')::boolean, true),
            NULLIF(p->>'dibuat_oleh','')::uuid)
    RETURNING id INTO v_id;
  ELSE
    PERFORM 1 FROM retail.voucher_paket WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'voucher_prabayar:paket_tidak_ditemukan'; END IF;
    v_terkunci := EXISTS (SELECT 1 FROM retail.voucher_milik WHERE paket_id = v_id);
    IF v_terkunci AND v_harga <> (SELECT harga FROM retail.voucher_paket WHERE id = v_id) THEN
      RAISE EXCEPTION 'voucher_prabayar:struktur_terkunci';
    END IF;
    UPDATE retail.voucher_paket SET
      nama = p->>'nama', deskripsi = NULLIF(p->>'deskripsi',''), harga = v_harga,
      beli_mulai = NULLIF(p->>'beli_mulai','')::timestamptz, beli_selesai = NULLIF(p->>'beli_selesai','')::timestamptz,
      tebus_sampai = NULLIF(p->>'tebus_sampai','')::timestamptz, tebus_hari = NULLIF(p->>'tebus_hari','')::int,
      kuota_total = NULLIF(p->>'kuota_total','')::int, batas_per_pelanggan = NULLIF(p->>'batas_per_pelanggan','')::int,
      is_active = COALESCE((p->>'is_active')::boolean, is_active), updated_at = now()
    WHERE id = v_id;
    IF v_terkunci THEN
      SELECT count(*) INTO v_n FROM retail.voucher_paket_slot WHERE paket_id = v_id;
      IF v_n <> jsonb_array_length(p->'slots') THEN RAISE EXCEPTION 'voucher_prabayar:struktur_terkunci'; END IF;
    ELSE
      DELETE FROM retail.voucher_paket_slot WHERE paket_id = v_id;
    END IF;
  END IF;

  FOR v_slot IN SELECT * FROM jsonb_array_elements(p->'slots') LOOP
    v_urut := v_urut + 1;
    IF v_terkunci THEN
      SELECT id INTO v_slot_id FROM retail.voucher_paket_slot
       WHERE paket_id = v_id AND urut = v_urut
         AND jumlah = (v_slot->>'jumlah')::int AND nilai_per_unit = (v_slot->>'nilai_per_unit')::numeric;
      IF v_slot_id IS NULL THEN RAISE EXCEPTION 'voucher_prabayar:struktur_terkunci'; END IF;
      DELETE FROM retail.voucher_paket_slot_menu WHERE slot_id = v_slot_id;
    ELSE
      INSERT INTO retail.voucher_paket_slot (paket_id, urut, nama, jumlah, nilai_per_unit)
      VALUES (v_id, v_urut, v_slot->>'nama', (v_slot->>'jumlah')::int, (v_slot->>'nilai_per_unit')::numeric)
      RETURNING id INTO v_slot_id;
    END IF;
    FOR v_menu IN SELECT jsonb_array_elements_text(v_slot->'menu_ids') LOOP
      INSERT INTO retail.voucher_paket_slot_menu (slot_id, menu_item_id) VALUES (v_slot_id, v_menu::uuid)
      ON CONFLICT DO NOTHING;
    END LOOP;
    v_slot_id := NULL;
  END LOOP;

  RETURN v_id;
END $$;

-- 2. beli_voucher_reserve: menahan kuota; kuota dihitung di bawah kunci per paket.
CREATE OR REPLACE FUNCTION retail.beli_voucher_reserve(p_paket uuid, p_customer uuid, p_client_beli uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, retail AS $$
DECLARE
  v_p retail.voucher_paket%ROWTYPE; v_ada retail.voucher_milik%ROWTYPE;
  v_now timestamptz := now(); v_terjual int; v_pel int; v_id uuid;
BEGIN
  SELECT * INTO v_ada FROM retail.voucher_milik WHERE client_beli_id = p_client_beli;
  IF FOUND THEN
    IF v_ada.customer_id <> p_customer THEN RETURN jsonb_build_object('ok', false, 'kode', 'tidak_sah'); END IF;
    RETURN jsonb_build_object('ok', true, 'milik_id', v_ada.id, 'ada', true, 'status_bayar', v_ada.status_bayar);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('vp:' || p_paket::text, 0));

  SELECT * INTO v_p FROM retail.voucher_paket WHERE id = p_paket;
  IF NOT FOUND OR NOT v_p.is_active
     OR NOT EXISTS (SELECT 1 FROM retail.voucher_paket_slot WHERE paket_id = p_paket) THEN
    RETURN jsonb_build_object('ok', false, 'kode', 'paket_tidak_tersedia');
  END IF;
  IF v_p.beli_mulai IS NOT NULL AND v_now < v_p.beli_mulai THEN
    RETURN jsonb_build_object('ok', false, 'kode', 'belum_dibuka');
  END IF;
  IF v_p.beli_selesai IS NOT NULL AND v_now >= v_p.beli_selesai THEN
    RETURN jsonb_build_object('ok', false, 'kode', 'sudah_ditutup');
  END IF;

  IF v_p.kuota_total IS NOT NULL THEN
    SELECT count(*) INTO v_terjual FROM retail.voucher_milik
     WHERE paket_id = p_paket AND (status_bayar = 'lunas' OR (status_bayar = 'menunggu_bayar' AND bayar_expires_at > v_now));
    IF v_terjual >= v_p.kuota_total THEN RETURN jsonb_build_object('ok', false, 'kode', 'kuota_habis'); END IF;
  END IF;
  IF v_p.batas_per_pelanggan IS NOT NULL THEN
    SELECT count(*) INTO v_pel FROM retail.voucher_milik
     WHERE paket_id = p_paket AND customer_id = p_customer
       AND (status_bayar = 'lunas' OR (status_bayar = 'menunggu_bayar' AND bayar_expires_at > v_now));
    IF v_pel >= v_p.batas_per_pelanggan THEN RETURN jsonb_build_object('ok', false, 'kode', 'batas_pelanggan'); END IF;
  END IF;

  BEGIN
    INSERT INTO retail.voucher_milik (paket_id, customer_id, client_beli_id, harga_dibayar, bayar_expires_at)
    VALUES (p_paket, p_customer, p_client_beli, v_p.harga, v_now + interval '15 minutes')
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_ada FROM retail.voucher_milik WHERE client_beli_id = p_client_beli;
    RETURN jsonb_build_object('ok', true, 'milik_id', v_ada.id, 'ada', true, 'status_bayar', v_ada.status_bayar);
  END;
  RETURN jsonb_build_object('ok', true, 'milik_id', v_id, 'ada', false, 'status_bayar', 'menunggu_bayar');
END $$;

-- 3. beli_voucher_lunas: idempoten; pembayaran yang sudah masuk SELALU dihormati.
CREATE OR REPLACE FUNCTION retail.beli_voucher_lunas(p_milik uuid, p_fee numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, retail AS $$
DECLARE
  v_m retail.voucher_milik%ROWTYPE; v_p retail.voucher_paket%ROWTYPE;
  v_now timestamptz := now(); v_fee numeric; v_ked timestamptz; s record; i int;
BEGIN
  SELECT * INTO v_m FROM retail.voucher_milik WHERE id = p_milik FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'kode', 'tidak_ditemukan'); END IF;
  IF v_m.status_bayar = 'lunas' THEN RETURN jsonb_build_object('ok', true, 'sudah', true); END IF;

  SELECT * INTO v_p FROM retail.voucher_paket WHERE id = v_m.paket_id;
  -- Fee: angka riil bila diberikan, jika tidak estimasi 0,7% dari harga beli (spec §7b.6).
  v_fee := COALESCE(p_fee, round(v_m.harga_dibayar * 0.007, 2));
  v_ked := LEAST(
    COALESCE(v_p.tebus_sampai, 'infinity'::timestamptz),
    COALESCE(v_now + make_interval(days => v_p.tebus_hari), 'infinity'::timestamptz));

  UPDATE retail.voucher_milik
     SET status_bayar = 'lunas', lunas_at = v_now, kedaluwarsa_at = v_ked, fee_riil = v_fee
   WHERE id = p_milik;

  FOR s IN SELECT id, jumlah, nilai_per_unit FROM retail.voucher_paket_slot WHERE paket_id = v_m.paket_id ORDER BY urut LOOP
    FOR i IN 1..s.jumlah LOOP
      INSERT INTO retail.voucher_milik_slot (milik_id, slot_id, nilai, fee_bagian)
      VALUES (p_milik, s.id, s.nilai_per_unit, round(v_fee * s.nilai_per_unit / v_m.harga_dibayar, 4));
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'fee', v_fee);
END $$;

REVOKE ALL ON FUNCTION retail.simpan_paket(jsonb), retail.beli_voucher_reserve(uuid, uuid, uuid),
  retail.beli_voucher_lunas(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION retail.simpan_paket(jsonb), retail.beli_voucher_reserve(uuid, uuid, uuid),
  retail.beli_voucher_lunas(uuid, numeric) TO service_role;
```

- [ ] **Step 4: Jalankan uji — harus lulus**

```bash
supabase db query --linked "BEGIN; $(cat supabase/migrations/20260929200000_voucher_prabayar_tabel.sql) $(cat supabase/migrations/20260929205000_voucher_prabayar_order_items.sql) $(cat supabase/migrations/20260929210000_voucher_prabayar_rpc_paket_beli.sql) $(cat supabase/verifikasi/voucher_prabayar/t2_paket_beli.sql)"
```
Expected: galat berisi `HASIL T2: LULUS`. Bila `GAGAL (…)`, perbaiki fungsi. Bila `v_cust2` NULL (hanya 1 pelanggan), cabang (d3)/(e) dilewati; catat itu di PR.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260929210000_voucher_prabayar_rpc_paket_beli.sql supabase/verifikasi/voucher_prabayar/t2_paket_beli.sql
git commit -m "feat(voucher-prabayar): RPC simpan_paket, beli reserve & lunas"
```

---

### Task 4: `'voucher'` sebagai metode bayar

**Files:**
- Create: `supabase/migrations/20260929215000_voucher_prabayar_payment_method.sql`
- Create: `supabase/verifikasi/voucher_prabayar/t3_payment_method.sql`

**Interfaces:**
- Produces: `orders_payment_method_check` menerima `payment_method='voucher'` hanya bila `sales_source='app'`.

Prasyarat: Task 1 Step 1 menegaskan definisi live memuat `'va'` dan `website`.

- [ ] **Step 1: Tulis uji**

`supabase/verifikasi/voucher_prabayar/t3_payment_method.sql`:

```sql
-- t3_payment_method.sql — harapan "HASIL T3: LULUS".
DO $$
DECLARE v_outlet uuid;
BEGIN
  SELECT id INTO v_outlet FROM public.outlets WHERE type = 'test' LIMIT 1;
  IF v_outlet IS NULL THEN RAISE EXCEPTION 'GAGAL: tak ada outlet tes'; END IF;

  -- (a) 'voucher' + sales_source 'app' lolos
  INSERT INTO public.orders (outlet_id, payment_method, total_amount, status, source, channel, sales_source, client_order_id)
  VALUES (v_outlet, 'voucher', 0, 'preparing', 'app', 'app', 'app', gen_random_uuid());

  -- (b) 'voucher' di kanal lain ditolak
  BEGIN
    INSERT INTO public.orders (outlet_id, payment_method, total_amount, status, source, channel, sales_source, client_order_id)
    VALUES (v_outlet, 'voucher', 0, 'preparing', 'pos', 'pos', 'pos', gen_random_uuid());
    RAISE EXCEPTION 'GAGAL (b): voucher lolos di sales_source pos';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- (c) nilai lama tetap sah
  INSERT INTO public.orders (outlet_id, payment_method, total_amount, status, source, channel, sales_source, client_order_id)
  VALUES (v_outlet, 'qris', 1000, 'preparing', 'app', 'app', 'app', gen_random_uuid());
  INSERT INTO public.orders (outlet_id, payment_method, total_amount, status, source, channel, sales_source, client_order_id)
  VALUES (v_outlet, 'cash', 1000, 'completed', 'pos', 'pos', 'pos', gen_random_uuid());

  -- (d) nilai asing tetap ditolak
  BEGIN
    INSERT INTO public.orders (outlet_id, payment_method, total_amount, status, source, channel, sales_source, client_order_id)
    VALUES (v_outlet, 'bitcoin', 1000, 'preparing', 'app', 'app', 'app', gen_random_uuid());
    RAISE EXCEPTION 'GAGAL (d): metode asing lolos';
  EXCEPTION WHEN check_violation THEN NULL; END;

  RAISE EXCEPTION 'HASIL T3: LULUS (voucher hanya untuk sales_source app; qris/cash utuh)';
END $$;
```

- [ ] **Step 2: Jalankan uji sebelum migration — harus gagal**

```bash
supabase db query --linked "BEGIN; $(cat supabase/verifikasi/voucher_prabayar/t3_payment_method.sql)"
```
Expected: `new row for relation "orders" violates check constraint "orders_payment_method_check"` pada (a).

- [ ] **Step 3: Tulis migration (dengan penjaga: menolak menimpa definisi yang tak dikenal)**

`supabase/migrations/20260929215000_voucher_prabayar_payment_method.sql`:

```sql
-- Metode bayar 'voucher' untuk pesanan tebus murni Rp 0 (spec §7b.4).
-- CHECK live tidak ada di repo; migration ini menolak jalan bila definisinya bukan yang diharapkan,
-- agar tidak menimpa perubahan yang tak dikenal.
SET LOCAL lock_timeout = '5s';

DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.orders'::regclass AND conname = 'orders_payment_method_check';
  IF v_def IS NULL THEN RAISE EXCEPTION 'orders_payment_method_check tidak ada'; END IF;
  IF v_def NOT LIKE '%cash%' OR v_def NOT LIKE '%qris%' OR v_def NOT LIKE '%card%'
     OR v_def NOT LIKE '%va%' OR v_def NOT LIKE '%website%' THEN
    RAISE EXCEPTION 'Definisi orders_payment_method_check berbeda dari yang diharapkan: %', v_def;
  END IF;
END $$;

ALTER TABLE public.orders DROP CONSTRAINT orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check CHECK (
  payment_method IS NULL
  OR payment_method IN ('cash', 'qris', 'card')
  OR (payment_method = 'va' AND lower(btrim(channel)) = 'website')
  OR (payment_method = 'voucher' AND sales_source = 'app')
) NOT VALID;
ALTER TABLE public.orders VALIDATE CONSTRAINT orders_payment_method_check;
```

- [ ] **Step 4: Jalankan migration + uji dalam satu transaksi**

```bash
supabase db query --linked "BEGIN; $(cat supabase/migrations/20260929215000_voucher_prabayar_payment_method.sql) $(cat supabase/verifikasi/voucher_prabayar/t3_payment_method.sql)"
```
Expected: `HASIL T3: LULUS`. Bila penjaga menolak (definisi berbeda), hentikan dan laporkan definisi live ke owner; jangan memaksakan.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260929215000_voucher_prabayar_payment_method.sql supabase/verifikasi/voucher_prabayar/t3_payment_method.sql
git commit -m "feat(voucher-prabayar): metode bayar 'voucher' untuk pesanan app"
```

---

### Task 5: RPC tebus dan pembatalan

**Files:**
- Create: `supabase/migrations/20260929220000_voucher_prabayar_rpc_tebus.sql`
- Create: `supabase/verifikasi/voucher_prabayar/t4_tebus.sql`

**Interfaces:**
- Consumes: tabel Task 2, RPC beli Task 3, CHECK Task 4.
- Produces (skema `retail`):
  - `tahan_tebus(p_milik uuid, p_customer uuid, p_outlet uuid, p_client_order uuid, p_pilihan jsonb) RETURNS jsonb` — `p_pilihan` = `[{ "slot_id": uuid, "menu_item_id": uuid }, …]` (satu elemen per unit slot). Hasil `{ tebus_id, ada, status, order_id?, nilai_total }`. Galat (`RAISE`): `tidak_sah`, `belum_lunas`, `kedaluwarsa`, `pilihan_kosong`, `menu_tidak_valid`, `slot_habis`.
  - `selesaikan_tebus(p_tebus uuid, p_order jsonb, p_items jsonb) RETURNS jsonb` — hasil `{ order_id, order_number, sudah? }`. `p_order` sama bentuknya dengan `atomic_insert_order`; `p_items` elemen voucher membawa kunci `voucher_tebus_item_id`. Galat: `tebus_tidak_aktif`, `client_order_tidak_cocok`, `item_tidak_lengkap`.
  - `lepas_tebus(p_tebus uuid) RETURNS jsonb` — `{ ok, sudah? }`.
  - Trigger `trg_batalkan_tebus_pesanan` pada `public.orders`.

- [ ] **Step 1: Tulis uji `t4_tebus.sql`**

```sql
-- t4_tebus.sql — harapan "HASIL T4: LULUS". Membutuhkan migration Task 2–5 dalam transaksi yang sama.
DO $$
DECLARE
  v_cust uuid; v_outlet uuid; v_menu1 uuid; v_menu2 uuid; v_paket uuid; v_milik uuid; v_r jsonb;
  v_slot_mkn uuid; v_slot_min uuid; v_tebus uuid; v_client uuid := gen_random_uuid(); v_order uuid;
  v_ti record; v_items jsonb := '[]'::jsonb; v_n int; v_total numeric;
BEGIN
  SELECT id INTO v_cust FROM retail.customers ORDER BY created_at LIMIT 1;
  SELECT id INTO v_outlet FROM public.outlets WHERE type = 'test' LIMIT 1;
  SELECT id INTO v_menu1 FROM public.menu_items WHERE tampil_di_app AND is_available ORDER BY id LIMIT 1;
  SELECT id INTO v_menu2 FROM public.menu_items WHERE tampil_di_app AND is_available ORDER BY id OFFSET 1 LIMIT 1;

  v_paket := retail.simpan_paket(jsonb_build_object('nama','UJI T4','harga',100000,'tebus_hari',30,
    'slots', jsonb_build_array(
      jsonb_build_object('nama','Makanan','jumlah',2,'nilai_per_unit',30000,'menu_ids',jsonb_build_array(v_menu1)),
      jsonb_build_object('nama','Minuman','jumlah',2,'nilai_per_unit',10000,'menu_ids',jsonb_build_array(v_menu2)),
      jsonb_build_object('nama','Snack','jumlah',1,'nilai_per_unit',20000,'menu_ids',jsonb_build_array(v_menu1)))));
  v_r := retail.beli_voucher_reserve(v_paket, v_cust, gen_random_uuid());
  v_milik := (v_r->>'milik_id')::uuid;
  PERFORM retail.beli_voucher_lunas(v_milik);
  SELECT id INTO v_slot_mkn FROM retail.voucher_paket_slot WHERE paket_id = v_paket AND urut = 1;
  SELECT id INTO v_slot_min FROM retail.voucher_paket_slot WHERE paket_id = v_paket AND urut = 2;

  -- (a) tahan 1 makanan + 1 minuman
  v_r := retail.tahan_tebus(v_milik, v_cust, v_outlet, v_client, jsonb_build_array(
    jsonb_build_object('slot_id', v_slot_mkn, 'menu_item_id', v_menu1),
    jsonb_build_object('slot_id', v_slot_min, 'menu_item_id', v_menu2)));
  v_tebus := (v_r->>'tebus_id')::uuid;
  IF (v_r->>'nilai_total')::numeric <> 40000 THEN RAISE EXCEPTION 'GAGAL (a1): nilai_total=%', v_r; END IF;
  SELECT count(*) INTO v_n FROM retail.voucher_milik_slot WHERE milik_id = v_milik AND status = 'ditahan';
  IF v_n <> 2 THEN RAISE EXCEPTION 'GAGAL (a2): ditahan=%', v_n; END IF;

  -- (b) idempoten: client_order_id sama mengembalikan tebus yang sama, tanpa menahan lagi
  v_r := retail.tahan_tebus(v_milik, v_cust, v_outlet, v_client, jsonb_build_array(
    jsonb_build_object('slot_id', v_slot_mkn, 'menu_item_id', v_menu1)));
  IF (v_r->>'tebus_id')::uuid <> v_tebus OR NOT (v_r->>'ada')::boolean THEN RAISE EXCEPTION 'GAGAL (b1): %', v_r; END IF;
  SELECT count(*) INTO v_n FROM retail.voucher_milik_slot WHERE milik_id = v_milik AND status = 'ditahan';
  IF v_n <> 2 THEN RAISE EXCEPTION 'GAGAL (b2): tahan ganda'; END IF;

  -- (c) minta lebih dari sisa: 3 makanan (sisa 1 tersedia) ditolak seluruhnya, tak ada sisa tahan
  BEGIN
    PERFORM retail.tahan_tebus(v_milik, v_cust, v_outlet, gen_random_uuid(), jsonb_build_array(
      jsonb_build_object('slot_id', v_slot_mkn, 'menu_item_id', v_menu1),
      jsonb_build_object('slot_id', v_slot_mkn, 'menu_item_id', v_menu1)));
    RAISE EXCEPTION 'GAGAL (c): melebihi sisa lolos';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%slot_habis%' THEN RAISE; END IF;
  END;

  -- (d) menu di luar daftar slot ditolak
  BEGIN
    PERFORM retail.tahan_tebus(v_milik, v_cust, v_outlet, gen_random_uuid(), jsonb_build_array(
      jsonb_build_object('slot_id', v_slot_min, 'menu_item_id', v_menu1)));
    RAISE EXCEPTION 'GAGAL (d): menu asing lolos';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%menu_tidak_valid%' THEN RAISE; END IF;
  END;

  -- (e) selesaikan: pesanan penuh = 40000 (tanpa item tambahan), payment_method 'voucher'
  FOR v_ti IN SELECT ti.id, ti.menu_item_id, ti.nilai, mi.name FROM retail.voucher_tebus_item ti
              JOIN public.menu_items mi ON mi.id = ti.menu_item_id WHERE ti.tebus_id = v_tebus LOOP
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'menu_item_id', v_ti.menu_item_id, 'menu_item_name', v_ti.name || '|NOTE|Voucher', 'quantity', 1,
      'unit_price', v_ti.nilai, 'subtotal', v_ti.nilai, 'package_choices', NULL, 'voucher_tebus_item_id', v_ti.id));
  END LOOP;
  v_r := retail.selesaikan_tebus(v_tebus, jsonb_build_object(
    'outlet_id', v_outlet, 'client_order_id', v_client, 'customer_name', 'Uji', 'payment_method', 'voucher',
    'total_amount', 40000, 'discount_amount', 0, 'promo_subsidy', 0, 'status', 'preparing',
    'kitchen_receipt_printed', false, 'source', 'app', 'channel', 'app', 'sales_source', 'app'), v_items);
  v_order := (v_r->>'order_id')::uuid;
  IF v_order IS NULL THEN RAISE EXCEPTION 'GAGAL (e1): %', v_r; END IF;
  SELECT count(*) INTO v_n FROM public.order_items WHERE order_id = v_order AND voucher_tebus_id = v_tebus;
  IF v_n <> 2 THEN RAISE EXCEPTION 'GAGAL (e2): item bertanda=%', v_n; END IF;
  SELECT sum(subtotal) INTO v_total FROM public.order_items WHERE order_id = v_order;
  IF v_total <> (SELECT total_amount FROM public.orders WHERE id = v_order) THEN
    RAISE EXCEPTION 'GAGAL (e3): total_amount tidak sama Σsubtotal (akan terbaca Potongan)'; END IF;
  SELECT count(*) INTO v_n FROM retail.voucher_milik_slot WHERE milik_id = v_milik AND status = 'terpakai';
  IF v_n <> 2 THEN RAISE EXCEPTION 'GAGAL (e4): terpakai=%', v_n; END IF;
  IF (SELECT status FROM retail.voucher_tebus WHERE id = v_tebus) <> 'aktif' THEN RAISE EXCEPTION 'GAGAL (e5)'; END IF;

  -- (f) selesaikan ulang idempoten
  v_r := retail.selesaikan_tebus(v_tebus, '{}'::jsonb, '[]'::jsonb);
  IF NOT COALESCE((v_r->>'sudah')::boolean, false) OR (v_r->>'order_id')::uuid <> v_order THEN
    RAISE EXCEPTION 'GAGAL (f): tidak idempoten %', v_r; END IF;

  -- (g) pesanan dibatalkan (POS) -> slot kembali tersedia, tebus dibatalkan
  UPDATE public.orders SET status = 'cancelled' WHERE id = v_order;
  SELECT count(*) INTO v_n FROM retail.voucher_milik_slot WHERE milik_id = v_milik AND status = 'tersedia';
  IF v_n <> 5 THEN RAISE EXCEPTION 'GAGAL (g1): tersedia=% (harus 5)', v_n; END IF;
  IF (SELECT status FROM retail.voucher_tebus WHERE id = v_tebus) <> 'dibatalkan' THEN RAISE EXCEPTION 'GAGAL (g2)'; END IF;

  -- (h) lepas tebus 'menunggu' mengembalikan tahan; lepas ganda aman
  v_r := retail.tahan_tebus(v_milik, v_cust, v_outlet, gen_random_uuid(), jsonb_build_array(
    jsonb_build_object('slot_id', v_slot_mkn, 'menu_item_id', v_menu1)));
  v_r := retail.lepas_tebus((v_r->>'tebus_id')::uuid);
  IF NOT (v_r->>'ok')::boolean THEN RAISE EXCEPTION 'GAGAL (h1): %', v_r; END IF;
  SELECT count(*) INTO v_n FROM retail.voucher_milik_slot WHERE milik_id = v_milik AND status = 'tersedia';
  IF v_n <> 5 THEN RAISE EXCEPTION 'GAGAL (h2): tersedia=%', v_n; END IF;

  RAISE EXCEPTION 'HASIL T4: LULUS (tahan, idempoten, batas sisa, menu valid, pesanan penuh, batal mengembalikan slot)';
END $$;
```

- [ ] **Step 2: Jalankan uji — harus gagal**

```bash
supabase db query --linked "BEGIN; $(cat supabase/migrations/2026092920*.sql supabase/migrations/20260929210000_voucher_prabayar_rpc_paket_beli.sql supabase/migrations/20260929215000_voucher_prabayar_payment_method.sql) $(cat supabase/verifikasi/voucher_prabayar/t4_tebus.sql)"
```
Expected: `function retail.tahan_tebus(...) does not exist`. (Glob `2026092920*.sql` memuat `200000` dan `205000`; pastikan hanya berkas voucher yang ikut.)

- [ ] **Step 3: Tulis migration**

`supabase/migrations/20260929220000_voucher_prabayar_rpc_tebus.sql`:

```sql
-- App Retail: voucher prabayar — tebus, lepas, dan pembatalan (spec §4, §7b).

-- 1. tahan_tebus: menahan slot (status 'ditahan') dan membuat baris tebus + item.
CREATE OR REPLACE FUNCTION retail.tahan_tebus(
  p_milik uuid, p_customer uuid, p_outlet uuid, p_client_order uuid, p_pilihan jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, retail AS $$
DECLARE
  v_m retail.voucher_milik%ROWTYPE; v_t retail.voucher_tebus%ROWTYPE; v_tebus uuid;
  v_el jsonb; v_unit retail.voucher_milik_slot%ROWTYPE; v_total numeric := 0;
BEGIN
  SELECT * INTO v_t FROM retail.voucher_tebus WHERE client_order_id = p_client_order;
  IF FOUND THEN
    IF v_t.milik_id <> p_milik THEN RAISE EXCEPTION 'voucher_prabayar:tidak_sah'; END IF;
    SELECT * INTO v_m FROM retail.voucher_milik WHERE id = v_t.milik_id;
    IF v_m.customer_id <> p_customer THEN RAISE EXCEPTION 'voucher_prabayar:tidak_sah'; END IF;
    RETURN jsonb_build_object('tebus_id', v_t.id, 'ada', true, 'status', v_t.status, 'order_id', v_t.order_id,
      'nilai_total', (SELECT COALESCE(sum(nilai), 0) FROM retail.voucher_tebus_item WHERE tebus_id = v_t.id));
  END IF;

  SELECT * INTO v_m FROM retail.voucher_milik WHERE id = p_milik FOR UPDATE;
  IF NOT FOUND OR v_m.customer_id <> p_customer THEN RAISE EXCEPTION 'voucher_prabayar:tidak_sah'; END IF;
  IF v_m.status_bayar <> 'lunas' THEN RAISE EXCEPTION 'voucher_prabayar:belum_lunas'; END IF;
  IF v_m.kedaluwarsa_at <= now() THEN RAISE EXCEPTION 'voucher_prabayar:kedaluwarsa'; END IF;
  IF jsonb_typeof(p_pilihan) IS DISTINCT FROM 'array' OR jsonb_array_length(p_pilihan) = 0 THEN
    RAISE EXCEPTION 'voucher_prabayar:pilihan_kosong';
  END IF;

  INSERT INTO retail.voucher_tebus (milik_id, outlet_id, client_order_id)
  VALUES (p_milik, p_outlet, p_client_order) RETURNING id INTO v_tebus;

  FOR v_el IN SELECT * FROM jsonb_array_elements(p_pilihan) LOOP
    IF NOT EXISTS (SELECT 1 FROM retail.voucher_paket_slot_menu
                    WHERE slot_id = (v_el->>'slot_id')::uuid AND menu_item_id = (v_el->>'menu_item_id')::uuid) THEN
      RAISE EXCEPTION 'voucher_prabayar:menu_tidak_valid';
    END IF;
    SELECT * INTO v_unit FROM retail.voucher_milik_slot
     WHERE milik_id = p_milik AND slot_id = (v_el->>'slot_id')::uuid AND status = 'tersedia'
     ORDER BY id LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'voucher_prabayar:slot_habis'; END IF;
    UPDATE retail.voucher_milik_slot SET status = 'ditahan' WHERE id = v_unit.id;
    INSERT INTO retail.voucher_tebus_item (tebus_id, milik_slot_id, menu_item_id, nilai, fee_dibebankan)
    VALUES (v_tebus, v_unit.id, (v_el->>'menu_item_id')::uuid, v_unit.nilai, v_unit.fee_bagian);
    v_total := v_total + v_unit.nilai;
  END LOOP;

  RETURN jsonb_build_object('tebus_id', v_tebus, 'ada', false, 'status', 'menunggu', 'nilai_total', v_total);
END $$;

-- 2. selesaikan_tebus: buat pesanan (total_amount PENUH) + tandai slot terpakai. Idempoten.
CREATE OR REPLACE FUNCTION retail.selesaikan_tebus(p_tebus uuid, p_order jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, retail AS $$
DECLARE
  v_t retail.voucher_tebus%ROWTYPE; v_order_id uuid; v_order_number int; v_created_at timestamptz;
  v_item jsonb; v_oi uuid; v_tebus_item uuid; v_n_voucher int := 0; v_n_tebus int;
BEGIN
  SELECT * INTO v_t FROM retail.voucher_tebus WHERE id = p_tebus FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'voucher_prabayar:tebus_tidak_aktif'; END IF;
  IF v_t.order_id IS NOT NULL THEN
    RETURN jsonb_build_object('order_id', v_t.order_id, 'sudah', true,
      'order_number', (SELECT order_number FROM public.orders WHERE id = v_t.order_id));
  END IF;
  IF v_t.status <> 'menunggu' THEN RAISE EXCEPTION 'voucher_prabayar:tebus_tidak_aktif'; END IF;
  IF (p_order->>'client_order_id')::uuid <> v_t.client_order_id THEN
    RAISE EXCEPTION 'voucher_prabayar:client_order_tidak_cocok';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF v_item ? 'voucher_tebus_item_id' THEN v_n_voucher := v_n_voucher + 1; END IF;
  END LOOP;
  SELECT count(*) INTO v_n_tebus FROM retail.voucher_tebus_item WHERE tebus_id = p_tebus;
  IF v_n_voucher <> v_n_tebus THEN RAISE EXCEPTION 'voucher_prabayar:item_tidak_lengkap'; END IF;

  v_created_at := COALESCE((p_order->>'created_at')::timestamptz, now());
  INSERT INTO public.orders (
    outlet_id, client_order_id, customer_name, customer_phone, cashier_name, notes,
    payment_method, total_amount, discount_amount, promo_subsidy, payment_proof_url,
    amount_received, change_amount, status, kitchen_receipt_printed, source, channel,
    sales_source, external_order_id, is_endorse, scheduled_promo_names, created_at, updated_at
  ) VALUES (
    (p_order->>'outlet_id')::uuid, (p_order->>'client_order_id')::uuid,
    p_order->>'customer_name', p_order->>'customer_phone', p_order->>'cashier_name', p_order->>'notes',
    p_order->>'payment_method', (p_order->>'total_amount')::numeric, COALESCE((p_order->>'discount_amount')::numeric, 0),
    COALESCE((p_order->>'promo_subsidy')::numeric, 0), p_order->>'payment_proof_url',
    (p_order->>'amount_received')::numeric, (p_order->>'change_amount')::numeric,
    COALESCE(p_order->>'status', 'pending'), COALESCE((p_order->>'kitchen_receipt_printed')::boolean, false),
    p_order->>'source', p_order->>'channel', COALESCE(p_order->>'sales_source', p_order->>'channel', p_order->>'source'),
    p_order->>'external_order_id', COALESCE((p_order->>'is_endorse')::boolean, false), '{}',
    v_created_at, COALESCE((p_order->>'updated_at')::timestamptz, v_created_at)
  ) RETURNING id, order_number INTO v_order_id, v_order_number;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_tebus_item := NULLIF(v_item->>'voucher_tebus_item_id', '')::uuid;
    INSERT INTO public.order_items (order_id, menu_item_id, menu_item_name, quantity, unit_price, subtotal,
                                    package_choices, voucher_tebus_id)
    VALUES (v_order_id, NULLIF(v_item->>'menu_item_id', '')::uuid, v_item->>'menu_item_name',
            (v_item->>'quantity')::int, (v_item->>'unit_price')::numeric, (v_item->>'subtotal')::numeric,
            v_item->'package_choices', CASE WHEN v_tebus_item IS NOT NULL THEN p_tebus END)
    RETURNING id INTO v_oi;
    IF v_tebus_item IS NOT NULL THEN
      UPDATE retail.voucher_tebus_item SET order_item_id = v_oi WHERE id = v_tebus_item AND tebus_id = p_tebus;
    END IF;
  END LOOP;

  UPDATE retail.voucher_milik_slot SET status = 'terpakai'
   WHERE id IN (SELECT milik_slot_id FROM retail.voucher_tebus_item WHERE tebus_id = p_tebus);
  UPDATE retail.voucher_tebus SET status = 'aktif', order_id = v_order_id WHERE id = p_tebus;

  RETURN jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number);
END $$;

-- 3. lepas_tebus: batalkan tebus. 'menunggu' -> slot tersedia; 'aktif' -> tersedia bila belum kedaluwarsa, selain itu hangus.
CREATE OR REPLACE FUNCTION retail.lepas_tebus(p_tebus uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, retail AS $$
DECLARE v_milik uuid; v_t retail.voucher_tebus%ROWTYPE; v_ked timestamptz;
BEGIN
  SELECT milik_id INTO v_milik FROM retail.voucher_tebus WHERE id = p_tebus;
  IF v_milik IS NULL THEN RETURN jsonb_build_object('ok', false, 'kode', 'tidak_ditemukan'); END IF;
  -- Urutan kunci sama dengan tahan_tebus: milik dulu, baru tebus.
  SELECT kedaluwarsa_at INTO v_ked FROM retail.voucher_milik WHERE id = v_milik FOR UPDATE;
  SELECT * INTO v_t FROM retail.voucher_tebus WHERE id = p_tebus FOR UPDATE;
  IF v_t.status = 'dibatalkan' THEN RETURN jsonb_build_object('ok', true, 'sudah', true); END IF;

  UPDATE retail.voucher_milik_slot SET status = CASE
      WHEN v_t.status = 'menunggu' THEN 'tersedia'
      WHEN v_ked > now() THEN 'tersedia'
      ELSE 'hangus' END
   WHERE id IN (SELECT milik_slot_id FROM retail.voucher_tebus_item WHERE tebus_id = p_tebus);
  UPDATE retail.voucher_tebus SET status = 'dibatalkan' WHERE id = p_tebus;
  RETURN jsonb_build_object('ok', true);
END $$;

-- 4. Trigger: pesanan aplikasi dibatalkan di POS -> lepas tebus 'aktif'-nya.
CREATE OR REPLACE FUNCTION retail.batalkan_tebus_pesanan()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, retail AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM retail.voucher_tebus WHERE order_id = NEW.id AND status = 'aktif' LOOP
    PERFORM retail.lepas_tebus(r.id);
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_batalkan_tebus_pesanan ON public.orders;
CREATE TRIGGER trg_batalkan_tebus_pesanan
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' AND NEW.sales_source = 'app')
  EXECUTE FUNCTION retail.batalkan_tebus_pesanan();

REVOKE ALL ON FUNCTION retail.tahan_tebus(uuid, uuid, uuid, uuid, jsonb), retail.selesaikan_tebus(uuid, jsonb, jsonb),
  retail.lepas_tebus(uuid), retail.batalkan_tebus_pesanan() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION retail.tahan_tebus(uuid, uuid, uuid, uuid, jsonb), retail.selesaikan_tebus(uuid, jsonb, jsonb),
  retail.lepas_tebus(uuid) TO service_role;
```

- [ ] **Step 4: Jalankan uji — harus lulus**

```bash
supabase db query --linked "BEGIN; $(cat supabase/migrations/20260929200000_voucher_prabayar_tabel.sql) $(cat supabase/migrations/20260929205000_voucher_prabayar_order_items.sql) $(cat supabase/migrations/20260929210000_voucher_prabayar_rpc_paket_beli.sql) $(cat supabase/migrations/20260929215000_voucher_prabayar_payment_method.sql) $(cat supabase/migrations/20260929220000_voucher_prabayar_rpc_tebus.sql) $(cat supabase/verifikasi/voucher_prabayar/t4_tebus.sql)"
```
Expected: `HASIL T4: LULUS`. Uji (e3) adalah yang terpenting: ia membuktikan `total_amount` = Σ`subtotal`, artinya nilai slot tidak akan terbaca "Potongan" di laporan. Bila trigger BOM atau trigger lain di `orders`/`order_items` melempar galat saat `INSERT`, catat pesan lengkapnya dan hentikan: itu temuan yang harus dibawa ke owner sebelum lanjut.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260929220000_voucher_prabayar_rpc_tebus.sql supabase/verifikasi/voucher_prabayar/t4_tebus.sql
git commit -m "feat(voucher-prabayar): RPC tahan/selesaikan/lepas tebus + trigger batal"
```

---

### Task 6: Proses harian (hangus, lepas tahan yatim, pengingat)

**Files:**
- Create: `supabase/migrations/20260929230000_voucher_prabayar_harian.sql`
- Create: `supabase/verifikasi/voucher_prabayar/t5_harian.sql`

**Interfaces:**
- Produces: `retail.proses_voucher_harian() RETURNS jsonb` → `{ hangus, kadaluarsa_bayar, tahan_dilepas, pengingat }` (semua integer); jadwal pg_cron `voucher-prabayar-harian` pukul `0 1 * * *` UTC (08:00 WIB).

- [ ] **Step 1: Tulis uji**

```sql
-- t5_harian.sql — harapan "HASIL T5: LULUS". Butuh migration Task 2–6 dalam satu transaksi.
DO $$
DECLARE
  v_cust uuid; v_menu uuid; v_paket uuid; v_milik uuid; v_r jsonb; v_n int; v_hari int;
BEGIN
  SELECT id INTO v_cust FROM retail.customers ORDER BY created_at LIMIT 1;
  SELECT id INTO v_menu FROM public.menu_items WHERE tampil_di_app AND is_available LIMIT 1;
  v_paket := retail.simpan_paket(jsonb_build_object('nama','UJI T5','harga',20000,'tebus_hari',30,
    'slots', jsonb_build_array(jsonb_build_object('nama','A','jumlah',2,'nilai_per_unit',10000,'menu_ids',jsonb_build_array(v_menu)))));
  v_r := retail.beli_voucher_reserve(v_paket, v_cust, gen_random_uuid());
  v_milik := (v_r->>'milik_id')::uuid;
  PERFORM retail.beli_voucher_lunas(v_milik);

  -- (a) kedaluwarsa 3 hari lagi (tepat H-3 WIB) -> 1 pengingat; jalan lagi -> tak ganda
  UPDATE retail.voucher_milik SET kedaluwarsa_at = ((now() AT TIME ZONE 'Asia/Jakarta')::date + 3)::timestamp AT TIME ZONE 'Asia/Jakarta' + interval '12 hours' WHERE id = v_milik;
  v_r := retail.proses_voucher_harian();
  SELECT count(*) INTO v_n FROM retail.customer_notifications
   WHERE customer_id = v_cust AND type = 'reminder' AND data->>'voucher_milik_id' = v_milik::text AND data->>'hari' = '3';
  IF v_n <> 1 THEN RAISE EXCEPTION 'GAGAL (a1): pengingat H-3 = %', v_n; END IF;
  PERFORM retail.proses_voucher_harian();
  SELECT count(*) INTO v_n FROM retail.customer_notifications
   WHERE customer_id = v_cust AND type = 'reminder' AND data->>'voucher_milik_id' = v_milik::text AND data->>'hari' = '3';
  IF v_n <> 1 THEN RAISE EXCEPTION 'GAGAL (a2): pengingat ganda = %', v_n; END IF;

  -- (b) tanpa sisa slot -> tak ada pengingat H-1
  UPDATE retail.voucher_milik_slot SET status = 'terpakai' WHERE milik_id = v_milik;
  UPDATE retail.voucher_milik SET kedaluwarsa_at = ((now() AT TIME ZONE 'Asia/Jakarta')::date + 1)::timestamp AT TIME ZONE 'Asia/Jakarta' + interval '12 hours' WHERE id = v_milik;
  PERFORM retail.proses_voucher_harian();
  SELECT count(*) INTO v_n FROM retail.customer_notifications
   WHERE data->>'voucher_milik_id' = v_milik::text AND data->>'hari' = '1';
  IF v_n <> 0 THEN RAISE EXCEPTION 'GAGAL (b): pengingat untuk voucher tanpa sisa = %', v_n; END IF;

  -- (c) lewat batas -> sisa 'tersedia' jadi 'hangus', yang 'terpakai' tetap
  UPDATE retail.voucher_milik_slot SET status = 'tersedia' WHERE id = (SELECT id FROM retail.voucher_milik_slot WHERE milik_id = v_milik LIMIT 1);
  UPDATE retail.voucher_milik SET kedaluwarsa_at = now() - interval '1 hour' WHERE id = v_milik;
  v_r := retail.proses_voucher_harian();
  SELECT count(*) INTO v_n FROM retail.voucher_milik_slot WHERE milik_id = v_milik AND status = 'hangus';
  IF v_n <> 1 THEN RAISE EXCEPTION 'GAGAL (c1): hangus=%', v_n; END IF;
  SELECT count(*) INTO v_n FROM retail.voucher_milik_slot WHERE milik_id = v_milik AND status = 'terpakai';
  IF v_n <> 1 THEN RAISE EXCEPTION 'GAGAL (c2): terpakai=%', v_n; END IF;

  -- (d) pembelian belum dibayar yang lewat batas -> 'kadaluarsa'
  v_r := retail.beli_voucher_reserve(v_paket, v_cust, gen_random_uuid());
  UPDATE retail.voucher_milik SET bayar_expires_at = now() - interval '1 minute' WHERE id = (v_r->>'milik_id')::uuid;
  PERFORM retail.proses_voucher_harian();
  IF (SELECT status_bayar FROM retail.voucher_milik WHERE id = (v_r->>'milik_id')::uuid) <> 'kadaluarsa' THEN
    RAISE EXCEPTION 'GAGAL (d): pembelian tak dikadaluarsakan'; END IF;

  -- (e) jadwal pg_cron terpasang pada 0 1 * * *
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'voucher-prabayar-harian' AND schedule = '0 1 * * *') THEN
    RAISE EXCEPTION 'GAGAL (e): jadwal pg_cron tidak terpasang'; END IF;

  RAISE EXCEPTION 'HASIL T5: LULUS (pengingat sekali, tanpa sisa tak diingatkan, hangus, pembelian kedaluwarsa, cron)';
END $$;
```

- [ ] **Step 2: Jalankan uji sebelum migration — harus gagal** (`function retail.proses_voucher_harian() does not exist`).

- [ ] **Step 3: Tulis migration**

`supabase/migrations/20260929230000_voucher_prabayar_harian.sql`:

```sql
-- App Retail: voucher prabayar — proses harian (spec P4, P15). pg_cron berjalan dalam UTC:
-- '0 1 * * *' = 08:00 WIB. Pengingat: H-3 dan H-1, hanya untuk voucher yang masih punya slot 'tersedia'.
CREATE OR REPLACE FUNCTION retail.proses_voucher_harian()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, retail AS $$
DECLARE v_hangus int; v_bayar int; v_lepas int; v_ingat int;
BEGIN
  -- 1. Hangus: slot yang masih tersedia pada voucher yang lewat batas tebus.
  WITH u AS (
    UPDATE retail.voucher_milik_slot ms SET status = 'hangus'
     WHERE ms.status = 'tersedia'
       AND ms.milik_id IN (SELECT id FROM retail.voucher_milik WHERE status_bayar = 'lunas' AND kedaluwarsa_at <= now())
    RETURNING 1) SELECT count(*) INTO v_hangus FROM u;

  -- 2. Pembelian yang tak dibayar lewat batas 15 menit. Pembayaran yang datang terlambat tetap
  --    dihormati oleh beli_voucher_lunas (tidak membaca status ini).
  WITH u AS (
    UPDATE retail.voucher_milik SET status_bayar = 'kadaluarsa'
     WHERE status_bayar = 'menunggu_bayar' AND bayar_expires_at <= now() RETURNING 1)
  SELECT count(*) INTO v_bayar FROM u;

  -- 3. Tahan yatim: tebus 'menunggu' yang draft-nya sudah mati, atau tak punya draft dan sudah > 1 jam.
  SELECT count(*) INTO v_lepas FROM (
    SELECT retail.lepas_tebus(t.id) FROM retail.voucher_tebus t
     WHERE t.status = 'menunggu' AND (
       EXISTS (SELECT 1 FROM retail.order_drafts d WHERE d.tebus_id = t.id AND d.status IN ('kadaluarsa','gagal'))
       OR (NOT EXISTS (SELECT 1 FROM retail.order_drafts d WHERE d.tebus_id = t.id) AND t.dibuat_at < now() - interval '1 hour'))
  ) x;

  -- 4. Pengingat inbox H-3 dan H-1 (WIB), sekali per hari-H per voucher.
  WITH ins AS (
    INSERT INTO retail.customer_notifications (customer_id, order_id, type, title, body, data)
    SELECT m.customer_id, NULL, 'reminder', 'Voucher hampir berakhir',
           p.nama || ' berlaku sampai ' || to_char(m.kedaluwarsa_at AT TIME ZONE 'Asia/Jakarta', 'DD-MM-YYYY')
             || '. Masih ada ' || s.sisa || ' slot yang belum ditebus.',
           jsonb_build_object('voucher_milik_id', m.id, 'hari', h.hari, 'jenis', 'voucher_prabayar')
      FROM retail.voucher_milik m
      JOIN retail.voucher_paket p ON p.id = m.paket_id
      JOIN LATERAL (SELECT count(*) AS sisa FROM retail.voucher_milik_slot
                     WHERE milik_id = m.id AND status = 'tersedia') s ON true
      JOIN (VALUES (3), (1)) AS h(hari)
        ON ((m.kedaluwarsa_at AT TIME ZONE 'Asia/Jakarta')::date - (now() AT TIME ZONE 'Asia/Jakarta')::date) = h.hari
     WHERE m.status_bayar = 'lunas' AND m.kedaluwarsa_at > now() AND s.sisa > 0
       AND NOT EXISTS (SELECT 1 FROM retail.customer_notifications n
                        WHERE n.customer_id = m.customer_id AND n.type = 'reminder'
                          AND n.data->>'voucher_milik_id' = m.id::text AND n.data->>'hari' = h.hari::text)
    RETURNING 1)
  SELECT count(*) INTO v_ingat FROM ins;

  RETURN jsonb_build_object('hangus', v_hangus, 'kadaluarsa_bayar', v_bayar, 'tahan_dilepas', v_lepas, 'pengingat', v_ingat);
END $$;

REVOKE ALL ON FUNCTION retail.proses_voucher_harian() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION retail.proses_voucher_harian() TO service_role;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'voucher-prabayar-harian';
SELECT cron.schedule('voucher-prabayar-harian', '0 1 * * *', $$SELECT retail.proses_voucher_harian();$$);

-- DOWN (manual): SELECT cron.unschedule('voucher-prabayar-harian');
```

- [ ] **Step 4: Jalankan uji dengan migration Task 2–6 dalam satu transaksi — harus lulus**

```bash
supabase db query --linked "BEGIN; $(cat supabase/migrations/20260929200000_voucher_prabayar_tabel.sql) $(cat supabase/migrations/20260929205000_voucher_prabayar_order_items.sql) $(cat supabase/migrations/20260929210000_voucher_prabayar_rpc_paket_beli.sql) $(cat supabase/migrations/20260929215000_voucher_prabayar_payment_method.sql) $(cat supabase/migrations/20260929220000_voucher_prabayar_rpc_tebus.sql) $(cat supabase/migrations/20260929230000_voucher_prabayar_harian.sql) $(cat supabase/verifikasi/voucher_prabayar/t5_harian.sql)"
```
Expected: `HASIL T5: LULUS`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260929230000_voucher_prabayar_harian.sql supabase/verifikasi/voucher_prabayar/t5_harian.sql
git commit -m "feat(voucher-prabayar): proses harian hangus, tahan yatim, pengingat + jadwal cron"
```

---

### Task 7: Fungsi murni gateway (`lib/voucherPrabayar.ts`)

**Files:**
- Create: `apps/retail-gateway/src/lib/voucherPrabayar.ts`
- Test: `apps/retail-gateway/src/lib/voucherPrabayar.test.ts`

**Interfaces:**
- Consumes: `ItemPesanan` (`./pricing`), `susunPayloadPos` (`./orderPayload`).
- Produces:
  - `estimasiFee(harga: number): number`
  - `type PilihanSlot = { slot_id: string; menu_item_id: string }`
  - `validasiPilihan(mentah: unknown): PilihanSlot[] | null`
  - `kodeGalatDb(pesan: string | null | undefined): string | null`
  - `pesanGalat(kode: string): string`
  - `periksaPilihan(input: { pilihan: PilihanSlot[]; tersediaPerSlot: Record<string, number>; menuPerSlot: Record<string, string[]>; katalog: Array<{ id: string; name: string; is_available: boolean }> }): { ok: true; items: ItemVoucherPilih[] } | { ok: false; kode: 'slot_habis' | 'menu_tidak_valid' | 'menu_habis_outlet' }`
  - `type ItemVoucherPilih = { slot_id: string; menu_item_id: string; name: string }`
  - `type ItemVoucherTebus = { menu_item_id: string; name: string; nilai: number; tebus_item_id: string }`
  - `susunPayloadTebus(input: { clientOrderId: string; outletId: string; customerName: string; customerPhone: string | null; itemsBiasa: ItemPesanan[]; itemsVoucher: ItemVoucherTebus[]; ditagih: number }): { p_order: Record<string, unknown>; p_items: Record<string, unknown>[]; total: number }`

- [ ] **Step 1: Tulis test yang gagal**

`apps/retail-gateway/src/lib/voucherPrabayar.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  estimasiFee, validasiPilihan, kodeGalatDb, pesanGalat, periksaPilihan, susunPayloadTebus,
} from './voucherPrabayar'

const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'
const M1 = '33333333-3333-4333-8333-333333333333'
const M2 = '44444444-4444-4444-8444-444444444444'

describe('estimasiFee', () => {
  it('0,7% dari harga beli, dibulatkan dua desimal', () => {
    expect(estimasiFee(100000)).toBe(700)
    expect(estimasiFee(25000)).toBe(175)
    expect(estimasiFee(12345)).toBe(86.42)
  })
})

describe('validasiPilihan', () => {
  it('menerima daftar {slot_id, menu_item_id} yang berbentuk uuid', () => {
    expect(validasiPilihan([{ slot_id: U1, menu_item_id: M1 }])).toEqual([{ slot_id: U1, menu_item_id: M1 }])
  })
  it('menolak yang bukan array, kosong, terlalu banyak, atau bukan uuid', () => {
    expect(validasiPilihan(null)).toBeNull()
    expect(validasiPilihan([])).toBeNull()
    expect(validasiPilihan([{ slot_id: 'x', menu_item_id: M1 }])).toBeNull()
    expect(validasiPilihan([{ slot_id: U1 }])).toBeNull()
    expect(validasiPilihan(Array.from({ length: 51 }, () => ({ slot_id: U1, menu_item_id: M1 })))).toBeNull()
  })
})

describe('kodeGalatDb', () => {
  it('mengambil kode dari pesan RAISE EXCEPTION', () => {
    expect(kodeGalatDb('voucher_prabayar:slot_habis')).toBe('slot_habis')
    expect(kodeGalatDb('xx voucher_prabayar:menu_tidak_valid (context)')).toBe('menu_tidak_valid')
  })
  it('null untuk galat lain', () => {
    expect(kodeGalatDb('duplicate key')).toBeNull()
    expect(kodeGalatDb(undefined)).toBeNull()
  })
  it('pesanGalat memberi kalimat Indonesia dan cadangan umum', () => {
    expect(pesanGalat('slot_habis')).toMatch(/slot/i)
    expect(pesanGalat('kode_tak_dikenal')).toBe('Voucher tidak dapat diproses')
  })
})

describe('periksaPilihan', () => {
  const katalog = [
    { id: M1, name: 'Ayam Reguler', is_available: true },
    { id: M2, name: 'Es Teh', is_available: true },
  ]
  const dasar = {
    tersediaPerSlot: { [U1]: 2, [U2]: 1 },
    menuPerSlot: { [U1]: [M1], [U2]: [M2] },
    katalog,
  }
  it('meloloskan pilihan yang sah dan memberi nama dari katalog', () => {
    const h = periksaPilihan({ ...dasar, pilihan: [{ slot_id: U1, menu_item_id: M1 }, { slot_id: U2, menu_item_id: M2 }] })
    expect(h).toEqual({ ok: true, items: [
      { slot_id: U1, menu_item_id: M1, name: 'Ayam Reguler' },
      { slot_id: U2, menu_item_id: M2, name: 'Es Teh' }] })
  })
  it('slot_habis bila meminta lebih dari sisa', () => {
    const h = periksaPilihan({ ...dasar, pilihan: [{ slot_id: U2, menu_item_id: M2 }, { slot_id: U2, menu_item_id: M2 }] })
    expect(h).toEqual({ ok: false, kode: 'slot_habis' })
  })
  it('menu_tidak_valid bila menu bukan bagian slot', () => {
    expect(periksaPilihan({ ...dasar, pilihan: [{ slot_id: U1, menu_item_id: M2 }] })).toEqual({ ok: false, kode: 'menu_tidak_valid' })
  })
  it('menu_habis_outlet bila menu tak ada di katalog atau tak tersedia', () => {
    const habis = katalog.map((m) => (m.id === M1 ? { ...m, is_available: false } : m))
    expect(periksaPilihan({ ...dasar, katalog: habis, pilihan: [{ slot_id: U1, menu_item_id: M1 }] })).toEqual({ ok: false, kode: 'menu_habis_outlet' })
    expect(periksaPilihan({ ...dasar, katalog: [], pilihan: [{ slot_id: U1, menu_item_id: M1 }] })).toEqual({ ok: false, kode: 'menu_habis_outlet' })
  })
  it('slot yang tak dikenal dianggap slot_habis', () => {
    expect(periksaPilihan({ ...dasar, pilihan: [{ slot_id: M1, menu_item_id: M1 }] })).toEqual({ ok: false, kode: 'slot_habis' })
  })
})

describe('susunPayloadTebus', () => {
  const base = {
    clientOrderId: U1, outletId: U2, customerName: 'Budi', customerPhone: null,
    itemsVoucher: [
      { menu_item_id: M1, name: 'Ayam Reguler', nilai: 30000, tebus_item_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      { menu_item_id: M2, name: 'Es Teh', nilai: 10000, tebus_item_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    ],
  }
  it('tebus murni: total_amount = nilai penuh, metode bayar voucher, tanpa diskon', () => {
    const h = susunPayloadTebus({ ...base, itemsBiasa: [], ditagih: 0 })
    expect(h.total).toBe(40000)
    expect(h.p_order.total_amount).toBe(40000)
    expect(h.p_order.discount_amount).toBe(0)
    expect(h.p_order.payment_method).toBe('voucher')
    expect(h.p_order.sales_source).toBe('app')
  })
  it('campur: total_amount penuh (voucher + tambahan), metode qris', () => {
    const h = susunPayloadTebus({
      ...base, ditagih: 12000,
      itemsBiasa: [{ menu_item_id: M1, name: 'Kentang', unit_price: 12000, quantity: 1 }],
    })
    expect(h.total).toBe(52000)
    expect(h.p_order.total_amount).toBe(52000)
    expect(h.p_order.payment_method).toBe('qris')
  })
  it('item voucher bertanda, berharga nilai slot, berlabel Voucher; item biasa tanpa penanda', () => {
    const h = susunPayloadTebus({
      ...base, ditagih: 12000,
      itemsBiasa: [{ menu_item_id: M1, name: 'Kentang', unit_price: 12000, quantity: 1 }],
    })
    const voucher = h.p_items.filter((i) => 'voucher_tebus_item_id' in i)
    expect(voucher).toHaveLength(2)
    expect(voucher[0]).toMatchObject({ unit_price: 30000, subtotal: 30000, quantity: 1, menu_item_name: 'Ayam Reguler|NOTE|Voucher' })
    const biasa = h.p_items.filter((i) => !('voucher_tebus_item_id' in i))
    expect(biasa).toHaveLength(1)
    // Σ subtotal harus sama dengan total_amount, kalau tidak nilai slot terbaca sebagai Potongan.
    const jumlah = h.p_items.reduce((n, i) => n + Number(i.subtotal), 0)
    expect(jumlah).toBe(h.p_order.total_amount)
  })
})
```

- [ ] **Step 2: Jalankan — harus gagal**

```bash
yarn workspace @suka/retail-gateway vitest run src/lib/voucherPrabayar.test.ts
```
Expected: FAIL `Failed to resolve import "./voucherPrabayar"`.

- [ ] **Step 3: Implementasi minimal**

`apps/retail-gateway/src/lib/voucherPrabayar.ts`:

```ts
import type { ItemPesanan } from './pricing'
import { susunPayloadPos } from './orderPayload'

/** Estimasi fee Xendit saat angka riil belum tersedia (spec §7b.6). */
export const FEE_ESTIMASI_PERSEN = 0.007
export const PREFIKS_GALAT = 'voucher_prabayar:'
const MAKS_PILIHAN = 50
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function estimasiFee(harga: number): number {
  return Math.round(harga * FEE_ESTIMASI_PERSEN * 100) / 100
}

export type PilihanSlot = { slot_id: string; menu_item_id: string }

/** Bentuk saja. Yang sah atau tidaknya menu/slot diputuskan server (periksaPilihan + RPC). */
export function validasiPilihan(mentah: unknown): PilihanSlot[] | null {
  if (!Array.isArray(mentah) || mentah.length === 0 || mentah.length > MAKS_PILIHAN) return null
  const hasil: PilihanSlot[] = []
  for (const p of mentah) {
    if (typeof p !== 'object' || p === null) return null
    const { slot_id, menu_item_id } = p as Record<string, unknown>
    if (typeof slot_id !== 'string' || typeof menu_item_id !== 'string') return null
    if (!UUID.test(slot_id) || !UUID.test(menu_item_id)) return null
    hasil.push({ slot_id, menu_item_id })
  }
  return hasil
}

/** Mengambil kode dari `RAISE EXCEPTION 'voucher_prabayar:<kode>'`. */
export function kodeGalatDb(pesan: string | null | undefined): string | null {
  if (!pesan) return null
  const i = pesan.indexOf(PREFIKS_GALAT)
  if (i < 0) return null
  const cocok = pesan.slice(i + PREFIKS_GALAT.length).match(/^[a-z_]+/)
  return cocok ? cocok[0] : null
}

const PESAN: Record<string, string> = {
  paket_tidak_tersedia: 'Voucher ini tidak tersedia',
  belum_dibuka: 'Penjualan voucher ini belum dibuka',
  sudah_ditutup: 'Penjualan voucher ini sudah ditutup',
  kuota_habis: 'Voucher ini sudah habis terjual',
  batas_pelanggan: 'Anda sudah mencapai batas pembelian voucher ini',
  tidak_sah: 'Voucher tidak ditemukan',
  belum_lunas: 'Voucher belum aktif karena pembayaran belum selesai',
  kedaluwarsa: 'Voucher sudah melewati batas tebus',
  pilihan_kosong: 'Pilih minimal satu slot untuk ditebus',
  slot_habis: 'Jatah slot yang Anda pilih sudah tidak cukup',
  menu_tidak_valid: 'Menu yang dipilih bukan bagian dari slot ini',
  menu_habis_outlet: 'Ada menu yang sedang tidak tersedia di outlet ini. Coba outlet lain atau pilih menu lain.',
  tebus_tidak_aktif: 'Penebusan ini sudah tidak berlaku',
  voucher_dan_tebus: 'Voucher diskon tidak bisa digabung dengan penebusan voucher prabayar',
}
export function pesanGalat(kode: string): string {
  return PESAN[kode] ?? 'Voucher tidak dapat diproses'
}

export type ItemVoucherPilih = { slot_id: string; menu_item_id: string; name: string }

export type HasilPeriksaPilihan =
  | { ok: true; items: ItemVoucherPilih[] }
  | { ok: false; kode: 'slot_habis' | 'menu_tidak_valid' | 'menu_habis_outlet' }

/**
 * Pemeriksaan murni di gateway SEBELUM menahan slot, supaya pelanggan mendapat
 * pesan yang jelas. Yang menentukan tetap RPC `tahan_tebus` (di bawah kunci baris).
 */
export function periksaPilihan(input: {
  pilihan: PilihanSlot[]
  tersediaPerSlot: Record<string, number>
  menuPerSlot: Record<string, string[]>
  katalog: Array<{ id: string; name: string; is_available: boolean }>
}): HasilPeriksaPilihan {
  const dipakai: Record<string, number> = {}
  const peta = new Map(input.katalog.map((m) => [m.id, m]))
  const items: ItemVoucherPilih[] = []
  for (const p of input.pilihan) {
    if (!(p.slot_id in input.tersediaPerSlot)) return { ok: false, kode: 'slot_habis' }
    if (!(input.menuPerSlot[p.slot_id] ?? []).includes(p.menu_item_id)) return { ok: false, kode: 'menu_tidak_valid' }
    dipakai[p.slot_id] = (dipakai[p.slot_id] ?? 0) + 1
    if (dipakai[p.slot_id] > input.tersediaPerSlot[p.slot_id]) return { ok: false, kode: 'slot_habis' }
    const m = peta.get(p.menu_item_id)
    if (!m || !m.is_available) return { ok: false, kode: 'menu_habis_outlet' }
    items.push({ slot_id: p.slot_id, menu_item_id: p.menu_item_id, name: m.name })
  }
  return { ok: true, items }
}

export type ItemVoucherTebus = { menu_item_id: string; name: string; nilai: number; tebus_item_id: string }

/**
 * Argumen untuk RPC `retail.selesaikan_tebus`.
 *
 * `total_amount` = Σ subtotal PENUH (voucher + tambahan). Semua laporan menghitung
 * `Potongan = MAX(0, Σsubtotal − total_amount)`; kalau total_amount hanya yang ditagih,
 * nilai slot akan terbaca sebagai Potongan. `ditagih` (yang dibayar Xendit) hanya
 * menentukan metode bayar.
 */
export function susunPayloadTebus(input: {
  clientOrderId: string
  outletId: string
  customerName: string
  customerPhone: string | null
  itemsBiasa: ItemPesanan[]
  itemsVoucher: ItemVoucherTebus[]
  ditagih: number
}): { p_order: Record<string, unknown>; p_items: Record<string, unknown>[]; total: number } {
  const subtotalBiasa = input.itemsBiasa.reduce((n, it) => n + it.unit_price * it.quantity, 0)
  const subtotalVoucher = input.itemsVoucher.reduce((n, it) => n + it.nilai, 0)
  const total = subtotalBiasa + subtotalVoucher

  const dasar = susunPayloadPos({
    clientOrderId: input.clientOrderId,
    outletId: input.outletId,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    items: input.itemsBiasa,
    subtotal: total,
    discountAmount: 0,
    total,
  })

  const p_order = {
    ...dasar.p_order,
    total_amount: total,
    discount_amount: 0,
    payment_method: input.ditagih > 0 ? 'qris' : 'voucher',
    notes: 'Pesanan aplikasi (tebus voucher)',
  }
  const p_items = [
    ...dasar.p_items,
    ...input.itemsVoucher.map((v) => ({
      menu_item_id: v.menu_item_id,
      menu_item_name: `${v.name}|NOTE|Voucher`,
      quantity: 1,
      unit_price: v.nilai,
      subtotal: v.nilai,
      package_choices: null,
      voucher_tebus_item_id: v.tebus_item_id,
    })),
  ]
  return { p_order, p_items, total }
}
```

- [ ] **Step 4: Jalankan test — harus lulus**

```bash
yarn workspace @suka/retail-gateway vitest run src/lib/voucherPrabayar.test.ts
yarn workspace @suka/retail-gateway type-check
```
Expected: semua test PASS, type-check 0 error.

- [ ] **Step 5: Commit**

```bash
git add apps/retail-gateway/src/lib/voucherPrabayar.ts apps/retail-gateway/src/lib/voucherPrabayar.test.ts
git commit -m "feat(retail-gateway): fungsi murni voucher prabayar (fee, pilihan, payload tebus)"
```

---

### Task 8: Pembungkus DB gateway dan rute beli / daftar

**Files:**
- Create: `apps/retail-gateway/src/lib/voucherPrabayarDb.ts`
- Create: `apps/retail-gateway/src/app/api/v1/voucher-paket/route.ts`
- Create: `apps/retail-gateway/src/app/api/v1/voucher-paket/[id]/beli/route.ts`
- Create: `apps/retail-gateway/src/app/api/v1/voucher-saya/route.ts`
- Modify: `apps/retail-gateway/src/app/api/webhooks/xendit/route.ts` (cabang pembelian voucher)

**Interfaces:**
- Consumes: `createRetailClient`, `createServiceClient` (`@/lib/supabase`), `requireCustomer`, `buatQris`/`buatTagihan`, `estimasiFee`, `kodeGalatDb`, `pesanGalat`, `periksaPilihan`, `type PilihanSlot`.
- Produces (di `voucherPrabayarDb.ts`; `RetailClient = ReturnType<typeof createRetailClient>`):
  - `daftarPaketDijual(retail, sekarang: Date): Promise<PaketDijual[]>`, `type PaketDijual = { id; nama; deskripsi: string|null; harga: number; beli_selesai: string|null; tebus_sampai: string|null; tebus_hari: number|null; sisa_kuota: number|null; slots: Array<{ id: string; nama: string; jumlah: number; menu_ids: string[] }> }`
  - `voucherSaya(retail, customerId): Promise<VoucherSaya[]>`, `type VoucherSaya = { id; paket_id; nama; deskripsi: string|null; kedaluwarsa_at: string; slots: Array<{ slot_id: string; nama: string; total: number; tersedia: number; ditahan: number; terpakai: number; hangus: number }> }`
  - `reserveBeli(retail, paketId, customerId, clientBeliId): Promise<{ ok: true; milik_id: string; ada: boolean; status_bayar: string } | { ok: false; kode: string }>`
  - `lunasBeli(retail, milikId): Promise<{ ok: boolean; sudah?: boolean }>`
  - `tahanTebus`, `selesaikanTebus`, `lepasTebus`, `ambilItemTebus`, `periksaTebus` (ditambah di Task 9).

- [ ] **Step 1: Tulis `voucherPrabayarDb.ts` (bagian paket, beli, saya)**

```ts
import type { createRetailClient } from './supabase'
import { estimasiFee } from './voucherPrabayar'

type RetailClient = ReturnType<typeof createRetailClient>

export type PaketDijual = {
  id: string
  nama: string
  deskripsi: string | null
  harga: number
  beli_selesai: string | null
  tebus_sampai: string | null
  tebus_hari: number | null
  sisa_kuota: number | null
  slots: Array<{ id: string; nama: string; jumlah: number; menu_ids: string[] }>
}

/**
 * Paket yang sedang dijual. Nilai rupiah per slot SENGAJA tidak ikut dikirim:
 * pelanggan memiliki jatah item, bukan saldo rupiah (spec §1).
 */
export async function daftarPaketDijual(retail: RetailClient, sekarang: Date): Promise<PaketDijual[]> {
  const iso = sekarang.toISOString()
  const { data, error } = await retail
    .from('voucher_paket')
    .select(
      'id, nama, deskripsi, harga, beli_mulai, beli_selesai, tebus_sampai, tebus_hari, kuota_total, ' +
      'voucher_paket_slot(id, urut, nama, jumlah, voucher_paket_slot_menu(menu_item_id))'
    )
    .eq('is_active', true)
    .or(`beli_mulai.is.null,beli_mulai.lte.${iso}`)
    .or(`beli_selesai.is.null,beli_selesai.gt.${iso}`)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  const paket = (data ?? []) as unknown as Array<Record<string, any>>

  const idKuota = paket.filter((p) => p.kuota_total !== null).map((p) => p.id as string)
  const terjual = new Map<string, number>()
  if (idKuota.length > 0) {
    const { data: t, error: e2 } = await retail.from('voucher_paket_terjual').select('paket_id, terjual').in('paket_id', idKuota)
    if (e2) throw new Error(e2.message)
    for (const r of (t ?? []) as Array<{ paket_id: string; terjual: number }>) terjual.set(r.paket_id, r.terjual)
  }

  const hasil: PaketDijual[] = []
  for (const p of paket) {
    const slots = ((p.voucher_paket_slot ?? []) as Array<Record<string, any>>)
      .sort((a, b) => a.urut - b.urut)
      .map((s) => ({
        id: s.id as string, nama: s.nama as string, jumlah: Number(s.jumlah),
        menu_ids: ((s.voucher_paket_slot_menu ?? []) as Array<{ menu_item_id: string }>).map((m) => m.menu_item_id),
      }))
    if (slots.length === 0) continue
    const sisa = p.kuota_total === null ? null : Math.max(0, Number(p.kuota_total) - (terjual.get(p.id) ?? 0))
    if (sisa === 0) continue
    hasil.push({
      id: p.id, nama: p.nama, deskripsi: p.deskripsi ?? null, harga: Number(p.harga),
      beli_selesai: p.beli_selesai ?? null, tebus_sampai: p.tebus_sampai ?? null,
      tebus_hari: p.tebus_hari === null ? null : Number(p.tebus_hari), sisa_kuota: sisa, slots,
    })
  }
  return hasil
}

export type VoucherSaya = {
  id: string
  paket_id: string
  nama: string
  deskripsi: string | null
  kedaluwarsa_at: string
  slots: Array<{ slot_id: string; nama: string; total: number; tersedia: number; ditahan: number; terpakai: number; hangus: number }>
}

export async function voucherSaya(retail: RetailClient, customerId: string): Promise<VoucherSaya[]> {
  const { data, error } = await retail
    .from('voucher_milik')
    .select('id, paket_id, kedaluwarsa_at, voucher_paket(nama, deskripsi), voucher_milik_slot(slot_id, status)')
    .eq('customer_id', customerId)
    .eq('status_bayar', 'lunas')
    .order('lunas_at', { ascending: false })
  if (error) throw new Error(error.message)
  const milik = (data ?? []) as unknown as Array<Record<string, any>>
  const idPaket = [...new Set(milik.map((m) => m.paket_id as string))]
  const namaSlot = new Map<string, string>()
  if (idPaket.length > 0) {
    const { data: s, error: e2 } = await retail.from('voucher_paket_slot').select('id, nama').in('paket_id', idPaket)
    if (e2) throw new Error(e2.message)
    for (const r of (s ?? []) as Array<{ id: string; nama: string }>) namaSlot.set(r.id, r.nama)
  }
  return milik.map((m) => {
    const per = new Map<string, VoucherSaya['slots'][number]>()
    for (const u of (m.voucher_milik_slot ?? []) as Array<{ slot_id: string; status: string }>) {
      const s = per.get(u.slot_id) ?? { slot_id: u.slot_id, nama: namaSlot.get(u.slot_id) ?? 'Slot', total: 0, tersedia: 0, ditahan: 0, terpakai: 0, hangus: 0 }
      s.total += 1
      if (u.status === 'tersedia' || u.status === 'ditahan' || u.status === 'terpakai' || u.status === 'hangus') s[u.status] += 1
      per.set(u.slot_id, s)
    }
    const paket = Array.isArray(m.voucher_paket) ? m.voucher_paket[0] : m.voucher_paket
    return {
      id: m.id, paket_id: m.paket_id, nama: paket?.nama ?? 'Voucher', deskripsi: paket?.deskripsi ?? null,
      kedaluwarsa_at: m.kedaluwarsa_at, slots: [...per.values()],
    }
  })
}

export async function reserveBeli(
  retail: RetailClient, paketId: string, customerId: string, clientBeliId: string,
): Promise<{ ok: true; milik_id: string; ada: boolean; status_bayar: string } | { ok: false; kode: string }> {
  const { data, error } = await retail.rpc('beli_voucher_reserve', {
    p_paket: paketId, p_customer: customerId, p_client_beli: clientBeliId,
  })
  if (error) throw new Error(error.message)
  return data as never
}

export async function lunasBeli(retail: RetailClient, milikId: string): Promise<{ ok: boolean; sudah?: boolean }> {
  // Angka fee riil belum tersedia dari webhook (spec §7b.6): biarkan RPC memakai estimasi 0,7%.
  void estimasiFee
  const { data, error } = await retail.rpc('beli_voucher_lunas', { p_milik: milikId })
  if (error) throw new Error(error.message)
  return data as never
}
```
Catatan: baris `void estimasiFee` sengaja dihapus bila impor tak dipakai lagi (estimasi dihitung di SQL). Hapus impor dan baris itu sebelum commit bila type-check/lint mengeluh.

- [ ] **Step 2: Rute `GET /voucher-paket`**

`apps/retail-gateway/src/app/api/v1/voucher-paket/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/auth'
import { createRetailClient } from '@/lib/supabase'
import { daftarPaketDijual } from '@/lib/voucherPrabayarDb'

export const dynamic = 'force-dynamic'

/** Paket voucher prabayar yang sedang dijual. Tanpa cache: kuota berubah tiap pembelian. */
export async function GET(request: Request) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })
  try {
    const paket = await daftarPaketDijual(createRetailClient(), new Date())
    return NextResponse.json({ paket })
  } catch (e) {
    console.error('gagal memuat paket voucher', e)
    return NextResponse.json({ error: 'Gagal memuat voucher' }, { status: 502 })
  }
}
```

- [ ] **Step 3: Rute `GET /voucher-saya`**

`apps/retail-gateway/src/app/api/v1/voucher-saya/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/auth'
import { createRetailClient } from '@/lib/supabase'
import { voucherSaya } from '@/lib/voucherPrabayarDb'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })
  try {
    const voucher = await voucherSaya(createRetailClient(), sesi.customerId)
    return NextResponse.json({ voucher })
  } catch (e) {
    console.error('gagal memuat voucher pelanggan', e)
    return NextResponse.json({ error: 'Gagal memuat voucher' }, { status: 502 })
  }
}
```

- [ ] **Step 4: Rute `POST /voucher-paket/[id]/beli`**

`apps/retail-gateway/src/app/api/v1/voucher-paket/[id]/beli/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/auth'
import { createRetailClient } from '@/lib/supabase'
import { buatQris, buatTagihan } from '@/lib/xendit'
import { reserveBeli } from '@/lib/voucherPrabayarDb'
import { pesanGalat } from '@/lib/voucherPrabayar'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })
  const { id: paketId } = await params
  if (!UUID.test(paketId)) return NextResponse.json({ error: 'Voucher tidak ditemukan' }, { status: 404 })

  let body: { client_beli_id?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 }) }
  if (!body.client_beli_id || !UUID.test(body.client_beli_id)) {
    return NextResponse.json({ error: 'client_beli_id wajib diisi' }, { status: 400 })
  }

  const retail = createRetailClient()
  let r
  try {
    r = await reserveBeli(retail, paketId, sesi.customerId, body.client_beli_id)
  } catch (e) {
    console.error('gagal memesan voucher', e)
    return NextResponse.json({ error: 'Gagal memproses pembelian' }, { status: 502 })
  }
  if (!r.ok) {
    return NextResponse.json({ error: 'voucher_tidak_bisa_dibeli', alasan: r.kode, pesan: pesanGalat(r.kode) }, { status: 409 })
  }

  const { data: milik, error: mErr } = await retail
    .from('voucher_milik')
    .select('id, status_bayar, harga_dibayar, payment_url, qr_string, bayar_expires_at')
    .eq('id', r.milik_id)
    .single()
  if (mErr || !milik) {
    console.error('gagal membaca voucher_milik', mErr)
    return NextResponse.json({ error: 'Gagal memproses pembelian' }, { status: 502 })
  }

  if (milik.status_bayar === 'lunas') return NextResponse.json({ milik_id: milik.id, status: 'lunas', duplicate: true })
  if (milik.status_bayar !== 'menunggu_bayar') {
    return NextResponse.json({ error: 'pesanan_kadaluarsa', pesan: 'Pembelian sebelumnya sudah kedaluwarsa. Silakan beli lagi.' }, { status: 409 })
  }
  // Tagihan sudah pernah dibuat: kembalikan yang sama, jangan membuat tagihan kedua.
  if (milik.qr_string || milik.payment_url) {
    return NextResponse.json({
      milik_id: milik.id, payment_url: milik.payment_url, qr_string: milik.qr_string,
      total_amount: Number(milik.harga_dibayar), expires_at: milik.bayar_expires_at, duplicate: true,
    })
  }
  if (r.ada) {
    // Reservasi ada tapi tagihannya belum tercatat: proses lain sedang membuatnya.
    return NextResponse.json({ error: 'pesanan_sedang_diproses', pesan: 'Pembelian sedang diproses, coba lagi sebentar.' }, { status: 409 })
  }

  const harga = Number(milik.harga_dibayar)
  let tagihan
  try {
    tagihan = await buatQris({ externalId: body.client_beli_id, amount: harga })
  } catch (eQris) {
    console.error('QR Code API gagal, jatuh ke Invoice:', eQris)
    try {
      tagihan = await buatTagihan({
        externalId: body.client_beli_id, amount: harga, description: 'Voucher SukaShawarma', customerName: 'Pelanggan',
      })
    } catch (e) {
      console.error('Gagal membuat tagihan voucher', e)
      await retail.from('voucher_milik').update({ status_bayar: 'gagal' }).eq('id', milik.id)
      return NextResponse.json({ error: 'Gagal membuat tagihan pembayaran' }, { status: 502 })
    }
  }

  const { error: upErr } = await retail
    .from('voucher_milik')
    .update({ payment_ref: tagihan.ref, payment_url: tagihan.url, qr_string: tagihan.qrString })
    .eq('id', milik.id)
  if (upErr) console.error('GAGAL MENCATAT TAGIHAN KE VOUCHER_MILIK', { milik_id: milik.id, payment_ref: tagihan.ref, error: upErr })

  return NextResponse.json({
    milik_id: milik.id, payment_url: tagihan.url, qr_string: tagihan.qrString,
    total_amount: harga, expires_at: milik.bayar_expires_at,
  })
}
```

- [ ] **Step 5: Webhook — cabang pembelian voucher**

Di `apps/retail-gateway/src/app/api/webhooks/xendit/route.ts`, ganti blok `if (!draft) { … }` (baris 41–44) dengan:

```ts
  if (!draft) {
    // Bukan pesanan: mungkin pembelian voucher prabayar (externalId = client_beli_id).
    const { data: milik } = await retail
      .from('voucher_milik')
      .select('id, customer_id, status_bayar')
      .eq('client_beli_id', peristiwa.externalId)
      .maybeSingle()
    if (!milik) {
      console.error('Webhook untuk pesanan yang tidak dikenal:', peristiwa.externalId)
      return NextResponse.json({ diabaikan: true })
    }
    if (peristiwa.status === 'gagal') {
      if (milik.status_bayar === 'menunggu_bayar') {
        await retail.from('voucher_milik').update({ status_bayar: 'gagal' }).eq('id', milik.id)
      }
      return NextResponse.json({ ok: true })
    }
    // Lunas: SELALU dihormati, juga bila status sebelumnya gagal/kadaluarsa (uang sudah masuk).
    try {
      const hasil = await lunasBeli(retail, milik.id)
      if (!hasil.ok) throw new Error('beli_voucher_lunas menolak')
    } catch (e) {
      // 500 supaya Xendit mengirim ulang; RPC idempoten.
      console.error('GAGAL MENERBITKAN VOUCHER PRABAYAR', { milik_id: milik.id, error: e })
      return NextResponse.json({ error: 'Gagal menerbitkan voucher' }, { status: 500 })
    }
    await insertCustomerNotification(retail, {
      customerId: milik.customer_id, orderId: null, type: 'system',
      title: 'Voucher berhasil dibeli 🎟️', body: 'Voucher Anda sudah aktif. Lihat di halaman Voucher.',
      data: { voucher_milik_id: milik.id, jenis: 'voucher_prabayar' },
    }).catch((err) => console.warn('Gagal mencatat notifikasi voucher:', err))
    return NextResponse.json({ ok: true, voucher: true })
  }
```
dan tambahkan impor di bagian atas berkas: `import { lunasBeli } from '@/lib/voucherPrabayarDb'`.

- [ ] **Step 6: Type-check dan test**

```bash
yarn workspace @suka/retail-gateway type-check
yarn workspace @suka/retail-gateway test
```
Expected: type-check 0 error, seluruh test lulus (test yang sudah ada tidak boleh rusak).

- [ ] **Step 7: Commit**

```bash
git add apps/retail-gateway/src
git commit -m "feat(retail-gateway): rute daftar/beli/saya voucher prabayar + webhook pembelian"
```

---

### Task 9: Jalur tebus di gateway (validate, orders, webhook, expire-drafts)

**Files:**
- Modify: `apps/retail-gateway/src/lib/voucherPrabayarDb.ts` (tambah pembungkus tebus)
- Modify: `apps/retail-gateway/src/app/api/v1/checkout/validate/route.ts`
- Modify: `apps/retail-gateway/src/app/api/v1/orders/route.ts`
- Modify: `apps/retail-gateway/src/app/api/webhooks/xendit/route.ts`
- Modify: `apps/retail-gateway/src/app/api/cron/expire-drafts/route.ts`

**Interfaces:**
- Consumes: Task 7 (`periksaPilihan`, `susunPayloadTebus`, `validasiPilihan`, `kodeGalatDb`, `pesanGalat`), Task 8 (`voucherPrabayarDb.ts`), RPC Task 5.
- Produces (di `voucherPrabayarDb.ts`):
  - `periksaTebus(retail, input: { customerId; milikId; pilihan: PilihanSlot[]; katalog: MenuApp[]; sekarang: Date }): Promise<{ ok: true; items: ItemVoucherPilih[] } | { ok: false; kode: string }>`
  - `tahanTebus(retail, input: { milikId; customerId; outletId; clientOrderId; pilihan: PilihanSlot[] }): Promise<{ tebus_id: string; ada: boolean; status: string; order_id: string | null; nilai_total: number }>` — melempar `Error` dengan `message` yang memuat `voucher_prabayar:<kode>` bila RPC menolak.
  - `ambilItemTebus(retail, db, tebusId): Promise<ItemVoucherTebus[]>`
  - `selesaikanTebus(retail, tebusId, pOrder, pItems): Promise<{ order_id: string; order_number: number; sudah?: boolean }>`
  - `lepasTebus(retail, tebusId): Promise<void>`
- Perubahan kontrak API: `POST /checkout/validate` dan `POST /orders` menerima `tebus?: { milik_id: string; pilihan: PilihanSlot[] }`; `items` boleh kosong bila `tebus` ada. Balasan `orders` untuk tebus murni: `{ order_id, order_number, total_amount: 0, tanpa_bayar: true, payment_url: null, qr_string: null }`.

- [ ] **Step 1: Tambah pembungkus tebus di `voucherPrabayarDb.ts`**

Tambahkan impor di atas berkas: `import type { SupabaseClient } from '@supabase/supabase-js'`, `import type { MenuApp } from './catalog'`, dan `import { periksaPilihan, kodeGalatDb, type PilihanSlot, type ItemVoucherPilih, type ItemVoucherTebus } from './voucherPrabayar'`. Lalu tambahkan di akhir berkas:

```ts
export async function periksaTebus(
  retail: RetailClient,
  input: { customerId: string; milikId: string; pilihan: PilihanSlot[]; katalog: MenuApp[]; sekarang: Date },
): Promise<{ ok: true; items: ItemVoucherPilih[] } | { ok: false; kode: string }> {
  const { data: m, error } = await retail
    .from('voucher_milik').select('id, customer_id, status_bayar, kedaluwarsa_at').eq('id', input.milikId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!m || m.customer_id !== input.customerId) return { ok: false, kode: 'tidak_sah' }
  if (m.status_bayar !== 'lunas') return { ok: false, kode: 'belum_lunas' }
  if (!m.kedaluwarsa_at || new Date(m.kedaluwarsa_at) <= input.sekarang) return { ok: false, kode: 'kedaluwarsa' }

  const { data: unit, error: e2 } = await retail
    .from('voucher_milik_slot').select('slot_id').eq('milik_id', input.milikId).eq('status', 'tersedia')
  if (e2) throw new Error(e2.message)
  const tersediaPerSlot: Record<string, number> = {}
  for (const u of (unit ?? []) as Array<{ slot_id: string }>) tersediaPerSlot[u.slot_id] = (tersediaPerSlot[u.slot_id] ?? 0) + 1

  const idSlot = [...new Set(input.pilihan.map((p) => p.slot_id))]
  const { data: menu, error: e3 } = await retail
    .from('voucher_paket_slot_menu').select('slot_id, menu_item_id').in('slot_id', idSlot)
  if (e3) throw new Error(e3.message)
  const menuPerSlot: Record<string, string[]> = {}
  for (const r of (menu ?? []) as Array<{ slot_id: string; menu_item_id: string }>) {
    ;(menuPerSlot[r.slot_id] ??= []).push(r.menu_item_id)
  }

  const h = periksaPilihan({ pilihan: input.pilihan, tersediaPerSlot, menuPerSlot, katalog: input.katalog })
  return h.ok ? { ok: true, items: h.items } : { ok: false, kode: h.kode }
}

export async function tahanTebus(
  retail: RetailClient,
  input: { milikId: string; customerId: string; outletId: string; clientOrderId: string; pilihan: PilihanSlot[] },
): Promise<{ tebus_id: string; ada: boolean; status: string; order_id: string | null; nilai_total: number }> {
  const { data, error } = await retail.rpc('tahan_tebus', {
    p_milik: input.milikId, p_customer: input.customerId, p_outlet: input.outletId,
    p_client_order: input.clientOrderId, p_pilihan: input.pilihan,
  })
  // Pesan RAISE EXCEPTION dibawa apa adanya; pemanggil memetakannya lewat kodeGalatDb.
  if (error) throw Object.assign(new Error(error.message), { code: (error as { code?: string }).code })
  const d = data as Record<string, unknown>
  return {
    tebus_id: String(d.tebus_id), ada: d.ada === true, status: String(d.status),
    order_id: (d.order_id as string | null) ?? null, nilai_total: Number(d.nilai_total ?? 0),
  }
}

export async function ambilItemTebus(
  retail: RetailClient, db: SupabaseClient, tebusId: string,
): Promise<ItemVoucherTebus[]> {
  const { data, error } = await retail
    .from('voucher_tebus_item').select('id, menu_item_id, nilai').eq('tebus_id', tebusId).order('id')
  if (error) throw new Error(error.message)
  const baris = (data ?? []) as Array<{ id: string; menu_item_id: string; nilai: number }>
  if (baris.length === 0) return []
  const { data: menu, error: e2 } = await db.from('menu_items').select('id, name').in('id', baris.map((b) => b.menu_item_id))
  if (e2) throw new Error(e2.message)
  const nama = new Map((menu ?? []).map((m: { id: string; name: string }) => [m.id, m.name]))
  return baris.map((b) => ({
    menu_item_id: b.menu_item_id, name: nama.get(b.menu_item_id) ?? 'Menu', nilai: Number(b.nilai), tebus_item_id: b.id,
  }))
}

export async function selesaikanTebus(
  retail: RetailClient, tebusId: string, pOrder: Record<string, unknown>, pItems: Record<string, unknown>[],
): Promise<{ order_id: string; order_number: number; sudah?: boolean }> {
  const { data, error } = await retail.rpc('selesaikan_tebus', { p_tebus: tebusId, p_order: pOrder, p_items: pItems })
  if (error) throw new Error(error.message)
  return data as never
}

export async function lepasTebus(retail: RetailClient, tebusId: string): Promise<void> {
  const { error } = await retail.rpc('lepas_tebus', { p_tebus: tebusId })
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 2: `checkout/validate` menerima `tebus`**

Di `apps/retail-gateway/src/app/api/v1/checkout/validate/route.ts`:

1. Tambah impor: `import { validasiPilihan, pesanGalat, type PilihanSlot } from '@/lib/voucherPrabayar'` dan `import { periksaTebus } from '@/lib/voucherPrabayarDb'`.
2. Ubah tipe `body` menjadi `{ outlet_id?: string; items?: ItemPesanan[]; voucher_id?: string; kode_voucher?: string; tebus?: { milik_id?: string; pilihan?: unknown } }`.
3. Ganti validasi awal (baris 26–32) dengan:

```ts
  const punyaTebus = body.tebus !== undefined && body.tebus !== null
  const itemsAda = Array.isArray(body.items) && body.items.length > 0
  if (!body.outlet_id || (!itemsAda && !punyaTebus)) {
    return NextResponse.json({ error: 'outlet_id dan items wajib diisi' }, { status: 400 })
  }
  if (itemsAda && !jumlahWajar(body.items!)) {
    return NextResponse.json({ error: 'Jumlah pesanan tidak wajar' }, { status: 400 })
  }
  let pilihanTebus: PilihanSlot[] | null = null
  if (punyaTebus) {
    pilihanTebus = validasiPilihan(body.tebus!.pilihan)
    if (!pilihanTebus || !body.tebus!.milik_id) {
      return NextResponse.json({ error: 'Data penebusan tidak valid' }, { status: 400 })
    }
    if (body.voucher_id || body.kode_voucher) {
      return NextResponse.json({ ok: false, alasan: 'voucher_dan_tebus', pesan: pesanGalat('voucher_dan_tebus') }, { status: 200 })
    }
  }
```
4. Ganti bagian mulai dari `const itemsBelanja = …` sampai `return NextResponse.json({ ok: true, ...rincian, voucher: blok })` (baris 79–100) dengan:

```ts
  const itemsBelanja = (body.items ?? []).filter((it) => it.note !== CATATAN_GRATIS)
  if (itemsBelanja.length === 0 && !pilihanTebus) {
    return NextResponse.json({ error: 'Pesanan wajib berisi minimal satu menu' }, { status: 400 })
  }
  const masalah = itemsBelanja.length > 0 ? periksaKeranjang(itemsBelanja, katalog) : []
  if (masalah.length > 0) {
    return NextResponse.json({ ok: false, alasan: 'keranjang_berubah', masalah }, { status: 200 })
  }

  if (pilihanTebus) {
    let hasil
    try {
      hasil = await periksaTebus(createRetailClient(), {
        customerId: sesi.customerId, milikId: body.tebus!.milik_id!, pilihan: pilihanTebus, katalog, sekarang: new Date(),
      })
    } catch (e) {
      console.error('gagal memeriksa tebus', e)
      return NextResponse.json({ error: 'Gagal memeriksa voucher' }, { status: 502 })
    }
    if (!hasil.ok) {
      return NextResponse.json({ ok: false, alasan: hasil.kode, pesan: pesanGalat(hasil.kode) }, { status: 200 })
    }
    // `total` = yang ditagih (hanya item biasa). Nilai rupiah slot tidak pernah dikirim ke pelanggan.
    const subtotal = itemsBelanja.reduce((n, it) => n + it.unit_price * it.quantity, 0)
    return NextResponse.json({
      ok: true, subtotal, discountAmount: 0, total: subtotal, voucher: null,
      tebus: { jumlah_slot: hasil.items.length, item: hasil.items.map((i) => ({ slot_id: i.slot_id, menu_item_id: i.menu_item_id, name: i.name })) },
    })
  }

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

- [ ] **Step 3: `orders` — jalur tebus**

Di `apps/retail-gateway/src/app/api/v1/orders/route.ts`:

1. Tambah impor:
```ts
import { validasiPilihan, kodeGalatDb, pesanGalat, susunPayloadTebus, type PilihanSlot } from '@/lib/voucherPrabayar'
import { periksaTebus, tahanTebus, ambilItemTebus, selesaikanTebus, lepasTebus } from '@/lib/voucherPrabayarDb'
import { hitungTotal } from '@/lib/pricing'
```
2. Ubah tipe `body` menambah `tebus?: { milik_id?: string; pilihan?: unknown }`.
3. Ganti validasi awal (baris 66–75) dengan:

```ts
  const punyaTebus = body.tebus !== undefined && body.tebus !== null
  const itemsAda = Array.isArray(body.items) && body.items.length > 0
  if (!body.client_order_id || !body.outlet_id || (!itemsAda && !punyaTebus)) {
    return NextResponse.json({ error: 'client_order_id, outlet_id, dan items wajib diisi' }, { status: 400 })
  }
  if (itemsAda && !jumlahWajar(body.items!)) {
    return NextResponse.json({ error: 'Jumlah pesanan tidak wajar' }, { status: 400 })
  }
  let pilihanTebus: PilihanSlot[] | null = null
  if (punyaTebus) {
    pilihanTebus = validasiPilihan(body.tebus!.pilihan)
    if (!pilihanTebus || !body.tebus!.milik_id) {
      return NextResponse.json({ error: 'Data penebusan tidak valid' }, { status: 400 })
    }
    if (body.voucher_id || body.kode_voucher) {
      return NextResponse.json({ error: 'voucher_tidak_berlaku', pesan: pesanGalat('voucher_dan_tebus') }, { status: 409 })
    }
  }
```
4. Ganti `const itemsKlien = …` sampai sebelum `const petaMenu = …` (baris 172–179) dengan:

```ts
  const itemsKlien = (body.items ?? []).filter((it) => it.note !== CATATAN_GRATIS)
  if (itemsKlien.length === 0 && !pilihanTebus) {
    return NextResponse.json({ error: 'Pesanan wajib berisi minimal satu menu' }, { status: 400 })
  }
  const masalah = itemsKlien.length > 0 ? periksaKeranjang(itemsKlien, katalog) : []
  if (masalah.length > 0) {
    return NextResponse.json({ error: 'keranjang_berubah', masalah }, { status: 409 })
  }
```
5. Sisipkan **tepat setelah** blok `itemsTepercaya` (sebelum `let nv: NilaiVoucher`) jalur tebus lengkap, lalu bungkus jalur voucher diskon lama dengan `if (!pilihanTebus)`:

```ts
  if (pilihanTebus) {
    const milikId = body.tebus!.milik_id!
    let cek
    try {
      cek = await periksaTebus(retail, {
        customerId: sesi.customerId, milikId, pilihan: pilihanTebus, katalog, sekarang: new Date(),
      })
    } catch (e) {
      console.error('gagal memeriksa tebus', e)
      return NextResponse.json({ error: 'Gagal memeriksa voucher' }, { status: 502 })
    }
    if (!cek.ok) {
      return NextResponse.json({ error: 'voucher_tidak_berlaku', alasan: cek.kode, pesan: pesanGalat(cek.kode) }, { status: 409 })
    }

    let tahan
    try {
      tahan = await tahanTebus(retail, {
        milikId, customerId: sesi.customerId, outletId: body.outlet_id, clientOrderId: body.client_order_id, pilihan: pilihanTebus,
      })
    } catch (e) {
      const kode = kodeGalatDb((e as Error).message)
      if ((e as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'pesanan_sedang_diproses', pesan: 'Pesanan sedang diproses, coba lagi sebentar.' }, { status: 409 })
      }
      if (kode) return NextResponse.json({ error: 'voucher_tidak_berlaku', alasan: kode, pesan: pesanGalat(kode) }, { status: 409 })
      console.error('gagal menahan slot', e)
      return NextResponse.json({ error: 'Gagal memproses voucher' }, { status: 502 })
    }

    // Percobaan ulang untuk tebus yang sudah selesai: kembalikan hasil yang sama.
    if (tahan.ada && tahan.order_id) {
      const { data: o } = await db.from('orders').select('id, order_number').eq('id', tahan.order_id).maybeSingle()
      return NextResponse.json({
        order_id: tahan.tebus_id, order_number: o?.order_number ?? null, total_amount: 0, tanpa_bayar: true,
        payment_url: null, qr_string: null, duplicate: true,
      })
    }

    const extras = hitungTotal(itemsTepercaya, 0)
    const { data: pel } = await retail.from('customers').select('name, phone').eq('id', sesi.customerId).maybeSingle()

    if (extras.total === 0) {
      // Tebus murni: tanpa tagihan Xendit, pesanan dibuat langsung.
      try {
        const itemsVoucher = await ambilItemTebus(retail, db, tahan.tebus_id)
        const { p_order, p_items } = susunPayloadTebus({
          clientOrderId: body.client_order_id, outletId: body.outlet_id,
          customerName: pel?.name ?? 'Pelanggan Aplikasi', customerPhone: pel?.phone ?? null,
          itemsBiasa: [], itemsVoucher, ditagih: 0,
        })
        const hasil = await selesaikanTebus(retail, tahan.tebus_id, p_order, p_items)
        return NextResponse.json({
          order_id: tahan.tebus_id, order_number: hasil.order_number, total_amount: 0, tanpa_bayar: true,
          payment_url: null, qr_string: null,
        })
      } catch (e) {
        console.error('Gagal menyelesaikan tebus murni', e)
        await lepasTebus(retail, tahan.tebus_id).catch((e2) => console.error('GAGAL MELEPAS TEBUS', e2))
        return NextResponse.json({ error: 'Gagal membuat pesanan' }, { status: 502 })
      }
    }

    // Tebus campur: draft hanya menagih item biasa. Slot tetap ditahan sampai webhook lunas.
    const kedaluwarsaTebus = new Date(Date.now() + BATAS_BAYAR_MS)
    const { data: draftT, error: draftTErr } = await retail
      .from('order_drafts')
      .insert({
        client_order_id: body.client_order_id, customer_id: sesi.customerId, outlet_id: body.outlet_id,
        items: itemsTepercaya, subtotal: extras.subtotal, discount_amount: 0, total_amount: extras.total,
        expires_at: kedaluwarsaTebus.toISOString(), tebus_id: tahan.tebus_id,
      })
      .select('id')
      .maybeSingle()
    if (draftTErr || !draftT) {
      console.error('Gagal menyimpan draft tebus:', draftTErr)
      await lepasTebus(retail, tahan.tebus_id).catch((e2) => console.error('GAGAL MELEPAS TEBUS', e2))
      return NextResponse.json({ error: 'Gagal menyimpan pesanan' }, { status: 500 })
    }

    let tagihanT
    try {
      tagihanT = await buatQris({ externalId: body.client_order_id, amount: extras.total })
    } catch (eQris) {
      console.error('QR Code API gagal, jatuh ke Invoice:', eQris)
      try {
        tagihanT = await buatTagihan({
          externalId: body.client_order_id, amount: extras.total,
          description: `Pesanan SukaShawarma di ${outlet.name}`, customerName: pel?.name ?? 'Pelanggan',
        })
      } catch (e) {
        await lepasTebus(retail, tahan.tebus_id).catch((e2) => console.error('GAGAL MELEPAS TEBUS', e2))
        return await gagalkanDraft(retail, draftT.id, body.client_order_id, e)
      }
    }
    const { error: upT } = await retail
      .from('order_drafts')
      .update({ payment_ref: tagihanT.ref, payment_url: tagihanT.url, qr_string: tagihanT.qrString })
      .eq('id', draftT.id)
    if (upT) console.error('GAGAL MENCATAT TAGIHAN KE DRAFT', { client_order_id: body.client_order_id, error: upT })

    return NextResponse.json({
      order_id: draftT.id, payment_url: tagihanT.url, qr_string: tagihanT.qrString,
      total_amount: extras.total, expires_at: kedaluwarsaTebus.toISOString(),
    })
  }
```
Lalu **bungkus** blok `let nv: NilaiVoucher` … sampai akhir handler lama di dalam `if (!pilihanTebus) { … }` **tidak diperlukan**, karena blok tebus di atas selalu `return`. Cukup pastikan blok tebus ditaruh sebelum `let nv: NilaiVoucher`; jalur lama tetap berjalan untuk pesanan tanpa tebus.

- [ ] **Step 4: Webhook — pesanan tebus campur**

Di `webhooks/xendit/route.ts`, pada jalur `peristiwa.status === 'gagal'` untuk draft (baris 46–51), lepas slot bila draft bertebus:

```ts
  if (peristiwa.status === 'gagal') {
    if (draft.status === 'menunggu_bayar') {
      await retail.from('order_drafts').update({ status: 'gagal' }).eq('id', draft.id)
      if (draft.tebus_id) {
        await lepasTebus(retail, draft.tebus_id).catch((e) => console.error('GAGAL MELEPAS TEBUS', e))
      }
    }
    return NextResponse.json({ ok: true })
  }
```
Tambahkan `tebus_id` ke kolom `.select(...)` draft (baris 37): `'id, client_order_id, customer_id, outlet_id, items, subtotal, discount_amount, total_amount, status, pos_order_id, tebus_id'`. Lalu, **sebelum** `const { p_order, p_items } = susunPayloadPos({` (baris 77) sisipkan cabang tebus dan hentikan alur lama untuk draft bertebus:

```ts
  if (draft.tebus_id) {
    try {
      const db2 = createServiceClient()
      const itemsVoucher = await ambilItemTebus(retail, db2, draft.tebus_id)
      const { p_order, p_items } = susunPayloadTebus({
        clientOrderId: draft.client_order_id, outletId: draft.outlet_id,
        customerName: pelanggan?.name ?? 'Pelanggan Aplikasi', customerPhone: pelanggan?.phone ?? null,
        itemsBiasa: draft.items as ItemPesanan[], itemsVoucher, ditagih: Number(draft.total_amount),
      })
      const hasil = await selesaikanTebus(retail, draft.tebus_id, p_order, p_items)
      await retail.from('order_drafts').update({
        status: 'dibayar', paid_at: new Date().toISOString(), pos_order_id: hasil.order_id, pos_order_number: hasil.order_number,
      }).eq('id', draft.id)
      await insertCustomerNotification(retail, {
        customerId: draft.customer_id, orderId: draft.id, type: 'order_status',
        title: 'Pesanan Diterima & Sedang Disiapkan 🌯',
        body: `Pesanan #${hasil.order_number} berhasil dibayar dan sedang disiapkan dapur.`,
        data: { order_id: draft.id, status: 'preparing', order_number: hasil.order_number },
      }).catch((err) => console.warn('Gagal mencatat notifikasi pesanan diterima:', err))
      return NextResponse.json({ ok: true, order_number: hasil.order_number })
    } catch (e) {
      // Uang masuk tapi pesanan tebus gagal: 500 supaya Xendit mengirim ulang (selesaikan_tebus idempoten).
      console.error('GAGAL DORONG PESANAN TEBUS KE KASIR', { client_order_id: draft.client_order_id, error: e })
      return NextResponse.json({ error: 'Gagal meneruskan ke kasir' }, { status: 500 })
    }
  }
```
Impor tambahan di atas berkas: `import { susunPayloadTebus } from '@/lib/voucherPrabayar'` dan gabungkan `ambilItemTebus, selesaikanTebus, lepasTebus` ke impor dari `@/lib/voucherPrabayarDb` (sudah ada `lunasBeli` dari Task 8).

- [ ] **Step 5: `expire-drafts` melepas tahan**

Di `cron/expire-drafts/route.ts`, ganti `.select('id')` menjadi `.select('id, tebus_id')`, tambahkan impor `import { lepasTebus } from '@/lib/voucherPrabayarDb'`, dan sebelum `return NextResponse.json({ dihanguskan: … })` tambahkan:

```ts
  for (const d of (data ?? []) as Array<{ id: string; tebus_id: string | null }>) {
    if (d.tebus_id) {
      await lepasTebus(retail, d.tebus_id).catch((e) => console.error('GAGAL MELEPAS TEBUS', { draft_id: d.id, error: e }))
    }
  }
```

- [ ] **Step 6: Type-check dan test**

```bash
yarn workspace @suka/retail-gateway type-check
yarn workspace @suka/retail-gateway test
```
Expected: 0 error tipe, semua test lulus. Bila `body.items` berubah dari wajib menjadi opsional menimbulkan galat tipe di sisa handler, gunakan `(body.items ?? [])`.

- [ ] **Step 7: Commit**

```bash
git add apps/retail-gateway/src
git commit -m "feat(retail-gateway): jalur tebus voucher prabayar (validate, orders, webhook, expire)"
```

---

### Task 10: Terapkan ke produksi dan uji rahasia ujung ke ujung

**Files:** tidak ada kode baru. Hasil uji dicatat di `docs/superpowers/plans/2026-09-29-app-retail-voucher-prabayar-1-db-gateway.md` (bagian "Catatan pelaksanaan" di akhir berkas, ditambahkan oleh pelaksana).

⚠️ **Langkah 1–3 menyentuh DB produksi bersama dan butuh izin eksplisit owner.** Tampilkan ringkasan migration ke owner dan tunggu jawaban "ya" sebelum langkah 1.

- [ ] **Step 1: Cek riwayat migration sebelum apply**

```bash
supabase migration list
```
Pastikan tidak ada migration remote-only baru dari dev lain yang bentrok dengan timestamp rencana ini. Jangan `migration repair --status reverted`.

- [ ] **Step 2: Apply satu per satu, verifikasi ground-truth tiap kali**

Untuk tiap berkas berurutan (`200000`, `205000`, `210000`, `215000`, `220000`, `230000`):

```bash
supabase db query --linked "$(cat supabase/migrations/<berkas>.sql)"
```
Setelah semua: verifikasi katalog dan uji ulang (kontrol negatif sudah dilakukan di Task 2):

```bash
supabase db query --linked "SELECT proname, prosecdef FROM pg_proc WHERE pronamespace='retail'::regnamespace AND proname IN ('simpan_paket','beli_voucher_reserve','beli_voucher_lunas','tahan_tebus','selesaikan_tebus','lepas_tebus','proses_voucher_harian','batalkan_tebus_pesanan') ORDER BY 1;"
supabase db query --linked "SELECT jobname, schedule, active FROM cron.job WHERE jobname='voucher-prabayar-harian';"
supabase db query --linked "SELECT conname FROM pg_constraint WHERE conname IN ('orders_payment_method_check','order_items_voucher_tebus_fk');"
supabase db query --linked "$(cat supabase/verifikasi/voucher_prabayar/t4_tebus.sql)"
```
Expected: 8 fungsi (semua `prosecdef=true`), job aktif, kedua constraint ada, t4 mengembalikan `HASIL T4: LULUS` dan tidak meninggalkan data (rollback otomatis). Lalu stempel riwayat hanya untuk versi yang tercatat remote-only tanpa berkas: `supabase migration repair --status applied <timestamp>` per versi, lalu `supabase migration list` harus sinkron.

- [ ] **Step 3: Redeploy `retail-gateway`**, lalu pastikan endpoint baru hidup:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<host-gateway>/api/v1/voucher-paket
```
Expected: `401` (perlu sesi), bukan `404`.

- [ ] **Step 4: Uji rahasia dengan akun tim di outlet tes (voucher kecil)**

Buat satu paket uji lewat SQL di transaksi tersendiri (tanpa rollback, tandai nama `[UJI] …` supaya mudah dibersihkan): harga Rp 3.000, 3 slot (mis. 2 makanan @ Rp 1.000, 1 minuman @ Rp 1.000), menu dari 2 menu tampil-di-app, `tebus_hari` 7, kuota 5. Lalu dengan token sesi akun tim, berurutan:

1. `GET /api/v1/voucher-paket` → paket uji muncul, **tanpa nilai rupiah per slot**.
2. `POST /api/v1/voucher-paket/{id}/beli` dengan `client_beli_id` baru → balasan memuat `qr_string`. Ulangi dengan `client_beli_id` yang sama → `duplicate: true`, **tagihan yang sama**.
3. Bayar QRIS Rp 3.000; pastikan webhook menerbitkan voucher: `GET /api/v1/voucher-saya` menampilkan 3 slot tersedia.
4. `POST /api/v1/checkout/validate` dengan `tebus` 1 slot makanan saja (outlet tes) → `ok: true`, `total: 0`.
5. `POST /api/v1/orders` tebus murni → `tanpa_bayar: true`, `order_number` terisi; di POS outlet tes pesanan muncul dengan label `VOUCHER`; `orders.payment_method='voucher'`, `total_amount = 1000 = Σ subtotal`; `voucher-saya` sisa 2 slot.
6. `POST /api/v1/orders` tebus campur (1 minuman + 1 item biasa) → `qr_string`; sebelum bayar, `voucher-saya` menunjukkan slot `ditahan`; bayar → pesanan muncul, slot `terpakai`.
7. Tebus lagi lalu **batalkan pesanan di POS** → slot kembali `tersedia`, `voucher_tebus.status='dibatalkan'`.
8. Tebus campur lalu **jangan bayar**; tunggu 15 menit + cron `expire-drafts` → slot kembali `tersedia`.
9. `SELECT retail.proses_voucher_harian();` setelah memajukan `kedaluwarsa_at` satu voucher uji ke kemarin → slot sisa `hangus`.

Ground-truth setelah uji: `SELECT count(*) FROM retail.voucher_milik_slot WHERE status='ditahan';` harus 0 (tak ada tahan yatim).

- [ ] **Step 5: Bersihkan data uji, matikan paket uji**

Nonaktifkan paket uji (`UPDATE retail.voucher_paket SET is_active=false WHERE nama LIKE '[UJI]%'`). Jangan menghapus baris `voucher_milik`/pesanan uji (jejak audit); outlet tes dikecualikan dari laporan uang.

- [ ] **Step 6: Perbarui `CLAUDE.md` proyek** dengan satu entri sesi ringkas (status, migration yang applied, temuan uji, "perlu redeploy `retail-gateway`", dan bahwa Rencana 2 dan 3 belum dikerjakan), lalu commit.

```bash
git add CLAUDE.md docs/superpowers/plans/2026-09-29-app-retail-voucher-prabayar-1-db-gateway.md
git commit -m "docs: catat voucher prabayar rencana 1 (DB & gateway)"
```

---

## Self-Review

**Spec coverage** (P1–P23, D1–D4):
- P1 prabayar → Task 3 (reserve/lunas) + Task 8 (rute beli). P2/P7 slot & nilai per slot → Task 2/3 (`simpan_paket`, invarian total). P3 dua jendela → Task 2 (kolom), Task 3 (`beli_*`, kedaluwarsa `LEAST`). P4 hangus → Task 6. P5/P6 pembukuan → Task 5 (`total_amount` penuh, uji e3) + Task 4 (`'voucher'`). P8 cicilan → Task 5 (`tahan_tebus` per unit). P9 tanda item → Task 2 (`order_items.voucher_tebus_id`) + Task 5. P10 campur & Rp 0 → Task 9 (dua cabang di `orders`). P11 outlet bebas → tidak ada pembatasan outlet di RPC. P12 menu habis → `periksaPilihan` + `periksaTebus` (katalog outlet). P13 kunci struktur → `simpan_paket` (`struktur_terkunci`, uji g). P14 kuota & batas → `beli_voucher_reserve` (kunci per paket). P15 pengingat → Task 6. P16 batal → trigger Task 5 (`lepas_tebus`, uji g) + expire Task 9. P17 fee → `fee_bagian`/`fee_dibebankan` tersimpan (Task 3/5); **laporan/pembebanan ke "Potongan" mitra ditunda ke Rencana 2**. P18 terikat akun → semua RPC memeriksa `customer_id`. P19 tanpa refund → tidak ada jalur refund. P20 perpanjang (server action + log) dan P21 laporan uang, P22 peringatan margin → **Rencana 2**. P23 peluncuran bertahap → Task 10 (uji rahasia).
- D1 tanpa batas slot → tak ada batas selain `MAKS_PILIHAN=50` per permintaan (guard anti-abuse, bukan batas bisnis). D2 voucher tak terbit bila tak bayar → `status_bayar` + hanya `lunas` yang membuat unit. D3 admin/owner → Rencana 2 (`requireRole`). D4 tak digabung → dicek di `validate` dan `orders`.
- **Celah yang disengaja ke rencana berikutnya:** P17 pembebanan fee ke laporan mitra, P20, P21, P22, label POS/struk (§7b.13), dan seluruh APK.

**Placeholder scan:** tidak ada "TBD/TODO". Satu catatan kondisional di Task 8 Step 1 (impor `estimasiFee` yang mungkin tak terpakai) adalah instruksi konkret untuk dihapus, bukan placeholder.

**Type consistency:** `PilihanSlot`, `ItemVoucherPilih`, `ItemVoucherTebus`, `susunPayloadTebus`, `periksaPilihan`, `kodeGalatDb`, `pesanGalat` didefinisikan di Task 7 dan dipakai dengan nama/signature yang sama di Task 8–9. Kode galat RPC (`slot_habis`, `menu_tidak_valid`, `kedaluwarsa`, …) sama di SQL (Task 3/5), `PESAN` (Task 7), dan uji. Nama RPC dan kolom (`tahan_tebus`, `selesaikan_tebus`, `lepas_tebus`, `voucher_tebus_item_id`, `tebus_id`) konsisten di SQL, uji, dan TypeScript.

**Risiko yang tetap terbuka (bawa ke pelaksana):** (1) Task 5 Step 4 dapat menemukan trigger lain di `orders`/`order_items` yang melempar galat pada `INSERT` langsung dari RPC. (2) Definisi live `orders_payment_method_check` belum dibaca (Task 1). (3) Fee memakai estimasi 0,7%. (4) Pengingat hanya inbox, tanpa push.
