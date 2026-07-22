# Dual Packaging Variant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambahkan dukungan 2 packaging variant (kompan & pouch) untuk SAOS CABE & SAOS TOMAT — input terima kiriman, opname 3-field, monitoring breakdown, dan admin CRUD variant.

**Architecture:** 2 tabel baru di Supabase (`bahan_baku_packaging_variant` + `stok_balance_packaging`). Saldo utama (`stok_balance`) tidak berubah. Breakdown per packaging diupdate hanya saat terima kiriman & opname. UI di stok-app (gudang) dan admin-dashboard masing-masing punya hook + komponen tersendiri.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Supabase (PostgreSQL + RLS), React Query (`@tanstack/react-query`), Tailwind CSS.

## Global Constraints

- Satuan dasar SAOS CABE & SAOS TOMAT = **kg** (sudah ada, tidak berubah)
- 1 kompan = **5.5 kg**, 1 pouch = **1.0 kg**
- Saldo breakdown hanya update saat: **terima kiriman** & **opname** — BUKAN saat konsumsi/BOM
- Semua tabel baru harus punya **RLS enabled**
- Soft delete variant: set `is_active = false`, jangan hard delete
- File paths selalu exact — jangan singkat
- Test runner stok-app: `cd apps/stok && npx vitest run` (vitest)
- Test runner admin-dashboard: `cd apps/admin-dashboard && npx vitest run` (vitest)
- Commit message format: `feat:`, `test:`, `fix:`, `db:` dsb.

---

## Task 1: Database Migration — 2 Tabel Baru + Seed Data

**Files:**
- Create: `supabase/migrations/20260722_packaging_variant.sql`

**Interfaces:**
- Produces: tabel `bahan_baku_packaging_variant(id, bahan_baku_id, nama_variant, satuan_variant, faktor_ke_kg, is_active, urutan, created_at)` dan `stok_balance_packaging(outlet_id, bahan_baku_id, variant_id, saldo_variant, updated_at)`

- [ ] **Step 1: Buat file migration SQL**

Buat file `supabase/migrations/20260722_packaging_variant.sql`:

```sql
-- =============================================================
-- Migration: Dual Packaging Variant
-- Tanggal: 2026-07-22
-- Tujuan: Support 2 jenis packaging per bahan baku (misal: kompan & pouch)
-- =============================================================

-- Tabel 1: Definisi packaging variant per bahan baku (master data)
CREATE TABLE IF NOT EXISTS bahan_baku_packaging_variant (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bahan_baku_id   uuid NOT NULL REFERENCES bahan_baku(id) ON DELETE CASCADE,
  nama_variant    text NOT NULL,
  satuan_variant  text NOT NULL,
  faktor_ke_kg    numeric(10, 4) NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  urutan          int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_bahan_variant UNIQUE (bahan_baku_id, satuan_variant)
);

CREATE INDEX IF NOT EXISTS idx_bbpv_bahan_baku_id
  ON bahan_baku_packaging_variant(bahan_baku_id);

-- Tabel 2: Saldo breakdown per packaging per outlet (diupdate saat kiriman & opname)
CREATE TABLE IF NOT EXISTS stok_balance_packaging (
  outlet_id       uuid NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  bahan_baku_id   uuid NOT NULL REFERENCES bahan_baku(id) ON DELETE CASCADE,
  variant_id      uuid NOT NULL REFERENCES bahan_baku_packaging_variant(id) ON DELETE CASCADE,
  saldo_variant   numeric(12, 4) NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (outlet_id, bahan_baku_id, variant_id)
);

-- RLS
ALTER TABLE bahan_baku_packaging_variant ENABLE ROW LEVEL SECURITY;
ALTER TABLE stok_balance_packaging ENABLE ROW LEVEL SECURITY;

-- bahan_baku_packaging_variant: semua authenticated user bisa baca
CREATE POLICY "bbpv_read_authenticated" ON bahan_baku_packaging_variant
  FOR SELECT TO authenticated USING (true);

-- bahan_baku_packaging_variant: hanya admin/owner yang bisa tulis
CREATE POLICY "bbpv_write_admin" ON bahan_baku_packaging_variant
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outlet_staff
      WHERE outlet_staff.auth_user_id = auth.uid()
        AND outlet_staff.role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM outlet_staff
      WHERE outlet_staff.auth_user_id = auth.uid()
        AND outlet_staff.role IN ('admin', 'owner')
    )
  );

-- stok_balance_packaging: semua authenticated user bisa baca
CREATE POLICY "sbp_read_authenticated" ON stok_balance_packaging
  FOR SELECT TO authenticated USING (true);

-- stok_balance_packaging: admin/owner/kitchen/spv bisa tulis
CREATE POLICY "sbp_write_ops" ON stok_balance_packaging
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outlet_staff
      WHERE outlet_staff.auth_user_id = auth.uid()
        AND outlet_staff.role IN ('admin', 'owner', 'spv', 'kitchen')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM outlet_staff
      WHERE outlet_staff.auth_user_id = auth.uid()
        AND outlet_staff.role IN ('admin', 'owner', 'spv', 'kitchen')
    )
  );

-- =============================================================
-- Seed Data: SAOS CABE & SAOS TOMAT — 2 variant masing-masing
-- =============================================================
INSERT INTO bahan_baku_packaging_variant (bahan_baku_id, nama_variant, satuan_variant, faktor_ke_kg, urutan)
SELECT b.id, 'Kompan', 'kompan', 5.5, 1
FROM bahan_baku b WHERE b.nama = 'SAOS CABE' AND b.is_active = true
ON CONFLICT (bahan_baku_id, satuan_variant) DO NOTHING;

INSERT INTO bahan_baku_packaging_variant (bahan_baku_id, nama_variant, satuan_variant, faktor_ke_kg, urutan)
SELECT b.id, 'Pouch', 'pouch', 1.0, 2
FROM bahan_baku b WHERE b.nama = 'SAOS CABE' AND b.is_active = true
ON CONFLICT (bahan_baku_id, satuan_variant) DO NOTHING;

INSERT INTO bahan_baku_packaging_variant (bahan_baku_id, nama_variant, satuan_variant, faktor_ke_kg, urutan)
SELECT b.id, 'Kompan', 'kompan', 5.5, 1
FROM bahan_baku b WHERE b.nama = 'SAOS TOMAT' AND b.is_active = true
ON CONFLICT (bahan_baku_id, satuan_variant) DO NOTHING;

INSERT INTO bahan_baku_packaging_variant (bahan_baku_id, nama_variant, satuan_variant, faktor_ke_kg, urutan)
SELECT b.id, 'Pouch', 'pouch', 1.0, 2
FROM bahan_baku b WHERE b.nama = 'SAOS TOMAT' AND b.is_active = true
ON CONFLICT (bahan_baku_id, satuan_variant) DO NOTHING;
```

