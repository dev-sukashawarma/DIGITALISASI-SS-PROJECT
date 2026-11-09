import { type ExpenseCategory, type ExpenseScope } from '@/lib/expenseCategories'

const KANTOR_PUSAT_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
const GUDANG_PUSAT_ID = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'
const GUDANG_SS_ONLINE_ID = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b91'
const GUDANG_SS_ONLINE_PUSAT_SEJAK = '2026-10-01'

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

/**
 * Cek apakah satu baris `expenses` termasuk beban Kantor Pusat / Gudang Pusat (`scope: 'pusat'`).
 * Khusus `GUDANG SS ONLINE`, periode < Oktober 2026 tetap ber-scope `'outlet'` agar rekonsiliasi
 * closing September 2026 (`terapkanClosingOpex` -> kolom `SS ONLINE`) tidak berubah; mulai
 * Oktober 2026 ke atas beban Gudang SS Online masuk ke OPEX Pusat (`PUSAT`), bukan cabang ritel.
 */
export function isPusatExpenseRow(row: any): boolean {
  if (!row) return false
  const oid = row.outlet_id
  if (!oid || oid === KANTOR_PUSAT_ID || oid === GUDANG_PUSAT_ID) return true

  const outletNameLower = String(row.outlets?.name ?? row.outlet_name ?? '').toLowerCase()
  if (outletNameLower.includes('kantor pusat') || outletNameLower.includes('gudang pusat')) {
    return true
  }

  if (oid === GUDANG_SS_ONLINE_ID || outletNameLower.includes('gudang ss online')) {
    const tgl = String(row.expense_date || row.period_month || '').slice(0, 10)
    return tgl >= GUDANG_SS_ONLINE_PUSAT_SEJAK
  }

  return false
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

  const staffName = Array.isArray(row.outlet_staff)
    ? row.outlet_staff[0]?.name
    : row.outlet_staff?.name

  if (!recipientName && staffName) {
    recipientName = staffName
  }

  // Penggantian Superadmin 2 menjadi akun Hesti Qodriani
  if (recipientName && /superadmin\s*2/i.test(recipientName)) {
    recipientName = 'Hesti Qodriani'
  }

  // Pengeluaran Endorsement & Promo: nama pemohon dari Crew Marcom (Putri Lestari Hambali)
  if (!recipientName && (cat === 'endorsement' || cat === 'promo' || displayDesc.includes('[MARCOM:'))) {
    recipientName = 'Putri Lestari Hambali'
  }

  const isPusat = isPusatExpenseRow(row)

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
