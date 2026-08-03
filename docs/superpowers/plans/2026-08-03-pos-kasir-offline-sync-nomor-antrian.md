# POS-Kasir: Perbaikan Nomor Antrian & Sinkronisasi Offline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nomor antrian POS urut rapat dan tidak pernah kembar, dan setiap pesanan yang dibuat saat offline pasti tersinkron ke server begitu jaringan kembali — tanpa duplikat dan tanpa hilang diam-diam.

**Architecture:** Nomor antrian dipindah dari dua trigger yang berebut (`trg_fill_order_number` + `trigger_generate_order_number` dengan `MAX+1` yang balapan) menjadi **satu** trigger `BEFORE INSERT` yang mengambil nomor dari counter atomik per outlet per hari, dijaga unique index. Di sisi client, nomor lokal 9000-an dihapus total; order offline memakai nomor perkiraan yang diperbarui saat sinkron. Pengiriman ulang order offline dipindah ke endpoint ingest khusus yang menerima snapshot harga apa adanya + `client_order_id` sebagai kunci idempotensi, sehingga tidak bisa ditolak permanen dan tidak bisa dobel. Pesanan online ditarik lewat cron sisi server supaya tidak lagi bergantung pada tab browser kasir yang terbuka.

**Tech Stack:** Next.js App Router (Next 16), TypeScript, Supabase (Postgres + PostgREST), Dexie/IndexedDB, TanStack Query, Vitest, Vercel Cron.

## Global Constraints

- **Timestamp migrasi WAJIB di atas lantai 2030.** Migrasi terakhir di repo adalah `20300104000001`. Migrasi baru pakai `20300105000000` dan seterusnya. Migrasi bertanggal wajar akan dijalankan LEBIH DULU dan ditimpa oleh migrasi 2030 — ini utang teknis yang sudah terdokumentasi di `CLAUDE.md`.
- **Sebelum menyentuh fungsi/trigger DB apa pun, grep dulu:** `grep -rn "<nama_fungsi>" supabase/migrations/`. Ada riwayat fungsi order-number ditimpa diam-diam oleh migrasi lain.
- **Verifikasi DB pakai ground truth, bukan `supabase migration list`.** Perintah baku dari root repo:
  `npx supabase db query "<sql>" --linked`
- **Bash tool mem-background perintah pada karakter `&`.** SQL yang memakai `&` (mis. `tgtype & 2`) harus dijalankan lewat tool PowerShell, atau tulis ulang SQL-nya tanpa `&`.
- **Zona bisnis = `Asia/Jakarta`** untuk semua penentuan "hari" pada nomor antrian.
- **Pesanan offline yang belum tersinkron TIDAK BOLEH dihapus otomatis.** Uangnya sudah diterima kasir. Penghapusan hanya lewat tindakan sadar kasir.
- Direktori kerja aplikasi: `apps/pos-kasir`. Test: `npm test` (vitest, `environment: 'node'`, include `tests/**/*.test.ts` dan `lib/**/*.test.ts`). Type-check: `npm run type-check`.
- Migrasi disimpan di **root repo** `supabase/migrations/`, bukan di `apps/pos-kasir/`.

## Kondisi Produksi Terverifikasi (per 2026-08-03)

Dipakai sebagai dasar rencana ini — sudah dicek langsung ke DB, jangan diasumsikan ulang:

| Fakta | Nilai |
|---|---|
| Trigger `BEFORE INSERT ROW` di `orders` yang mengisi `order_number` | `trg_fill_order_number` (sequence `pos_sync_order_number_seq`) **dan** `trigger_generate_order_number` (`MAX+1`) — yang kedua menang karena urutan abjad, dan menimpa tanpa syarat |
| Constraint unik di `orders` | **hanya** `orders_pkey (id)`. Tidak ada unik apa pun di `order_number` |
| Baris `order_number >= 9000` | **0**, sepanjang riwayat. Nomor 9000-an milik `lib/offline.ts` tidak pernah mendarat di server |
| Duplikat `(outlet_id, tanggal Jakarta, order_number)` | **0 grup** sepanjang riwayat → unique index penuh aman dipasang |
| Tabel `outlet_order_counters` | **SUDAH ADA**, kolom hanya `(outlet_id uuid, last_number integer)` — tanpa `biz_date`. **Kosong (0 baris)** dan tidak dirujuk trigger/fungsi mana pun |
| `pos_sync_order_number_seq` | Ada (START 9000000), tapi nilainya selalu ditimpa `trigger_generate_order_number`, jadi efektif mati |
| Cron yang terdaftar di `vercel.json` | hanya `check-scheduled-orders` dan `cancel-expired`. Tidak ada penarik order online |

---

### Task 1: Migrasi DB — counter atomik, trigger tunggal, unique index

Mengganti dua trigger yang berebut dengan satu trigger yang mengambil nomor dari counter atomik per outlet per hari, dan memasang unique index supaya nomor kembar ditolak alih-alih lolos diam-diam.

**Files:**
- Create: `supabase/migrations/20300105000000_atomic_order_number.sql`

**Interfaces:**
- Consumes: tabel `public.orders` (kolom `outlet_id`, `order_number`, `created_at`), tabel `public.outlets`.
- Produces:
  - Tabel `public.outlet_order_counters (outlet_id uuid, biz_date date, last_number integer)`, PK `(outlet_id, biz_date)`.
  - Fungsi `public.assign_order_number()` — trigger function, `BEFORE INSERT ON orders FOR EACH ROW`.
  - Trigger `trg_assign_order_number` pada `public.orders`.
  - Unique index `orders_outlet_bizdate_number_uq` pada `(outlet_id, (created_at AT TIME ZONE 'Asia/Jakarta')::date, order_number)`.

- [ ] **Step 1: Konfirmasi ulang prasyarat sebelum menulis migrasi**

Fakta di tabel "Kondisi Produksi Terverifikasi" dikumpulkan pada 2026-08-03. Database ini **dipakai bersama developer lain** dan riwayatnya terbukti berubah di tengah sesi. Jalankan ulang dari root repo:

```bash
npx supabase db query "select count(*) as n from outlet_order_counters" --linked
```
Harapan: `n = 0`. **Kalau bukan 0, BERHENTI** dan laporkan — ada yang mulai memakai tabel itu dan langkah drop di bawah menjadi tidak aman.

```bash
npx supabase db query "select count(*) as dup_groups from (select outlet_id, (created_at at time zone 'Asia/Jakarta')::date as d, order_number from orders group by 1,2,3 having count(*)>1) x" --linked
```
Harapan: `dup_groups = 0`. **Kalau bukan 0, BERHENTI** dan laporkan — unique index penuh akan gagal dan perlu diganti index parsial dengan tanggal cutoff.

- [ ] **Step 2: Tulis migrasi**

Buat `supabase/migrations/20300105000000_atomic_order_number.sql`:

```sql
-- ============================================================
-- Nomor antrian POS: satu counter atomik per outlet per hari.
--
-- Mengganti DUA trigger BEFORE INSERT yang selama ini berebut:
--   * trg_fill_order_number       -> nextval(pos_sync_order_number_seq)
--   * trigger_generate_order_number -> SELECT MAX(order_number)+1  (balapan!)
-- Yang kedua selalu menang karena trigger dieksekusi urut abjad, dan ia
-- menimpa tanpa syarat -- termasuk menimpa nomor dari sequence sync.
--
-- MAX+1 tidak atomik: dua insert bersamaan di satu outlet bisa mendapat
-- nomor yang sama, dan tidak ada constraint yang menolaknya.
-- ============================================================

-- 1. Tabel counter. Tabel lama bernama sama SUDAH ADA di produksi dengan
--    bentuk (outlet_id, last_number) tanpa biz_date, kosong, dan tidak
--    dirujuk trigger/fungsi mana pun. CREATE TABLE IF NOT EXISTS akan
--    diam-diam melewatinya dan menyisakan tabel tanpa biz_date, jadi
--    tabel lama dibuang lebih dulu.
DROP TABLE IF EXISTS public.outlet_order_counters;

CREATE TABLE public.outlet_order_counters (
  outlet_id   uuid    NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  biz_date    date    NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (outlet_id, biz_date)
);

COMMENT ON TABLE public.outlet_order_counters IS
  'Counter nomor antrian per outlet per hari bisnis (Asia/Jakarta). Hanya ditulis oleh assign_order_number().';

-- Ditulis eksklusif lewat trigger SECURITY DEFINER; tidak ada akses langsung.
ALTER TABLE public.outlet_order_counters ENABLE ROW LEVEL SECURITY;

-- 2. Seed dari data yang sudah ada supaya nomor hari ini LANJUT, tidak
--    mengulang dari 1 dan menabrak order yang sudah tercetak strukmya.
INSERT INTO public.outlet_order_counters (outlet_id, biz_date, last_number)
SELECT
  outlet_id,
  (created_at AT TIME ZONE 'Asia/Jakarta')::date AS biz_date,
  MAX(order_number)
FROM public.orders
WHERE outlet_id IS NOT NULL
  AND order_number IS NOT NULL
  AND created_at >= now() - interval '2 days'
GROUP BY 1, 2;

-- 3. Trigger function tunggal. SECURITY DEFINER karena penulis order
--    (authenticated / service_role) tidak punya policy tulis ke tabel counter.
CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_biz_date date;
  v_next     integer;
BEGIN
  IF NEW.outlet_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_biz_date := (COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Jakarta')::date;

  -- Satu pernyataan, atomik. Tidak ada jendela balapan antara baca dan tulis.
  INSERT INTO public.outlet_order_counters AS c (outlet_id, biz_date, last_number)
  VALUES (NEW.outlet_id, v_biz_date, 1)
  ON CONFLICT (outlet_id, biz_date)
  DO UPDATE SET last_number = c.last_number + 1
  RETURNING c.last_number INTO v_next;

  -- order_number yang dikirim client SENGAJA diabaikan. Server satu-satunya
  -- yang membagi nomor; client hanya menampilkan perkiraan saat offline.
  NEW.order_number := v_next;
  RETURN NEW;
END;
$$;

-- 4. Pasang trigger baru, buang dua trigger lama.
DROP TRIGGER IF EXISTS trg_assign_order_number ON public.orders;
CREATE TRIGGER trg_assign_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_order_number();

DROP TRIGGER IF EXISTS trigger_generate_order_number ON public.orders;
DROP TRIGGER IF EXISTS trg_fill_order_number ON public.orders;

-- Fungsi lama dibiarkan ada (tanpa trigger) supaya migrasi lama yang
-- mereferensikannya tetap bisa dijalankan ulang tanpa error. Sequence
-- pos_sync_order_number_seq juga dibiarkan -- efektif tidak terpakai.

-- 5. Nomor kembar kini DITOLAK, bukan lolos diam-diam.
--    (Verified 2026-08-03: 0 grup duplikat sepanjang riwayat.)
CREATE UNIQUE INDEX IF NOT EXISTS orders_outlet_bizdate_number_uq
  ON public.orders (
    outlet_id,
    ((created_at AT TIME ZONE 'Asia/Jakarta')::date),
    order_number
  );
```