- [ ] **Step 2: Jalankan migration di Supabase**

Buka Supabase Dashboard → SQL Editor → paste dan run isi file di atas. Atau via CLI:
```bash
# Jika pakai Supabase CLI
npx supabase db push
```

Verifikasi:
```sql
-- Cek tabel terbuat
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('bahan_baku_packaging_variant', 'stok_balance_packaging');

-- Cek seed data masuk
SELECT bb.nama, v.nama_variant, v.satuan_variant, v.faktor_ke_kg
FROM bahan_baku_packaging_variant v
JOIN bahan_baku bb ON bb.id = v.bahan_baku_id
ORDER BY bb.nama, v.urutan;
-- Expected: 4 rows (SAOS CABE: Kompan 5.5, Pouch 1.0; SAOS TOMAT: Kompan 5.5, Pouch 1.0)
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260722_packaging_variant.sql
git commit -m "db: add bahan_baku_packaging_variant and stok_balance_packaging tables with RLS + seed"
```

---

## Task 2: TypeScript Types — Shared Type Definitions

**Files:**
- Modify: `apps/stok/src/types/stok.ts`

**Interfaces:**
- Produces: `PackagingVariant` type dan `StokBalancePackaging` type yang dipakai di Task 3, 4, 5, 6, 7

- [ ] **Step 1: Tambahkan type baru di stok.ts**

Buka `apps/stok/src/types/stok.ts` dan tambahkan di bagian **bawah** file:

```typescript
// ── Packaging Variant (dual-packaging support) ──────────────
export interface PackagingVariant {
  id: string
  bahan_baku_id: string
  nama_variant: string       // "Kompan", "Pouch"
  satuan_variant: string     // "kompan", "pouch"
  faktor_ke_kg: number       // 5.5, 1.0
  is_active: boolean
  urutan: number
  created_at: string
}

export interface StokBalancePackaging {
  outlet_id: string
  bahan_baku_id: string
  variant_id: string
  saldo_variant: number
  updated_at: string
}

export interface PackagingVariantWithBalance extends PackagingVariant {
  saldo_variant: number      // dari stok_balance_packaging, 0 jika belum ada row
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/stok/src/types/stok.ts
git commit -m "feat: add PackagingVariant and StokBalancePackaging types"
```

---

## Task 3: Hook — usePackagingVariants (Stok App)

Hook untuk fetch daftar variant aktif per bahan baku. Dipakai oleh OpnameForm dan komponen terima kiriman.

**Files:**
- Create: `apps/stok/src/hooks/usePackagingVariants.ts`
- Create: `apps/stok/src/hooks/__tests__/usePackagingVariants.test.ts`

**Interfaces:**
- Consumes: tabel `bahan_baku_packaging_variant` dari Task 1, type `PackagingVariant` dari Task 2
- Produces: `usePackagingVariants(bahanBakuIds: string[])` → `{ variantMap: Map<string, PackagingVariant[]>, isLoading: boolean }`

- [ ] **Step 1: Tulis test (failing)**

Buat `apps/stok/src/hooks/__tests__/usePackagingVariants.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { computeVariantTotal } from '../usePackagingVariants'

describe('computeVariantTotal', () => {
  it('returns 0 when all inputs are 0', () => {
    expect(computeVariantTotal([])).toBe(0)
  })

  it('calculates kompan × 5.5 + pouch × 1 correctly', () => {
    const inputs = [
      { faktor_ke_kg: 5.5, qty: 2 },  // 2 kompan = 11 kg
      { faktor_ke_kg: 1.0, qty: 5 },  // 5 pouch  = 5 kg
    ]
    expect(computeVariantTotal(inputs)).toBeCloseTo(16, 5)
  })

  it('handles decimal qty for sisa terbuka (faktor 1)', () => {
    const inputs = [
      { faktor_ke_kg: 5.5, qty: 1 },  // 1 kompan = 5.5 kg
      { faktor_ke_kg: 1.0, qty: 0.5 }, // 0.5 kg sisa
    ]
    expect(computeVariantTotal(inputs)).toBeCloseTo(6, 5)
  })
})
```

- [ ] **Step 2: Jalankan test — pastikan FAIL**

