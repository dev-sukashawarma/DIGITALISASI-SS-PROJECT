import { ExpenseCategory, CATEGORY_META } from './expenseCategories'

export const OFFICE_DIVISIONS = [
  'Marketing & Growth',
  'HR & General Affairs (GA)',
  'Finance & Accounting',
  'Operations & Logistics',
  'IT & Technology',
  'R&D / Kitchen Development',
  'Executive / Management'
] as const

export type OfficeDivision = typeof OFFICE_DIVISIONS[number]

export type VoucherStatus = 
  | 'draft_advance'        // Uang Muka Diserahkan / Menunggu Pembelian & Struk
  | 'waiting_verification' // Struk sudah diupload / Menunggu Verifikasi Finance
  | 'verified'             // Diverifikasi & Resmi Masuk OPEX Kantor
  | 'rejected'             // Ditolak

export interface OfficeVoucher {
  id: string
  voucherNumber: string
  date: string
  division: string
  recipientName: string
  category: ExpenseCategory
  categoryLabel: string
  advanceAmount: number
  realizedAmount?: number
  refundAmount?: number
  reason: string
  status: VoucherStatus
  receiptUrl?: string | null
  createdAt: string
  createdBy?: string | null
  verifiedAt?: string | null
  verifiedBy?: string | null
  paymentSource: string
  notes?: string
}

export const VOUCHER_STATUS_META: Record<VoucherStatus, { label: string; color: string; badgeCls: string }> = {
  draft_advance: {
    label: 'Uang Muka (Menunggu Struk)',
    color: 'amber',
    badgeCls: 'bg-amber-100 text-amber-800 border-amber-300'
  },
  waiting_verification: {
    label: 'Menunggu Verifikasi Finance',
    color: 'blue',
    badgeCls: 'bg-blue-100 text-blue-800 border-blue-300'
  },
  verified: {
    label: 'Terverifikasi (Masuk OPEX)',
    color: 'emerald',
    badgeCls: 'bg-emerald-100 text-emerald-800 border-emerald-300'
  },
  rejected: {
    label: 'Ditolak',
    color: 'rose',
    badgeCls: 'bg-rose-100 text-rose-800 border-rose-300'
  }
}

/**
 * Format serializer untuk menyimpan data voucher di kolom description tabel expenses
 */
export function serializeVoucherToDescription(data: {
  voucherNumber: string
  division: string
  recipientName: string
  category?: string
  reason: string
  advanceAmount: number
  realizedAmount?: number
  refundAmount?: number
  status: VoucherStatus
  verifiedAt?: string | null
  verifiedBy?: string | null
  notes?: string
}): string {
  const payload = {
    vcr: data.voucherNumber,
    div: data.division,
    rcp: data.recipientName,
    cat: data.category || 'pengeluaran_global',
    rsn: data.reason,
    adv: data.advanceAmount,
    rel: data.realizedAmount !== undefined ? data.realizedAmount : data.advanceAmount,
    ref: data.refundAmount ?? 0,
    st: data.status,
    vat: data.verifiedAt ?? null,
    vby: data.verifiedBy ?? null,
    nt: data.notes ?? ''
  }
  return `[OFFICE_VCR] ${JSON.stringify(payload)} | ${data.reason} (${data.division} - ${data.recipientName})`
}

/**
 * Deserializer untuk membaca kembali data voucher dari row expenses
 */
export function deserializeVoucherFromRow(row: any): OfficeVoucher | null {
  const desc = row.description || ''
  if (!desc.includes('[OFFICE_VCR]')) {
    // Fallback if not voucher format
    return null
  }

  try {
    const jsonPart = desc.split('[OFFICE_VCR] ')[1]?.split(' | ')[0]
    if (!jsonPart) return null
    const parsed = JSON.parse(jsonPart)

    const catKey = (parsed.cat || row.category) as ExpenseCategory
    const catMeta = CATEGORY_META[catKey]

    return {
      id: row.id,
      voucherNumber: parsed.vcr || `VCR-${row.id.slice(0, 8).toUpperCase()}`,
      date: row.expense_date,
      division: parsed.div || 'General',
      recipientName: parsed.rcp || '-',
      category: catKey,
      categoryLabel: catMeta?.label || row.category,
      advanceAmount: Number(parsed.adv) || Number(row.amount),
      realizedAmount: parsed.rel !== undefined ? Number(parsed.rel) : Number(row.amount),
      refundAmount: Number(parsed.ref) || 0,
      reason: parsed.rsn || desc,
      status: (parsed.st as VoucherStatus) || (row.type === 'office_settled' ? 'verified' : 'draft_advance'),
      receiptUrl: row.receipt_url || null,
      createdAt: row.created_at,
      createdBy: row.created_by || null,
      verifiedAt: parsed.vat || null,
      verifiedBy: parsed.vby || null,
      paymentSource: row.payment_source || 'petty_cash',
      notes: parsed.nt || ''
    }
  } catch (e) {
    return null
  }
}

/**
 * Generate nomor voucher unik berdasar tahun, bulan, dan random sequence
 */
export function generateVoucherNumber(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `VCR-${yyyy}${mm}-${rand}`
}
