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

      const staffName = Array.isArray(row.outlet_staff)
        ? row.outlet_staff[0]?.name
        : row.outlet_staff?.name

      let resolvedRecipient = staffName ?? null
      if (resolvedRecipient && /superadmin\s*2/i.test(resolvedRecipient)) {
        resolvedRecipient = 'Hesti Qodriani'
      }
      if (!resolvedRecipient && (cat === 'endorsement' || cat === 'promo' || (row.description && row.description.includes('[MARCOM:')))) {
        resolvedRecipient = 'Putri Lestari Hambali'
      }

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
        recipient_name: resolvedRecipient,
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
