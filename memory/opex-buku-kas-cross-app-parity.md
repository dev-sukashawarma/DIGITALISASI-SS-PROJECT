# Aturan Wajib: Paritas Lintas-App Buku Kas (OPEX) & Kategori Pengeluaran

Setiap ada perubahan pada **Buku Kas (OPEX)** — baik menambah/mengubah kategori pengeluaran, allowlist query `petty_cash_expenses`, perhitungan prorata/gaji HR/sewa, filter grup outlet, maupun tampilan kartu/tabel/modal — **WAJIB disinkronkan serentak di 4 tempat**:

1. `apps/admin-dashboard` (`src/app/dashboard/reports/input-pengeluaran/page.tsx`, `src/lib/expenseCategories.ts`, `src/lib/pengeluaran/ambilPengeluaran.ts`, `src/app/actions/profitExport.ts`, `src/app/actions/expenses.ts`, dll.)
2. `apps/finance` (`src/app/laporan/buku-kas/page.tsx`, `src/lib/expenseCategories.ts`, `src/lib/pengeluaran/ambilPengeluaran.ts`, `src/app/actions/expenses.ts`, `src/lib/eom/opex.ts`, `src/components/PettyCashExpensesTab.tsx`, dll.)
3. `apps/manager` (`src/lib/expenseCategories.ts`, `src/app/actions/expenses.ts`, `src/app/buku-kas/page.tsx`)
4. `apps/pos-kasir` (`app/kasir/shift/page.tsx` — dropdown input kategori petty cash kru) + koordinasi POS Native bila menambah kategori input kasir.

**Penjaga otomatis di CI:** `apps/finance/src/lib/pengeluaran/opex.parity.test.ts` memverifikasi kesamaan byte-for-byte 17 berkas inti OPEX, halaman `Buku Kas` (`admin-dashboard` ↔ `finance`), allowlist `petty_cash_expenses` lintas-app, serta daftar kategori `manager` & `pos-kasir`. Selalu jalankan `yarn workspace @suka/finance test` setelah menyentuh modul OPEX di app mana pun.