- [ ] **Step 3: Terapkan migrasi**

```bash
npx supabase db push --linked
```

Kalau gagal karena migrasi remote-only milik developer lain (rutin di repo ini), **jangan** jalankan `migration repair` sepihak. Laporkan daftar timestamp yang memblokir dan tunggu instruksi.

- [ ] **Step 4: Verifikasi ground truth di DB live**

Jangan percaya `migration list`. Jalankan dari root repo:

```bash
npx supabase db query "select tgname from pg_trigger where tgrelid='public.orders'::regclass and not tgisinternal order by tgname" --linked
```
Harapan: ada `trg_assign_order_number`; **tidak ada** `trg_fill_order_number` maupun `trigger_generate_order_number`.

```bash
npx supabase db query "select prosecdef, pg_get_functiondef(oid) as def from pg_proc where proname='assign_order_number'" --linked
```
Harapan: `prosecdef = true`, dan badan fungsi memuat `ON CONFLICT (outlet_id, biz_date)`.

```bash
npx supabase db query "select indexname from pg_indexes where tablename='orders' and indexname='orders_outlet_bizdate_number_uq'" --linked
```
Harapan: satu baris.

```bash
npx supabase db query "select count(*) as seeded from outlet_order_counters" --linked
```
Harapan: > 0 (ter-seed dari order 2 hari terakhir).

Periksa apakah ada outlet yang ter-seed dengan nomor tak wajar. Sebagian baris lama (source `kiosk`/`online`) masih membawa nomor warisan sequence global sampai 4727; kalau baris seperti itu jatuh di dua hari terakhir, counter outlet tersebut ikut melompat tinggi:

```bash
npx supabase db query "select outlet_id, biz_date, last_number from outlet_order_counters where last_number > 500 order by last_number desc" --linked
```
Nol baris = ideal. Kalau ada, itu **bukan bug** — nomor tersebut memang sudah terpakai hari itu dan tidak boleh dipakai ulang, dan urutannya kembali normal keesokan harinya. Catat saja temuannya di laporan task supaya tidak dikira regresi saat smoke test.

- [ ] **Step 5: Uji atomisitas nomor lewat insert nyata**

Sisipkan dua order uji ke satu outlet, pastikan nomornya berurutan dan tidak kembar, lalu bersihkan. Ganti `<OUTLET_ID>` dengan outlet uji (mis. `550e8400-e29b-41d4-a716-446655440002`).

```bash
npx supabase db query "with ins as (insert into orders (outlet_id, status, total_amount, source, payment_method) select '<OUTLET_ID>'::uuid, 'cancelled', 0, 'pos', 'cash' from generate_series(1,5) returning id, order_number) select count(*) as n, count(distinct order_number) as distinct_num, min(order_number) as lo, max(order_number) as hi from ins" --linked
```
Harapan: `n = 5`, `distinct_num = 5`, dan `hi - lo = 4` (berurutan tanpa kembar).

Bersihkan baris uji:

```bash
npx supabase db query "delete from orders where outlet_id='<OUTLET_ID>' and status='cancelled' and total_amount=0 and created_at > now() - interval '10 minutes'" --linked
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20300105000000_atomic_order_number.sql
git commit -m "fix(db): satu counter atomik untuk nomor antrian, buang dua trigger yang berebut"
```

---

### Task 2: Migrasi DB — `client_order_id` untuk idempotensi

Kunci idempotensi yang dibuat di device, supaya kirim ulang order offline yang sebenarnya sudah sukses tidak menghasilkan order dobel.

**Files:**
- Create: `supabase/migrations/20300105000001_orders_client_order_id.sql`

**Interfaces:**
- Produces: kolom `public.orders.client_order_id uuid NULL` + unique index parsial `orders_client_order_id_uq`.

- [ ] **Step 1: Tulis migrasi**

Buat `supabase/migrations/20300105000001_orders_client_order_id.sql`:

```sql
-- ============================================================
-- Idempotensi order dari device kasir.
--
-- Device membuat UUID sekali per transaksi dan mengirimnya di SETIAP
-- percobaan. Tanpa ini, kirim ulang yang timeout-padahal-sukses akan
-- membuat order dobel -- persis penyakit antrean offline sekarang.
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS client_order_id uuid;

-- Parsial: baris lama (NULL) tidak terganggu, dan NULL boleh berulang.
CREATE UNIQUE INDEX IF NOT EXISTS orders_client_order_id_uq
  ON public.orders (client_order_id)
  WHERE client_order_id IS NOT NULL;

COMMENT ON COLUMN public.orders.client_order_id IS
  'UUID dibuat device kasir per transaksi. Kunci idempotensi untuk kirim ulang order offline.';
```

- [ ] **Step 2: Terapkan dan verifikasi**

```bash
npx supabase db push --linked
```

```bash
npx supabase db query "select column_name from information_schema.columns where table_schema='public' and table_name='orders' and column_name='client_order_id'" --linked
```
Harapan: satu baris.

```bash
npx supabase db query "select indexname from pg_indexes where tablename='orders' and indexname='orders_client_order_id_uq'" --linked
```
Harapan: satu baris.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20300105000001_orders_client_order_id.sql
git commit -m "feat(db): kolom client_order_id sebagai kunci idempotensi order kasir"
```

---

### Task 3: Buang nomor 9000-an, ganti nomor perkiraan

`lib/offline.ts` sekarang memberi nomor 9001+ ke order offline. Nomor itu tercetak di struk pelanggan dan tampil di papan, padahal server selalu menimpanya — jadi struk dan sistem menunjuk angka berbeda. Diganti perkiraan berbasis nomor server terakhir yang diketahui.

**Files:**
- Modify: `apps/pos-kasir/lib/offline.ts` (buang `nextLocalOrderNumber`, tambah `estimateOrderNumber`, ubah `createLocalOrder`)
- Create: `apps/pos-kasir/lib/offline.test.ts`
- Modify: `apps/pos-kasir/lib/db.ts:74` (komentar `order_number`)

**Interfaces:**
- Consumes: `db.local_orders`, `db.sync_queue_orders` dari `lib/db.ts`.
- Produces:
  - `export function estimateOrderNumber(knownNumbers: number[], pendingLocalCount: number): number`
  - `CreateLocalOrderInput` bertambah field wajib `estimatedOrderNumber: number` dan `clientOrderId: string`; field `apiUrl` dan `apiPayload` **dihapus** (diganti Task 5).
  - `createLocalOrder` mengembalikan `{ localId: string; orderNumber: number }` (tanda tangan tidak berubah).
  - `LocalOrderRow` bertambah field opsional `is_estimated_number?: boolean`.
- `nextLocalOrderNumber` **dihapus** — tidak ada pemanggil lain selain `createLocalOrder` (sudah diverifikasi lewat grep).

- [ ] **Step 1: Tulis test yang gagal**

Buat `apps/pos-kasir/lib/offline.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { estimateOrderNumber } from './offline'

