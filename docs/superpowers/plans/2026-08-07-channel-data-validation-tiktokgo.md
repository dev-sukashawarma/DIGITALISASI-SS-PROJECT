# Data Validation Channel Penjualan — TikTok GO (Fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bangun ulang halaman `/dashboard/data-validate` di `apps/admin-dashboard` supaya bisa memvalidasi qty & omzet TikTok GO (file export vs sistem) per outlet/semua-outlet, periode 1–31 Juli 2026, dengan pemetaan outlet & menu yang dikelola dari DB+UI (bukan hardcode), dan hasil tersimpan sehingga bisa dibuka lagi tanpa upload ulang.

**Architecture:** Parser khusus (deteksi header dinamis) mengekstrak baris item-level dari file TikTok GO. Server actions me-resolve nama toko/menu terhadap 2 tabel mapping baru (yang gagal tampil sebagai "belum dipetakan", tak pernah dibuang diam-diam), lalu memanggil 1 RPC Postgres baru untuk menarik qty/omzet sisi sistem teragregasi di server (menghindari batas 1.000 baris PostgREST yang pernah membuat perhitungan meleset ~6%). Hasil gabungan (file vs sistem) disimpan ke 2 tabel riwayat pada grain (outlet, menu, tanggal) — baik tampilan ringkas maupun drill-down per tanggal membaca dari tabel yang sama.

**Tech Stack:** Next.js App Router (Server Actions), Supabase (Postgres + RPC), `xlsx` (parsing, sudah ada di `package.json`), React Query (client state), Vitest (unit test), TypeScript.

## Global Constraints

- Semua perubahan kode terbatas pada `apps/admin-dashboard`. Tidak menyentuh `apps/pos-kasir`, `apps/absensi`, `apps/stok`, `apps/distribusi`, `apps/finance`, atau `packages/*`.
- `orders` dan `order_items` **read-only** — tidak ada `INSERT`/`UPDATE`/`DELETE`, tidak ada trigger baru pada tabel ini atau tabel yang direferensikannya.
- Perubahan DB **aditif saja** — `CREATE TABLE`/`CREATE FUNCTION` baru. Tidak ada `ALTER`/`DROP` pada tabel yang sudah ada.
- `src/lib/platformSettlement/*`, halaman `/dashboard/platform-settlement`, dan `src/data/platform_store_map.json` — tidak diubah sama sekali (dipakai sebagai seed data saja, dibaca bukan ditulis).
- Semua Server Action yang menyentuh service-role client WAJIB dipagari `requireRole(['admin', 'owner'])` dari `src/lib/authz.ts` — proyek ini punya riwayat lubang otorisasi pada Server Action yang lupa memanggilnya (lihat `docs/SESSION-2026-07-20-*`).
- Scope hanya channel **TikTok GO**. Placeholder UI untuk channel lain boleh ada (dropdown), tapi disabled dengan label "Segera hadir" — jangan diimplementasikan.
- Bahasa UI: Bahasa Indonesia, konsisten dengan sisa aplikasi.

---

## File Structure

```
supabase/migrations/
└── 20260807100000_channel_data_validation.sql   ← 4 tabel + 1 RPC (baru)

apps/admin-dashboard/src/app/dashboard/data-validate/
├── page.tsx                          ← MODIFIKASI (ganti total, tetap route sama)
├── actions.ts                        ← HAPUS (digantikan lib/ di bawah)
├── components/DataValidateClient.tsx ← HAPUS (digantikan components/ di bawah)
├── utils/parsers.ts                  ← HAPUS (digantikan lib/parsers/tiktokgo.ts)
├── lib/
│   ├── types.ts                      ← BARU — tipe bersama modul ini
│   ├── parsers/
│   │   ├── tiktokgo.ts                ← BARU — parser file, deteksi header dinamis
│   │   └── tiktokgo.test.ts           ← BARU
│   ├── normalize.ts                   ← BARU — normalisasi nama toko/menu (dipakai mapping)
│   ├── normalize.test.ts              ← BARU
│   ├── mapping.actions.ts             ← BARU — server actions resolve outlet & menu
│   └── compare.actions.ts             ← BARU — server actions agregasi & bandingkan + simpan
└── components/
    ├── UploadForm.tsx                 ← BARU — pilih outlet/channel + upload file
    ├── UnmappedResolver.tsx           ← BARU — daftar toko/menu belum dipetakan + form assign
    ├── ResultsTable.tsx                ← BARU — tabel ringkas per menu + expand per tanggal
    └── RunHistory.tsx                  ← BARU — daftar run tersimpan + buka ulang
```

---

## Task 1: Migration — tabel mapping, tabel riwayat, dan RPC agregasi sisi sistem

**Files:**
- Create: `supabase/migrations/20260807100000_channel_data_validation.sql`

**Interfaces:**
- Produces: tabel `platform_store_mapping(platform, store_key, outlet_id)`, tabel `channel_menu_mapping(platform, source_item_name, canonical_menu_name)`, tabel `channel_validation_runs(id, platform, period_from, period_to, source_file_name, uploaded_by, uploaded_at, unmapped_stores jsonb, unmapped_items jsonb)`, tabel `channel_validation_results(id, run_id, outlet_id, canonical_menu_name, tanggal, qty_file, qty_system, omzet_kotor_file, omzet_kotor_system, promo_diskon_deal, promo_platform_incentive, promo_merchant_incentive, admin_platform_fee)`, fungsi RPC `tiktokgo_qty_by_menu_date(p_from date, p_to date, p_outlet_ids uuid[]) RETURNS TABLE(outlet_id uuid, canonical_menu_name text, tanggal date, qty bigint, omzet_kotor numeric)`.

- [ ] **Step 1: Tulis file migration**

```sql
-- 20260807100000_channel_data_validation.sql
-- Fitur Data Validasi Channel Penjualan (Fase 1: TikTok GO saja).
-- Lihat docs/superpowers/specs/2026-08-07-channel-data-validation-tiktokgo-design.md
--
-- Seluruhnya ADITIF: 4 tabel baru + 1 fungsi baru. Tidak ada ALTER pada tabel
-- yang sudah ada. orders/order_items tetap read-only (dibaca via RPC di bawah,
-- tidak pernah ditulis oleh fitur ini).

-- 1. Pemetaan nama toko (raw dari file platform) -> outlet_id kita.
-- Tak pernah "auto-drop": baris yang gagal cocok tampil di UI utk dipetakan
-- manual, lalu tersimpan di sini untuk upload berikutnya.
CREATE TABLE IF NOT EXISTS public.platform_store_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  store_key text NOT NULL,
  outlet_id uuid NOT NULL REFERENCES public.outlets(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.outlet_staff(id),
  UNIQUE (platform, store_key)
);

-- 2. Pemetaan nama menu (raw dari file platform) -> nama kanonik yang dipakai
-- untuk group-by di kedua sisi (file & order_items.menu_item_name yang sudah
-- dibersihkan dari suffix "|ID|...|NOTE|...").
CREATE TABLE IF NOT EXISTS public.channel_menu_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  source_item_name text NOT NULL,
  canonical_menu_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.outlet_staff(id),
  UNIQUE (platform, source_item_name)
);

-- 3. Satu baris per proses upload/validasi. unmapped_* menyimpan snapshot apa
-- yang gagal dipetakan SAAT run itu dijalankan (audit trail, bukan state aktif).
CREATE TABLE IF NOT EXISTS public.channel_validation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  source_file_name text NOT NULL,
  uploaded_by uuid REFERENCES public.outlet_staff(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  unmapped_stores jsonb NOT NULL DEFAULT '[]'::jsonb,
  unmapped_items jsonb NOT NULL DEFAULT '[]'::jsonb
);

-- 4. Grain terkecil: (run, outlet, menu, tanggal). Tampilan ringkas (per menu,
-- dijumlah 1 bulan) dan tampilan drill-down (per tanggal) SAMA-SAMA membaca
-- dari sini -- tidak ada tabel agregat terpisah yang bisa divergen.
CREATE TABLE IF NOT EXISTS public.channel_validation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.channel_validation_runs(id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.outlets(id),
  canonical_menu_name text NOT NULL,
  tanggal date NOT NULL,
  qty_file integer NOT NULL DEFAULT 0,
  qty_system integer NOT NULL DEFAULT 0,
  omzet_kotor_file numeric NOT NULL DEFAULT 0,
  omzet_kotor_system numeric NOT NULL DEFAULT 0,
  promo_diskon_deal numeric NOT NULL DEFAULT 0,
  promo_platform_incentive numeric NOT NULL DEFAULT 0,
  promo_merchant_incentive numeric NOT NULL DEFAULT 0,
  admin_platform_fee numeric NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_channel_validation_results_run
  ON public.channel_validation_results(run_id);

-- RLS: baca untuk staff yang login, tulis hanya lewat service-role (Server
-- Action sudah dipagari requireRole(['admin','owner']) di lapisan app --
-- lihat Task 4 & 5). Pola ini konsisten dgn migrasi lain di repo yg menyerahkan
-- validasi keamanan ke application layer untuk tabel yang HANYA ditulis lewat
-- Server Action tepercaya (bukan langsung dari client browser).
ALTER TABLE public.platform_store_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_menu_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_validation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_validation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_store_mapping_read ON public.platform_store_mapping
  FOR SELECT TO authenticated USING (true);
CREATE POLICY channel_menu_mapping_read ON public.channel_menu_mapping
  FOR SELECT TO authenticated USING (true);
CREATE POLICY channel_validation_runs_read ON public.channel_validation_runs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY channel_validation_results_read ON public.channel_validation_results
  FOR SELECT TO authenticated USING (true);

-- 5. Agregasi qty & omzet sisi SISTEM, dihitung di Postgres (bukan ditarik
-- mentah ke JS -- pola lama yang pernah menghasilkan angka meleset ~6% karena
-- batas 1000 baris PostgREST pada relasi embedded order_items).
-- Channel TikTok GO tersebar di 2 kombinasi kolom (mayoritas order dari
-- Pawoon punya channel kosong, hanya sales_source terisi) -- pola resolusi ini
-- sama dengan channel_gross_by_outlet() di 20260729150000_platform_settlements.sql.
-- Nama menu dibersihkan dari suffix "|ID|...|NOTE|..." sebelum dikembalikan,
-- supaya bisa langsung di-join ke channel_menu_mapping.canonical_menu_name.
CREATE OR REPLACE FUNCTION public.tiktokgo_qty_by_menu_date(
  p_from date,
  p_to date,
  p_outlet_ids uuid[]
)
RETURNS TABLE (
  outlet_id uuid,
  canonical_menu_name text,
  tanggal date,
  qty bigint,
  omzet_kotor numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    o.outlet_id,
    lower(trim(split_part(oi.menu_item_name, '|', 1))) AS canonical_menu_name,
    (o.created_at AT TIME ZONE 'Asia/Jakarta')::date AS tanggal,
    SUM(oi.quantity)::bigint AS qty,
    COALESCE(SUM(o.total_amount), 0)::numeric AS omzet_kotor
  FROM public.orders o
  JOIN public.order_items oi ON oi.order_id = o.id
  WHERE o.status = 'completed'
    AND (o.channel IN ('tiktokgo', 'tiktok') OR o.sales_source IN ('tiktokgo', 'tiktok'))
    AND (o.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
    AND (p_outlet_ids IS NULL OR o.outlet_id = ANY(p_outlet_ids))
  GROUP BY o.outlet_id, lower(trim(split_part(oi.menu_item_name, '|', 1))),
           (o.created_at AT TIME ZONE 'Asia/Jakarta')::date;
$$;

REVOKE ALL ON FUNCTION public.tiktokgo_qty_by_menu_date(date, date, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tiktokgo_qty_by_menu_date(date, date, uuid[]) TO service_role;

-- Seed pemetaan outlet dari platform_store_map.json yang sudah ada (tiktokgo),
-- supaya tidak mengulang kerja mapping yang sudah dikonfirmasi bekerja di
-- halaman platform-settlement. File JSON itu sendiri TIDAK diubah.
INSERT INTO public.platform_store_mapping (platform, store_key, outlet_id)
SELECT 'tiktokgo', 'suka shawarma kota wisata cibubur', id
FROM public.outlets WHERE name = 'MITRA CIBUBUR'
ON CONFLICT (platform, store_key) DO NOTHING;
```