```bash
cd apps/stok
npx vitest run src/hooks/__tests__/usePackagingVariants.test.ts
```
Expected: FAIL dengan "computeVariantTotal is not a function"

- [ ] **Step 3: Buat hook dengan implementasi**

Buat `apps/stok/src/hooks/usePackagingVariants.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PackagingVariant } from '@/types/stok'

/**
 * Hitung total kg dari array { faktor_ke_kg, qty }.
 * Digunakan untuk opname (kompan + pouch + sisa) dan terima kiriman.
 */
export function computeVariantTotal(
  inputs: { faktor_ke_kg: number; qty: number }[]
): number {
  return inputs.reduce((sum, i) => sum + i.faktor_ke_kg * i.qty, 0)
}

/**
 * Fetch packaging variant aktif untuk sejumlah bahan_baku_id.
 * Returns Map<bahan_baku_id, PackagingVariant[]> sorted by urutan ASC.
 * Empty array = bahan tidak punya variant khusus.
 */
export function usePackagingVariants(bahanBakuIds: string[]) {
  const supabase = createClient()

  const { data, isLoading } = useQuery({
    queryKey: ['packaging_variants', ...bahanBakuIds.sort()],
    enabled: bahanBakuIds.length > 0,
    staleTime: 10 * 60_000, // 10 menit — jarang berubah
    queryFn: async () => {
      if (bahanBakuIds.length === 0) return []
      const { data, error } = await supabase
        .from('bahan_baku_packaging_variant')
        .select('*')
        .in('bahan_baku_id', bahanBakuIds)
        .eq('is_active', true)
        .order('urutan', { ascending: true })
      if (error) throw error
      return (data ?? []) as PackagingVariant[]
    },
  })

  const variantMap = new Map<string, PackagingVariant[]>()
  for (const v of data ?? []) {
    const existing = variantMap.get(v.bahan_baku_id) ?? []
    variantMap.set(v.bahan_baku_id, [...existing, v])
  }

  return { variantMap, isLoading }
}
```

- [ ] **Step 4: Jalankan test — pastikan PASS**

```bash
cd apps/stok
npx vitest run src/hooks/__tests__/usePackagingVariants.test.ts
```
Expected: PASS semua 3 test

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/hooks/usePackagingVariants.ts apps/stok/src/hooks/__tests__/usePackagingVariants.test.ts
git commit -m "feat: add usePackagingVariants hook with computeVariantTotal"
```

---

## Task 4: Komponen Opname — Input 3-Field untuk Bahan Bervariant

Extend `OpnameForm.tsx` untuk bahan yang punya `≥2` packaging variant: ganti 2-field composite dengan 3-field (kompan + pouch + sisa_terbuka_kg).

**Files:**
- Modify: `apps/stok/src/components/stok/OpnameForm.tsx`

**Interfaces:**
- Consumes: `usePackagingVariants` dari Task 3

- [ ] **Step 1: Import hook di OpnameForm.tsx**

Di `apps/stok/src/components/stok/OpnameForm.tsx`, tambahkan import:

```typescript
import { usePackagingVariants, computeVariantTotal } from '@/hooks/usePackagingVariants'
```

- [ ] **Step 2: Tambahkan state untuk 3-field input variant**

Di dalam `OpnameForm` component, setelah deklarasi state `containerInput` dan `remainderInput` yang sudah ada (sekitar line 104-106), tambahkan:

```typescript
// State untuk dual-packaging variant (3-field input: per-variant qty + sisa terbuka)
const [variantInput, setVariantInput] = useState<Record<string, Record<string, string>>>({})
// variantInput[bahanId][variantId] = qty string
const [sisaTerbukaInput, setSisaTerbukaInput] = useState<Record<string, string>>({})
// sisaTerbukaInput[bahanId] = kg string
```

- [ ] **Step 3: Panggil usePackagingVariants**

Di dalam `OpnameForm` component, setelah `const { bahanBaku, ... } = useBahanBaku()`, tambahkan:

```typescript
// Ambil IDs semua bahan yang tampil, fetch variant map-nya
const bahanIds = useMemo(() => bahanBaku.map(b => b.id), [bahanBaku])
const { variantMap } = usePackagingVariants(bahanIds)
```

- [ ] **Step 4: Tambahkan handler untuk variant input**

Tambahkan fungsi baru setelah `handleCompositeChange`:

```typescript
const handleVariantChange = (
  bahanId: string,
  variantId: string,
  qty: string,
  variants: import('@/types/stok').PackagingVariant[]
) => {
  setVariantInput(prev => ({
    ...prev,
    [bahanId]: { ...(prev[bahanId] ?? {}), [variantId]: qty },
  }))

  // Recalculate total dari semua variant + sisa terbuka
  const updatedVariantQtys = { ...(variantInput[bahanId] ?? {}), [variantId]: qty }
  const sisaKg = Number(sisaTerbukaInput[bahanId] ?? 0)

  const inputs = variants.map(v => ({
    faktor_ke_kg: v.faktor_ke_kg,
    qty: Number(updatedVariantQtys[v.id] ?? 0),
  }))
  inputs.push({ faktor_ke_kg: 1, qty: sisaKg }) // sisa terbuka selalu dalam kg

  const total = computeVariantTotal(inputs)
  setFisik(prev => ({ ...prev, [bahanId]: total > 0 ? total.toString() : '' }))
}