describe('estimateOrderNumber', () => {
  it('melanjutkan dari nomor server tertinggi yang diketahui', () => {
    // Server terakhir memberi 12, belum ada order lokal tertunda.
    expect(estimateOrderNumber([9, 12, 11], 0)).toBe(13)
  })

  it('menghitung order lokal yang sudah antre supaya tidak kembar', () => {
    // Server terakhir 12, sudah ada 2 order offline menunggu -> berikutnya 15.
    expect(estimateOrderNumber([12], 2)).toBe(15)
  })

  it('mulai dari 1 saat belum ada order sama sekali hari itu', () => {
    expect(estimateOrderNumber([], 0)).toBe(1)
  })

  it('mengabaikan nomor tak valid dari data cache yang rusak', () => {
    expect(estimateOrderNumber([NaN, 0, -3, 7], 0)).toBe(8)
  })

  it('tidak pernah mengembalikan angka 9000-an dari nomor lokal lama', () => {
    // Cache lama bisa berisi 9001 warisan build sebelumnya; jangan diikuti.
    expect(estimateOrderNumber([9001, 9002, 14], 0)).toBe(15)
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

```bash
cd apps/pos-kasir && npm test -- offline.test.ts
```
Harapan: FAIL — `estimateOrderNumber is not a function` / tidak diekspor.

- [ ] **Step 3: Ganti `nextLocalOrderNumber` dengan `estimateOrderNumber`**

Di `apps/pos-kasir/lib/offline.ts`, **hapus seluruh** fungsi `nextLocalOrderNumber` (blok komentar + fungsi, sekitar baris 71-84) dan ganti dengan:

```ts
/**
 * Perkiraan nomor antrian untuk order yang dibuat saat offline.
 *
 * Server tetap satu-satunya yang membagi nomor final (trigger
 * assign_order_number). Fungsi ini hanya menebak angka yang WAJAR untuk
 * dicetak di struk, berdasarkan nomor server tertinggi yang diketahui
 * device hari ini ditambah jumlah order offline yang sudah antre.
 *
 * Dengan satu device per outlet dan offline hitungan menit, tebakan ini
 * hampir selalu tepat. Kalau meleset (ada order online masuk selagi
 * offline), papan kasir memperbarui nomornya begitu tersinkron.
 *
 * Nomor 9000-an dari build lama sengaja diabaikan supaya cache basi tidak
 * menyeret nomor hari ini ke range itu lagi.
 */
const LEGACY_LOCAL_NUMBER_FLOOR = 9000;

export function estimateOrderNumber(knownNumbers: number[], pendingLocalCount: number): number {
  const valid = knownNumbers.filter(
    (n) => Number.isFinite(n) && n > 0 && n < LEGACY_LOCAL_NUMBER_FLOOR
  );
  const highest = valid.length > 0 ? Math.max(...valid) : 0;
  return highest + pendingLocalCount + 1;
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

```bash
cd apps/pos-kasir && npm test -- offline.test.ts
```
Harapan: PASS, 5 test.

- [ ] **Step 5: Ubah `CreateLocalOrderInput` dan `createLocalOrder`**

Di `apps/pos-kasir/lib/offline.ts`, ganti interface `CreateLocalOrderInput` (sekitar baris 95-108) menjadi:

```ts
export interface CreateLocalOrderInput {
  outletId: string;
  items: LocalOrderItemInput[];
  payment_method: string;
  customer_name: string | null;
  total_amount: number;
  discount_amount: number | null;
  source: 'pos' | 'manual';
  channel: string | null;
  promo_subsidy?: number;
  payment_proof_url?: string;
  /** Nomor perkiraan dari estimateOrderNumber — hanya untuk tampilan & struk. */
  estimatedOrderNumber: number;
  /** Kunci idempotensi; dipakai ulang di setiap percobaan kirim. */
  clientOrderId: string;
  /** Snapshot lengkap yang dikirim ke /api/orders/offline-ingest saat online. */
  ingestPayload: OfflineIngestPayload;
}
```

Ganti isi `createLocalOrder` (sekitar baris 115-178) — perubahannya: nomor datang dari input, bukan dihasilkan; antrean menyimpan `ingestPayload` ke endpoint ingest; order ditandai bernomor perkiraan.

```ts
export async function createLocalOrder(
  input: CreateLocalOrderInput
): Promise<{ localId: string; orderNumber: number }> {
  const localId = input.clientOrderId;
  const orderNumber = input.estimatedOrderNumber;
  const nowISO = new Date().toISOString();

  const orderItems: OrderItem[] = input.items.map((it) => ({
    id: crypto.randomUUID(),
    order_id: localId,
    menu_item_id: it.menu_item_id,
    // Konvensi |NOTE| sama seperti server supaya papan order merender identik
    menu_item_name: it.note?.trim() ? `${it.name}|NOTE|${it.note.trim()}` : it.name,
    quantity: it.quantity,
    unit_price: it.unit_price,
    subtotal: it.subtotal,
  }));

  const order: OrderWithItems = {
    id: localId,
    outlet_id: input.outletId,
    order_number: orderNumber,
    customer_name: input.customer_name,
    customer_phone: null,
    status: 'preparing',
    kitchen_receipt_printed: true,
    payment_method: input.payment_method as any,
    total_amount: input.total_amount,
    notes: null,
    source: input.source,
    channel: input.channel,
    promo_subsidy: input.promo_subsidy ?? 0,
    payment_proof_url: input.payment_proof_url ?? null,
    external_order_id: null,
    created_at: nowISO,
    updated_at: nowISO,
    order_items: orderItems,
  };

  await db.transaction('rw', db.local_orders, db.sync_queue_orders, async () => {
    await db.local_orders.add({
      id: localId,
      outlet_id: input.outletId,
      order_number: orderNumber,
      is_estimated_number: true,
      status: 'preparing',
      created_at: nowISO,
      data: order,
    });
    await db.sync_queue_orders.add({
      id: crypto.randomUUID(),
      local_order_id: localId,
      payload: {
        url: '/api/orders/offline-ingest',
        method: 'POST',
        body: JSON.stringify(input.ingestPayload),
      },
      status: 'pending',
      attempts: 0,
      created_at: Date.now(),
    });
  });

  return { localId, orderNumber };
}
```

Tambahkan tipe payload ingest di file yang sama, tepat di atas `CreateLocalOrderInput`:

```ts
/** Snapshot transaksi apa adanya — harga TIDAK dihitung ulang di server. */
export interface OfflineIngestPayload {
  client_order_id: string;
  outlet_id: string;
  created_at: string;
  source: 'pos' | 'manual';
  channel: string | null;
  payment_method: string;
  customer_name: string | null;
  total_amount: number;
  discount_amount: number | null;
  promo_subsidy: number;
  amount_received: number | null;
  change_amount: number | null;
  payment_proof_url: string | null;
  items: Array<{
    menu_item_id: string | null;
    menu_item_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    package_choices?: Record<string, string> | null;
  }>;
}
```

- [ ] **Step 6: Perbarui `lib/db.ts`**

Di `apps/pos-kasir/lib/db.ts`, ubah interface `LocalOrderRow` (baris 71-79) menjadi:

```ts
// Pesanan yang DIBUAT saat offline. Tampil di papan order dengan badge offline
// dan dihapus setelah berhasil dikirim ke server.
export interface LocalOrderRow {
  id: string; // = client_order_id, sekaligus kunci idempotensi ke server
  outlet_id: string;
  order_number: number; // nomor PERKIRAAN; final ditetapkan server saat sinkron
  is_estimated_number?: boolean;
  status: string;
  created_at: string; // ISO
  data: OrderWithItems;
  sync_error?: string;
  needs_attention?: number; // 1 = gagal permanen, tunggu tindakan kasir
}
```

Pada interface `SyncQueueOrder` (baris 22-45), tambahkan dua field setelah `error_message`:

```ts
  attempts?: number;
  next_attempt_at?: number;
```

Tambahkan versi skema Dexie baru di akhir constructor `SukaPOSDB`, setelah blok `this.version(3)`:

```ts
    // v4: index tambahan untuk backoff antrean & daftar "Perlu Perhatian".
    // Tidak ada perubahan bentuk data, jadi tak perlu upgrade handler.
    this.version(4).stores({
      menu_items: 'id, category, is_available',
      categories: 'id, sort_order',
      sync_queue_orders: 'id, status, created_at, next_attempt_at',
      kiosk_settings: 'id',
      orders_cache: 'id, outlet_id, status, created_at',
      shifts_cache: 'id',
      local_orders: 'id, outlet_id, status, created_at, needs_attention',
      sync_queue_mutations: 'id, order_id, status, is_local, created_at',
      app_state: 'key'
    });
```

- [ ] **Step 7: Verifikasi tidak ada sisa referensi**

```bash
cd apps/pos-kasir && grep -rn "nextLocalOrderNumber\|9000\|9001" lib app components --include=*.ts --include=*.tsx
```
Harapan: tidak ada hasil selain konstanta `LEGACY_LOCAL_NUMBER_FLOOR` di `lib/offline.ts`.

- [ ] **Step 8: Commit**

Type-check masih akan gagal di `app/kasir/order-manual/page.tsx` (pemanggil belum disesuaikan, dikerjakan di Task 5). Itu diharapkan pada titik ini.

```bash
cd apps/pos-kasir && npm test
git add apps/pos-kasir/lib/offline.ts apps/pos-kasir/lib/offline.test.ts apps/pos-kasir/lib/db.ts
git commit -m "fix(pos-kasir): buang nomor antrian 9000-an, pakai nomor perkiraan dari server"
```

---

### Task 4: Endpoint `POST /api/orders/offline-ingest`

Order offline sekarang dikirim ulang ke `/api/orders/walk-in` atau `/api/orders/manual`, yang menghitung ulang harga dan promo dari DB. Kalau menu atau promo sudah berubah, order ditolak 4xx dan nyangkut selamanya. Endpoint ini menerima snapshot apa adanya — uangnya sudah diterima dan struknya sudah di tangan pelanggan.

**Files:**
- Create: `apps/pos-kasir/app/api/orders/offline-ingest/route.ts`

**Interfaces:**
- Consumes: `createClient`, `createServiceClient` dari `@/lib/supabase/server`; tipe `OfflineIngestPayload` dari Task 3; kolom `orders.client_order_id` dari Task 2.
- Produces: endpoint `POST /api/orders/offline-ingest` → `200 { success: true, order_id: string, order_number: number, duplicate?: boolean }`.

- [ ] **Step 1: Tulis route**

Buat `apps/pos-kasir/app/api/orders/offline-ingest/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { OfflineIngestPayload } from '@/lib/offline'

// Menerima pesanan yang DIBUAT saat kasir offline, lalu dikirim ulang setelah
// jaringan pulih.
//
// Berbeda dari /api/orders/walk-in dan /api/orders/manual: endpoint ini TIDAK
// menghitung ulang harga atau promo. Transaksinya sudah terjadi, uangnya sudah
// diterima, dan struknya sudah dipegang pelanggan -- menghitung ulang hanya
// membuat order ditolak permanen saat menu/promo berubah.
//
// Yang tetap divalidasi: sesi kasir, kepemilikan outlet, bentuk data, dan
// idempotensi lewat client_order_id.

function isUuid(v: unknown): v is string {
  return typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

export async function POST(request: Request) {
  let body: OfflineIngestPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body tidak valid' }, { status: 400 })
  }

  if (!isUuid(body.client_order_id)) {
    return NextResponse.json({ error: 'client_order_id wajib berupa UUID' }, { status: 400 })
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'Pesanan kosong' }, { status: 400 })
  }
  if (!Number.isFinite(body.total_amount) || body.total_amount < 0) {
    return NextResponse.json({ error: 'total_amount tidak valid' }, { status: 400 })
  }
  if (!body.created_at || Number.isNaN(Date.parse(body.created_at))) {
    return NextResponse.json({ error: 'created_at tidak valid' }, { status: 400 })
  }

  const supabaseService = createServiceClient()
  const supabaseAuth = await createClient()

  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Sesi tidak valid' }, { status: 401 })
  }

  const { data: profile } = await supabaseService
    .from('outlet_staff')
    .select('outlet_id, role, name')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 403 })
  }

  let outletId = profile.outlet_id
  if (profile.role === 'admin' && !outletId) {
    outletId = body.outlet_id
  }
  if (!outletId) {
    return NextResponse.json({ error: 'Akun Anda tidak terhubung ke cabang manapun' }, { status: 403 })
  }
  // Order offline hanya boleh masuk ke outlet milik kasir yang login.
  if (body.outlet_id !== outletId) {
    return NextResponse.json({ error: 'Outlet pesanan tidak sesuai akun kasir' }, { status: 403 })
  }

  // ── Idempotensi: percobaan ulang mengembalikan order yang sama ───────────
  const { data: existing } = await supabaseService
    .from('orders')
    .select('id, order_number')
    .eq('client_order_id', body.client_order_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      success: true,
      duplicate: true,
      order_id: existing.id,
      order_number: existing.order_number,
    })
  }

  // ── Insert order. order_number SENGAJA tidak dikirim: trigger
  //    assign_order_number yang menetapkannya secara atomik. ───────────────
  const { data: order, error: orderError } = await supabaseService
    .from('orders')
    .insert({
      outlet_id: outletId,
      client_order_id: body.client_order_id,
      customer_name: body.customer_name,
      cashier_name: profile.name || null,
      payment_method: body.payment_method,
      total_amount: body.total_amount,
      discount_amount: body.discount_amount,
      promo_subsidy: body.promo_subsidy ?? 0,
      payment_proof_url: body.payment_proof_url,
      amount_received: body.amount_received,
      change_amount: body.change_amount,
      status: 'preparing',
      kitchen_receipt_printed: true,
      source: body.source,
      channel: body.channel,
      sales_source: body.channel || body.source,
      // Waktu transaksi ASLI, bukan waktu sinkron -- kalau tidak, laporan
      // penjualan dan tutup shift ikut melenceng.
      created_at: body.created_at,
    })
    .select('id, order_number')
    .single()

  if (orderError || !order) {
    // 23505 = unique_violation. Bisa terjadi kalau dua percobaan berlomba;
    // ambil hasil pemenangnya supaya percobaan yang kalah tidak dianggap gagal.
    if ((orderError as any)?.code === '23505') {
      const { data: raced } = await supabaseService
        .from('orders')
        .select('id, order_number')
        .eq('client_order_id', body.client_order_id)
        .maybeSingle()
      if (raced) {
        return NextResponse.json({
          success: true,
          duplicate: true,
          order_id: raced.id,
          order_number: raced.order_number,
        })
      }
    }
    console.error('offline-ingest: gagal insert order', orderError)
    return NextResponse.json({ error: 'Gagal menyimpan pesanan offline' }, { status: 500 })
  }

  const { error: itemsError } = await supabaseService.from('order_items').insert(
    body.items.map((it) => ({
      order_id: order.id,
      menu_item_id: it.menu_item_id,
      menu_item_name: it.menu_item_name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      subtotal: it.subtotal,
      package_choices: it.package_choices ?? null,
    }))
  )

  if (itemsError) {
    console.error('offline-ingest: gagal insert items', itemsError)
    await supabaseService.from('orders').delete().eq('id', order.id)
    return NextResponse.json({ error: 'Gagal menyimpan item pesanan' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    order_id: order.id,
    order_number: order.order_number,
  })
}
```

- [ ] **Step 2: Type-check route**

```bash
cd apps/pos-kasir && npm run type-check 2>&1 | grep "offline-ingest"
```
Harapan: tidak ada error yang menyebut `offline-ingest`. (Error lain di `order-manual/page.tsx` masih diharapkan sampai Task 5 selesai.)

Kalau muncul error kolom `cashier_name`, `sales_source`, `promo_subsidy`, atau `discount_amount` tidak dikenal, cek kolom aslinya sebelum menghapus baris:

```bash
npx supabase db query "select column_name from information_schema.columns where table_schema='public' and table_name='orders' order by ordinal_position" --linked
```

- [ ] **Step 3: Commit**

```bash
git add apps/pos-kasir/app/api/orders/offline-ingest/route.ts
git commit -m "feat(pos-kasir): endpoint ingest order offline dengan snapshot harga & idempotensi"
```

---

### Task 5: Perbaiki jalur submit di halaman order-manual

Ini akar penyebab order hantu. `printReceipt()` berada di dalam blok `try`, dan `catch` menangkap **semua** error tanpa memeriksa apakah benar-benar masalah jaringan. Printer Bluetooth gagal → order sudah sukses di server → catch tetap membuat order lokal + antrean kirim → order dobel.

**Files:**
- Modify: `apps/pos-kasir/app/kasir/order-manual/page.tsx` (`handleSubmit` ~baris 472-632, `handleWalkInPay` ~baris 634-830)

**Interfaces:**
- Consumes: `createLocalOrder`, `estimateOrderNumber`, `isNetworkError`, tipe `OfflineIngestPayload` dari `@/lib/offline`; `db.local_orders` dari `@/lib/db`.
- Produces: tidak ada ekspor baru.

- [ ] **Step 1: Tambahkan import dan pembantu nomor perkiraan**

Di bagian import `apps/pos-kasir/app/kasir/order-manual/page.tsx`, ganti baris import offline yang ada menjadi:

```ts
import { createLocalOrder, estimateOrderNumber, isNetworkError, type OfflineIngestPayload } from '@/lib/offline'
import { db } from '@/lib/db'
```

Tambahkan fungsi pembantu di dalam komponen, tepat sebelum `handleSubmit`:

```ts
  // Nomor perkiraan untuk struk offline: nomor server tertinggi yang device
  // ketahui hari ini, ditambah jumlah order offline yang sudah antre.
  async function nextEstimatedNumber(outlet: string): Promise<number> {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const [cached, pending] = await Promise.all([
      db.orders_cache.where('outlet_id').equals(outlet).toArray(),
      db.local_orders.where('outlet_id').equals(outlet).toArray(),
    ])
    const knownNumbers = cached
      .filter((r) => new Date(r.created_at) >= today)
      .map((r) => r.data.order_number)
    const pendingToday = pending.filter((r) => new Date(r.created_at) >= today).length
    return estimateOrderNumber(knownNumbers, pendingToday)
  }