- [ ] **Step 2: Jalankan migration ke DB lokal/remote yang terhubung**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT" && supabase db push`
Expected: migration `20260807100000_channel_data_validation` applied tanpa error. Jika ada migration remote-only tanpa file lokal yang memblokir push (riwayat proyek ini sering begitu — lihat `docs/superpowers/specs/2026-08-07-channel-data-validation-tiktokgo-design.md` isolasi & memory `supabase-migration-history-drift`), **jangan** jalankan `migration repair` sepihak — laporkan ke user dan tunggu arahan.

- [ ] **Step 3: Verifikasi ground-truth di DB live (bukan cuma migration list)**

Run:
```bash
supabase db query "SELECT proname, prosecdef FROM pg_proc WHERE proname = 'tiktokgo_qty_by_menu_date';" --linked
supabase db query "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('platform_store_mapping','channel_menu_mapping','channel_validation_runs','channel_validation_results');" --linked
```
Expected: fungsi ada, `prosecdef` boleh false (bukan SECURITY DEFINER, dipanggil via service-role); 4 tabel muncul.

- [ ] **Step 4: Commit**

```bash
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
git add supabase/migrations/20260807100000_channel_data_validation.sql
git commit -m "$(cat <<'EOF'
feat(admin-dashboard): add DB schema for TikTok GO data validation

4 additive tables (store/menu mapping + validation run history) and
one aggregation RPC (tiktokgo_qty_by_menu_date) that computes system-side
qty/omzet in Postgres instead of pulling raw rows to JS, avoiding the
PostgREST 1000-row truncation that previously caused ~6% miscalculation.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Tipe bersama modul

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/data-validate/lib/types.ts`

**Interfaces:**
- Produces: `ParsedRow`, `FileAggregateRow`, `SystemAggregateRow`, `ComparisonRow`, `UnmappedStore`, `UnmappedItem` — dipakai oleh Task 3, 4, 5, 6.

- [ ] **Step 1: Tulis file tipe**

```typescript
// apps/admin-dashboard/src/app/dashboard/data-validate/lib/types.ts

/** Satu baris hasil parse mentah dari file TikTok GO -- 1 baris file = 1 qty. */
export interface ParsedRow {
  tanggal: string; // YYYY-MM-DD, dari "Redemption time"
  storeRaw: string; // dari "Redemption location"
  itemRaw: string; // dari "Item name"
  originalPrice: number;
  paymentAmount: number;
  platformIncentive: number;
  merchantIncentive: number;
  settlementAmount: number | null; // null = belum settle saat export
}

/** Agregat sisi FILE per (outlet, menu kanonik, tanggal) -- setelah resolusi mapping. */
export interface FileAggregateRow {
  outletId: string;
  canonicalMenuName: string;
  tanggal: string;
  qty: number;
  omzetKotor: number; // SUM(paymentAmount)
  promoDiskonDeal: number; // SUM(original - payment - PI - MI)
  promoPlatformIncentive: number;
  promoMerchantIncentive: number;
  /** null jika ada baris settlement_amount belum terisi pada grup ini (lihat compare.actions.ts). */
  adminPlatformFee: number | null;
}

/** Agregat sisi SISTEM, hasil RPC tiktokgo_qty_by_menu_date. */
export interface SystemAggregateRow {
  outletId: string;
  canonicalMenuName: string;
  tanggal: string;
  qty: number;
  omzetKotor: number;
}

/** Baris gabungan file vs sistem, grain (outlet, menu, tanggal) -- disimpan ke channel_validation_results. */
export interface ComparisonRow {
  outletId: string;
  outletName: string;
  canonicalMenuName: string;
  tanggal: string;
  qtyFile: number;
  qtySystem: number;
  omzetKotorFile: number;
  omzetKotorSystem: number;
  promoDiskonDeal: number;
  promoPlatformIncentive: number;
  promoMerchantIncentive: number;
  adminPlatformFee: number | null;
}

export interface UnmappedStore {
  storeRaw: string;
  qty: number;
  omzetKotor: number;
}

export interface UnmappedItem {
  itemRaw: string;
  qty: number;
  omzetKotor: number;
}
```

- [ ] **Step 2: Commit**

```bash
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
git add apps/admin-dashboard/src/app/dashboard/data-validate/lib/types.ts
git commit -m "feat(admin-dashboard): add shared types for TikTok GO data validation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Parser file TikTok GO (deteksi header dinamis)

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/data-validate/lib/parsers/tiktokgo.ts`
- Test: `apps/admin-dashboard/src/app/dashboard/data-validate/lib/parsers/tiktokgo.test.ts`

**Interfaces:**
- Consumes: `ParsedRow` (Task 2)
- Produces: `parseTiktokGoFile(buffer: ArrayBuffer): ParsedRow[]` — dipakai oleh `compare.actions.ts` (Task 6) dan UI upload (Task 7).

- [ ] **Step 1: Tulis test dengan file xlsx buatan (2 baris, header di baris 0)**

