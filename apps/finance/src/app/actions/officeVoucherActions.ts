'use server'

import {
  type OfficeDivision,
  deserializeVoucherFromRow,
  serializeVoucherToDescription,
  generateVoucherNumber,
  type OfficeVoucher
} from '@/lib/officeVoucher'
import { type ExpenseCategory } from '@/lib/expenseCategories'
import { getServiceSupabase } from '@/lib/supabase-service'
import { requireRole, PERAN_KEUANGAN } from '@/lib/authz'

const TIPE_MENUNGGU_VERIFIKASI = 'office_waiting_verification'
const PESAN_SUDAH_DIPROSES = 'Voucher sudah diproses atau tidak lagi menunggu verifikasi. Muat ulang daftar.'

/**
 * Catat keputusan dana kantor ke riwayat Hub Approval. Jalur ini memakai service
 * role sehingga trigger tak tahu pelakunya; pelaku diambil dari sesi terverifikasi.
 * Tahan galat: kegagalan mencatat tidak membatalkan keputusan.
 */
async function catatRiwayatVoucher(
  supabase: ReturnType<typeof getServiceSupabase>,
  v: OfficeVoucher,
  keputusan: 'setuju' | 'tolak',
  pelaku: string,
  nominal: number,
  alasan: string | null
) {
  const sekarang = new Date().toISOString()
  const { error } = await supabase.from('approval_log').insert({
    jenis: 'dana_kantor',
    keputusan,
    sumber_id: v.id,
    judul: `${v.division} · ${v.recipientName}`,
    keterangan: v.voucherNumber,
    nominal,
    alasan,
    pelaku,
    waktu: sekarang,
    waktu_urut: sekarang,
  })
  if (error) console.error('Gagal mencatat riwayat voucher:', error.message)
}

export async function getOfficeVouchersAction(filterMonth?: string): Promise<OfficeVoucher[]> {
  await requireRole(PERAN_KEUANGAN)
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
  await requireRole(PERAN_KEUANGAN)
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
  await requireRole(PERAN_KEUANGAN)
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
  /** Rekening pusat yang membayar; saldonya dipotong sebesar nominal akhir (trigger expenses_sinkron_kas). */
  cashLocationId: string
}) {
  const { userId } = await requireRole(PERAN_KEUANGAN)
  if (!input.cashLocationId) {
    throw new Error('Pilih rekening pembayar terlebih dahulu.')
  }
  const supabase = getServiceSupabase()
  const v = input.voucher
  const finalAmount = input.approvedAmount !== undefined ? input.approvedAmount : (v.realizedAmount || v.advanceAmount)
  if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
    throw new Error('Nominal akhir harus lebih dari 0.')
  }
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

  const { data, error } = await supabase
    .from('expenses')
    .update({
      amount: finalAmount,
      description: newDesc,
      // 'expense' = pengeluaran biasa: ikut Buku Kas (OPEX) & Laba Perusahaan sebagai biaya Pusat.
      // Penanda [OFFICE_VCR] di description tetap menjaga voucher di daftar dana kantor.
      type: 'expense',
      cash_location_id: input.cashLocationId
    })
    .eq('id', v.id)
    // Hanya voucher yang masih menunggu verifikasi; cegah menimpa keputusan dari tab lain.
    .eq('type', TIPE_MENUNGGU_VERIFIKASI)
    .select('id')

  if (error) {
    throw new Error(error.message)
  }
  if (!data || data.length === 0) {
    throw new Error(PESAN_SUDAH_DIPROSES)
  }

  await catatRiwayatVoucher(supabase, v, 'setuju', userId, finalAmount, null)

  return { success: true }
}

export async function rejectOfficeVoucherAction(input: {
  voucher: OfficeVoucher
  reason: string
}) {
  const { userId } = await requireRole(PERAN_KEUANGAN)
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

  const { data, error } = await supabase
    .from('expenses')
    .update({
      description: newDesc,
      type: 'office_rejected'
    })
    .eq('id', v.id)
    // Hanya voucher yang masih menunggu verifikasi; cegah menimpa keputusan dari tab lain.
    .eq('type', TIPE_MENUNGGU_VERIFIKASI)
    .select('id')

  if (error) {
    throw new Error(error.message)
  }
  if (!data || data.length === 0) {
    throw new Error(PESAN_SUDAH_DIPROSES)
  }

  await catatRiwayatVoucher(supabase, v, 'tolak', userId, v.realizedAmount ?? v.advanceAmount, input.reason.trim() || null)

  return { success: true }
}