```

- [ ] **Step 2: Perbaiki `handleSubmit` — keluarkan cetak struk dari `try`, saring error jaringan**

Ganti blok `try { … } catch (err) { … } finally { … }` di `handleSubmit` (mulai dari `try {` sekitar baris 505 sampai `}` penutup `finally` sekitar baris 632) menjadi:

```ts
    const clientOrderId = crypto.randomUUID()
    let receipt: ReceiptData | null = null
    let successState: { orderNumber: number; method: string; change: number | null } | null = null

    try {
      const res = await fetch('/api/orders/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, client_order_id: clientOrderId }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        // 5xx BUKAN kondisi offline. Server mungkin sudah menyimpan sebagian.
        // Tampilkan errornya; kasir yang memutuskan mengulang.
        postToNative({ type: 'haptic', style: 'error' })
        setError(data.error ?? `Gagal membuat pesanan (${res.status})`)
        setSubmitting(false)
        return
      }

      postToNative({ type: 'haptic', style: 'success' })
      receipt = buildManualReceipt(data.order_number, data.change_amount ?? null)
      successState = {
        orderNumber: data.order_number,
        method: payment as string,
        change: data.change_amount ?? null,
      }
    } catch (err) {
      // Hanya kegagalan jaringan yang boleh jadi order offline. Bug lain harus
      // muncul sebagai error, bukan diam-diam melahirkan order kedua.
      if (!isNetworkError(err)) {
        console.error('handleSubmit gagal (bukan masalah jaringan):', err)
        postToNative({ type: 'haptic', style: 'error' })
        setError('Terjadi kesalahan saat membuat pesanan. Coba lagi.')
        setSubmitting(false)
        return
      }

      const estimated = await nextEstimatedNumber(outletId as string)
      const items = lineList.map((l) => {
        const unit = wrappedCalculateItemPrice(l.item.price, l.item.id, l.item.channel_prices)
        return {
          menu_item_id: l.item.id,
          name: l.item.name,
          note: l.note,
          quantity: l.quantity,
          unit_price: unit,
          subtotal: unit * l.quantity,
        }
      })
      const promoSubsidyValue = ['gofood', 'grabfood', 'shopeefood', 'tiktok', 'tiktokgo'].includes(reqChannel || '')
        ? Number(promoSubsidy) || 0
        : 0

      const ingestPayload: OfflineIngestPayload = {
        client_order_id: clientOrderId,
        outlet_id: outletId as string,
        created_at: new Date().toISOString(),
        source: 'manual',
        channel: reqChannel,
        payment_method: payment as string,
        customer_name: finalCustomerName || null,
        total_amount: totalPrice,
        discount_amount: globalDiscount > 0 ? globalDiscount : null,
        promo_subsidy: promoSubsidyValue,
        amount_received: payment === 'cash' ? amountReceived : null,
        change_amount: payment === 'cash' && amountReceived !== null ? amountReceived - totalPrice : null,
        payment_proof_url: typeof proofUrl === 'string' ? proofUrl : null,
        items: items.map((it) => ({
          menu_item_id: it.menu_item_id,
          menu_item_name: it.note?.trim() ? `${it.name}|NOTE|${it.note.trim()}` : it.name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          subtotal: it.subtotal,
        })),
      }

      const { orderNumber } = await createLocalOrder({
        outletId: outletId as string,
        items,
        payment_method: payment as string,
        customer_name: finalCustomerName || null,
        total_amount: totalPrice,
        discount_amount: globalDiscount > 0 ? globalDiscount : null,
        source: 'manual',
        channel: reqChannel,
        promo_subsidy: promoSubsidyValue,
        payment_proof_url: (typeof proofUrl === 'string' ? proofUrl : undefined) as string | undefined,
        estimatedOrderNumber: estimated,
        clientOrderId,
        ingestPayload,
      })

      postToNative({ type: 'haptic', style: 'success' })
      receipt = buildManualReceipt(orderNumber, ingestPayload.change_amount)
      successState = { orderNumber, method: payment as string, change: ingestPayload.change_amount }
    } finally {
      setSubmitting(false)
    }

    // Cetak DI LUAR try/catch order. Printer gagal tidak boleh lagi membuat
    // order kedua -- ini penyebab order hantu sebelumnya.
    if (receipt) {
      try {
        await printReceipt(receipt)
      } catch (printErr) {
        console.error('Gagal mencetak struk (pesanan tetap tersimpan):', printErr)
        setError('Pesanan tersimpan, tapi struk gagal dicetak. Cek koneksi printer.')
      }
    }

    if (successState) {
      setSuccess(successState)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setLines([])
      setChannel(null)
      setPayment(null)
      setCustomerName('')
      setPromoSubsidy('')
      setCartOpen(false)
    }