```typescript
// apps/admin-dashboard/src/app/dashboard/data-validate/lib/parsers/tiktokgo.test.ts
import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseTiktokGoFile } from './tiktokgo'

function buildWorkbookBuffer(rows: (string | number)[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'order detail')
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return out
}

const HEADER = [
  'Breakdown', 'Store order ID', 'Item order ID', 'Item order status',
  'Redemption time', 'Redemption source', 'Redemption organization',
  'Redemption location', 'Redemption code', 'Cashier name', 'Item ID',
  'Item name', 'Currency', 'Original price', 'Payment amount',
  'Price before tax', 'Total price', 'Estimated tax', 'Final tax',
  'Platform incentive', 'Merchant incentive', 'Refund amount',
  'Settlement number', 'Settlement amount', 'Settlement time',
  'Redemption ID', 'Notes', 'Order source',
]

describe('parseTiktokGoFile', () => {
  it('parses rows when header is on row 0 (this export variant)', () => {
    const rows = [
      HEADER,
      ['', 'SO1', 'IO1', 'Fulfilled', '2026-07-01', 'APP', 'Bogor', 'SUKA Shawarma Ciseeng', 'C1', 'Kasir', 'I1', 'BEST SELLER (MIX JUMBO)', 'IDR', 47000, 33000, '', '', '', '', 5000, 0, '', '', 34960, '', 'RID1', '', 'STANDARD'],
    ]
    const parsed = parseTiktokGoFile(buildWorkbookBuffer(rows))
    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toEqual({
      tanggal: '2026-07-01',
      storeRaw: 'SUKA Shawarma Ciseeng',
      itemRaw: 'BEST SELLER (MIX JUMBO)',
      originalPrice: 47000,
      paymentAmount: 33000,
      platformIncentive: 5000,
      merchantIncentive: 0,
      settlementAmount: 34960,
    })
  })

  it('detects header on a later row when preceded by summary rows (settlement-style export)', () => {
    const rows = [
      ['Total', '', ''],
      ['Item order number', '', ''],
      ['Order fulfillment amount', '', ''],
      HEADER,
      ['', 'SO2', 'IO2', 'Fulfilled', '2026-07-02', 'APP', 'Depok', 'SUKA Shawarma Beji', 'C2', 'Kasir', 'I2', 'BEST SELLER 2', 'IDR', 42000, 34000, '', '', '', '', 0, 0, '', '', 31280, '', 'RID2', '', 'STANDARD'],
    ]
    const parsed = parseTiktokGoFile(buildWorkbookBuffer(rows))
    expect(parsed).toHaveLength(1)
    expect(parsed[0].storeRaw).toBe('SUKA Shawarma Beji')
    expect(parsed[0].itemRaw).toBe('BEST SELLER 2')
  })

  it('treats missing Settlement amount as null, not zero', () => {
    const rows = [
      HEADER,
      ['', 'SO3', 'IO3', 'Fulfilled', '2026-07-31', 'APP', 'Bogor', 'SUKA Shawarma Ciseeng', 'C3', 'Kasir', 'I3', 'BEST SELLER 2', 'IDR', 42000, 34000, '', '', '', '', 0, 0, '', '', '', '', 'RID3', '', 'STANDARD'],
    ]
    const parsed = parseTiktokGoFile(buildWorkbookBuffer(rows))
    expect(parsed[0].settlementAmount).toBeNull()
  })

  it('throws a clear error when no recognizable header row exists', () => {
    const rows = [['foo', 'bar'], ['1', '2']]
    expect(() => parseTiktokGoFile(buildWorkbookBuffer(rows))).toThrow(
      /header.*tidak ditemukan/i
    )
  })

  it('skips rows without an Item order ID (blank/summary rows)', () => {
    const rows = [
      HEADER,
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['', 'SO4', 'IO4', 'Fulfilled', '2026-07-01', 'APP', 'Bogor', 'SUKA Shawarma Ciseeng', 'C4', 'Kasir', 'I4', 'BEST SELLER 2', 'IDR', 42000, 34000, '', '', '', '', 0, 0, '', '', 31280, '', 'RID4', '', 'STANDARD'],
    ]
    const parsed = parseTiktokGoFile(buildWorkbookBuffer(rows))
    expect(parsed).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal (fungsi belum ada)**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && npx vitest run src/app/dashboard/data-validate/lib/parsers/tiktokgo.test.ts`
Expected: FAIL — `Cannot find module './tiktokgo'` atau `parseTiktokGoFile is not a function`.

- [ ] **Step 3: Implementasi parser**

```typescript
// apps/admin-dashboard/src/app/dashboard/data-validate/lib/parsers/tiktokgo.ts
import * as XLSX from 'xlsx'
import type { ParsedRow } from '../types'

const REQUIRED_COLS = ['Item name', 'Redemption location', 'Item order ID', 'Redemption time']

function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return isNaN(n) ? 0 : n
}

/**
 * Cari baris header dengan scan 10 baris pertama untuk baris yang mengandung
 * SEMUA kolom wajib. Export TikTok GO punya 2 varian: header di baris 0
 * (varian ini) atau baris ke-4 (varian settlement, 3 baris ringkasan di atas).
 */
function findHeaderRowIndex(grid: unknown[][]): number {
  const scanLimit = Math.min(10, grid.length)
  for (let i = 0; i < scanLimit; i++) {
    const row = (grid[i] ?? []).map((c) => String(c ?? '').trim())
    if (REQUIRED_COLS.every((col) => row.includes(col))) return i
  }
  throw new Error(
    `Header tidak ditemukan pada 10 baris pertama. Pastikan file berisi kolom: ${REQUIRED_COLS.join(', ')}.`
  )
}

export function parseTiktokGoFile(buffer: ArrayBuffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName = wb.SheetNames.includes('order detail') ? 'order detail' : wb.SheetNames[0]
  const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
    header: 1,
    defval: '',
    raw: true,
  })

  const headerIdx = findHeaderRowIndex(grid)
  const header = (grid[headerIdx] as unknown[]).map((c) => String(c ?? '').trim())
  const col = (name: string) => header.indexOf(name)

  const cItemOrderId = col('Item order ID')
  const cTime = col('Redemption time')
  const cLocation = col('Redemption location')
  const cItem = col('Item name')
  const cOriginal = col('Original price')
  const cPayment = col('Payment amount')
  const cPI = col('Platform incentive')
  const cMI = col('Merchant incentive')
  const cSettlement = col('Settlement amount')

  const out: ParsedRow[] = []
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const row = grid[i] as unknown[]
    if (!row || String(row[cItemOrderId] ?? '').trim() === '') continue

    const settlementRaw = row[cSettlement]
    out.push({
      tanggal: String(row[cTime] ?? '').trim(),
      storeRaw: String(row[cLocation] ?? '').trim(),
      itemRaw: String(row[cItem] ?? '').trim(),
      originalPrice: toNumber(row[cOriginal]),
      paymentAmount: toNumber(row[cPayment]),
      platformIncentive: toNumber(row[cPI]),
      merchantIncentive: toNumber(row[cMI]),
      settlementAmount: settlementRaw === '' || settlementRaw === undefined ? null : toNumber(settlementRaw),
    })
  }

  return out
}
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && npx vitest run src/app/dashboard/data-validate/lib/parsers/tiktokgo.test.ts`
Expected: PASS, 5/5 test.

- [ ] **Step 5: Verifikasi manual terhadap file sample asli**

Run:
```bash
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
node -e "
const fs = require('fs');
const { parseTiktokGoFile } = require('./apps/admin-dashboard/src/app/dashboard/data-validate/lib/parsers/tiktokgo.ts');
" 2>&1 || echo "Catatan: jalankan via ts-node atau tulis script sementara di scratchpad jika 'node -e' tidak bisa import TS langsung; verifikasi manual: total baris harus 3540, SUM(originalPrice) harus 177254000."
```
Expected: kalau butuh, tulis script Node sementara (CommonJS, transpile manual atau pakai `esbuild-register`) yang memanggil `parseTiktokGoFile` terhadap `sample-reports/juli-2026/TIKTOKGO SS JULY.xlsx`, cek `parsed.length === 3540` dan `parsed.reduce((s,r)=>s+r.originalPrice,0) === 177254000`. Ini best-effort manual check, bukan bagian dari suite otomatis — cukup laporkan hasilnya, jangan blok task kalau tooling ts-node tak tersedia (unit test di Step 4 sudah menjaga kebenaran logika).

- [ ] **Step 6: Commit**

```bash
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
git add apps/admin-dashboard/src/app/dashboard/data-validate/lib/parsers/
git commit -m "$(cat <<'EOF'
feat(admin-dashboard): add TikTok GO file parser with dynamic header detection

Scans first 10 rows for the header row (handles both the row-0 and
row-4 export variants) instead of hardcoding a row index. Settlement
amount is parsed as null (not 0) when absent, since ~71 rows in the
July sample are unsettled at export time.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Normalisasi nama (outlet & menu)

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/data-validate/lib/normalize.ts`
- Test: `apps/admin-dashboard/src/app/dashboard/data-validate/lib/normalize.test.ts`

**Interfaces:**
- Produces: `normalizeStoreName(raw: string): string`, `normalizeMenuName(raw: string): string` — dipakai `mapping.actions.ts` (Task 5).

- [ ] **Step 1: Tulis test**

```typescript
// apps/admin-dashboard/src/app/dashboard/data-validate/lib/normalize.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeStoreName, normalizeMenuName } from './normalize'

describe('normalizeStoreName', () => {
  it('strips "SUKA Shawarma" prefix and lowercases', () => {
    expect(normalizeStoreName('SUKA Shawarma Beji')).toBe('beji')
  })

  it('strips "Kebab SUKA Shawarma - Sukahati" prefix', () => {
    expect(normalizeStoreName('Kebab SUKA Shawarma - Sukahati Cibinong')).toBe('cibinong')
  })

  it('strips "Kota Wisata" and "MITRA" so both sides converge', () => {
    expect(normalizeStoreName('SUKA Shawarma Kota Wisata Cibubur')).toBe('cibubur')
    expect(normalizeStoreName('MITRA CIBUBUR')).toBe('cibubur')
  })

  it('removes non-alphabetic characters', () => {
    expect(normalizeStoreName('SUKA Shawarma Depok-Sukmajaya!')).toBe('depoksukmajaya')
  })
})

describe('normalizeMenuName', () => {
  it('strips the |ID|...|NOTE|... suffix used in order_items.menu_item_name', () => {
    expect(normalizeMenuName('Best Seller 2|ID|4h8azlt')).toBe('best seller 2')
  })

  it('lowercases and trims', () => {
    expect(normalizeMenuName('  SUKA DUO FAVORIT  ')).toBe('suka duo favorit')
  })

  it('strips note suffix too', () => {
    expect(normalizeMenuName('Best Seller (Mix Jumbo)|ID|tqyjgb9|NOTE|Tidak pedas')).toBe(
      'best seller (mix jumbo)'
    )
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && npx vitest run src/app/dashboard/data-validate/lib/normalize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implementasi**

```typescript
// apps/admin-dashboard/src/app/dashboard/data-validate/lib/normalize.ts

