'use server'

import { createClient } from '@supabase/supabase-js'
import {
  type OfficeDivision,
  deserializeVoucherFromRow,
  serializeVoucherToDescription,
  generateVoucherNumber,
  type OfficeVoucher
} from '@/lib/officeVoucher'
import { type ExpenseCategory } from '@/lib/expenseCategories'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co'
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'

function getServiceSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function getOfficeVouchersAction(filterMonth?: string): Promise<OfficeVoucher[]> {
  const supabase = getServiceSupabase()

  let q = supabase
    .from('expenses')
    .select('*')
    .is('outlet_id', null)
    .like('description', '%[OFFICE_VCR]%')
    .order('expense_date', { ascending: false })

  if (filterMonth) {
    const from = `${filterMonth}-01`
    const [y, m] = filterMonth.split('-').map(Number)
    const lastDayNumber = new Date(y, m, 0).getDate()
    const lastDayStr = `${filterMonth}-${String(lastDayNumber).padStart(2, '0')}`
    q = q.gte('expense_date', from).lte('expense_date', lastDayStr)
  }

  const { data, error } = await q
  if (error) {
    console.error('getOfficeVouchersAction error:', error)
    throw new Error(error.message)
  }

  const list: OfficeVoucher[] = []
  ;(data || []).forEach((row: any) => {
    const v = deserializeVoucherFromRow(row)
    if (v) list.push(v)
  })

  return list
}

export async function createOfficeVoucherAction(input: {
  date: string
  division: OfficeDivision
  recipientName: string
  category: ExpenseCategory
  advanceAmount: number
  reason: string
  paymentSource?: string
  userId?: string | null
}): Promise<OfficeVoucher | null> {
  const supabase = getServiceSupabase()

  const voucherNumber = generateVoucherNumber()
  const desc = serializeVoucherToDescription({
    voucherNumber,
    division: input.division,
    recipientName: input.recipientName,
    category: input.category,
    reason: input.reason,
    advanceAmount: input.advanceAmount,
    status: 'draft_advance'
  })

  const periodMonth = `${input.date.slice(0, 7)}-01`

  let validStaffId: string | null = null
  if (input.userId) {
    const { data: staff } = await supabase
      .from('outlet_staff')
      .select('id')
      .eq('id', input.userId)
      .maybeSingle()
    if (staff?.id) {
      validStaffId = staff.id
    }
  }

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      outlet_id: null,
      category: 'pengeluaran_global',
      amount: input.advanceAmount,
      description: desc,
      expense_date: input.date,
      period_month: periodMonth,
      type: 'office_advance',
      payment_source: 'transfer_pusat',
      created_by: validStaffId
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return deserializeVoucherFromRow(data)
}

export async function settleOfficeVoucherAction(input: {
  voucher: OfficeVoucher
  realizedAmount: number
  receiptUrl?: string | null
  notes?: string
}) {
  const supabase = getServiceSupabase()
  const v = input.voucher
  const refund = Math.max(0, v.advanceAmount - input.realizedAmount)

  const newDesc = serializeVoucherToDescription({
    voucherNumber: v.voucherNumber,
    division: v.division,
    recipientName: v.recipientName,
    category: v.category,
    reason: v.reason,
    advanceAmount: v.advanceAmount,
    realizedAmount: input.realizedAmount,
    refundAmount: refund,
    status: 'waiting_verification',
    notes: input.notes
  })

  const { error } = await supabase
    .from('expenses')
    .update({
      amount: input.realizedAmount,
      description: newDesc,
      receipt_url: input.receiptUrl !== undefined ? input.receiptUrl : v.receiptUrl,
      type: 'office_waiting_verification'
    })
    .eq('id', v.id)

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

export async function verifyOfficeVoucherAction(input: {
  voucher: OfficeVoucher
  approvedAmount?: number
  verifiedBy?: string | null
}) {
  const supabase = getServiceSupabase()
  const v = input.voucher
  const finalAmount = input.approvedAmount !== undefined ? input.approvedAmount : (v.realizedAmount || v.advanceAmount)
  const refund = Math.max(0, v.advanceAmount - finalAmount)

  const newDesc = serializeVoucherToDescription({
    voucherNumber: v.voucherNumber,
    division: v.division,
    recipientName: v.recipientName,
    category: v.category,
    reason: v.reason,
    advanceAmount: v.advanceAmount,
    realizedAmount: finalAmount,
    refundAmount: refund,
    status: 'verified',
    verifiedAt: new Date().toISOString(),
    verifiedBy: input.verifiedBy || 'Finance & Accounting',
    notes: v.notes
  })

  const { error } = await supabase
    .from('expenses')
    .update({
      amount: finalAmount,
      description: newDesc,
      type: 'office_settled'
    })
    .eq('id', v.id)

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

export async function rejectOfficeVoucherAction(input: {
  voucher: OfficeVoucher
  reason: string
}) {
  const supabase = getServiceSupabase()
  const v = input.voucher
  const newDesc = serializeVoucherToDescription({
    voucherNumber: v.voucherNumber,
    division: v.division,
    recipientName: v.recipientName,
    category: v.category,
    reason: v.reason,
    advanceAmount: v.advanceAmount,
    status: 'rejected',
    notes: `Ditolak: ${input.reason}`
  })

  const { error } = await supabase
    .from('expenses')
    .update({
      description: newDesc,
      type: 'office_rejected'
    })
    .eq('id', v.id)

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}