```

Tambahkan pembantu penyusun struk di dalam `handleSubmit`, tepat sebelum `const clientOrderId = …`, supaya kode struk tidak diduplikasi antara jalur online dan offline:

```ts
    const buildManualReceipt = (orderNumber: number, changeAmount: number | null): ReceiptData => ({
      outletName: outletName || 'SUKA SHAWARMA',
      orderNumber,
      dateISO: new Date().toISOString(),
      customerName: customerName.trim() || null,
      items: lineList.map((l) => {
        const unit = wrappedCalculateItemPrice(l.item.price, l.item.id, l.item.channel_prices)
        return {
          name: l.item.name,
          note: l.note?.trim() || undefined,
          quantity: l.quantity,
          unit_price: unit,
          subtotal: unit * l.quantity,
          isChild: !!l.parentId,
        }
      }),
      subtotal: subtotalAmount,
      discount: globalDiscount,
      total: totalPrice,
      paymentMethod: payment as 'cash' | 'qris',
      amountReceived: payment === 'cash' ? amountReceived : null,
      changeAmount,
      receiptType: 'kitchen',
    })
```

- [ ] **Step 3: Terapkan pola yang sama ke `handleWalkInPay`**

Ganti blok `try/catch/finally` di `handleWalkInPay` dengan struktur identik. Perbedaannya hanya: endpoint `/api/orders/walk-in`, `source: 'pos'`, `channel: null`, memakai snapshot `snapCustomer`/`snapSubtotal`/`snapDiscount`/`receiptItems` yang sudah diambil sebelum keranjang direset, memakai state `setWalkInError`/`setWalkInSubmitting`/`setWalkInSuccess`, dan blok upload bukti QRIS tetap di jalur sukses online saja.

```ts
    const clientOrderId = crypto.randomUUID()
    const totalAmount = snapSubtotal - snapDiscount
    let receipt: ReceiptData | null = null
    let successState: { orderNumber: number; method: WalkInPayment; change: number | null; receipt: ReceiptData } | null = null

    const buildWalkInReceipt = (orderNumber: number, changeAmount: number | null): ReceiptData => ({
      outletName: outletName || 'SUKA SHAWARMA',
      orderNumber,
      dateISO: new Date().toISOString(),
      customerName: snapCustomer,
      items: receiptItems,
      subtotal: snapSubtotal,
      discount: snapDiscount,
      total: totalAmount,
      paymentMethod: method,
      amountReceived: amountReceived ?? null,
      changeAmount,
      receiptType: 'kitchen',
    })

    try {
      const res = await fetch('/api/orders/walk-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, client_order_id: clientOrderId }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        postToNative({ type: 'haptic', style: 'error' })
        setWalkInError(data.error ?? `Gagal membuat pesanan (${res.status})`)
        setWalkInSubmitting(false)
        return
      }

      if (proofFile instanceof File && data.order_id) {
        try {
          const ext = proofFile.name.split('.').pop() || 'jpg'
          const d = new Date()
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          const cleanOutlet = (outletName || 'OUTLET').replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()
          const fileName = `${cleanOutlet}_${data.order_number}_${dateStr}.${ext}`
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('payment_proofs')
            .upload(fileName, proofFile, { upsert: true })
          if (!uploadError && uploadData) {
            const { data: publicUrlData } = supabase.storage.from('payment_proofs').getPublicUrl(uploadData.path)
            await supabase.from('orders').update({ payment_proof_url: publicUrlData.publicUrl }).eq('id', data.order_id)
          } else {
            console.error('Failed to upload proof:', uploadError)
          }
        } catch (uploadErr) {
          console.error('Error uploading proof:', uploadErr)
        }
      }

      postToNative({ type: 'haptic', style: 'success' })
      receipt = buildWalkInReceipt(data.order_number, data.change_amount ?? null)
      successState = { orderNumber: data.order_number, method, change: data.change_amount ?? null, receipt }
    } catch (err) {
      if (!isNetworkError(err)) {
        console.error('handleWalkInPay gagal (bukan masalah jaringan):', err)
        postToNative({ type: 'haptic', style: 'error' })
        setWalkInError('Terjadi kesalahan saat membuat pesanan. Coba lagi.')
        setWalkInSubmitting(false)
        return
      }

      const estimated = await nextEstimatedNumber(outletId as string)
      const changeAmount = method === 'cash' && amountReceived !== null ? amountReceived - totalAmount : null
      const items = lineList.map((l) => {
        const unit = wrappedCalculateItemPrice(l.item.price, l.item.id, l.item.channel_prices)
        return {
          menu_item_id: l.item.id,
          name: l.item.name,
          note: l.note,
          quantity: l.quantity,
          unit_price: unit,
          subtotal: unit * l.quantity,
        }
      })

      const ingestPayload: OfflineIngestPayload = {
        client_order_id: clientOrderId,
        outlet_id: outletId as string,
        created_at: new Date().toISOString(),
        source: 'pos',
        channel: null,
        payment_method: method,
        customer_name: snapCustomer,
        total_amount: totalAmount,
        discount_amount: snapDiscount > 0 ? snapDiscount : null,
        promo_subsidy: 0,
        amount_received: amountReceived ?? null,
        change_amount: changeAmount,
        payment_proof_url: typeof proofFile === 'string' ? proofFile : null,
        items: items.map((it) => ({
          menu_item_id: it.menu_item_id,
          menu_item_name: it.note?.trim() ? `${it.name}|NOTE|${it.note.trim()}` : it.name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          subtotal: it.subtotal,
        })),
      }

      const { orderNumber } = await createLocalOrder({
        outletId: outletId as string,
        items,
        payment_method: method,
        customer_name: snapCustomer,
        total_amount: totalAmount,
        discount_amount: snapDiscount > 0 ? snapDiscount : null,
        source: 'pos',
        channel: null,
        payment_proof_url: (typeof proofFile === 'string' ? proofFile : undefined) as string | undefined,
        estimatedOrderNumber: estimated,
        clientOrderId,
        ingestPayload,
      })

      postToNative({ type: 'haptic', style: 'success' })
      receipt = buildWalkInReceipt(orderNumber, changeAmount)
      successState = { orderNumber, method, change: changeAmount, receipt }
    } finally {
      setWalkInSubmitting(false)
    }

    if (receipt) {
      try {
        await printReceipt(receipt)
      } catch (printErr) {
        console.error('Gagal mencetak struk (pesanan tetap tersimpan):', printErr)
        setWalkInError('Pesanan tersimpan, tapi struk gagal dicetak. Cek koneksi printer.')
      }
    }

    if (successState) {
      setWalkInSuccess(successState)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setLines([])
      setCustomerName('')
      setCartOpen(false)
      setWalkInPanelKey((k) => k + 1)
    }
```

- [ ] **Step 4: Terima `client_order_id` di dua endpoint online**

Supaya jalur online juga idempoten (bukan cuma jalur offline), tambahkan di `apps/pos-kasir/app/api/orders/walk-in/route.ts`:

Pada `interface WalkInPayload`, ganti `order_number?: number` menjadi:
```ts
  client_order_id?: string
```

Pada objek `baseOrder` (baris ~229), ganti `order_number: body.order_number,` menjadi:
```ts
    client_order_id: body.client_order_id ?? null,