/**
 * Normalisasi nama toko utk auto-match antara "Redemption location" (file)
 * dan outlets.name (DB). Prefix yang dibuang ditemukan lewat audit 19 lokasi
 * pada file sample Juli 2026 -- lihat spec §"Pemetaan Outlet".
 */
export function normalizeStoreName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/kebab suka shawarma - sukahati /g, '')
    .replace(/suka shawarma/g, '')
    .replace(/kota wisata /g, '')
    .replace(/mitra/g, '')
    .replace(/[^a-z]/g, '')
}

/**
 * Normalisasi nama menu. order_items.menu_item_name sering berimbuhan
 * "|ID|xxx" atau "|ID|xxx|NOTE|catatan" -- ambil segmen sebelum "|" pertama.
 */
export function normalizeMenuName(raw: string): string {
  return raw.split('|')[0].trim().toLowerCase()
}
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && npx vitest run src/app/dashboard/data-validate/lib/normalize.test.ts`
Expected: PASS, 7/7 test.

- [ ] **Step 5: Commit**

```bash
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
git add apps/admin-dashboard/src/app/dashboard/data-validate/lib/normalize.ts apps/admin-dashboard/src/app/dashboard/data-validate/lib/normalize.test.ts
git commit -m "feat(admin-dashboard): add store/menu name normalization for TikTok GO mapping

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Server actions — resolusi mapping outlet & menu

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/data-validate/lib/mapping.actions.ts`

**Interfaces:**
- Consumes: `normalizeStoreName`, `normalizeMenuName` (Task 4); `requireRole` dari `@/lib/authz`; `UnmappedStore`, `UnmappedItem` (Task 2)
- Produces: `resolveStoreMappings(storeRawNames: string[]): Promise<{ resolved: Map<string,string>; unmapped: string[] }>`, `resolveMenuMappings(itemRawNames: string[]): Promise<{ resolved: Map<string,string>; unmapped: string[] }>`, `saveStoreMapping(storeRaw: string, outletId: string): Promise<void>`, `saveMenuMapping(itemRaw: string, canonicalMenuName: string): Promise<void>`, `getOutletOptions(): Promise<{id: string; name: string}[]>`, `getCanonicalMenuOptions(): Promise<string[]>` — dipakai `compare.actions.ts` (Task 6) dan `UnmappedResolver.tsx` (Task 8).

- [ ] **Step 1: Implementasi (tanpa test unit terpisah — di-cover oleh integration check di Task 6/9; logika murni normalisasi sudah ditest di Task 4)**

```typescript
// apps/admin-dashboard/src/app/dashboard/data-validate/lib/mapping.actions.ts
'use server'

import { createClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/authz'
import { normalizeStoreName, normalizeMenuName } from './normalize'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLATFORM = 'tiktokgo'

/**
 * Resolve daftar nama toko mentah -> outlet_id, dalam 2 tahap:
 *  1. Cocokkan langsung terhadap platform_store_mapping (persisted, dari upload sebelumnya).
 *  2. Untuk sisanya, coba auto-match via normalizeStoreName() terhadap outlets.name.
 * Sisa yang tetap gagal dikembalikan sebagai `unmapped` -- TIDAK pernah dibuang diam-diam.
 */
export async function resolveStoreMappings(
  storeRawNames: string[]
): Promise<{ resolved: Map<string, string>; unmapped: string[] }> {
  await requireRole(['admin', 'owner'])

  const uniqueRaw = [...new Set(storeRawNames)]
  const resolved = new Map<string, string>()

  const { data: existingMappings, error: mapErr } = await supabase
    .from('platform_store_mapping')
    .select('store_key, outlet_id')
    .eq('platform', PLATFORM)
    .in('store_key', uniqueRaw)
  if (mapErr) throw new Error(mapErr.message)
  for (const m of existingMappings ?? []) resolved.set(m.store_key, m.outlet_id)

  const stillUnresolved = uniqueRaw.filter((s) => !resolved.has(s))
  if (stillUnresolved.length > 0) {
    const { data: outlets, error: outErr } = await supabase.from('outlets').select('id, name')
    if (outErr) throw new Error(outErr.message)
    const byNorm = new Map((outlets ?? []).map((o) => [normalizeStoreName(o.name), o.id]))
    for (const raw of stillUnresolved) {
      const outletId = byNorm.get(normalizeStoreName(raw))
      if (outletId) resolved.set(raw, outletId)
    }
  }

  const unmapped = uniqueRaw.filter((s) => !resolved.has(s))
  return { resolved, unmapped }
}

/** Sama polanya dengan resolveStoreMappings, untuk nama menu. */
export async function resolveMenuMappings(
  itemRawNames: string[]
): Promise<{ resolved: Map<string, string>; unmapped: string[] }> {
  await requireRole(['admin', 'owner'])

  const uniqueRaw = [...new Set(itemRawNames)]
  const resolved = new Map<string, string>()

  const { data: existingMappings, error: mapErr } = await supabase
    .from('channel_menu_mapping')
    .select('source_item_name, canonical_menu_name')
    .eq('platform', PLATFORM)
    .in('source_item_name', uniqueRaw)
  if (mapErr) throw new Error(mapErr.message)
  for (const m of existingMappings ?? []) resolved.set(m.source_item_name, m.canonical_menu_name)

  const stillUnresolved = uniqueRaw.filter((s) => !resolved.has(s))
  if (stillUnresolved.length > 0) {
    const { data: menuItems, error: miErr } = await supabase.from('menu_items').select('name')
    if (miErr) throw new Error(miErr.message)
    const dbNames = new Set((menuItems ?? []).map((m) => normalizeMenuName(m.name)))
    for (const raw of stillUnresolved) {
      const norm = normalizeMenuName(raw)
      if (dbNames.has(norm)) resolved.set(raw, norm)
    }
  }

  const unmapped = uniqueRaw.filter((s) => !resolved.has(s))
  return { resolved, unmapped }
}

export async function saveStoreMapping(storeRaw: string, outletId: string): Promise<void> {
  const { userId } = await requireRole(['admin', 'owner'])
  const { error } = await supabase
    .from('platform_store_mapping')
    .upsert(
      { platform: PLATFORM, store_key: storeRaw, outlet_id: outletId, created_by: userId },
      { onConflict: 'platform,store_key' }
    )
  if (error) throw new Error(error.message)
}

export async function saveMenuMapping(itemRaw: string, canonicalMenuName: string): Promise<void> {
  const { userId } = await requireRole(['admin', 'owner'])
  const { error } = await supabase
    .from('channel_menu_mapping')
    .upsert(
      { platform: PLATFORM, source_item_name: itemRaw, canonical_menu_name: canonicalMenuName, created_by: userId },
      { onConflict: 'platform,source_item_name' }
    )
  if (error) throw new Error(error.message)
}

export async function getOutletOptions(): Promise<{ id: string; name: string }[]> {
  await requireRole(['admin', 'owner'])
  const { data, error } = await supabase
    .from('outlets')
    .select('id, name')
    .neq('type', 'marketplace')
    .order('name')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getCanonicalMenuOptions(): Promise<string[]> {
  await requireRole(['admin', 'owner'])
  const { data, error } = await supabase.from('menu_items').select('name')
  if (error) throw new Error(error.message)
  const names = new Set((data ?? []).map((m) => normalizeMenuName(m.name)))
  return [...names].sort()
}
```

- [ ] **Step 2: Type-check**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn type-check`
Expected: 0 error baru pada file ini (error pre-existing di file lain boleh diabaikan, dicek di Task 10).

- [ ] **Step 3: Commit**

```bash
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
git add apps/admin-dashboard/src/app/dashboard/data-validate/lib/mapping.actions.ts
git commit -m "$(cat <<'EOF'
feat(admin-dashboard): add store/menu mapping resolution server actions

Two-stage resolution (persisted mapping table, then name-normalization
auto-match) for TikTok GO. Anything that still fails to resolve is
returned as `unmapped` for the UI to surface -- never silently dropped,
unlike the whitelist the old data-validate page used.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Server actions — agregasi, perbandingan, dan simpan hasil

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/data-validate/lib/compare.actions.ts`
- Test: `apps/admin-dashboard/src/app/dashboard/data-validate/lib/compare.actions.test.ts` (test fungsi murni saja, bukan yang memanggil Supabase)

**Interfaces:**
- Consumes: `ParsedRow`, `FileAggregateRow`, `ComparisonRow` (Task 2); `resolveStoreMappings`, `resolveMenuMappings` (Task 5); `requireRole`
- Produces: `aggregateFileRows(rows: ParsedRow[], storeMap: Map<string,string>, menuMap: Map<string,string>): FileAggregateRow[]` (pure, testable), `runValidation(formData: FormData): Promise<{success: true; runId: string; comparison: ComparisonRow[]; unmappedStores: UnmappedStore[]; unmappedItems: UnmappedItem[]} | {success: false; error: string}>`, `getRunHistory(): Promise<{id: string; periodFrom: string; periodTo: string; sourceFileName: string; uploadedAt: string}[]>`, `getRunResults(runId: string): Promise<ComparisonRow[]>` — dipakai oleh `UploadForm.tsx`, `ResultsTable.tsx`, `RunHistory.tsx` (Task 8/9).

- [ ] **Step 1: Tulis test untuk fungsi murni `aggregateFileRows`**

```typescript
// apps/admin-dashboard/src/app/dashboard/data-validate/lib/compare.actions.test.ts
import { describe, it, expect } from 'vitest'
import { aggregateFileRows } from './compare.actions'
import type { ParsedRow } from './types'

describe('aggregateFileRows', () => {
  const storeMap = new Map([['SUKA Shawarma Ciseeng', 'outlet-1']])
  const menuMap = new Map([['BEST SELLER (MIX JUMBO)', 'best seller (mix jumbo)']])

  it('groups by outlet + canonical menu + tanggal, summing qty and omzet kotor (payment amount)', () => {
    const rows: ParsedRow[] = [
      {
        tanggal: '2026-07-01', storeRaw: 'SUKA Shawarma Ciseeng', itemRaw: 'BEST SELLER (MIX JUMBO)',
        originalPrice: 47000, paymentAmount: 33000, platformIncentive: 5000, merchantIncentive: 0,
        settlementAmount: 34960,
      },
      {
        tanggal: '2026-07-01', storeRaw: 'SUKA Shawarma Ciseeng', itemRaw: 'BEST SELLER (MIX JUMBO)',
        originalPrice: 47000, paymentAmount: 38000, platformIncentive: 0, merchantIncentive: 0,
        settlementAmount: 34960,
      },
    ]
    const result = aggregateFileRows(rows, storeMap, menuMap)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      outletId: 'outlet-1',
      canonicalMenuName: 'best seller (mix jumbo)',
      tanggal: '2026-07-01',
      qty: 2,
      omzetKotor: 71000, // SUM(paymentAmount) = 33000 + 38000
    })
  })

  it('computes promo diskon deal as original - payment - PI - MI', () => {
    const rows: ParsedRow[] = [{
      tanggal: '2026-07-01', storeRaw: 'SUKA Shawarma Ciseeng', itemRaw: 'BEST SELLER (MIX JUMBO)',
      originalPrice: 47000, paymentAmount: 31000, platformIncentive: 7000, merchantIncentive: 0,
      settlementAmount: 34960,
    }]
    const result = aggregateFileRows(rows, storeMap, menuMap)
    expect(result[0].promoDiskonDeal).toBe(9000) // 47000 - 31000 - 7000 - 0
    expect(result[0].promoPlatformIncentive).toBe(7000)
    expect(result[0].promoMerchantIncentive).toBe(0)
  })

  it('computes admin platform fee as (payment+PI+MI) - settlement, never negative even with PI present', () => {
    const rows: ParsedRow[] = [{
      tanggal: '2026-07-01', storeRaw: 'SUKA Shawarma Ciseeng', itemRaw: 'BEST SELLER (MIX JUMBO)',
      originalPrice: 47000, paymentAmount: 31000, platformIncentive: 7000, merchantIncentive: 0,
      settlementAmount: 34960,
    }]
    const result = aggregateFileRows(rows, storeMap, menuMap)
    // (31000+7000+0) - 34960 = 3040
    expect(result[0].adminPlatformFee).toBe(3040)
    expect(result[0].adminPlatformFee!).toBeGreaterThanOrEqual(0)
  })

  it('returns null admin platform fee for the group when any row in it lacks settlement amount', () => {
    const rows: ParsedRow[] = [{
      tanggal: '2026-07-31', storeRaw: 'SUKA Shawarma Ciseeng', itemRaw: 'BEST SELLER (MIX JUMBO)',
      originalPrice: 47000, paymentAmount: 38000, platformIncentive: 0, merchantIncentive: 0,
      settlementAmount: null,
    }]
    const result = aggregateFileRows(rows, storeMap, menuMap)
    expect(result[0].adminPlatformFee).toBeNull()
  })

  it('skips rows whose store or item failed to resolve (not present in the maps)', () => {
    const rows: ParsedRow[] = [{
      tanggal: '2026-07-01', storeRaw: 'Toko Tidak Dikenal', itemRaw: 'BEST SELLER (MIX JUMBO)',
      originalPrice: 47000, paymentAmount: 38000, platformIncentive: 0, merchantIncentive: 0,
      settlementAmount: 34960,
    }]
    const result = aggregateFileRows(rows, storeMap, menuMap)
    expect(result).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && npx vitest run src/app/dashboard/data-validate/lib/compare.actions.test.ts`
Expected: FAIL — module/fungsi belum ada.

- [ ] **Step 3: Implementasi**

```typescript
// apps/admin-dashboard/src/app/dashboard/data-validate/lib/compare.actions.ts
'use server'

import { createClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/authz'
import { parseTiktokGoFile } from './parsers/tiktokgo'
import { resolveStoreMappings, resolveMenuMappings } from './mapping.actions'
import type {
  ParsedRow, FileAggregateRow, SystemAggregateRow, ComparisonRow, UnmappedStore, UnmappedItem,
} from './types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PERIOD_FROM = '2026-07-01'
const PERIOD_TO = '2026-07-31'

/**
 * Grouping murni (outlet, menu kanonik, tanggal) -- diekspor terpisah dari
 * runValidation() supaya bisa ditest tanpa menyentuh Supabase.
 * Baris yang store/item-nya tak ada di peta (belum diresolve) DILEWATI --
 * pemanggil bertanggung jawab memastikan maps sudah lengkap (lihat
 * runValidation, yang menahan proses sampai unmapped kosong).
 */
export function aggregateFileRows(
  rows: ParsedRow[],
  storeMap: Map<string, string>,
  menuMap: Map<string, string>
): FileAggregateRow[] {
  type Bucket = {
    outletId: string; canonicalMenuName: string; tanggal: string;
    qty: number; omzetKotor: number;
    promoDiskonDeal: number; promoPlatformIncentive: number; promoMerchantIncentive: number;
    paymentPlusIncentiveSum: number; settlementSum: number; hasNullSettlement: boolean;
  }
  const buckets = new Map<string, Bucket>()

  for (const r of rows) {
    const outletId = storeMap.get(r.storeRaw)
    const canonicalMenuName = menuMap.get(r.itemRaw)
    if (!outletId || !canonicalMenuName) continue

    const key = `${outletId}|${canonicalMenuName}|${r.tanggal}`
    const b = buckets.get(key) ?? {
      outletId, canonicalMenuName, tanggal: r.tanggal,
      qty: 0, omzetKotor: 0, promoDiskonDeal: 0, promoPlatformIncentive: 0, promoMerchantIncentive: 0,
      paymentPlusIncentiveSum: 0, settlementSum: 0, hasNullSettlement: false,
    }

    b.qty += 1
    b.omzetKotor += r.paymentAmount
    b.promoDiskonDeal += r.originalPrice - r.paymentAmount - r.platformIncentive - r.merchantIncentive
    b.promoPlatformIncentive += r.platformIncentive
    b.promoMerchantIncentive += r.merchantIncentive
    b.paymentPlusIncentiveSum += r.paymentAmount + r.platformIncentive + r.merchantIncentive
    if (r.settlementAmount === null) {
      b.hasNullSettlement = true
    } else {
      b.settlementSum += r.settlementAmount
    }

    buckets.set(key, b)
  }

  return [...buckets.values()].map((b) => ({
    outletId: b.outletId,
    canonicalMenuName: b.canonicalMenuName,
    tanggal: b.tanggal,
    qty: b.qty,
    omzetKotor: b.omzetKotor,
    promoDiskonDeal: b.promoDiskonDeal,
    promoPlatformIncentive: b.promoPlatformIncentive,
    promoMerchantIncentive: b.promoMerchantIncentive,
    adminPlatformFee: b.hasNullSettlement ? null : b.paymentPlusIncentiveSum - b.settlementSum,
  }))
}

export async function runValidation(formData: FormData): Promise<
  | { success: true; runId: string; comparison: ComparisonRow[]; unmappedStores: UnmappedStore[]; unmappedItems: UnmappedItem[] }
  | { success: false; error: string }
> {
  try {
    const { userId } = await requireRole(['admin', 'owner'])

    const file = formData.get('file') as File | null
    if (!file) return { success: false, error: 'File belum dipilih.' }
    const outletIdsRaw = String(formData.get('outletIds') ?? '[]')
    const selectedOutletIds: string[] = JSON.parse(outletIdsRaw)

    const parsed = parseTiktokGoFile(await file.arrayBuffer())
    if (parsed.length === 0) return { success: false, error: 'Tidak ada baris transaksi terbaca dari file ini.' }

    const [{ resolved: storeMap, unmapped: unmappedStoreNames }, { resolved: menuMap, unmapped: unmappedItemNames }] =
      await Promise.all([
        resolveStoreMappings(parsed.map((r) => r.storeRaw)),
        resolveMenuMappings(parsed.map((r) => r.itemRaw)),
      ])

    const unmappedStores: UnmappedStore[] = unmappedStoreNames.map((storeRaw) => {
      const rows = parsed.filter((r) => r.storeRaw === storeRaw)
      return { storeRaw, qty: rows.length, omzetKotor: rows.reduce((s, r) => s + r.paymentAmount, 0) }
    })
    const unmappedItems: UnmappedItem[] = unmappedItemNames.map((itemRaw) => {
      const rows = parsed.filter((r) => r.itemRaw === itemRaw)
      return { itemRaw, qty: rows.length, omzetKotor: rows.reduce((s, r) => s + r.paymentAmount, 0) }
    })

    const fileAgg = aggregateFileRows(parsed, storeMap, menuMap)

    const outletIdsForRpc = selectedOutletIds.length > 0 ? selectedOutletIds : null
    const { data: systemRows, error: rpcErr } = await supabase.rpc('tiktokgo_qty_by_menu_date', {
      p_from: PERIOD_FROM,
      p_to: PERIOD_TO,
      p_outlet_ids: outletIdsForRpc,
    })
    if (rpcErr) return { success: false, error: `Gagal memuat data sistem: ${rpcErr.message}` }

    const systemAgg: SystemAggregateRow[] = (systemRows ?? []).map((r: any) => ({
      outletId: r.outlet_id,
      canonicalMenuName: r.canonical_menu_name,
      tanggal: r.tanggal,
      qty: Number(r.qty),
      omzetKotor: Number(r.omzet_kotor),
    }))

    const { data: outlets } = await supabase.from('outlets').select('id, name')
    const outletNameById = new Map((outlets ?? []).map((o) => [o.id, o.name]))

    const merged = new Map<string, ComparisonRow>()
    for (const f of fileAgg) {
      const key = `${f.outletId}|${f.canonicalMenuName}|${f.tanggal}`
      merged.set(key, {
        outletId: f.outletId,
        outletName: outletNameById.get(f.outletId) ?? f.outletId,
        canonicalMenuName: f.canonicalMenuName,
        tanggal: f.tanggal,
        qtyFile: f.qty,
        qtySystem: 0,
        omzetKotorFile: f.omzetKotor,
        omzetKotorSystem: 0,
        promoDiskonDeal: f.promoDiskonDeal,
        promoPlatformIncentive: f.promoPlatformIncentive,
        promoMerchantIncentive: f.promoMerchantIncentive,
        adminPlatformFee: f.adminPlatformFee,
      })
    }
    for (const s of systemAgg) {
      const key = `${s.outletId}|${s.canonicalMenuName}|${s.tanggal}`
      const existing = merged.get(key)
      if (existing) {
        existing.qtySystem = s.qty
        existing.omzetKotorSystem = s.omzetKotor
      } else {
        merged.set(key, {
          outletId: s.outletId,
          outletName: outletNameById.get(s.outletId) ?? s.outletId,
          canonicalMenuName: s.canonicalMenuName,
          tanggal: s.tanggal,
          qtyFile: 0,
          qtySystem: s.qty,
          omzetKotorFile: 0,
          omzetKotorSystem: s.omzetKotor,
          promoDiskonDeal: 0,
          promoPlatformIncentive: 0,
          promoMerchantIncentive: 0,
          adminPlatformFee: null,
        })
      }
    }

    const comparison = [...merged.values()].sort(
      (a, b) => a.outletName.localeCompare(b.outletName) || a.canonicalMenuName.localeCompare(b.canonicalMenuName) || a.tanggal.localeCompare(b.tanggal)
    )

    const { data: run, error: runErr } = await supabase
      .from('channel_validation_runs')
      .insert({
        platform: 'tiktokgo',
        period_from: PERIOD_FROM,
        period_to: PERIOD_TO,
        source_file_name: file.name,
        uploaded_by: userId,
        unmapped_stores: unmappedStores,
        unmapped_items: unmappedItems,
      })
      .select('id')
      .single()
    if (runErr) return { success: false, error: `Gagal menyimpan run: ${runErr.message}` }

    if (comparison.length > 0) {
      const records = comparison.map((c) => ({
        run_id: run.id,
        outlet_id: c.outletId,
        canonical_menu_name: c.canonicalMenuName,
        tanggal: c.tanggal,
        qty_file: c.qtyFile,
        qty_system: c.qtySystem,
        omzet_kotor_file: c.omzetKotorFile,
        omzet_kotor_system: c.omzetKotorSystem,
        promo_diskon_deal: c.promoDiskonDeal,
        promo_platform_incentive: c.promoPlatformIncentive,
        promo_merchant_incentive: c.promoMerchantIncentive,
        admin_platform_fee: c.adminPlatformFee,
      }))
      const BATCH = 500
      for (let i = 0; i < records.length; i += BATCH) {
        const { error } = await supabase.from('channel_validation_results').insert(records.slice(i, i + BATCH))
        if (error) return { success: false, error: `Gagal menyimpan hasil: ${error.message}` }
      }
    }

    return { success: true, runId: run.id, comparison, unmappedStores, unmappedItems }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Terjadi kesalahan tak terduga.' }
  }
}

export async function getRunHistory() {
  await requireRole(['admin', 'owner'])
  const { data, error } = await supabase
    .from('channel_validation_runs')
    .select('id, period_from, period_to, source_file_name, uploaded_at')
    .eq('platform', 'tiktokgo')
    .order('uploaded_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    id: r.id, periodFrom: r.period_from, periodTo: r.period_to,
    sourceFileName: r.source_file_name, uploadedAt: r.uploaded_at,
  }))
}

export async function getRunResults(runId: string): Promise<ComparisonRow[]> {
  await requireRole(['admin', 'owner'])
  const { data, error } = await supabase
    .from('channel_validation_results')
    .select('outlet_id, canonical_menu_name, tanggal, qty_file, qty_system, omzet_kotor_file, omzet_kotor_system, promo_diskon_deal, promo_platform_incentive, promo_merchant_incentive, admin_platform_fee, outlets(name)')
    .eq('run_id', runId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: any) => ({
    outletId: r.outlet_id,
    outletName: r.outlets?.name ?? r.outlet_id,
    canonicalMenuName: r.canonical_menu_name,
    tanggal: r.tanggal,
    qtyFile: r.qty_file,
    qtySystem: r.qty_system,
    omzetKotorFile: Number(r.omzet_kotor_file),
    omzetKotorSystem: Number(r.omzet_kotor_system),
    promoDiskonDeal: Number(r.promo_diskon_deal),
    promoPlatformIncentive: Number(r.promo_platform_incentive),
    promoMerchantIncentive: Number(r.promo_merchant_incentive),
    adminPlatformFee: r.admin_platform_fee === null ? null : Number(r.admin_platform_fee),
  }))
}
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && npx vitest run src/app/dashboard/data-validate/lib/compare.actions.test.ts`
Expected: PASS, 5/5 test.

- [ ] **Step 5: Type-check**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn type-check`
Expected: 0 error baru pada file ini.

- [ ] **Step 6: Commit**

```bash
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
git add apps/admin-dashboard/src/app/dashboard/data-validate/lib/compare.actions.ts apps/admin-dashboard/src/app/dashboard/data-validate/lib/compare.actions.test.ts
git commit -m "$(cat <<'EOF'
feat(admin-dashboard): add file/system comparison and persistence server actions

aggregateFileRows() is a pure function (unit tested) that groups parsed
rows by (outlet, menu, tanggal) and computes the 3-part promo split plus
the admin platform fee -- verified never negative even when Platform
Incentive is present (the naive Settlement-Payment formula produces
negative fees on 12% of real rows).

runValidation() orchestrates parse -> resolve mapping -> aggregate ->
fetch system side via RPC -> merge -> persist to
channel_validation_runs/results, so results survive without re-upload.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Komponen upload + resolusi mapping

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/data-validate/components/UploadForm.tsx`
- Create: `apps/admin-dashboard/src/app/dashboard/data-validate/components/UnmappedResolver.tsx`

**Interfaces:**
- Consumes: `runValidation`, `getOutletOptions` (Task 5/6); `saveStoreMapping`, `saveMenuMapping`, `getCanonicalMenuOptions` (Task 5)
- Produces: `<UploadForm outlets={...} onValidated={(result) => void} />`, `<UnmappedResolver unmappedStores={...} unmappedItems={...} outlets={...} canonicalMenus={...} onResolved={() => void} />` — dipakai `page.tsx` (Task 9).

- [ ] **Step 1: Implementasi `UnmappedResolver.tsx`**

```typescript
// apps/admin-dashboard/src/app/dashboard/data-validate/components/UnmappedResolver.tsx
'use client'

import { useState } from 'react'
import { Button } from '@suka/design-system'
import { toast } from 'sonner'
import { saveStoreMapping, saveMenuMapping } from '../lib/mapping.actions'
import type { UnmappedStore, UnmappedItem } from '../lib/types'

interface Props {
  unmappedStores: UnmappedStore[]
  unmappedItems: UnmappedItem[]
  outlets: { id: string; name: string }[]
  canonicalMenus: string[]
  onResolved: () => void
}

export default function UnmappedResolver({ unmappedStores, unmappedItems, outlets, canonicalMenus, onResolved }: Props) {
  const [storeChoice, setStoreChoice] = useState<Record<string, string>>({})
  const [itemChoice, setItemChoice] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  if (unmappedStores.length === 0 && unmappedItems.length === 0) return null

  const handleSaveAll = async () => {
    setSaving(true)
    try {
      for (const s of unmappedStores) {
        const outletId = storeChoice[s.storeRaw]
        if (outletId) await saveStoreMapping(s.storeRaw, outletId)
      }
      for (const it of unmappedItems) {
        const menu = itemChoice[it.itemRaw]
        if (menu) await saveMenuMapping(it.itemRaw, menu)
      }
      toast.success('Pemetaan disimpan. Upload ulang file untuk melanjutkan validasi.')
      onResolved()
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan pemetaan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 space-y-6">
      <h3 className="font-semibold text-amber-900">Belum dipetakan — perlu tindakan sebelum melanjutkan</h3>

      {unmappedStores.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Toko/lokasi ({unmappedStores.length})</p>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-amber-700">
              <th className="py-1">Nama di File</th><th>Qty</th><th>Omzet</th><th>Petakan ke Outlet</th>
            </tr></thead>
            <tbody>
              {unmappedStores.map((s) => (
                <tr key={s.storeRaw} className="border-t border-amber-100">
                  <td className="py-2">{s.storeRaw}</td>
                  <td>{s.qty}</td>
                  <td>Rp {s.omzetKotor.toLocaleString('id-ID')}</td>
                  <td>
                    <select
                      className="border rounded p-1 text-sm"
                      value={storeChoice[s.storeRaw] ?? ''}
                      onChange={(e) => setStoreChoice((prev) => ({ ...prev, [s.storeRaw]: e.target.value }))}
                    >
                      <option value="">Pilih outlet...</option>
                      {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {unmappedItems.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Menu ({unmappedItems.length})</p>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-amber-700">
              <th className="py-1">Nama di File</th><th>Qty</th><th>Omzet</th><th>Petakan ke Menu</th>
            </tr></thead>
            <tbody>
              {unmappedItems.map((it) => (
                <tr key={it.itemRaw} className="border-t border-amber-100">
                  <td className="py-2">{it.itemRaw}</td>
                  <td>{it.qty}</td>
                  <td>Rp {it.omzetKotor.toLocaleString('id-ID')}</td>
                  <td>
                    <select
                      className="border rounded p-1 text-sm"
                      value={itemChoice[it.itemRaw] ?? ''}
                      onChange={(e) => setItemChoice((prev) => ({ ...prev, [it.itemRaw]: e.target.value }))}
                    >
                      <option value="">Pilih menu...</option>
                      {canonicalMenus.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Button onClick={handleSaveAll} disabled={saving}>
        {saving ? 'Menyimpan...' : 'Simpan Pemetaan'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Implementasi `UploadForm.tsx`**

```typescript
// apps/admin-dashboard/src/app/dashboard/data-validate/components/UploadForm.tsx
'use client'

import { useState } from 'react'
import { Button } from '@suka/design-system'
import { toast } from 'sonner'
import { runValidation } from '../lib/compare.actions'
import { getCanonicalMenuOptions } from '../lib/mapping.actions'
import UnmappedResolver from './UnmappedResolver'
import type { ComparisonRow, UnmappedStore, UnmappedItem } from '../lib/types'

interface Props {
  outlets: { id: string; name: string }[]
  onValidated: (comparison: ComparisonRow[]) => void
}

export default function UploadForm({ outlets, onValidated }: Props) {
  const [selectedOutletIds, setSelectedOutletIds] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [unmappedStores, setUnmappedStores] = useState<UnmappedStore[]>([])
  const [unmappedItems, setUnmappedItems] = useState<UnmappedItem[]>([])
  const [canonicalMenus, setCanonicalMenus] = useState<string[]>([])

  const handleSubmit = async () => {
    if (!file) return toast.error('Pilih file terlebih dahulu')
    setLoading(true)
    try {
      const formData = new FormData()
      formData.set('file', file)
      formData.set('outletIds', JSON.stringify(selectedOutletIds))
      const result = await runValidation(formData)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      if (result.unmappedStores.length > 0 || result.unmappedItems.length > 0) {
        setUnmappedStores(result.unmappedStores)
        setUnmappedItems(result.unmappedItems)
        setCanonicalMenus(await getCanonicalMenuOptions())
        toast.warning('Ada toko/menu yang belum dipetakan. Petakan dulu lalu upload ulang.')
      } else {
        setUnmappedStores([])
        setUnmappedItems([])
      }
      onValidated(result.comparison)
      toast.success('Validasi selesai dan tersimpan.')
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan saat memvalidasi data')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div>
          <label className="text-sm font-medium">Outlet</label>
          <select
            multiple
            className="w-full p-2 border rounded-md mt-1 h-32"
            value={selectedOutletIds}
            onChange={(e) => setSelectedOutletIds(Array.from(e.target.selectedOptions, (o) => o.value))}
          >
            {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <p className="text-xs text-muted-foreground mt-1">Kosongkan pilihan untuk validasi semua outlet.</p>
        </div>
        <div>
          <label className="text-sm font-medium">Periode</label>
          <p className="text-sm text-muted-foreground mt-1">1 – 31 Juli 2026 (mengikuti cakupan file)</p>
        </div>
        <div>
          <label className="text-sm font-medium">File TikTok GO (.xlsx)</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="w-full p-2 border rounded-md mt-1"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Memvalidasi...' : 'Validasi Data'}
        </Button>
      </div>

      <UnmappedResolver
        unmappedStores={unmappedStores}
        unmappedItems={unmappedItems}
        outlets={outlets}
        canonicalMenus={canonicalMenus}
        onResolved={() => { setUnmappedStores([]); setUnmappedItems([]) }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn type-check`
Expected: 0 error baru pada kedua file ini.

- [ ] **Step 4: Commit**

```bash
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
git add apps/admin-dashboard/src/app/dashboard/data-validate/components/UploadForm.tsx apps/admin-dashboard/src/app/dashboard/data-validate/components/UnmappedResolver.tsx
git commit -m "feat(admin-dashboard): add upload form and unmapped store/menu resolver UI

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Komponen hasil (ringkas + drill-down per tanggal) dan riwayat

**Files:**
- Create: `apps/admin-dashboard/src/app/dashboard/data-validate/components/ResultsTable.tsx`
- Create: `apps/admin-dashboard/src/app/dashboard/data-validate/components/RunHistory.tsx`

**Interfaces:**
- Consumes: `ComparisonRow` (Task 2); `getRunHistory`, `getRunResults` (Task 6)
- Produces: `<ResultsTable comparison={ComparisonRow[]} />`, `<RunHistory onOpenRun={(comparison: ComparisonRow[]) => void} />` — dipakai `page.tsx` (Task 9).

- [ ] **Step 1: Implementasi `ResultsTable.tsx`**

```typescript
// apps/admin-dashboard/src/app/dashboard/data-validate/components/ResultsTable.tsx
'use client'

import { useState, useMemo } from 'react'
import type { ComparisonRow } from '../lib/types'

interface MenuSummary {
  outletName: string
  canonicalMenuName: string
  qtyFile: number
  qtySystem: number
  omzetKotorFile: number
  omzetKotorSystem: number
  rows: ComparisonRow[]
}

export default function ResultsTable({ comparison }: { comparison: ComparisonRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const summaries = useMemo<MenuSummary[]>(() => {
    const map = new Map<string, MenuSummary>()
    for (const row of comparison) {
      const key = `${row.outletName}|${row.canonicalMenuName}`
      const s = map.get(key) ?? {
        outletName: row.outletName, canonicalMenuName: row.canonicalMenuName,
        qtyFile: 0, qtySystem: 0, omzetKotorFile: 0, omzetKotorSystem: 0, rows: [],
      }
      s.qtyFile += row.qtyFile
      s.qtySystem += row.qtySystem
      s.omzetKotorFile += row.omzetKotorFile
      s.omzetKotorSystem += row.omzetKotorSystem
      s.rows.push(row)
      map.set(key, s)
    }
    return [...map.values()].sort((a, b) => a.outletName.localeCompare(b.outletName) || a.canonicalMenuName.localeCompare(b.canonicalMenuName))
  }, [comparison])

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  if (comparison.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada hasil. Upload file untuk memulai validasi.</p>
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-gray-100">
            <tr>
              <th className="px-4 py-3">Outlet</th>
              <th className="px-4 py-3">Menu</th>
              <th className="px-4 py-3">Qty File</th>
              <th className="px-4 py-3">Qty Sistem</th>
              <th className="px-4 py-3">Selisih</th>
              <th className="px-4 py-3">Omzet Kotor File</th>
              <th className="px-4 py-3">Omzet Kotor Sistem</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => {
              const key = `${s.outletName}|${s.canonicalMenuName}`
              const selisih = s.qtyFile - s.qtySystem
              const isMatch = selisih === 0
              const isExpanded = expanded.has(key)
              return (
                <>
                  <tr key={key} className={`border-t ${isMatch ? '' : 'bg-red-50 text-red-900'}`}>
                    <td className="px-4 py-3">{s.outletName}</td>
                    <td className="px-4 py-3">{s.canonicalMenuName}</td>
                    <td className="px-4 py-3">{s.qtyFile}</td>
                    <td className="px-4 py-3">{s.qtySystem}</td>
                    <td className="px-4 py-3 font-bold">{selisih !== 0 ? (selisih > 0 ? `+${selisih}` : selisih) : '-'}</td>
                    <td className="px-4 py-3">Rp {s.omzetKotorFile.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3">Rp {s.omzetKotorSystem.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3">
                      {!isMatch && (
                        <button className="text-blue-600 text-xs underline" onClick={() => toggle(key)}>
                          {isExpanded ? '▾ Sembunyikan' : '▸ Lihat per tanggal'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && s.rows
                    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
                    .map((r) => (
                      <tr key={`${key}|${r.tanggal}`} className="border-t bg-gray-50 text-xs">
                        <td className="px-4 py-2 pl-8" colSpan={2}>{r.tanggal}</td>
                        <td className="px-4 py-2">{r.qtyFile}</td>
                        <td className="px-4 py-2">{r.qtySystem}</td>
                        <td className="px-4 py-2 font-semibold">{r.qtyFile - r.qtySystem !== 0 ? (r.qtyFile - r.qtySystem > 0 ? `+${r.qtyFile - r.qtySystem}` : r.qtyFile - r.qtySystem) : '-'}</td>
                        <td className="px-4 py-2">Rp {r.omzetKotorFile.toLocaleString('id-ID')}</td>
                        <td className="px-4 py-2">Rp {r.omzetKotorSystem.toLocaleString('id-ID')}</td>
                        <td></td>
                      </tr>
                    ))}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implementasi `RunHistory.tsx`**

```typescript
// apps/admin-dashboard/src/app/dashboard/data-validate/components/RunHistory.tsx
'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getRunHistory, getRunResults } from '../lib/compare.actions'
import type { ComparisonRow } from '../lib/types'

interface RunSummary {
  id: string; periodFrom: string; periodTo: string; sourceFileName: string; uploadedAt: string
}

export default function RunHistory({ onOpenRun }: { onOpenRun: (comparison: ComparisonRow[]) => void }) {
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRunHistory().then(setRuns).catch((err) => toast.error(err.message)).finally(() => setLoading(false))
  }, [])

  const handleOpen = async (runId: string) => {
    try {
      const results = await getRunResults(runId)
      onOpenRun(results)
    } catch (err: any) {
      toast.error(err.message || 'Gagal memuat hasil')
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Memuat riwayat...</p>
  if (runs.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h3 className="font-semibold text-lg mb-3">Riwayat Validasi</h3>
      <ul className="divide-y">
        {runs.map((run) => (
          <li key={run.id} className="py-2 flex items-center justify-between text-sm">
            <span>{run.sourceFileName} — {run.periodFrom} s/d {run.periodTo} (diupload {new Date(run.uploadedAt).toLocaleString('id-ID')})</span>
            <button className="text-blue-600 underline" onClick={() => handleOpen(run.id)}>Buka</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn type-check`
Expected: 0 error baru pada kedua file ini.

- [ ] **Step 4: Commit**

```bash
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
git add apps/admin-dashboard/src/app/dashboard/data-validate/components/ResultsTable.tsx apps/admin-dashboard/src/app/dashboard/data-validate/components/RunHistory.tsx
git commit -m "feat(admin-dashboard): add results table with per-date drill-down and run history

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Rakit halaman, hapus kode lama

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/data-validate/page.tsx`
- Delete: `apps/admin-dashboard/src/app/dashboard/data-validate/actions.ts`
- Delete: `apps/admin-dashboard/src/app/dashboard/data-validate/components/DataValidateClient.tsx`
- Delete: `apps/admin-dashboard/src/app/dashboard/data-validate/utils/parsers.ts` (dan folder `utils/` jika sudah kosong)

**Interfaces:**
- Consumes: `getOutletOptions` (Task 5), `UploadForm`, `ResultsTable`, `RunHistory` (Task 7/8)

- [ ] **Step 1: Hapus file lama**

```bash
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard"
rm src/app/dashboard/data-validate/actions.ts
rm -rf src/app/dashboard/data-validate/components
rm -rf src/app/dashboard/data-validate/utils
mkdir -p src/app/dashboard/data-validate/components
```

- [ ] **Step 2: Tulis ulang `page.tsx` dan komponen client yang merakit semuanya**

```typescript
// apps/admin-dashboard/src/app/dashboard/data-validate/page.tsx
import { getOutletOptions } from './lib/mapping.actions'
import DataValidatePageClient from './components/DataValidatePageClient'

export const dynamic = 'force-dynamic'

export default async function DataValidatePage() {
  const outlets = await getOutletOptions()

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Validasi Channel Penjualan</h1>
        <p className="text-muted-foreground mt-2">
          Cocokkan jumlah (qty) dan omzet kotor per menu antara file export TikTok GO dengan data di sistem.
        </p>
      </div>
      <DataValidatePageClient outlets={outlets} />
    </div>
  )
}
```

Perlu satu file gabungan di sisi client karena `UploadForm` (upload baru) dan `RunHistory` (buka riwayat) sama-sama menghasilkan `ComparisonRow[]` untuk ditampilkan `ResultsTable` — state gabungan ini harus hidup di satu komponen client, di atas keduanya:

```typescript
// apps/admin-dashboard/src/app/dashboard/data-validate/components/DataValidatePageClient.tsx
'use client'

import { useState } from 'react'
import UploadForm from './UploadForm'
import ResultsTable from './ResultsTable'
import RunHistory from './RunHistory'
import type { ComparisonRow } from '../lib/types'

export default function DataValidatePageClient({ outlets }: { outlets: { id: string; name: string }[] }) {
  const [comparison, setComparison] = useState<ComparisonRow[]>([])

  return (
    <div className="space-y-6">
      <UploadForm outlets={outlets} onValidated={setComparison} />
      <ResultsTable comparison={comparison} />
      <RunHistory onOpenRun={setComparison} />
    </div>
  )
}
```

- [ ] **Step 3: Type-check seluruh app**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn type-check`
Expected: 0 error pada file-file `data-validate/*`. Error pre-existing di file lain (mis. `BahanBakuDetailModal.tsx` dari kerja BOM sesi lain, dicatat di CLAUDE.md) boleh tetap ada — bukan tanggung jawab task ini, hanya pastikan tidak bertambah.

- [ ] **Step 4: Jalankan seluruh suite test yang relevan**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && npx vitest run src/app/dashboard/data-validate`
Expected: PASS — semua test dari Task 3, 4, 6 lolos (14 test total: 5 parser + 7 normalize + ~5 aggregateFileRows, sesuaikan jumlah aktual).

- [ ] **Step 5: Jalankan build**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn build`
Expected: build sukses, route `/dashboard/data-validate` muncul di output tanpa error.

- [ ] **Step 6: Commit**

```bash
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
git add apps/admin-dashboard/src/app/dashboard/data-validate/
git commit -m "$(cat <<'EOF'
feat(admin-dashboard): assemble TikTok GO data-validate page, retire old whitelist-based version

Replaces the old client-side-only, single-channel, non-persisted
data-validate page with the new modular one: upload -> resolve unmapped
outlets/menus inline -> compare (qty + gross revenue split into 3 promo
components) -> persist -> reopen from history without re-upload.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Verifikasi manual end-to-end terhadap file sample

**Files:** tidak ada file baru — verifikasi manual memakai UI yang sudah dibangun.

- [ ] **Step 1: Jalankan dev server**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard" && yarn dev`

- [ ] **Step 2: Buka `/dashboard/data-validate` sebagai user role admin/owner**

Login dengan akun yang punya role `admin` atau `owner` (lihat `requireRole` di Task 5/6 — role lain akan ditolak).

- [ ] **Step 3: Upload `sample-reports/juli-2026/TIKTOKGO SS JULY.xlsx` tanpa memilih outlet spesifik (semua outlet)**

Expected pertama kali: muncul panel kuning "Belum dipetakan" berisi **7 lokasi** (Sentul, Pekayon, Kalisari, Paledang, Ciseeng, Cibinong, `SUKA Shawarma Kitchen`) — sesuai temuan analisis sesi brainstorming. `SUKA Shawarma Kitchen` memang tidak punya padanan outlet jual; biarkan tidak dipetakan (baris ini akan tetap muncul di run berikutnya sampai ada keputusan bisnis, itu perilaku yang benar).

- [ ] **Step 4: Petakan 6 lokasi yang valid via dropdown di panel, klik Simpan Pemetaan**

Expected: toast sukses, panel meminta upload ulang.

- [ ] **Step 5: Upload ulang file yang sama**

Expected: panel "Belum dipetakan" untuk outlet tinggal `SUKA Shawarma Kitchen` saja (atau kosong outlet, tergantung apakah ada menu yang juga belum terpetakan — `PAKET JUARA` kemungkinan muncul di panel menu, itu perilaku yang benar, petakan manual atau biarkan sesuai keputusan bisnis).

- [ ] **Step 6: Setelah tervalidasi, cek tabel ringkas**

Expected: baris qty file untuk `MITRA SENTUL` dkk muncul; total qty file keseluruhan mendekati 3.531 (sesuai analisis sesi brainstorming, dengan asumsi `SUKA Shawarma Kitchen` tetap tak terpetakan sehingga 9 barisnya tak masuk hitungan).

- [ ] **Step 7: Klik "▸ Lihat per tanggal" pada baris yang selisihnya tidak nol**

Expected: expand menampilkan hingga 31 baris tanggal untuk kombinasi outlet+menu itu, jumlah qty per tanggal menjumlah ke total ringkasan.

- [ ] **Step 8: Refresh halaman, buka panel Riwayat Validasi, klik "Buka" pada run yang baru saja dibuat**

Expected: tabel hasil terisi kembali tanpa upload ulang file — membuktikan Task 6 `getRunResults` bekerja.

- [ ] **Step 9: Laporkan hasil verifikasi ke user**

Sampaikan: total qty file vs sistem, apakah `SUKA Shawarma Kitchen` & `PAKET JUARA` perlu keputusan bisnis (petakan ke outlet/menu apa, atau memang di luar cakupan), dan screenshot/ringkasan tabel ringkas.

---

## Self-Review Checklist (sudah dijalankan penulis plan)

1. **Cakupan spec** — semua bagian spec (`2026-08-07-channel-data-validation-tiktokgo-design.md`) tercakup: parsing header dinamis (Task 3), Omzet Kotor = Payment amount + promo 3 komponen + Admin Platform fee (Task 6), mapping outlet & menu via DB+UI tanpa drop diam-diam (Task 5, 7), qty per outlet/semua-outlet periode 1-31 Juli (Task 6/7), simpan hasil + riwayat (Task 6, 8), ringkas dengan drill-down per tanggal (Task 8), isolasi app lain (Global Constraints + Task 1 catatan read-only).
2. **Placeholder scan** — tidak ada TBD/TODO; semua step berisi kode lengkap.
3. **Konsistensi tipe** — `ParsedRow`, `FileAggregateRow`, `SystemAggregateRow`, `ComparisonRow`, `UnmappedStore`, `UnmappedItem` didefinisikan sekali di Task 2, dipakai identik di Task 3, 5, 6, 7, 8 tanpa penamaan bercabang.
