# Implementation Plan: Distribusi Beban Gaji Area Manager (AM) & Regional Manager (RM)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mendistribusikan beban gaji bersih Area Manager (AM) dan Regional Manager (RM) secara merata (*equal split*) ke cabang-cabang operasional binaan mereka, melepaskan beban 100% dari home outlet, dengan jaminan nol selisih (zero discrepancy) pada total pengeluaran payroll perusahaan, serta tetap menampilkan pos Gaji dan pos Bonus secara terpisah di Waterfall dan Export PDF.

**Architecture:** Memperluas engine kalkulasi `opexProrata.ts` untuk memisahkan baris payroll manajer dari kru toko, membagi rata beban bersih gaji manajer (`total_salary - bonus`) ke outlet operasional binaannya dengan pembagian sisa pembulatan (*exact remainder distribution*), dan mengakumulasikannya ke pos `gaji_crew_outlet` outlet binaan. Data binaan `staff_outlets` diambil melalui hook dan server actions (`useProratedOpex.ts`, `prorataAuxiliary.ts`, `mitraPnl.ts`).

**Tech Stack:** Next.js 14, TypeScript, Supabase PostgreSQL, Vitest.

## Global Constraints
- `total_salary - bonus` dari AM dan RM dialokasikan secara equal-split ke cabang operasional binaannya.
- `bonus_area_manager` dan `bonus_regional_manager` tetap dihitung per outlet berdasarkan `pcs * 50` dan disajikan terpisah di Waterfall dan Export PDF.
- Cabang operasional penerima beban hanya yang bertipe `internal` atau `mitra`, aktif (`is_active = true`, `status = 'active'`), dan mengecualikan `office` (Kantor Pusat/HQ), `gudang`, `marketplace`, dan demo/test.
- Sisa pecahan pembulatan (remainder) disebar secara presisi (+Rp 1) agar $\sum \text{Alokasi} == \text{Beban Asli}$ persis ke rupiah terakhir.
- Seluruh 58+ unit tests yang ada harus tetap pass 100%.

---

### Task 1: Perluas Interface & Logika Alokasi Manajer di `opexProrata.ts`

**Files:**
- Modify: `apps/admin-dashboard/src/lib/opexProrata.ts`
- Test: `apps/admin-dashboard/src/lib/opexProrata.test.ts`

**Interfaces:**
- Consumes: `CalculateProrataInput`
- Produces:
  ```ts
  export interface ManagerAssignment {
    staff_id: string
    role: 'area_manager' | 'regional_manager'
    outlet_ids: string[]
  }
  ```
  Ditambahkan ke `CalculateProrataInput`:
  - `managerAssignments?: ManagerAssignment[]`
  - `operationalOutletIds?: string[]`

- [ ] **Step 1: Definisikan interface dan helper alokasi di `opexProrata.ts`**
Tambahkan helper `distributeManagerSalary`:
```ts
export function distributeEqualSplit(
  totalAmount: number,
  targetOutletIds: string[]
): Map<string, number> {
  const result = new Map<string, number>()
  if (!targetOutletIds || targetOutletIds.length === 0 || totalAmount <= 0) return result

  const n = targetOutletIds.length
  const base = Math.floor(totalAmount / n)
  let remainder = totalAmount - (base * n)

  for (const outletId of targetOutletIds) {
    const extra = remainder > 0 ? 1 : 0
    if (remainder > 0) remainder--
    result.set(outletId, base + extra)
  }
  return result
}
```

- [ ] **Step 2: Pisahkan staf crew vs manajer pada Mode 1 dan Mode 2**
Di dalam `calculateProratedExpenses`:
1. Identifikasi staf manajer: `p.role === 'area_manager' || p.role === 'regional_manager'`.
2. Untuk setiap manajer dalam periode bulan terkait:
   * Beban gaji bersih = $\max(0, \text{total\_salary} - \text{bonus})$.
   * Jika role `regional_manager`: target outlets = `operationalOutletIds` (semua cabang operasional aktif).
   * Jika role `area_manager`: target outlets = outlet operasional binaan dari `managerAssignments` (yang ada di dalam `operationalOutletIds`).
   * Hitung porsi alokasi per outlet via `distributeEqualSplit`.
3. Pada perulangan per outlet:
   * Ambil gaji kru toko (hanya staf selain AM dan RM).
   * Tambahkan porsi alokasi AM dan RM yang menjadi jatah outlet tersebut.
   * Total = `gajiKruToko + jatahAm + jatahRm`.

- [ ] **Step 3: Jalankan test vitest lokal**
Run: `npm test -- src/lib/opexProrata.test.ts`

- [ ] **Step 4: Commit perubahan Task 1**
```bash
git add apps/admin-dashboard/src/lib/opexProrata.ts
git commit -m "feat(opexProrata): implementasikan alokasi equal-split gaji AM dan RM ke outlet operasional"
```

---

### Task 2: Tambahkan Unit Test Komprehensif di `opexProrata.test.ts`

**Files:**
- Modify: `apps/admin-dashboard/src/lib/opexProrata.test.ts`