```

Lakukan perubahan setara di `apps/pos-kasir/app/api/orders/manual/route.ts`: ganti `order_number?: number` pada interface payload (baris ~31) dengan `client_order_id?: string`, dan ganti `order_number: body.order_number,` (baris ~260) dengan `client_order_id: body.client_order_id ?? null,`.

Ini juga menghapus satu-satunya jalur yang bisa menyuntikkan `order_number` dari client — sekarang server mutlak yang menentukan.

- [ ] **Step 5: Type-check dan test**

```bash
cd apps/pos-kasir && npm run type-check
```
Harapan: 0 error.

```bash
cd apps/pos-kasir && npm test
```
Harapan: seluruh test lulus.

- [ ] **Step 6: Commit**

```bash
git add apps/pos-kasir/app/kasir/order-manual/page.tsx apps/pos-kasir/app/api/orders/walk-in/route.ts apps/pos-kasir/app/api/orders/manual/route.ts
git commit -m "fix(pos-kasir): cetak struk di luar try, hanya error jaringan yang jadi order offline"
```

---

### Task 6: Klasifikasi kegagalan sinkron & hentikan penghapusan otomatis

`OfflineSyncManager` sekarang menandai `status: 'error'` permanen untuk semua kegagalan non-5xx, lalu `cleanupStaleOrders()` menghapus order offline yang lebih tua dari 12 jam **beserta antreannya** — penjualan hilang diam-diam padahal uangnya sudah diterima.

**Files:**
- Create: `apps/pos-kasir/lib/syncClassify.ts`
- Create: `apps/pos-kasir/lib/syncClassify.test.ts`
- Modify: `apps/pos-kasir/components/OfflineSyncManager.tsx`

**Interfaces:**
- Produces:
  - `export type SyncOutcome = 'retry' | 'give_up'`
  - `export function classifySyncFailure(status: number): SyncOutcome`
  - `export function backoffDelayMs(attempts: number): number`
- Consumes: `db.sync_queue_orders` (field `attempts`, `next_attempt_at` dari Task 3), `db.local_orders` (field `needs_attention`).

- [ ] **Step 1: Tulis test yang gagal**

Buat `apps/pos-kasir/lib/syncClassify.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { classifySyncFailure, backoffDelayMs } from './syncClassify'

describe('classifySyncFailure', () => {
  it('mencoba ulang error server sementara', () => {
    expect(classifySyncFailure(500)).toBe('retry')
    expect(classifySyncFailure(502)).toBe('retry')
    expect(classifySyncFailure(503)).toBe('retry')
  })

  it('mencoba ulang saat kena rate limit', () => {
    expect(classifySyncFailure(429)).toBe('retry')
  })

  it('mencoba ulang saat sesi kedaluwarsa — bisa pulih setelah token refresh', () => {
    expect(classifySyncFailure(401)).toBe('retry')
  })

  it('menyerah pada penolakan bisnis yang tidak akan berubah', () => {
    expect(classifySyncFailure(400)).toBe('give_up')
    expect(classifySyncFailure(403)).toBe('give_up')
    expect(classifySyncFailure(422)).toBe('give_up')
  })
})

