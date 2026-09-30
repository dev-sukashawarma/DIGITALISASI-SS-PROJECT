import { type ExpenseCategory, type ExpenseScope } from '@/lib/expenseCategories'

export interface ExpenseRow {
  id: string
  outlet_id: string | null
  outlet_name: string | null
  category: ExpenseCategory
  scope: ExpenseScope
  amount: number
  description: string
  expense_date: string
  period_month: string
  receipt_url?: string | null
  source: 'monthly' | 'petty_cash'
  type?: string
  recipient_name?: string | null
  division?: string | null
  raw_description?: string | null
  raw_category?: string | null
}

/** Satu baris `expenses` → ExpenseRow (dipakai halaman Pengeluaran, Rekap Bulanan, EOM). */
export function mapExpenseRow(row: any): ExpenseRow {
  let displayDesc = row.description ?? ''
  let cat = row.category
  let recipientName: string | null = null
  let division: string | null = null

  if (displayDesc.includes('[OFFICE_VCR]')) {
    try {
      const jsonPart = displayDesc.split('[OFFICE_VCR] ')[1]?.split(' | ')[0]
      if (jsonPart) {
        const parsed = JSON.parse(jsonPart)
        if (parsed.cat) cat = parsed.cat
        if (parsed.rcp) recipientName = parsed.rcp
        if (parsed.div) division = parsed.div
        if (parsed.rsn) displayDesc = parsed.rsn
      }
    } catch (e) {
      // ignore
    }
  } else if (displayDesc.startsWith('[Kategori: ') && displayDesc.includes('] ')) {
    const match = displayDesc.match(/^\[Kategori:\s*([^\]]+)\]\s*(.*)$/)
    if (match) {
      cat = match[1]
      displayDesc = match[2]
    }
  }

  const isPusat = !row.outlet_id || 
    row.outlet_id === 'ffffffff-ffff-ffff-ffff-ffffffffffff' ||
    row.outlets?.name?.toLowerCase().includes('kantor pusat') ||
    (row.category === 'pengeluaran_global' && !row.outlet_id) ||
    (row.category === 'gaji_staff_kantor' && !row.outlet_id)

  return {
    id: row.id,
    outlet_id: row.outlet_id,
    outlet_name: isPusat ? 'Kantor Pusat' : (row.outlets?.name ?? (row.outlet_id ? 'Outlet Tidak Dikenal' : 'Kantor Pusat')),
    category: cat,
    raw_category: row.category,
    scope: isPusat ? ('pusat' as const) : ('outlet' as const),
    amount: Number(row.amount),
    description: displayDesc,
    raw_description: row.description,
    expense_date: row.expense_date,
    period_month: row.period_month,
    receipt_url: row.receipt_url,
    type: row.type || 'expense',
    source: 'monthly' as const,
    recipient_name: recipientName,
    division: division
  }
}