- [ ] **Step 1: Buat unit test kasus distribusi gaji AM**
Memastikan gaji bersih AM Rp 3.500.000 dengan 5 outlet binaan membagikan Rp 700.000 ke setiap outlet binaan, dan Rp 0 ke outlet lain.

- [ ] **Step 2: Buat unit test kasus distribusi gaji RM**
Memastikan gaji bersih RM Rp 5.000.000 dibagikan rata ke seluruh cabang operasional aktif.

- [ ] **Step 3: Buat unit test pembulatan presisi nol rupiah (Zero Discrepancy)**
Memastikan jika gaji Rp 3.500.000 dibagi ke 6 outlet ($583.333 \times 6 = 3.499.998$), sisa Rp 2 dibagikan sehingga jumlah total seluruh outlet tetap persis Rp 3.500.000.

- [ ] **Step 4: Buat unit test pelepasan home outlet**
Memastikan home outlet tempat AM terdaftar tidak lagi dibebani 100% gaji AM.

- [ ] **Step 5: Buat unit test pemisahan Gaji vs Bonus**
Memastikan pos `bonus_area_manager` dan `bonus_regional_manager` tetap dihitung per pcs ($\text{pcs} \times \text{Rp } 50$) dan tidak digabungkan ke pos gaji.

- [ ] **Step 6: Jalankan seluruh test suite**
Run: `npm test -- src/lib/opexProrata.test.ts src/lib/profitWaterfall.test.ts src/lib/mitraPnl.test.ts src/lib/export/profitExportService.test.ts`
Expected: Seluruh test pass tanpa error.

- [ ] **Step 7: Commit test cases**
```bash
git add apps/admin-dashboard/src/lib/opexProrata.test.ts
git commit -m "test(opexProrata): tambah unit tests untuk distribusi gaji AM/RM dan verifikasi zero discrepancy"
```

---

### Task 3: Integrasikan Pengambilan Data Binaan di Hook & Actions

**Files:**
- Modify: `apps/admin-dashboard/src/hooks/useProratedOpex.ts`
- Modify: `apps/admin-dashboard/src/app/actions/prorataAuxiliary.ts`
- Modify: `apps/admin-dashboard/src/app/actions/mitraPnl.ts`

- [ ] **Step 1: Update `useProratedOpex.ts`**
Ambil data `staff_outlets` untuk AM dan RM yang aktif:
```ts
const { data: staffOutletsRaw } = await supabase
  .from('staff_outlets')
  .select('staff_id, outlet_id, outlet_staff!inner(role, is_active)')
  .in('outlet_staff.role', ['area_manager', 'regional_manager'])
  .eq('outlet_staff.is_active', true)
```
Filter outlet operasional valid:
`operationalOutletIds` = list outlet dengan `type in ('internal', 'mitra')` dan `is_active = true`.
Kirimkan `managerAssignments` dan `operationalOutletIds` ke `calculateProratedExpenses`.

- [ ] **Step 2: Update `prorataAuxiliary.ts`**
Lakukan query serupa pada server action `getProrataAuxiliaryDataAction` agar data auxiliary menyertakan `managerAssignments` dan `operationalOutletIds`.

- [ ] **Step 3: Update `mitraPnl.ts`**
Lakukan hal yang sama pada server action `getMitraPnlDataAction` agar dashboard Mitra PnL juga merefleksikan alokasi yang tepat.

- [ ] **Step 4: Commit perubahan integrasi data**
```bash
git add apps/admin-dashboard/src/hooks/useProratedOpex.ts apps/admin-dashboard/src/app/actions/prorataAuxiliary.ts apps/admin-dashboard/src/app/actions/mitraPnl.ts
git commit -m "feat(dashboard): integrasikan query staff_outlets AM/RM dan pass ke opexProrata"
```

---

### Task 4: Invalidate Cache Periode

**Files:**
- Modify: `apps/admin-dashboard/src/lib/periodCache.ts`

- [ ] **Step 1: Naikkan versi cache ke `v10`**
Ubah `const VERSION = 'v9'` menjadi `const VERSION = 'v10'`.

- [ ] **Step 2: Jalankan typecheck & build test**
Run: `npm test`

- [ ] **Step 3: Commit cache bump**
```bash
git add apps/admin-dashboard/src/lib/periodCache.ts
git commit -m "chore(cache): bump periodCache VERSION ke v10 untuk alokasi gaji AM/RM"
```

---

### Task 5: Verifikasi End-to-End & Rekonsiliasi Angka

- [ ] **Step 1: Buat skrip verifikasi data September 2026**
Bandingkan total payroll perusahaan sebelum vs sesudah:
* Total Gaji Kru + Total Alokasi Gaji AM + Total Alokasi Gaji RM = Total Pengeluaran Gaji Bersih HR.
* Selisih harus **Rp 0**.
* Home outlet (Depok Sukmajaya, Empang, Sentul, dll.) tidak lagi menanggung 100% gaji AM/RM mereka.

- [ ] **Step 2: Hapus skrip verifikasi sementara**

- [ ] **Step 3: Jalankan verifikasi linting & tests**
Run: `npm test`
Expected: 100% pass.