describe('backoffDelayMs', () => {
  it('menunda lebih lama tiap percobaan gagal', () => {
    expect(backoffDelayMs(1)).toBeLessThan(backoffDelayMs(2))
    expect(backoffDelayMs(2)).toBeLessThan(backoffDelayMs(3))
  })

  it('percobaan pertama tidak menunggu lama', () => {
    expect(backoffDelayMs(0)).toBeLessThanOrEqual(30_000)
  })

  it('dibatasi supaya tidak menunda berjam-jam', () => {
    expect(backoffDelayMs(50)).toBeLessThanOrEqual(15 * 60 * 1000)
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

```bash
cd apps/pos-kasir && npm test -- syncClassify.test.ts
```
Harapan: FAIL — modul `./syncClassify` tidak ditemukan.

- [ ] **Step 3: Tulis implementasi**

Buat `apps/pos-kasir/lib/syncClassify.ts`:

```ts
/**
 * Klasifikasi kegagalan pengiriman ulang order offline.
 *
 * Sebelumnya semua respons non-5xx langsung ditandai error permanen, jadi
 * sesi yang kedaluwarsa (401) pun mematikan antrean selamanya. Sekarang
 * dibedakan: yang bisa pulih dicoba lagi dengan backoff, yang tidak akan
 * berubah diserahkan ke kasir lewat daftar "Perlu Perhatian".
 */
export type SyncOutcome = 'retry' | 'give_up';

const RETRYABLE_STATUSES = new Set([401, 408, 425, 429]);

export function classifySyncFailure(status: number): SyncOutcome {
  if (status >= 500) return 'retry';
  if (RETRYABLE_STATUSES.has(status)) return 'retry';
  return 'give_up';
}

const BASE_DELAY_MS = 15_000;
const MAX_DELAY_MS = 15 * 60 * 1000;

export function backoffDelayMs(attempts: number): number {
  const safeAttempts = Math.max(0, Math.floor(attempts));
  const delay = BASE_DELAY_MS * Math.pow(2, safeAttempts);
  return Math.min(delay, MAX_DELAY_MS);
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

```bash
cd apps/pos-kasir && npm test -- syncClassify.test.ts
```
Harapan: PASS, 7 test.

- [ ] **Step 5: Pakai di `OfflineSyncManager`**

Di `apps/pos-kasir/components/OfflineSyncManager.tsx`, tambahkan import:

```ts
import { classifySyncFailure, backoffDelayMs } from '@/lib/syncClassify';
```

Ganti fungsi `syncOrderCreations` (baris 22-95) menjadi:

```ts
    const syncOrderCreations = async (): Promise<boolean> => {
      const now = Date.now();
      const pendingOrders = (await db.sync_queue_orders
        .where('status').equals('pending')
        .sortBy('created_at'))
        .filter((e) => !e.next_attempt_at || e.next_attempt_at <= now);

      if (pendingOrders.length === 0) return false;

      console.log(`[SyncManager] Sinkronisasi ${pendingOrders.length} pesanan offline...`);
      let hasSuccess = false;

      for (const entry of pendingOrders) {
        const attempts = (entry.attempts ?? 0) + 1;
        try {
          const { url, ...options } = entry.payload;
          const res = await fetch(url, {
            ...options,
            headers: { ...options.headers, 'Content-Type': 'application/json' },
          });

          if (res.ok) {
            const data = await res.json().catch(() => ({} as any));
            hasSuccess = true;

            if (entry.local_order_id) {
              const serverId: string | undefined = data.order_id;
              const localMutations = await db.sync_queue_mutations
                .where('order_id').equals(entry.local_order_id).toArray();
              for (const m of localMutations) {
                if (serverId) {
                  await db.sync_queue_mutations.update(m.id, { order_id: serverId, is_local: 0 });
                } else {
                  await db.sync_queue_mutations.delete(m.id);
                }
              }
              await db.local_orders.delete(entry.local_order_id);
            }

            await db.sync_queue_orders.delete(entry.id);
            console.log(`[SyncManager] Pesanan offline ${entry.id} berhasil dikirim (order #${data.order_number}).`);
            continue;
          }

          const data = await res.json().catch(() => ({} as any));
          const message = data.error || data.message || `HTTP ${res.status}`;

          if (classifySyncFailure(res.status) === 'retry') {
            // Bisa pulih sendiri: mundur sejenak, jangan matikan antrean.
            await db.sync_queue_orders.update(entry.id, {
              attempts,
              next_attempt_at: Date.now() + backoffDelayMs(attempts),
              error_message: `Menunggu percobaan ulang (${message})`,
            });
            console.warn(`[SyncManager] ${res.status} untuk ${entry.id}, dicoba lagi nanti.`);
            continue;
          }

          // Penolakan yang tidak akan berubah dengan sendirinya. JANGAN dihapus
          // -- uangnya sudah diterima kasir. Serahkan ke daftar Perlu Perhatian.
          console.error(`[SyncManager] Ditolak permanen ${entry.id}:`, message);
          await db.sync_queue_orders.update(entry.id, {
            status: 'error',
            attempts,
            error_message: message,
          });
          if (entry.local_order_id) {
            await db.local_orders.update(entry.local_order_id, {
              sync_error: message,
              needs_attention: 1,
            });
          }
        } catch (error) {
          // Jaringan masih bermasalah: biarkan pending, coba lagi siklus berikutnya.
          console.warn(`[SyncManager] Network error saat sinkron ${entry.id}, lanjut...`, error);
          await db.sync_queue_orders.update(entry.id, {
            attempts,
            next_attempt_at: Date.now() + backoffDelayMs(attempts),
          });
          continue;
        }
      }

      return hasSuccess;
    };
```

- [ ] **Step 6: Hapus penghapusan otomatis**

Di file yang sama, **hapus seluruh fungsi `cleanupStaleOrders`** (baris 138-169) dan **hapus pemanggilannya** di dalam `runSync` (`await cleanupStaleOrders();`). Ganti dengan komentar di posisi pemanggilan:

```ts
        // Tidak ada pembersihan otomatis. Order offline yang gagal sinkron
        // TIDAK boleh dihapus diam-diam -- uangnya sudah diterima kasir.
        // Order bermasalah muncul di panel "Perlu Perhatian" (KasirOrderClient)
        // dan hanya hilang lewat tindakan sadar kasir.
```

Hapus juga mutasi status yatim yang ikut terhapus di sana; mutasi yang benar-benar yatim sudah ditangani `deleteLocalOrder` di `lib/offline.ts`.

- [ ] **Step 7: Verifikasi dan commit**

```bash
cd apps/pos-kasir && grep -rn "cleanupStaleOrders" components lib app
```
Harapan: tidak ada hasil.

```bash
cd apps/pos-kasir && npm run type-check && npm test
```
Harapan: 0 error type-check, semua test lulus.

```bash
git add apps/pos-kasir/lib/syncClassify.ts apps/pos-kasir/lib/syncClassify.test.ts apps/pos-kasir/components/OfflineSyncManager.tsx
git commit -m "fix(pos-kasir): klasifikasi kegagalan sinkron + backoff, hentikan hapus otomatis order offline"
```

---

### Task 7: Panel "Perlu Perhatian" di papan kasir

Order yang gagal sinkron permanen harus terlihat dan diselesaikan kasir secara sadar, bukan menghilang.

**Files:**
- Create: `apps/pos-kasir/components/kasir/NeedsAttentionPanel.tsx`
- Modify: `apps/pos-kasir/app/kasir/KasirOrderClient.tsx` (sekitar baris 675-690, tempat `localOrderRows` dibaca)

**Interfaces:**
- Consumes: `db.local_orders` (`needs_attention`, `sync_error`), `deleteLocalOrder` dan `retryLocalOrderSync` dari `@/lib/offline` (keduanya sudah ada).
- Produces: `export default function NeedsAttentionPanel({ outletId }: { outletId: string })`.

- [ ] **Step 1: Buat komponen panel**

Buat `apps/pos-kasir/components/kasir/NeedsAttentionPanel.tsx`:

```tsx
'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, RotateCw, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { deleteLocalOrder, retryLocalOrderSync } from '@/lib/offline';

/**
 * Pesanan offline yang ditolak server secara permanen.
 *
 * Sengaja TIDAK dihapus otomatis: uangnya sudah diterima kasir, jadi
 * menghilangkannya diam-diam sama dengan kehilangan penjualan. Kasir yang
 * memutuskan mengirim ulang atau membatalkan.
 */
export default function NeedsAttentionPanel({ outletId }: { outletId: string }) {
  const stuck = useLiveQuery(
    () =>
      db.local_orders
        .where('outlet_id')
        .equals(outletId)
        .filter((r) => r.needs_attention === 1)
        .toArray(),
    [outletId]
  );

  if (!stuck || stuck.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
        <h3 className="font-semibold text-amber-900">
          {stuck.length} pesanan offline perlu perhatian
        </h3>
      </div>
      <p className="mb-3 text-sm text-amber-800">
        Pesanan berikut gagal dikirim ke server dan tidak akan dicoba ulang otomatis.
        Pesanan tetap tersimpan di perangkat ini sampai Anda memutuskan.
      </p>
      <ul className="space-y-2">
        {stuck.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3"
          >
            <div className="min-w-0">
              <p className="font-medium">
                #{row.order_number} · Rp {row.data.total_amount.toLocaleString('id-ID')}
              </p>
              <p className="break-words text-xs text-red-600">{row.sync_error}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => retryLocalOrderSync(row.id)}
                className="flex items-center gap-1 rounded-lg bg-suka-orange px-3 py-1.5 text-sm font-medium text-white"
              >
                <RotateCw className="h-4 w-4" /> Kirim Ulang
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      `Batalkan pesanan #${row.order_number}? Pesanan ini akan hilang dari perangkat dan TIDAK tercatat di server.`
                    )
                  ) {
                    deleteLocalOrder(row.id);
                  }
                }}
                className="flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600"
              >
                <Trash2 className="h-4 w-4" /> Batalkan
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Reset penanda saat kasir menekan Kirim Ulang**

Di `apps/pos-kasir/lib/offline.ts`, di dalam `retryLocalOrderSync`, ganti blok update `local_orders` menjadi:

```ts
    const local = await db.local_orders.get(localId);
    if (local) {
      await db.local_orders.update(localId, { sync_error: undefined, needs_attention: 0 });
    }
```

Dan pada loop reset antrean di fungsi yang sama, ganti objek update menjadi:

```ts
      await db.sync_queue_orders.update(q.id, {
        status: 'pending',
        error_message: undefined,
        attempts: 0,
        next_attempt_at: undefined,
      });
```

- [ ] **Step 3: Pasang panel di papan kasir**

Di `apps/pos-kasir/app/kasir/KasirOrderClient.tsx`, tambahkan import:

```ts
import NeedsAttentionPanel from '@/components/kasir/NeedsAttentionPanel'
```

Sisipkan komponen di paling atas area papan order, tepat sebelum elemen yang merender daftar kolom pesanan:

```tsx
{outletId && <NeedsAttentionPanel outletId={outletId} />}
```

Untuk menemukan titik sisip yang tepat, cari elemen pembungkus grid kolom pesanan:

```bash
cd apps/pos-kasir && grep -n "grid\|columns\|Menunggu\|Diproses" app/kasir/KasirOrderClient.tsx | head -20
```

- [ ] **Step 4: Tandai nomor perkiraan di kartu order offline**

Di `apps/pos-kasir/app/kasir/KasirOrderClient.tsx` sekitar baris 284, badge offline dirender saat `isLocal && !order._sync_error`. Tambahkan penanda nomor perkiraan pada badge itu supaya kasir tahu angkanya belum final — ubah teks badge menjadi menyertakan kata "nomor sementara". Contoh isi badge:

```tsx
<span title="Nomor final ditetapkan server saat pesanan tersinkron">
  Offline · nomor sementara
</span>
```

- [ ] **Step 5: Verifikasi dan commit**

```bash
cd apps/pos-kasir && npm run type-check && npm test && npm run build
```
Harapan: 0 error type-check, semua test lulus, build sukses.

```bash
git add apps/pos-kasir/components/kasir/NeedsAttentionPanel.tsx apps/pos-kasir/app/kasir/KasirOrderClient.tsx apps/pos-kasir/lib/offline.ts
git commit -m "feat(pos-kasir): panel Perlu Perhatian untuk order offline yang gagal sinkron"
```

---

### Task 8: Tarik pesanan online dari sisi server

Ingest pesanan online sekarang 100% bergantung pada tab browser kasir yang terbuka dan online. Tab tertutup atau outlet offline → pesanan tidak masuk. Pemulihannya pun hanya `limit(10)` order `paid` terbaru, jadi order lama terlewat permanen.

**Files:**
- Create: `apps/pos-kasir/app/api/cron/pull-online-orders/route.ts`
- Modify: `apps/pos-kasir/vercel.json`
- Modify: `apps/pos-kasir/components/OnlineOrderSync.tsx:100-120` (`syncPendingPaidOrders`)

**Interfaces:**
- Consumes: `createServiceClient` dari `@/lib/supabase/server`; env `NEXT_PUBLIC_SS_ORDER_URL`, `NEXT_PUBLIC_SS_ORDER_ANON_KEY`, `CRON_SECRET`; endpoint `/api/orders/pull-online` yang sudah ada.
- Produces: endpoint `GET /api/cron/pull-online-orders` → `{ success: true, pulled: number, skipped: number }`.

- [ ] **Step 1: Buat route cron**

Buat `apps/pos-kasir/app/api/cron/pull-online-orders/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient as createOrderClient } from '@supabase/supabase-js'

// Menarik pesanan online yang sudah dibayar ke POS Kasir dari sisi SERVER.
//
// Sebelumnya ingest hanya jalan lewat OnlineOrderSync di browser, jadi pesanan
// tidak masuk sama sekali kalau tab kasir tertutup atau outlet sedang offline.
// Route ini membuat ingest tidak lagi bergantung pada perangkat di outlet.

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const SS_ORDER_URL = process.env.NEXT_PUBLIC_SS_ORDER_URL
  const SS_ORDER_KEY = process.env.NEXT_PUBLIC_SS_ORDER_ANON_KEY
  if (!SS_ORDER_URL || !SS_ORDER_KEY) {
    return NextResponse.json({ error: 'Kredensial SS_ORDER tidak dikonfigurasi' }, { status: 500 })
  }

  const ssOrderDb = createOrderClient(SS_ORDER_URL, SS_ORDER_KEY)
  const posDb = createServiceClient()

  // Jendela 3 hari: cukup lebar untuk menutup outlet yang offline semalaman,
  // cukup sempit supaya cron per menit tetap ringan.
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  const { data: paidOrders, error: paidErr } = await ssOrderDb
    .from('orders')
    .select('id')
    .eq('status', 'paid')
    .gte('created_at', since)

  if (paidErr) {
    console.error('pull-online-orders: gagal baca order-system', paidErr)
    return NextResponse.json({ error: paidErr.message }, { status: 500 })
  }
  if (!paidOrders || paidOrders.length === 0) {
    return NextResponse.json({ success: true, pulled: 0, skipped: 0 })
  }

  // Anti-join: mana yang BELUM punya pasangan di pos-kasir.
  // Menggantikan limit(10) lama yang membuat order lama terlewat permanen.
  const ids = paidOrders.map((o) => o.id)
  const { data: alreadyPulled } = await posDb
    .from('orders')
    .select('external_order_id')
    .in('external_order_id', ids)

  const pulledSet = new Set((alreadyPulled ?? []).map((r) => r.external_order_id))
  const missing = ids.filter((id) => !pulledSet.has(id))

  const origin = new URL(request.url).origin
  let pulled = 0

  for (const externalId of missing) {
    try {
      const res = await fetch(`${origin}/api/orders/pull-online`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ external_order_id: externalId }),
      })
      if (res.ok) {
        pulled += 1
      } else {
        const detail = await res.json().catch(() => ({} as any))
        console.warn(`pull-online-orders: gagal tarik ${externalId}`, detail.error)
      }
    } catch (err) {
      console.warn(`pull-online-orders: error saat tarik ${externalId}`, err)
    }
  }

  return NextResponse.json({
    success: true,
    pulled,
    skipped: ids.length - missing.length,
  })
}
```

- [ ] **Step 2: Daftarkan cron**

Ganti isi `apps/pos-kasir/vercel.json` menjadi:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-scheduled-orders",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/pull-online-orders",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/cancel-expired",
      "schedule": "0 * * * *"
    }
  ]
}
```

- [ ] **Step 3: Buang `limit(10)` di sync browser**

Di `apps/pos-kasir/components/OnlineOrderSync.tsx`, ganti fungsi `syncPendingPaidOrders` (baris 100-120) menjadi:

```ts
    // Jalur browser dipertahankan untuk latensi rendah, tapi bukan lagi
    // satu-satunya jalur -- cron server /api/cron/pull-online-orders yang
    // menjamin tidak ada pesanan terlewat. Karena itu di sini cukup ambil
    // yang terbaru, bukan mencoba menutup seluruh celah dengan limit(10).
    async function syncPendingPaidOrders() {
      try {
        const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
        const { data: orders } = await ssOrderDb
          .from('orders')
          .select('id')
          .eq('status', 'paid')
          .gte('created_at', since)
          .order('created_at', { ascending: false })

        if (orders) {
          for (const o of orders) {
            if (!knownOrders.has(o.id)) {
              knownOrders.add(o.id)
              await pullOrder(o.id)
            }
          }
        }
      } catch (err) {
        console.error('OnlineOrderSync: Error initial sync', err)
      }
    }