const handleSisaTerbukaChange = (
  bahanId: string,
  sisa: string,
  variants: import('@/types/stok').PackagingVariant[]
) => {
  setSisaTerbukaInput(prev => ({ ...prev, [bahanId]: sisa }))

  const sisaKg = Number(sisa ?? 0)
  const inputs = variants.map(v => ({
    faktor_ke_kg: v.faktor_ke_kg,
    qty: Number((variantInput[bahanId] ?? {})[v.id] ?? 0),
  }))
  inputs.push({ faktor_ke_kg: 1, qty: sisaKg })

  const total = computeVariantTotal(inputs)
  setFisik(prev => ({ ...prev, [bahanId]: total > 0 ? total.toString() : '' }))
}
```

- [ ] **Step 5: Modifikasi render card — tambah 3-field UI**

Di dalam `.map((b) => {` (sekitar line 359), sebelum blok `useComposite`:

```typescript
const variants = variantMap.get(b.id) ?? []
const hasVariants = variants.length >= 2
```

Lalu di section "Card Bottom: Input Actions" (sekitar line 449), tambahkan kondisi `hasVariants` SEBELUM `useComposite`:

```typescript
{/* Card Bottom: Input Actions */}
{hasVariants ? (
  // 3-field input: per variant + sisa terbuka
  <div className="mt-4 space-y-2">
    {variants.map(v => (
      <div key={v.id} className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          className="w-20 text-center bg-white border border-[#d9c2b2]/45 rounded-lg font-extrabold text-sm text-[#701604] py-2.5 no-spinner shadow-inner focus:ring-2 focus:ring-[#f29744]/50 focus:border-[#f29744]"
          placeholder="0"
          value={(variantInput[b.id] ?? {})[v.id] ?? ''}
          onChange={e => handleVariantChange(b.id, v.id, e.target.value, variants)}
        />
        <span className="text-[10px] font-bold text-[#544437]/60 min-w-[60px]">
          {v.nama_variant} <span className="text-[#701604]/40">({v.faktor_ke_kg} kg)</span>
        </span>
      </div>
    ))}
    {/* Sisa terbuka */}
    <div className="flex items-center gap-2 border-t border-[#d9c2b2]/30 pt-2 mt-1">
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={0.1}
        className="w-20 text-center bg-white border border-[#d9c2b2]/45 rounded-lg font-extrabold text-sm text-[#701604] py-2.5 no-spinner shadow-inner focus:ring-2 focus:ring-[#f29744]/50 focus:border-[#f29744]"
        placeholder="0"
        value={sisaTerbukaInput[b.id] ?? ''}
        onChange={e => handleSisaTerbukaChange(b.id, e.target.value, variants)}
      />
      <span className="text-[10px] font-bold text-[#544437]/60">Sisa terbuka (kg)</span>
    </div>
    {fisik[b.id] && (
      <p className="text-[10px] text-[#0a7d2c] font-bold">
        → Total: {Number(fisik[b.id]).toFixed(2)} kg
      </p>
    )}
  </div>
) : useComposite ? (
  // ... existing composite input (tidak berubah)
```

> **Catatan:** Pastikan closing brace `}` menutup kondisi baru dan existing composite/single input tetap terbungkus dalam `else` yang tepat. Jangan hapus kode composite yang sudah ada.

- [ ] **Step 6: Update handleFinalize — update stok_balance_packaging setelah opname difinalize**

Setelah `await upsertItems(items)` dan sebelum `const hasFlagged = ...` di dalam `handleFinalize`, tambahkan:

```typescript
// Update stok_balance_packaging: replace saldo per variant berdasarkan input opname
const supabase = createClient()
for (const b of bahanBaku) {
  const variants = variantMap.get(b.id) ?? []
  if (variants.length < 2) continue

  for (const v of variants) {
    const qty = Number((variantInput[b.id] ?? {})[v.id] ?? 0)
    await supabase.from('stok_balance_packaging').upsert({
      outlet_id: outletId,
      bahan_baku_id: b.id,
      variant_id: v.id,
      saldo_variant: qty,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'outlet_id,bahan_baku_id,variant_id' })
  }
}
```

Tambahkan import `createClient` di atas file jika belum ada:
```typescript
import { createClient } from '@/lib/supabase'
```

- [ ] **Step 7: Smoke test manual**

Jalankan stok-app:
```bash
cd apps/stok
npm run dev
```
Buka `/stok/opname` → pilih outlet gudang → cari SAOS CABE → harus tampil 3 field: Kompan, Pouch, Sisa terbuka. Isi 2 kompan + 5 pouch + 0.5 sisa → total harus 2×5.5 + 5×1 + 0.5 = **16.5 kg**.

- [ ] **Step 8: Commit**

```bash
git add apps/stok/src/components/stok/OpnameForm.tsx
git commit -m "feat: add 3-field variant input for SAOS in OpnameForm + update stok_balance_packaging on finalize"
```

---

## Task 5: Terima Kiriman — Update stok_balance_packaging

Saat staf input terima kiriman (surat jalan / kiriman masuk), untuk bahan bervariant: tampilkan input per packaging dan update `stok_balance_packaging` setelah kiriman dikonfirmasi.

**Files:**
- Modify: `apps/stok/src/app/actions/` (cek action mana yang handle terima kiriman)
- Modify: Komponen terima kiriman yang relevan

**Interfaces:**
- Consumes: `usePackagingVariants` dari Task 3, tabel `stok_balance_packaging` dari Task 1

> **Note untuk implementor:** Cek terlebih dahulu flow "terima kiriman" di codebase. Kemungkinan ada di `/stok/mutasi` atau di surat jalan. Cek `apps/stok/src/app/actions/` dan `apps/stok/src/components/stok/` untuk komponen yang relevan. Ikuti pola yang sama dengan Task 4.

- [ ] **Step 1: Cari komponen terima kiriman**

```bash
# Cari komponen yang handle 'terima kiriman' atau 'surat_jalan' atau 'kiriman_masuk'
grep -r "terima_kiriman\|surat_jalan\|kiriman" apps/stok/src --include="*.tsx" -l
```

- [ ] **Step 2: Tambahkan state variantInput di komponen terima kiriman**

Sama dengan Task 4 step 2 — tambah `variantInput` dan state per bahan.

- [ ] **Step 3: Tambahkan usePackagingVariants**

```typescript
import { usePackagingVariants, computeVariantTotal } from '@/hooks/usePackagingVariants'
// ...
const { variantMap } = usePackagingVariants(bahanIds)
```

- [ ] **Step 4: Render input per packaging (kompan + pouch)**

Untuk bahan yang punya `variants.length >= 2`, tampilkan 2 input (kompan & pouch):

```typescript
{hasVariants ? (
  <div className="space-y-2">
    {variants.map(v => (
      <div key={v.id} className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          className="w-20 text-center bg-white border border-[#d9c2b2]/45 rounded-lg font-extrabold text-sm text-[#701604] py-2 no-spinner"
          placeholder="0"
          value={(variantInput[b.id] ?? {})[v.id] ?? ''}
          onChange={e => handleVariantChange(b.id, v.id, e.target.value, variants)}
        />
        <span className="text-[10px] font-bold text-[#544437]/60">
          {v.nama_variant}
        </span>
      </div>
    ))}
    {fisik[b.id] && (
      <p className="text-[10px] text-[#0a7d2c] font-bold">
        → Total: {Number(fisik[b.id]).toFixed(2)} kg
      </p>
    )}
  </div>
) : (
  // ... existing single input
)}
```

- [ ] **Step 5: Update stok_balance_packaging setelah kiriman dikonfirmasi**

Setelah ledger_stok dicommit (kiriman diterima), lakukan upsert += ke stok_balance_packaging:

```typescript
const supabase = createClient()
for (const [bahanId, variantQtys] of Object.entries(variantInput)) {
  const variants = variantMap.get(bahanId) ?? []
  for (const v of variants) {
    const qty = Number(variantQtys[v.id] ?? 0)
    if (qty <= 0) continue
    // Increment (+=) karena ini terima kiriman, bukan reset seperti opname
    await supabase.rpc('increment_stok_balance_packaging', {
      p_outlet_id: outletId,
      p_bahan_baku_id: bahanId,
      p_variant_id: v.id,
      p_qty_tambah: qty,
    })
  }
}
```

Tambahkan RPC function `increment_stok_balance_packaging` di Supabase:

```sql
CREATE OR REPLACE FUNCTION increment_stok_balance_packaging(
  p_outlet_id uuid,
  p_bahan_baku_id uuid,
  p_variant_id uuid,
  p_qty_tambah numeric
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO stok_balance_packaging (outlet_id, bahan_baku_id, variant_id, saldo_variant, updated_at)
  VALUES (p_outlet_id, p_bahan_baku_id, p_variant_id, p_qty_tambah, now())
  ON CONFLICT (outlet_id, bahan_baku_id, variant_id)
  DO UPDATE SET
    saldo_variant = stok_balance_packaging.saldo_variant + EXCLUDED.saldo_variant,
    updated_at = now();
END;
$$;
```

Jalankan SQL ini di Supabase SQL Editor sebelum test.

- [ ] **Step 6: Commit**

```bash
git add apps/stok/src/components/stok/ apps/stok/src/app/actions/
git commit -m "feat: add variant packaging input to terima kiriman + increment stok_balance_packaging"
```

---

## Task 6: Monitoring — Tampilkan Breakdown Packaging di Stok App

Tambahkan baris breakdown "X kompan + Y pouch" di bawah saldo total di monitoring harian.

**Files:**
- Modify: `apps/stok/src/components/monitoring/SPVDashboard.tsx` (atau `DetailOutletMonitoring.tsx`)
- Create: `apps/stok/src/hooks/usePackagingBalances.ts`

**Interfaces:**
- Consumes: tabel `stok_balance_packaging` dari Task 1, type `StokBalancePackaging` dan `PackagingVariant` dari Task 2
- Produces: `usePackagingBalances(outletId)` → `{ balanceMap: Map<bahan_baku_id, PackagingVariantWithBalance[]> }`

- [ ] **Step 1: Buat hook usePackagingBalances**

Buat `apps/stok/src/hooks/usePackagingBalances.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PackagingVariantWithBalance } from '@/types/stok'

/**
 * Fetch saldo per packaging variant untuk satu outlet.
 * Returns Map<bahan_baku_id, PackagingVariantWithBalance[]>
 */
export function usePackagingBalances(outletId: string | null | undefined) {
  const supabase = createClient()

  const { data, isLoading } = useQuery({
    queryKey: ['packaging_balances', outletId],
    enabled: !!outletId,
    staleTime: 30_000,
    queryFn: async () => {
      // Join stok_balance_packaging dengan variant definition
      const { data, error } = await supabase
        .from('stok_balance_packaging')
        .select(`
          outlet_id, bahan_baku_id, variant_id, saldo_variant, updated_at,
          bahan_baku_packaging_variant!inner(id, nama_variant, satuan_variant, faktor_ke_kg, urutan)
        `)
        .eq('outlet_id', outletId!)
        .order('bahan_baku_packaging_variant(urutan)', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  const balanceMap = new Map<string, PackagingVariantWithBalance[]>()
  for (const row of data ?? []) {
    const variant = (row as any).bahan_baku_packaging_variant
    const item: PackagingVariantWithBalance = {
      id: variant.id,
      bahan_baku_id: row.bahan_baku_id,
      nama_variant: variant.nama_variant,
      satuan_variant: variant.satuan_variant,
      faktor_ke_kg: variant.faktor_ke_kg,
      is_active: true,
      urutan: variant.urutan,
      created_at: '',
      saldo_variant: row.saldo_variant,
    }
    const existing = balanceMap.get(row.bahan_baku_id) ?? []
    balanceMap.set(row.bahan_baku_id, [...existing, item])
  }

  return { balanceMap, isLoading }
}
```

- [ ] **Step 2: Tambahkan PackagingBreakdownBadge component kecil**

Di atas return statement di `usePackagingBalances.ts` — atau buat file terpisah jika dipakai di banyak tempat — tambahkan helper:

Buat `apps/stok/src/components/monitoring/PackagingBreakdownBadge.tsx`:

```typescript
'use client'
import type { PackagingVariantWithBalance } from '@/types/stok'

export function PackagingBreakdownBadge({
  variants,
}: {
  variants: PackagingVariantWithBalance[]
}) {
  if (variants.length === 0) return null

  const parts = variants
    .filter(v => v.saldo_variant > 0)
    .map(v => `${v.saldo_variant} ${v.satuan_variant}`)

  if (parts.length === 0) return null

  return (
    <span className="text-[9px] text-[#544437]/60 font-semibold">
      ({parts.join(' + ')})
    </span>
  )
}
```

- [ ] **Step 3: Integrasikan di monitoring**

Di `apps/stok/src/components/monitoring/SPVDashboard.tsx` (atau komponen monitoring yang menampilkan saldo per bahan), tambahkan:

```typescript
import { usePackagingBalances } from '@/hooks/usePackagingBalances'
import { PackagingBreakdownBadge } from './PackagingBreakdownBadge'

// Di dalam component:
const { balanceMap } = usePackagingBalances(outletId)

// Di render row bahan:
<div>
  <span>{saldo} {satuan}</span>
  <PackagingBreakdownBadge variants={balanceMap.get(bahan.id) ?? []} />
</div>
```

> **Catatan untuk implementor:** `SPVDashboard.tsx` sangat besar (50KB). Cari baris yang render saldo bahan (`current_qty`, `saldo`, dsb.) dan tambahkan `PackagingBreakdownBadge` di sampingnya. Jangan refactor file besar tersebut.

- [ ] **Step 4: Smoke test manual**

```bash
cd apps/stok && npm run dev
```
Buka monitoring → cari SAOS CABE → di bawah saldo harus muncul "(2 kompan + 5 pouch)" jika data sudah ada di `stok_balance_packaging`.

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/hooks/usePackagingBalances.ts apps/stok/src/components/monitoring/PackagingBreakdownBadge.tsx apps/stok/src/components/monitoring/
git commit -m "feat: show packaging breakdown badge in monitoring (kompan + pouch)"
```

---

## Task 7: Admin Dashboard — CRUD Packaging Variant di BahanBakuDetailModal

Tambahkan section "📦 Packaging Variant" di dalam modal detail bahan baku yang sudah ada.

**Files:**
- Create: `apps/admin-dashboard/src/hooks/usePackagingVariants.ts`
- Modify: `apps/admin-dashboard/src/components/BahanBakuDetailModal.tsx`
- Modify: `apps/admin-dashboard/src/app/dashboard/bahan-baku/page.tsx`

**Interfaces:**
- Consumes: tabel `bahan_baku_packaging_variant` dari Task 1
- Produces: section UI di BahanBakuDetailModal untuk tambah/edit/soft-delete variant

- [ ] **Step 1: Buat hook di admin-dashboard**

Buat `apps/admin-dashboard/src/hooks/usePackagingVariants.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

export interface PackagingVariant {
  id: string
  bahan_baku_id: string
  nama_variant: string
  satuan_variant: string
  faktor_ke_kg: number
  is_active: boolean
  urutan: number
  created_at: string
}

export function usePackagingVariants(bahanBakuId: string | null) {
  const supabase = createClient()

  return useQuery<PackagingVariant[]>({
    queryKey: ['packaging_variants', bahanBakuId],
    enabled: !!bahanBakuId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bahan_baku_packaging_variant')
        .select('*')
        .eq('bahan_baku_id', bahanBakuId!)
        .eq('is_active', true)
        .order('urutan', { ascending: true })
      if (error) throw error
      return (data ?? []) as PackagingVariant[]
    },
  })
}

export function usePackagingVariantMutations() {
  const supabase = createClient()
  const qc = useQueryClient()

  const addVariant = useMutation({
    mutationFn: async (vars: {
      bahan_baku_id: string
      nama_variant: string
      satuan_variant: string
      faktor_ke_kg: number
      urutan: number
    }) => {
      const { error } = await supabase
        .from('bahan_baku_packaging_variant')
        .insert(vars)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ['packaging_variants', vars.bahan_baku_id] }),
  })

  const updateVariant = useMutation({
    mutationFn: async (vars: {
      id: string
      bahan_baku_id: string
      nama_variant: string
      satuan_variant: string
      faktor_ke_kg: number
      urutan: number
    }) => {
      const { error } = await supabase
        .from('bahan_baku_packaging_variant')
        .update({
          nama_variant: vars.nama_variant,
          satuan_variant: vars.satuan_variant,
          faktor_ke_kg: vars.faktor_ke_kg,
          urutan: vars.urutan,
        })
        .eq('id', vars.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ['packaging_variants', vars.bahan_baku_id] }),
  })

  const deactivateVariant = useMutation({
    mutationFn: async (vars: { id: string; bahan_baku_id: string }) => {
      const { error } = await supabase
        .from('bahan_baku_packaging_variant')
        .update({ is_active: false })
        .eq('id', vars.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ['packaging_variants', vars.bahan_baku_id] }),
  })

  return { addVariant, updateVariant, deactivateVariant }
}
```

- [ ] **Step 2: Tambahkan PackagingVariantSection di BahanBakuDetailModal**

Di `apps/admin-dashboard/src/components/BahanBakuDetailModal.tsx`:

Tambahkan import di atas:
```typescript
import { usePackagingVariants, usePackagingVariantMutations } from '@/hooks/usePackagingVariants'
import type { PackagingVariant } from '@/hooks/usePackagingVariants'
```

Tambahkan state untuk form tambah/edit variant, setelah state `showSkuSection`:
```typescript
const [showVariantSection, setShowVariantSection] = useState(false)
const [variantFormMode, setVariantFormMode] = useState<'add' | 'edit' | null>(null)
const [editingVariant, setEditingVariant] = useState<PackagingVariant | null>(null)
const [draftVariant, setDraftVariant] = useState({
  nama_variant: '',
  satuan_variant: '',
  faktor_ke_kg: '',
  urutan: '0',
})
```

Panggil hooks:
```typescript
const { data: variants = [] } = usePackagingVariants(bahanBaku?.id ?? null)
const { addVariant, updateVariant, deactivateVariant } = usePackagingVariantMutations()
```

- [ ] **Step 3: Buat section JSX untuk Packaging Variant**

Di dalam modal (cari tempat yang tepat setelah section SKU, sekitar line 800+), tambahkan section baru:

```typescript
{/* ── Packaging Variant Section ─────────────────────────── */}
<div className="border-t border-gray-100 pt-5 mt-5">
  <button
    className="flex items-center gap-2 text-sm font-bold text-[#701604] w-full text-left"
    onClick={() => setShowVariantSection(v => !v)}
  >
    <span>📦 Packaging Variant</span>
    <span className="ml-auto text-xs text-gray-400">{showVariantSection ? '▲' : '▼'}</span>
    {variants.length > 0 && (
      <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
        {variants.length}
      </span>
    )}
  </button>

  {showVariantSection && (
    <div className="mt-3 space-y-3">
      {/* List existing variants */}
      {variants.length === 0 && (
        <p className="text-xs text-gray-400 italic">Belum ada packaging variant.</p>
      )}
      {variants.map(v => (
        <div
          key={v.id}
          className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3"
        >
          {editingVariant?.id === v.id ? (
            // Inline edit form
            <div className="flex-1 grid grid-cols-3 gap-2">
              <input
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs"
                placeholder="Nama (mis: Kompan)"
                value={draftVariant.nama_variant}
                onChange={e => setDraftVariant(d => ({ ...d, nama_variant: e.target.value }))}
              />
              <input
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs"
                placeholder="Satuan (mis: kompan)"
                value={draftVariant.satuan_variant}
                onChange={e => setDraftVariant(d => ({ ...d, satuan_variant: e.target.value }))}
              />
              <input
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs"
                type="number"
                placeholder="Faktor ke kg"
                value={draftVariant.faktor_ke_kg}
                onChange={e => setDraftVariant(d => ({ ...d, faktor_ke_kg: e.target.value }))}
              />
              <div className="col-span-3 flex gap-2 justify-end mt-1">
                <button
                  className="text-xs px-3 py-1 bg-[#701604] text-white rounded-lg font-bold"
                  onClick={() => {
                    updateVariant.mutate({
                      id: v.id,
                      bahan_baku_id: bahanBaku!.id,
                      nama_variant: draftVariant.nama_variant,
                      satuan_variant: draftVariant.satuan_variant,
                      faktor_ke_kg: Number(draftVariant.faktor_ke_kg),
                      urutan: Number(draftVariant.urutan),
                    }, {
                      onSuccess: () => setEditingVariant(null),
                      onError: (e: any) => alert(e.message),
                    })
                  }}
                >
                  Simpan
                </button>
                <button
                  className="text-xs px-3 py-1 border border-gray-200 rounded-lg"
                  onClick={() => setEditingVariant(null)}
                >
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#1e1b15]">{v.nama_variant}</p>
                <p className="text-[10px] text-gray-400">{v.satuan_variant} = {v.faktor_ke_kg} kg</p>
              </div>
              <button
                className="text-[10px] text-blue-600 font-bold px-2 py-1 rounded hover:bg-blue-50"
                onClick={() => {
                  setEditingVariant(v)
                  setDraftVariant({
                    nama_variant: v.nama_variant,
                    satuan_variant: v.satuan_variant,
                    faktor_ke_kg: String(v.faktor_ke_kg),
                    urutan: String(v.urutan),
                  })
                }}
              >
                ✏️
              </button>
              <button
                className="text-[10px] text-red-500 font-bold px-2 py-1 rounded hover:bg-red-50"
                onClick={() => {
                  if (confirm(`Nonaktifkan variant "${v.nama_variant}"?`)) {
                    deactivateVariant.mutate(
                      { id: v.id, bahan_baku_id: bahanBaku!.id },
                      { onError: (e: any) => alert(e.message) }
                    )
                  }
                }}
              >
                🗑️
              </button>
            </>
          )}
        </div>
      ))}

      {/* Add new variant form */}
      {variantFormMode === 'add' ? (
        <div className="bg-orange-50 rounded-xl p-4 space-y-2 border border-orange-200">
          <p className="text-xs font-bold text-[#701604]">Tambah Variant Baru</p>
          <div className="grid grid-cols-3 gap-2">
            <input
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs"
              placeholder="Nama (mis: Kompan)"
              value={draftVariant.nama_variant}
              onChange={e => setDraftVariant(d => ({ ...d, nama_variant: e.target.value }))}
            />
            <input
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs"
              placeholder="Satuan (mis: kompan)"
              value={draftVariant.satuan_variant}
              onChange={e => setDraftVariant(d => ({ ...d, satuan_variant: e.target.value }))}
            />
            <input
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs"
              type="number"
              placeholder="Faktor ke kg"
              value={draftVariant.faktor_ke_kg}
              onChange={e => setDraftVariant(d => ({ ...d, faktor_ke_kg: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              className="text-xs px-3 py-1.5 bg-[#701604] text-white rounded-lg font-bold"
              onClick={() => {
                addVariant.mutate({
                  bahan_baku_id: bahanBaku!.id,
                  nama_variant: draftVariant.nama_variant,
                  satuan_variant: draftVariant.satuan_variant,
                  faktor_ke_kg: Number(draftVariant.faktor_ke_kg),
                  urutan: variants.length + 1,
                }, {
                  onSuccess: () => {
                    setVariantFormMode(null)
                    setDraftVariant({ nama_variant: '', satuan_variant: '', faktor_ke_kg: '', urutan: '0' })
                  },
                  onError: (e: any) => alert(e.message),
                })
              }}
            >
              Simpan Variant
            </button>
            <button
              className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg"
              onClick={() => setVariantFormMode(null)}
            >
              Batal
            </button>
          </div>
        </div>
      ) : (
        <button
          className="text-xs font-bold text-[#701604] border border-[#701604]/30 rounded-xl px-4 py-2 hover:bg-orange-50 transition-colors w-full"
          onClick={() => {
            setVariantFormMode('add')
            setDraftVariant({ nama_variant: '', satuan_variant: '', faktor_ke_kg: '', urutan: '0' })
          }}
        >
          + Tambah Variant
        </button>
      )}
    </div>
  )}
</div>
```

- [ ] **Step 4: Reset state saat modal ditutup/dibuka**

Di `useEffect` yang sudah ada (check `isOpen && bahanBaku`), tambahkan:
```typescript
setShowVariantSection(false)
setVariantFormMode(null)
setEditingVariant(null)
setDraftVariant({ nama_variant: '', satuan_variant: '', faktor_ke_kg: '', urutan: '0' })
```

- [ ] **Step 5: Smoke test admin dashboard**

```bash
cd apps/admin-dashboard && npm run dev
```
Buka `/dashboard/bahan-baku` → klik SAOS CABE → modal terbuka → scroll bawah → section "📦 Packaging Variant" muncul → klik expand → tampil Kompan (5.5 kg) dan Pouch (1.0 kg).

- [ ] **Step 6: Commit**

```bash
git add apps/admin-dashboard/src/hooks/usePackagingVariants.ts apps/admin-dashboard/src/components/BahanBakuDetailModal.tsx
git commit -m "feat: add PackagingVariant CRUD section in admin BahanBakuDetailModal"
```

---

## Task 8: Final Verification

- [ ] **Step 1: Jalankan semua test**

```bash
# Stok app
cd apps/stok
npx vitest run

# Admin dashboard
cd apps/admin-dashboard
npx vitest run
```
Expected: semua pass, tidak ada regresi.

- [ ] **Step 2: End-to-end manual test checklist**

```
✅ 1. Admin buka /dashboard/bahan-baku → SAOS CABE → section Packaging Variant
      → tampil 2 row: Kompan (5.5 kg) dan Pouch (1.0 kg)
✅ 2. Admin klik edit Kompan → ubah faktor_ke_kg menjadi 5.6 → Simpan → tampil 5.6
✅ 3. Admin ubah kembali ke 5.5 → Simpan
✅ 4. Gudang buka opname → cari SAOS CABE → tampil 3 field: Kompan, Pouch, Sisa terbuka
✅ 5. Isi: Kompan=2, Pouch=5, Sisa=0.5 → Total harus 2×5.5 + 5×1 + 0.5 = 16.5 kg ✓
✅ 6. Submit opname → check DB: opname_item.qty_fisik = 16.5 kg ✓
✅ 7. Check DB: stok_balance_packaging → kompan.saldo_variant = 2, pouch.saldo_variant = 5 ✓
✅ 8. Monitoring → SAOS CABE → saldo = 16.5 kg, breakdown "(2 kompan + 5 pouch)" tampil ✓
✅ 9. SAOS TOMAT → treatment yang sama berjalan ✓
✅ 10. Bahan tanpa variant (AYAM, MINYAK SAYUR dsb.) → tidak terpengaruh, UI lama berjalan ✓
```

- [ ] **Step 3: Commit final**

```bash
git add .
git commit -m "feat: dual packaging variant complete — SAOS CABE & SAOS TOMAT"
```
