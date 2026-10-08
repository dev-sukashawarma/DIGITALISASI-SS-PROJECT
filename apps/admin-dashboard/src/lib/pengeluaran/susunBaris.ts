import { mapExpenseRow, type ExpenseRow } from '@/lib/expenseRow'
import { isTestOutlet } from '@/lib/outletFilters'
import { buatSaringanKasKecil } from '@/lib/kasKecilTeraudit'

/**
 * Baris mentah `expenses` + `petty_cash_expenses` → ExpenseRow[] seperti yang
 * ditampilkan halaman Pengeluaran. Satu sumber untuk halaman (useExpenses) dan
 * Bot CEO (Hermes) agar angkanya selalu sama.
 */
export function susunBarisPengeluaran(expenses: any[], pettyCash: any[]): ExpenseRow[] {
  const monthlyRows = (expenses ?? [])
    .filter((row: any) => !row.outlet_id || (!isTestOutlet(row.outlet_id) && !isTestOutlet(row.outlets?.name)))
    .map(mapExpenseRow)

  const pettyCashRows = (pettyCash ?? [])
    .filter((row: any) => !isTestOutlet(row.outlet_id) && !isTestOutlet(row.outlets?.name))
    .map((row: any) => {
      let cat = row.category
      if (cat === 'bb') cat = 'bahan_baku'
      else if (cat === 'outlet' || cat === 'operasional') cat = 'pengeluaran_outlet'
      else if (cat === 'utilities') cat = 'utilitas'

      return {
        id: row.id,
        outlet_id: row.outlet_id,
        outlet_name: row.outlets?.name ?? (row.outlet_id ? 'Outlet Tidak Dikenal' : null),
        category: cat,
        scope: 'outlet' as const,
        amount: Number(row.amount) || 0,
        description: row.description ?? '',
        expense_date: row.expense_date,
        period_month: (row.expense_date || '').slice(0, 7) + '-01',
        receipt_url: row.receipt_url,
        source: 'petty_cash' as const,
        type: 'expense',
        recipient_name: null,
        division: null,
        raw_description: row.description,
        raw_category: row.category,
      } as ExpenseRow
    })

  // Kas kecil dilewati hanya untuk outlet-bulan yang sudah punya rangkuman
  // "OPEX <Bulan> <Tahun> - ..." di expenses — lihat lib/kasKecilTeraudit.ts.
  const filteredPettyCashRows = pettyCashRows.filter(buatSaringanKasKecil(monthlyRows))

  return [...monthlyRows, ...filteredPettyCashRows] as ExpenseRow[]
}