```

- [ ] **Step 4: Uji route secara lokal**

```bash
cd apps/pos-kasir && npm run dev
```

Di terminal lain:

```bash
curl -s http://localhost:3004/api/cron/pull-online-orders
```
Harapan: JSON `{"success":true,"pulled":N,"skipped":M}` tanpa 500. `pulled` boleh 0 kalau tidak ada order online baru — yang penting tidak error.

- [ ] **Step 5: Verifikasi dan commit**

```bash
cd apps/pos-kasir && npm run type-check && npm run build
```
Harapan: 0 error, dan route `/api/cron/pull-online-orders` muncul di keluaran build.

```bash
git add apps/pos-kasir/app/api/cron/pull-online-orders/route.ts apps/pos-kasir/vercel.json apps/pos-kasir/components/OnlineOrderSync.tsx
git commit -m "feat(pos-kasir): tarik pesanan online dari cron server, tidak lagi bergantung tab kasir"
```

---

### Task 9: Bersihkan file migrasi yang menyesatkan & verifikasi menyeluruh

`apps/pos-kasir/migration-order-number-per-outlet.sql` dan `migration-offline-order-number.sql` menggambarkan dunia yang tidak ada di produksi. Yang kedua berbahaya: kalau sampai dijalankan, satu order bernomor 9001 akan membuat seluruh outlet hari itu melompat ke 9002, 9003, dan seterusnya.

**Files:**
- Delete: `apps/pos-kasir/migration-order-number-per-outlet.sql`
- Delete: `apps/pos-kasir/migration-offline-order-number.sql`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Pastikan tidak ada yang merujuk kedua file**

```bash
cd "C:/Users/Creator MPB/OneDrive/Desktop/New folder/DIGITALISASI-SS-PROJECT" && grep -rn "migration-order-number-per-outlet\|migration-offline-order-number" --include=*.ts --include=*.tsx --include=*.js --include=*.mjs --include=*.json --include=*.md . | grep -v node_modules
```
Harapan: paling banyak hanya penyebutan di dokumen. Kalau ada skrip yang menjalankannya, **BERHENTI** dan laporkan.

- [ ] **Step 2: Hapus kedua file**

```bash
cd "C:/Users/Creator MPB/OneDrive/Desktop/New folder/DIGITALISASI-SS-PROJECT" && git rm apps/pos-kasir/migration-order-number-per-outlet.sql apps/pos-kasir/migration-offline-order-number.sql
```

- [ ] **Step 3: Catat di CLAUDE.md**

Tambahkan section baru tepat sebelum baris `**Last updated:**` di `CLAUDE.md`:

```markdown
---

## Session 2026-08-03: POS-Kasir — Nomor Antrian Atomik & Sinkronisasi Offline

**Status:** ✅ Kode selesai. ⚠️ Perlu **redeploy `pos-kasir`**; migration sudah applied & diverifikasi ground-truth.

### Akar masalah (diverifikasi langsung ke DB produksi, bukan dari kode)
1. **DUA trigger `BEFORE INSERT` berebut mengisi `order_number`** — `trg_fill_order_number` (sequence `pos_sync_order_number_seq`, dari migrasi POS sales sync) dan `trigger_generate_order_number` (`SELECT MAX(order_number)+1`). Trigger dieksekusi urut abjad, jadi yang kedua selalu menang dan menimpa tanpa syarat — termasuk menimpa nomor dari sequence sync, yang membuat sequence itu efektif mati.
2. **`MAX+1` tidak atomik** dan `orders` **tidak punya constraint unik apa pun** di `order_number` (hanya `orders_pkey`). Nomor kembar tidak akan ditolak. Belum terjadi (traffic rendah), tapi ranjau aktif.
3. **Angka "9000-an" berasal dari client, bukan DB.** `lib/offline.ts` `nextLocalOrderNumber()` memberi 9001+ ke order offline; angka itu tercetak di struk pelanggan dan tampil di papan, sementara server selalu menimpanya. Terverifikasi: **0 baris `order_number >= 9000`** sepanjang riwayat.
4. **`catch` buta di `order-manual/page.tsx`** — `printReceipt()` berada DI DALAM blok `try`, dan `catch` tidak memakai `isNetworkError()` yang sudah tersedia. Printer Bluetooth gagal → order sudah sukses di server → catch tetap membuat order lokal + antrean kirim → **order dobel**. Respons 5xx juga sengaja di-`throw` sebagai "fallback to offline" padahal bukan kondisi offline.
5. **`cleanupStaleOrders()` menghapus order offline >12 jam** beserta antreannya, tanpa konfirmasi — penjualan hilang diam-diam padahal uangnya sudah diterima kasir.
6. **Ingest pesanan online 100% bergantung tab browser kasir** (`OnlineOrderSync`), dengan pemulihan awal `limit(10)` saja. Tidak ada cron sisi server.

### Perbaikan
- Migration `20300105000000_atomic_order_number.sql` — tabel `outlet_order_counters(outlet_id, biz_date, last_number)`, fungsi `assign_order_number()` (`SECURITY DEFINER`, satu `INSERT … ON CONFLICT DO UPDATE … RETURNING` yang atomik), trigger tunggal `trg_assign_order_number`, unique index `orders_outlet_bizdate_number_uq`. Dua trigger lama di-DROP.
- Migration `20300105000001_orders_client_order_id.sql` — kolom + unique index parsial untuk idempotensi.
- Client: `nextLocalOrderNumber` dibuang, diganti `estimateOrderNumber()` (murni, ber-test). `order_number` tidak lagi pernah dikirim dari client ke server.
- Endpoint baru `/api/orders/offline-ingest` — menerima snapshot harga apa adanya + `created_at` waktu transaksi asli; tidak menghitung ulang harga (order tidak bisa lagi ditolak permanen gara-gara menu/promo berubah).
- `printReceipt()` dikeluarkan dari `try`; hanya `isNetworkError()` yang memicu jalur offline.
- `syncClassify.ts` — klasifikasi retry vs give-up + backoff eksponensial. Penghapusan otomatis dihapus, diganti panel "Perlu Perhatian".
- Cron server `/api/cron/pull-online-orders` tiap menit, anti-join `external_order_id`.

### Gotcha yang menyelamatkan eksekusi
- **`outlet_order_counters` SUDAH ADA di produksi** dengan bentuk lama `(outlet_id, last_number)` tanpa `biz_date` — kosong, tak dirujuk siapa pun. Sisa dari `migration-order-number-per-outlet.sql` yang di-jalankan sebagian secara manual. `CREATE TABLE IF NOT EXISTS` akan diam-diam melewatinya dan migrasi gagal belakangan → tabel lama harus di-DROP dulu.
- Dua file `apps/pos-kasir/migration-*.sql` soal nomor antrian **dihapus**: keduanya tidak pernah di-apply dan `migration-offline-order-number.sql` justru berbahaya (mempertahankan 9001 → `MAX+1` membuat seluruh outlet hari itu jadi 9002, 9003, …).

### 📝 Next (manual)
- **Redeploy `pos-kasir`.**
- Smoke test: matikan wifi → 3 transaksi → nyalakan → nomor urut rapat, tidak ada dobel, tidak ada 9000-an. Cabut printer saat online → pastikan tidak lahir order hantu.
```

- [ ] **Step 4: Verifikasi menyeluruh**

```bash
cd apps/pos-kasir && npm run type-check && npm test && npm run build
```
Harapan: 0 error type-check, semua test lulus, build sukses.

```bash
cd apps/pos-kasir && grep -rn "9000\|9001\|nextLocalOrderNumber\|cleanupStaleOrders" lib app components --include=*.ts --include=*.tsx
```
Harapan: hanya `LEGACY_LOCAL_NUMBER_FLOOR` di `lib/offline.ts`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: hapus migrasi nomor antrian yang menyesatkan, catat sesi di CLAUDE.md"
```

---

## Smoke Test Manual (setelah redeploy `pos-kasir`)

Rencana ini menyentuh uang dan struk pelanggan. Jalankan sebelum outlet dipakai penuh.

- [ ] **Nomor antrian berurutan.** Buat 5 order berturut-turut di satu outlet. Nomor harus `N, N+1, N+2, N+3, N+4` tanpa loncat dan tanpa kembar.
- [ ] **Reset harian.** Cek `outlet_order_counters` punya baris `biz_date` hari ini, dan order pertama besok mulai dari 1.
- [ ] **Printer gagal tidak melahirkan order hantu.** Dalam kondisi ONLINE, matikan printer Bluetooth lalu buat 1 order. Harapan: order muncul SATU kali di papan, ada pesan "struk gagal dicetak", dan tidak ada kartu offline.
- [ ] **Offline lalu online.** Matikan wifi, buat 3 order (catat nomor di struk), nyalakan wifi, tunggu maksimal 30 detik. Harapan: ketiga order pindah ke papan sebagai order server, tidak ada duplikat, nomornya berurutan.
- [ ] **Idempotensi.** Selagi offline buat 1 order, lalu muat ulang halaman sebelum online. Setelah online, pastikan order hanya masuk SATU kali.
- [ ] **Pesanan online tanpa tab kasir.** Tutup semua tab kasir, buat pesanan di order-system sampai `paid`, tunggu 2 menit. Harapan: pesanan sudah ada di papan saat tab kasir dibuka.
- [ ] **Panel Perlu Perhatian.** Verifikasi tidak ada order offline yang hilang sendiri setelah 12 jam.
