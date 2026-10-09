# Pemisahan Komponen Bonus dari Gaji Crew di Engine OPEX Laba Rugi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memisahkan komponen bonus penjualan dari `total_salary` slip HR pada kategori `gaji_crew_outlet`, dan menyalurkannya secara bersih ke kategori `bonus_crew` di Tab Laba Rugi, Waterfall Modal, dan Export PDF agar tidak terjadi dobel hitung (*double-counting*), dengan jaminan total beban crew tetap sama persis dengan total slip transfer HR (Rp 138.786.526).

**Architecture:** 
1. Di `useProratedOpex.ts`, `prorataAuxiliary.ts`, dan `mitraPnl.ts`, tambahkan kolom `bonus` dari tabel `payroll_records` ke pemetaan data slip HR.
2. Di `opexProrata.ts`, hitung `gaji_crew_outlet` sebagai `total_salary - bonus` (gaji pokok + tunjangan bersih).
3. Di pos `bonus_crew`, prioritaskan nilai bonus yang sudah tervalidasi di slip HR jika ada, sebelum fallback ke RPC penjualan. Total gaji + bonus crew menjadi 100% konsisten dengan nilai transfer slip HR.

**Tech Stack:** Next.js, React, TypeScript, TanStack Query, Vitest, Supabase.

## Global Constraints
- Tidak mengubah data di database Supabase (tabel `payroll_records`, `expenses`, dsb. tetap utuh).
- Tidak merusak angka bulan lain (seperti Agustus yang sudah memiliki entri Buku Kas tersendiri).
- Menjaga total pengeluaran crew (Gaji + Bonus) tepat sama dengan `total_salary` slip HR (Rp 138.786.526).

---

### Task 1: Update Tipe dan Logika di `src/lib/opexProrata.ts`

**Files:**
- Modify: `src/lib/opexProrata.ts:143-150`
- Modify: `src/lib/opexProrata.ts:340-348`
- Modify: `src/lib/opexProrata.ts:743-752`
- Modify: `src/lib/opexProrata.ts:790-805`
- Test: `src/lib/opexProrata.test.ts`

- [ ] **Step 1: Tulis test kasus pemisahan bonus dari gaji di `src/lib/opexProrata.test.ts`**
  Memastikan jika `payrollRecords` memiliki `total_salary: 2_500_000` dan `bonus: 500_000`, maka:
  - `gaji_crew_outlet` menjadi `2_000_000`.
  - `bonus_crew` menjadi `500_000`.
  - Total `gaji_crew_outlet + bonus_crew` = `2_500_000`.

- [ ] **Step 2: Jalankan test dan pastikan gagal (RED)**
  `npm test -- src/lib/opexProrata.test.ts`

- [ ] **Step 3: Update `CalculateProrataInput` dan logika kalkulasi di `src/lib/opexProrata.ts`**
  - Tambahkan `bonus?: number` pada tipe item `payrollRecords`.
  - Pada Mode 1 & Mode 2, kurangi `pr.bonus` dari `gajiMonthly`: `Math.max(0, tot - bon)`.
  - Pada pembentukan `bonus_crew`, jika `hrBonus > 0`, gunakan `hrBonus`.

- [ ] **Step 4: Jalankan test dan pastikan sukses (GREEN)**
  `npm test -- src/lib/opexProrata.test.ts`

---

### Task 2: Update Select & Mapping di `useProratedOpex.ts`, `prorataAuxiliary.ts`, dan `mitraPnl.ts`

**Files:**
- Modify: `src/hooks/useProratedOpex.ts:70-125`
- Modify: `src/app/actions/prorataAuxiliary.ts:70-170`
- Modify: `src/app/actions/mitraPnl.ts:228-248` & `765-785`

- [ ] **Step 1: Tambahkan `bonus` pada select query `payroll_records` di ketiga file tersebut**
- [ ] **Step 2: Petakan field `bonus: Number(r.bonus) || 0` pada array payroll records yang dikirim ke `calculateProratedExpenses`**
- [ ] **Step 3: Jalankan seluruh test suite terkait**
  `npm test -- src/lib/opexProrata.test.ts src/lib/mitraPnl.test.ts src/lib/profitWaterfall.test.ts src/lib/export/profitExportService.test.ts`

---

### Task 3: Verifikasi Konsistensi Angka September 2026 di Layar dan PDF

**Files:**
- Test/Verify: Script verifikasi data September 2026

- [ ] **Step 1: Jalankan simulasi kalkulasi September 2026**
  - Pastikan `gaji_crew_outlet` = Rp 133.482.231.
  - Pastikan `bonus_crew` = Rp 5.304.295.
  - Pastikan total beban crew = Rp 138.786.526.
  - Pastikan `bonus_area_manager` dan `bonus_regional_manager` tetap tampil sesuai realisasi penjualan.
- [ ] **Step 2: Pastikan data bulan Agustus 2026 tetap tidak berubah**
- [ ] **Step 3: Pastikan linter dan typecheck bersih (`npm run lint` / `tsc --noEmit`)**
