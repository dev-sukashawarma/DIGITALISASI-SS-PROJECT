# Satuan Majemuk untuk Tampilan Stok Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tampilkan saldo MINYAK SAYUR sebagai "2 kompan + 8 liter" dan FOIL sebagai "3 pcs + 40 cm" (bukan desimal `2.5 kompan`), dan biarkan crew input opname untuk 2 bahan ini lewat 2 field terpisah (kontainer utuh + sisa) alih-alih 1 angka desimal.

**Architecture:** Tambah 2 kolom nullable (`satuan_kecil`, `faktor_tampilan`) di `bahan_baku`, independen dari `faktor_konversi` yang sudah dipakai BOM automation. Satu modul formatter murni (`compositeUnit.ts`) dipakai di 3 tempat: ledger (list+detail), monitoring detail, dan form opname.

**Tech Stack:** Next.js (apps/stok), Supabase Postgres migration, Vitest.

Spec: `docs/superpowers/specs/2026-07-04-ledger-composite-unit-display-design.md`

---

### Task 1: Migration — kolom `satuan_kecil` & `faktor_tampilan`

**Files:**
- Create: `supabase/migrations/20260704210000_cogs_satuan_kecil_display.sql`

- [ ] **Step 1: Tulis migration**

```sql
-- 20260704210000_cogs_satuan_kecil_display.sql
-- Kolom tampilan majemuk (independen dari faktor_konversi yang dipakai BOM automation).
-- satuan_kecil/faktor_tampilan dipakai UI untuk pecah saldo jadi "N {satuan} + M {satuan_kecil}"
-- dan input opname 2-field (kontainer utuh + sisa perkiraan).
--
-- Kenapa terpisah dari faktor_konversi: MINYAK SAYUR dihitung BOM dalam GRAM
-- (asumsi densitas 1L~1kg), tapi crew fisik mengukur sisa minyak dalam LITER,
-- bukan gram. Dua kebutuhan (kalkulasi resep vs tampilan fisik) butuh satuan berbeda.

ALTER TABLE bahan_baku
  ADD COLUMN IF NOT EXISTS satuan_kecil TEXT
    CHECK (satuan_kecil IS NULL OR satuan_kecil IN ('liter','ml','gram','cm','lembar')),
  ADD COLUMN IF NOT EXISTS faktor_tampilan NUMERIC
    CHECK (faktor_tampilan IS NULL OR faktor_tampilan > 0);

COMMENT ON COLUMN bahan_baku.satuan_kecil IS
  'Satuan kecil untuk tampilan majemuk saldo (mis. liter untuk kompan, cm untuk roll). NULL = tidak berlaku, tampil apa adanya.';
COMMENT ON COLUMN bahan_baku.faktor_tampilan IS
  'Berapa satuan_kecil setara 1 satuan (satuan stok utama). Independen dari faktor_konversi (itu utk BOM/resep).';

UPDATE bahan_baku SET satuan_kecil = 'liter', faktor_tampilan = 16 WHERE nama = 'MINYAK SAYUR';
UPDATE bahan_baku SET satuan_kecil = 'cm', faktor_tampilan = 760 WHERE nama = 'FOIL';
```

- [ ] **Step 2: Push migration**

Run: `supabase db push`
Expected: migration `20260704210000_cogs_satuan_kecil_display` applied tanpa error. Kalau ada drift (lihat riwayat sesi sebelumnya), jalankan `supabase migration repair --status applied <timestamp>` untuk migration lama yang belum tercatat dulu, baru push ulang.

- [ ] **Step 3: Verifikasi manual**

Run (via Supabase SQL editor atau `psql`):
```sql
SELECT nama, satuan, satuan_kecil, faktor_tampilan FROM bahan_baku WHERE nama IN ('MINYAK SAYUR', 'FOIL');
```
Expected: MINYAK SAYUR → `kompan, liter, 16`. FOIL → `pcs, cm, 760`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260704210000_cogs_satuan_kecil_display.sql
git commit -m "feat(db): add satuan_kecil/faktor_tampilan for composite unit display"
```

---

### Task 2: Update TypeScript types

**Files:**
- Modify: `apps/stok/src/types/stok.ts`

- [ ] **Step 1: Perluas `Satuan` union dan tambah field baru di `BahanBaku`, tambah `ref_order_id` di `LedgerStok`**

Ganti isi file `apps/stok/src/types/stok.ts` baris 1 dan 10-13 dan 31-37:

```typescript
export type Satuan = 'kg'|'gram'|'liter'|'ml'|'pcs'|'box'|'pack'|'ikat'|'botol'|'crt'|'kompan'
export type SatuanKecil = 'liter'|'ml'|'gram'|'cm'|'lembar'
```

```typescript
export interface BahanBaku {
  id: string; nama: string; satuan: Satuan; kategori: Kategori
  default_reorder_point: number; is_active: boolean; created_at: string
  faktor_konversi: number
  satuan_kecil: SatuanKecil | null
  faktor_tampilan: number | null
}
```

```typescript
export interface LedgerStok {
  id: string; outlet_id: string; bahan_baku_id: string; tipe: LedgerTipe
  qty: number; catatan: string | null; ref_shipment_id: string | null
  ref_opname_id: string | null; ref_transfer_id: string | null; ref_order_id: string | null
  created_by: string | null; created_at: string
  saldo_sebelum: number; saldo_sesudah: number
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error (kalau ada file lain yang exhaustive-switch di `Satuan` tanpa `default`, tambahkan case — tapi tidak ada yang begitu saat ini berdasarkan pengecekan awal).

- [ ] **Step 3: Commit**

```bash
git add apps/stok/src/types/stok.ts
git commit -m "feat(stok): add satuan_kecil/faktor_tampilan/ref_order_id to types"
```

---

### Task 3: Formatter murni `compositeUnit.ts` (TDD)

**Files:**
- Create: `apps/stok/src/lib/format/compositeUnit.ts`
- Test: `apps/stok/src/lib/format/__tests__/compositeUnit.test.ts`

- [ ] **Step 1: Tulis test (gagal dulu)**

```typescript
// apps/stok/src/lib/format/__tests__/compositeUnit.test.ts
import { describe, it, expect } from 'vitest'
import { formatCompositeSaldo, formatCompositeDelta, combineOpnameInput } from '../compositeUnit'

describe('formatCompositeSaldo', () => {
  it('pecah saldo jadi unit besar + sisa unit kecil', () => {
    expect(formatCompositeSaldo(2.5, 'kompan', 'liter', 16)).toBe('2 kompan + 8 liter')
  })

  it('sisa 0 tetap tampil eksplisit', () => {
    expect(formatCompositeSaldo(2, 'kompan', 'liter', 16)).toBe('2 kompan + 0 liter')
  })

  it('sisa mendekati batas dibulatkan 2 desimal', () => {
    expect(formatCompositeSaldo(2.999, 'kompan', 'liter', 16)).toBe('2 kompan + 15.98 liter')
  })

  it('saldo negatif tetap konsisten secara matematis', () => {
    expect(formatCompositeSaldo(-0.5, 'kompan', 'liter', 16)).toBe('-1 kompan + 8 liter')
  })

  it('fallback ke tampilan lama kalau satuan_kecil null', () => {
    expect(formatCompositeSaldo(4.5, 'kg', null, null)).toBe('4.5 kg')
  })

  it('fallback ke tampilan lama kalau faktor_tampilan null', () => {
    expect(formatCompositeSaldo(4.5, 'kg', 'gram', null)).toBe('4.5 kg')
  })
})

describe('formatCompositeDelta', () => {
  it('qty kecil ditampilkan dalam satuan kecil', () => {
    expect(formatCompositeDelta(-0.03, 'kompan', 'liter', 16)).toBe('-0.48 liter')
  })

  it('qty positif ditampilkan dengan tanda plus', () => {
    expect(formatCompositeDelta(0.03, 'kompan', 'liter', 16)).toBe('+0.48 liter')
  })

  it('fallback ke tampilan lama kalau satuan_kecil null', () => {
    expect(formatCompositeDelta(-500, 'gram', null, null)).toBe('-500 gram')
  })
})

describe('combineOpnameInput', () => {
  it('gabung kontainer + sisa jadi qty desimal', () => {
    expect(combineOpnameInput(2, 8, 16)).toBe(2.5)
  })

  it('sisa 0 menghasilkan bilangan bulat', () => {
    expect(combineOpnameInput(3, 0, 16)).toBe(3)
  })

  it('sisa mendekati batas', () => {
    expect(combineOpnameInput(0, 15.98, 16)).toBeCloseTo(0.99875, 5)
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd apps/stok && yarn vitest run src/lib/format/__tests__/compositeUnit.test.ts`
Expected: FAIL — `Cannot find module '../compositeUnit'`

- [ ] **Step 3: Implementasi minimal**

```typescript
// apps/stok/src/lib/format/compositeUnit.ts

/**
 * Format saldo (running balance) sebagai "N {satuan} + M {satuan_kecil}".
 * Kalau satuanKecil/faktorTampilan tidak ada, fallback ke "{qty} {satuan}".
 */
export function formatCompositeSaldo(
  qty: number,
  satuan: string,
  satuanKecil: string | null,
  faktorTampilan: number | null
): string {
  if (!satuanKecil || !faktorTampilan) {
    return `${qty} ${satuan}`
  }
  const whole = Math.trunc(qty)
  const remainderRaw = Math.abs(qty - whole) * faktorTampilan
  const remainder = Math.round(remainderRaw * 100) / 100
  return `${whole} ${satuan} + ${remainder} ${satuanKecil}`
}

/**
 * Format qty pergerakan (delta) langsung dalam satuan kecil, karena angkanya
 * biasanya kecil (hasil BOM automation) dan lebih masuk akal drpd pecahan
 * satuan besar (mis. "-0.03 kompan" -> "-480 ml").
 */
export function formatCompositeDelta(
  qty: number,
  satuan: string,
  satuanKecil: string | null,
  faktorTampilan: number | null
): string {
  if (!satuanKecil || !faktorTampilan) {
    return `${qty > 0 ? '+' : ''}${qty} ${satuan}`
  }
  const converted = Math.round(qty * faktorTampilan * 100) / 100
  return `${converted > 0 ? '+' : ''}${converted} ${satuanKecil}`
}

/**
 * Gabung input 2-field opname (kontainer utuh + sisa dalam satuan kecil)
 * jadi satu qty_fisik desimal dalam satuan besar.
 */
export function combineOpnameInput(
  containers: number,
  remainder: number,
  faktorTampilan: number
): number {
  return containers + remainder / faktorTampilan
}
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `cd apps/stok && yarn vitest run src/lib/format/__tests__/compositeUnit.test.ts`
Expected: PASS — 10 test lolos.

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/lib/format/compositeUnit.ts apps/stok/src/lib/format/__tests__/compositeUnit.test.ts
git commit -m "feat(stok): add composite unit formatter (saldo/delta/opname combine)"
```

---

### Task 4: Pakai formatter di `LedgerList.tsx`

**Files:**
- Modify: `apps/stok/src/components/stok/LedgerList.tsx:30-37,134-189`

- [ ] **Step 1: Update `bahanMap` untuk sertakan `satuan_kecil`/`faktor_tampilan`**

Ganti baris 30-37:
```typescript
  // Map bahan_baku_id to name and unit
  const bahanMap = useMemo(() => {
    const map: Record<string, { nama: string; satuan: string; satuanKecil: string | null; faktorTampilan: number | null }> = {};
    for (const b of bahanBaku) {
      map[b.id] = { nama: b.nama, satuan: b.satuan, satuanKecil: b.satuan_kecil, faktorTampilan: b.faktor_tampilan };
    }
    return map;
  }, [bahanBaku]);
```

- [ ] **Step 2: Tambah import formatter**

Tambah di baris 6 (setelah import `useBahanBaku`):
```typescript
import { formatCompositeSaldo, formatCompositeDelta } from '@/lib/format/compositeUnit';
```

- [ ] **Step 3: Ganti tampilan qty & saldo (baris 182-189)**

```typescript
                {/* Right Section: Quantity and Balance */}
                <div className="text-right flex-shrink-0 space-y-0.5 pl-4">
                  <p className={`font-bold text-sm ${isPositive ? 'text-[#0a7d2c]' : 'text-[#ba1a1a]'}`}>
                    {bahan
                      ? formatCompositeDelta(l.qty, unit, bahan.satuanKecil, bahan.faktorTampilan)
                      : `${isPositive ? '+' : ''}${l.qty} ${unit}`}
                  </p>
                  <p className="text-[9px] text-[#544437]/60 font-bold bg-[#faf2e9]/50 px-2 py-0.5 rounded border border-[#d9c2b2]/20 inline-block mt-1">
                    Saldo: {bahan
                      ? formatCompositeSaldo(l.saldo_sesudah, unit, bahan.satuanKecil, bahan.faktorTampilan)
                      : `${l.saldo_sesudah} ${unit}`}
                  </p>
                </div>
```

Catatan: baris 135-137 (`const bahan = bahanMap[...]`) tetap dipakai apa adanya — hanya bagian render qty/saldo yang berubah.

- [ ] **Step 4: Verifikasi build/type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error.

- [ ] **Step 5: Commit**

```bash
git add apps/stok/src/components/stok/LedgerList.tsx
git commit -m "feat(stok): show composite unit format in ledger list cards"
```

---

### Task 5: Pakai formatter di `LedgerDetail.tsx`

**Files:**
- Modify: `apps/stok/src/components/stok/LedgerDetail.tsx:1-4,26-27,42-43,92-104`

- [ ] **Step 1: Tambah import & perluas select join**

Baris 1-4, tambah import:
```typescript
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Card } from '@suka/design-system'
import { formatCompositeSaldo, formatCompositeDelta } from '@/lib/format/compositeUnit'
```

Baris 26-27, ubah select:
```typescript
        const { data, error: err } = await supabase
          .from('ledger_stok')
          .select('*, bahan_baku(nama, satuan, satuan_kecil, faktor_tampilan)')
          .eq('id', ledgerId)
          .single()
```

- [ ] **Step 2: Ganti perhitungan `unit` & tampilan qty/saldo**

Baris 42-43, tambah variabel:
```typescript
  const isPositive = l.qty > 0;
  const unit = l.bahan_baku?.satuan || '';
  const satuanKecil = l.bahan_baku?.satuan_kecil ?? null;
  const faktorTampilan = l.bahan_baku?.faktor_tampilan ?? null;
```

Baris 92-97 ("Jumlah Perubahan"), ganti isi `<span>`:
```typescript
        <div className="flex justify-between items-center border-b border-[#d9c2b2]/10 pb-3.5">
          <span className="text-xs font-bold text-[#544437]/70">Jumlah Perubahan</span>
          <span className={`text-sm font-bold ${isPositive ? 'text-[#0a7d2c]' : 'text-[#ba1a1a]'}`}>
            {formatCompositeDelta(l.qty, unit, satuanKecil, faktorTampilan)}
          </span>
        </div>
```

Baris 99-104 ("Mutasi Saldo"), ganti isi `<span>`:
```typescript
        <div className="flex justify-between items-center border-b border-[#d9c2b2]/10 pb-3.5">
          <span className="text-xs font-bold text-[#544437]/70">Mutasi Saldo</span>
          <span className="text-xs font-semibold text-[#1e1b15]">
            {formatCompositeSaldo(l.saldo_sebelum, unit, satuanKecil, faktorTampilan)} → <span className="font-bold">{formatCompositeSaldo(l.saldo_sesudah, unit, satuanKecil, faktorTampilan)}</span>
          </span>
        </div>
```

- [ ] **Step 3: Verifikasi type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error.

- [ ] **Step 4: Commit**

```bash
git add apps/stok/src/components/stok/LedgerDetail.tsx
git commit -m "feat(stok): show composite unit format in ledger detail page"
```

---

### Task 6: Input opname 2-field untuk bahan bersatuan kecil

**Files:**
- Modify: `apps/stok/src/components/stok/OpnameForm.tsx:1-8,28-30,215-294`

- [ ] **Step 1: Tambah import & state kontainer/sisa**

Baris 8, tambah import:
```typescript
import { combineOpnameInput } from '@/lib/format/compositeUnit';
```

Baris 29, tambah state baru setelah `const [fisik, setFisik] = useState<Record<string, string>>({});`:
```typescript
  const [fisik, setFisik] = useState<Record<string, string>>({});
  const [containerInput, setContainerInput] = useState<Record<string, string>>({});
  const [remainderInput, setRemainderInput] = useState<Record<string, string>>({});
  const [remainderError, setRemainderError] = useState<Record<string, string>>({});
```

- [ ] **Step 2: Tambah handler gabung 2-field**

Tambah fungsi baru setelah `handleDecrement` (setelah baris 72, sebelum `filteredBahan`):
```typescript
  const handleCompositeChange = (
    bahanId: string,
    containers: string,
    remainder: string,
    faktorTampilan: number
  ) => {
    setContainerInput((prev) => ({ ...prev, [bahanId]: containers }));
    setRemainderInput((prev) => ({ ...prev, [bahanId]: remainder }));

    const remainderNum = remainder === '' ? 0 : Number(remainder);
    if (remainderNum >= faktorTampilan) {
      setRemainderError((prev) => ({ ...prev, [bahanId]: `Sisa harus kurang dari ${faktorTampilan}` }));
      return;
    }
    setRemainderError((prev) => {
      const next = { ...prev };
      delete next[bahanId];
      return next;
    });

    const containersNum = containers === '' ? 0 : Number(containers);
    if (containers === '' && remainder === '') {
      setFisik((prev) => {
        const next = { ...prev };
        delete next[bahanId];
        return next;
      });
      return;
    }
    const combined = combineOpnameInput(containersNum, remainderNum, faktorTampilan);
    setFisik((prev) => ({ ...prev, [bahanId]: combined.toString() }));
  };
```

- [ ] **Step 3: Render 2-field untuk bahan bersatuan kecil**

Ganti blok "Card Bottom: Input Actions" (baris 262-291) — bungkus dengan pengecekan `b.satuan_kecil`:

```typescript
              {/* Card Bottom: Input Actions */}
              {b.satuan_kecil && b.faktor_tampilan ? (
                <div className="mt-3.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      className="w-16 text-center bg-white border border-[#d9c2b2]/45 rounded-lg font-extrabold text-xs text-[#701604] py-1.5 no-spinner"
                      placeholder="0"
                      value={containerInput[b.id] ?? ''}
                      onChange={(e) =>
                        handleCompositeChange(b.id, e.target.value, remainderInput[b.id] ?? '', b.faktor_tampilan!)
                      }
                    />
                    <span className="text-[9px] font-bold text-[#544437]/60">{b.satuan} +</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      className="w-16 text-center bg-white border border-[#d9c2b2]/45 rounded-lg font-extrabold text-xs text-[#701604] py-1.5 no-spinner"
                      placeholder="0"
                      value={remainderInput[b.id] ?? ''}
                      onChange={(e) =>
                        handleCompositeChange(b.id, containerInput[b.id] ?? '', e.target.value, b.faktor_tampilan!)
                      }
                    />
                    <span className="text-[9px] font-bold text-[#544437]/60">{b.satuan_kecil}</span>
                  </div>
                  {remainderError[b.id] && (
                    <p className="text-[9px] font-bold text-[#ba1a1a]">{remainderError[b.id]}</p>
                  )}
                </div>
              ) : (
                <div className="mt-3.5 flex items-center justify-end">
                  <div className="flex items-center bg-[#faf2e9]/40 border border-[#d9c2b2]/45 rounded-lg overflow-hidden p-0.5 shadow-sm">
                    <button
                      type="button"
                      onClick={() => handleDecrement(b.id, step)}
                      className="w-8 h-8 flex items-center justify-center font-bold text-[#701604] hover:bg-[#faf2e9] active:scale-90 transition-all rounded-md text-xs cursor-pointer"
                    >
                      —
                    </button>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="w-14 text-center bg-transparent border-none focus:outline-none focus:ring-0 font-extrabold text-xs text-[#701604] focus:ring-transparent focus:border-transparent py-1 no-spinner"
                      placeholder="fisik"
                      value={val}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setFisik((prev) => ({ ...prev, [b.id]: inputVal }));
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleIncrement(b.id, step)}
                      className="w-8 h-8 flex items-center justify-center font-bold text-[#701604] hover:bg-[#faf2e9] active:scale-90 transition-all rounded-md text-xs cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
```

- [ ] **Step 4: Cegah submit kalau ada `remainderError`**

Di `handleFinalize` (baris 83), tambah guard di awal fungsi:
```typescript
  async function handleFinalize() {
    if (Object.keys(remainderError).length > 0) {
      showToast('🔴 Perbaiki dulu input sisa yang melebihi batas kontainer.', 'warning');
      return;
    }
    setBusy(true);
```

- [ ] **Step 5: Type-check & manual smoke test**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error.

Manual: buka `/stok/opname/new` (atau route form opname), cari MINYAK SAYUR & FOIL — pastikan muncul 2 input field, bahan lain tetap stepper +/- seperti biasa. Isi container=2, remainder=8 untuk MINYAK SAYUR → submit → cek `opname_item.qty_fisik = 2.5` di DB.

- [ ] **Step 6: Commit**

```bash
git add apps/stok/src/components/stok/OpnameForm.tsx
git commit -m "feat(stok): two-field opname input for composite-unit bahan"
```

---

### Task 7: Pakai formatter di halaman monitoring detail

**Files:**
- Modify: `apps/stok/src/lib/queries/monitoring.ts:170-224`
- Modify: `apps/stok/src/components/monitoring/MonitoringDetailModal.tsx:66,72,106,113,148`

- [ ] **Step 1: Tambah lookup `satuan_kecil`/`faktor_tampilan` di `fetchItemDetail`**

`monitoring_view_spv` tidak punya kolom ini (dan sengaja tidak diubah — hindari risiko drift pada view yang sudah kompleks). Tambah query kecil terpisah ke `bahan_baku`.

Ganti baris 170-224 (`fetchItemDetail`) — sisipkan fetch baru setelah `itemData` didapat (setelah baris 181, sebelum fetch `ledgerData`):

```typescript
  if (itemError) throw itemError;

  const { data: bahanExtra } = await supabase
    .from('bahan_baku')
    .select('satuan_kecil, faktor_tampilan')
    .eq('id', bahan_baku_id)
    .maybeSingle();
```

Lalu ubah `return` di akhir fungsi (baris 219-223):
```typescript
  return {
    ...itemData,
    satuan_kecil: bahanExtra?.satuan_kecil ?? null,
    faktor_tampilan: bahanExtra?.faktor_tampilan ?? null,
    recent_ledger: ledgerData || [],
    discrepancy_details: discrepancyDetails,
  };
```

- [ ] **Step 2: Tambah field ke type detail**

Cari interface yang dipakai return type `fetchItemDetail` (sekitar baris 364-368 di file yang sama, type untuk `OutletItemDetail`/serupa) dan tambah 2 field:
```typescript
  satuan_kecil: string | null;
  faktor_tampilan: number | null;
```
(Tambahkan persis setelah field `satuan: string | null;` yang sudah ada di interface tersebut.)

- [ ] **Step 3: Pakai formatter di modal**

Di `apps/stok/src/components/monitoring/MonitoringDetailModal.tsx`, tambah import:
```typescript
import { formatCompositeSaldo, formatCompositeDelta } from '@/lib/format/compositeUnit';
```

Ganti baris 66 (`current_qty`):
```typescript
                    {formatCompositeSaldo(detail.current_qty, detail.satuan ?? '', detail.satuan_kecil, detail.faktor_tampilan)}
```
(Hapus `<span>{detail.satuan}</span>` yang lama di baris ini karena satuan sudah termasuk dalam output formatter.)

Ganti baris 148 (qty ledger recent):
```typescript
                        {formatCompositeDelta(ledger.qty, detail.satuan ?? '', detail.satuan_kecil, detail.faktor_tampilan)}
```

Baris 72, 106, 113 (threshold & field lain yang bukan qty aktual bahan, melainkan angka ambang/statis) **tidak diubah** — format majemuk hanya relevan untuk qty stok aktual, bukan angka threshold konfigurasi.

- [ ] **Step 4: Update test snapshot kalau ada**

Run: `cd apps/stok && yarn vitest run src/components/monitoring/__tests__/MonitoringDetailModal.test.tsx`
Expected: kalau test menguji teks persis "current_qty {satuan}", update assertion mengikuti format baru. Kalau tidak ada assertion terkait qty spesifik, PASS tanpa perubahan.

- [ ] **Step 5: Type-check**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error.

- [ ] **Step 6: Commit**

```bash
git add apps/stok/src/lib/queries/monitoring.ts apps/stok/src/components/monitoring/MonitoringDetailModal.tsx
git commit -m "feat(stok): show composite unit format in monitoring detail modal"
```

---

### Task 8: Full verification

- [ ] **Step 1: Jalankan semua test**

Run: `cd apps/stok && yarn vitest run`
Expected: semua test PASS (termasuk test lama yang sudah ada).

- [ ] **Step 2: Type-check seluruh app**

Run: `cd apps/stok && yarn type-check`
Expected: 0 error.

- [ ] **Step 3: Manual smoke test (browser, dev server `yarn dev` di apps/stok)**

Checklist:
- [ ] Ledger list: cari baris MINYAK SAYUR/FOIL → qty tampil dalam satuan kecil (liter/cm), saldo tampil majemuk (kompan+liter / pcs+cm)
- [ ] Ledger detail: buka salah satu baris MINYAK SAYUR/FOIL → "Jumlah Perubahan" & "Mutasi Saldo" konsisten format majemuk
- [ ] Bahan lain (mis. AYAM) di ledger — tampilan **tidak berubah** dari sebelumnya
- [ ] Opname form: MINYAK SAYUR & FOIL punya 2 input; isi remainder ≥ faktor_tampilan → muncul pesan error, tombol finalize diblokir
- [ ] Monitoring detail modal: buka item MINYAK SAYUR/FOIL di outlet manapun → current_qty tampil majemuk

- [ ] **Step 4: Final commit (kalau ada perbaikan dari smoke test)**

```bash
git add -A
git commit -m "fix(stok): address issues found during composite unit smoke test"
```
(Skip step ini kalau tidak ada perubahan.)
