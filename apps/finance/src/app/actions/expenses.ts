'use server'

import { createClient } from '@supabase/supabase-js'
import { buatLinkUnggah, type LinkUnggah, type PermintaanLink } from '@suka/auth'
import { requireRole, PERAN_KEUANGAN } from '@/lib/authz'
import type { UpsertExpenseInput } from '@/hooks/useUpsertExpenses'
import { deserializeVoucherFromRow, serializeVoucherToDescription } from '@/lib/officeVoucher'
import { ambilPengeluaranMentah } from '@/lib/pengeluaran/ambilPengeluaran'
import { adalahJointExpenseDisembunyikan, PESAN_JOINT_EXPENSE_DITOLAK } from '@/lib/pengeluaran/jointExpense'
import { adalahKategoriRab, cekAturanRab, KATEGORI_RAB, TIPE_RAB } from '@/lib/pengeluaran/rab'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

export async function upsertExpensesAction(items: UpsertExpenseInput[]) {
  const { role } = await requireRole(['admin_finance', 'admin', 'owner'])
  const supabase = getServiceSupabase()

  for (const it of items) {
    if (adalahKategoriRab(it.category)) {
      throw new Error('Kategori RAB dicatat per transaksi lewat form Input Pengeluaran, bukan rekap bulanan.')
    }
    // Joint expense Oktober 2026 ke atas tidak dihitung di laporan mana pun; kalau
    // tetap boleh disimpan, barisnya lenyap dari Buku Kas dan tak bisa diedit.
    if (adalahJointExpenseDisembunyikan({ category: it.category, expense_date: it.periodMonth })) {
      throw new Error(PESAN_JOINT_EXPENSE_DITOLAK)
    }
    const isPusat = ['pengeluaran_global', 'gaji_staff_kantor'].includes(it.category) && !it.outletId
    if (isPusat && role !== 'owner' && role !== 'developer') {
      throw new Error('Forbidden: pengeluaran scope Pusat hanya boleh diisi owner')
    }
    const outletId = isPusat ? null : it.outletId

    if (outletId) {
      const { data: targetOutlet } = await supabase
        .from('outlets')
        .select('name, type')
        .eq('id', outletId)
        .maybeSingle()

      if (targetOutlet?.type === 'mitra' && ['gaji_staff_kantor', 'pengeluaran_global'].includes(it.category)) {
        throw new Error(`Pengeluaran ${it.category} dilarang dialokasikan ke outlet mitra (${targetOutlet.name}).`)
      }
    }

    const { error } = await supabase.from('expenses').upsert({
      outlet_id: outletId,
      category: it.category,
      amount: it.amount,
      expense_date: it.periodMonth,
      period_month: it.periodMonth,
      payment_source: 'transfer_pusat'
    }, {
      onConflict: 'outlet_id, category, period_month'
    })

    if (error) {
      throw new Error(error.message)
    }
  }
}

/**
 * Signed upload URL untuk foto/PDF nota OPEX. File TIDAK lewat server aplikasi:
 * browser mengunggah langsung ke Supabase Storage (`unggahLangsung` di @suka/auth),
 * jadi tidak kena WAF Cloudflare maupun batas body Server Action 1 MB
 * (insiden 12 Nov 2026: "An unexpected response was received from the server").
 */
export async function mintaLinkUnggahNotaOpexAction(permintaan: PermintaanLink): Promise<LinkUnggah> {
  try {
    await requireRole(PERAN_KEUANGAN)
    return await buatLinkUnggah({
      supabase: getServiceSupabase(),
      bucket: 'opex-invoices',
      folder: 'invoices',
      permintaan,
    })
  } catch (err: any) {
    console.error('Exception in mintaLinkUnggahNotaOpexAction:', err)
    return { ok: false, pesan: err?.message || 'Gagal menyiapkan unggahan bukti' }
  }
}

export async function createSingleExpenseAction(input: {
  outletId: string | null
  category: string
  amount: number
  description: string
  expenseDate: string
  periodMonth: string
  type: string
  created_by?: string | null
  receipt_url?: string | null
  /** Rekening Petty Cash pusat yang membayar; saldo dipotong otomatis oleh DB. */
  cashLocationId?: string | null
}) {
  try {
    await requireRole(PERAN_KEUANGAN)
    if (adalahJointExpenseDisembunyikan({ category: input.category, expense_date: input.expenseDate })) {
      return { success: false, error: PESAN_JOINT_EXPENSE_DITOLAK }
    }

    const supabase = getServiceSupabase()

    // RAB (ditanggung dana investasi): type 'rab', tidak pernah dihitung OPEX/laba.
    if (adalahKategoriRab(input.category)) {
      const galat = cekAturanRab({
        kategoriBaru: input.category,
        outletId: input.outletId,
        tanggalBaru: input.expenseDate,
      })
      if (galat) return { success: false, error: galat }
      let pencatatRab: string | null = null
      if (input.created_by) {
        const { data: staff } = await supabase.from('outlet_staff').select('id').eq('id', input.created_by).maybeSingle()
        pencatatRab = staff?.id ?? null
      }
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          outlet_id: input.outletId,
          category: KATEGORI_RAB,
          type: TIPE_RAB,
          amount: input.amount,
          description: input.description,
          expense_date: input.expenseDate,
          period_month: input.periodMonth,
          // Rekening pusat boleh membayar RAB: saldonya tetap terpotong (trigger DB).
          payment_source: input.cashLocationId ? 'petty_cash' : 'transfer_pusat',
          cash_location_id: input.cashLocationId || null,
          created_by: pencatatRab,
          receipt_url: input.receipt_url || null
        })
        .select()
        .single()
      if (error) return { success: false, error: error.message }
      return { success: true, data }
    }

    if (input.outletId) {
      const { data: targetOutlet } = await supabase
        .from('outlets')
        .select('name, type')
        .eq('id', input.outletId)
        .maybeSingle()

      if (targetOutlet?.type === 'mitra') {
        const cat = (input.category || '').toLowerCase()
        const desc = (input.description || '').toLowerCase()
        if (
          cat === 'gaji_staff_kantor' ||
          cat === 'pengeluaran_global' ||
          desc.includes('gaji kantor') ||
          desc.includes('staf kantor') ||
          desc.includes('staff kantor') ||
          desc.includes('kantor pusat')
        ) {
          return {
            success: false,
            error: `Pengeluaran gaji staf kantor / kantor pusat dilarang dialokasikan ke outlet mitra (${targetOutlet.name}). Harap alokasikan ke Pusat atau outlet internal.`
          }
        }
      }
    }

    const isPusat = !input.outletId
    const dbCategory = isPusat ? 'pengeluaran_global' : input.category
    const dbDescription = isPusat && input.category !== 'pengeluaran_global'
      ? `[Kategori: ${input.category}] ${input.description}`
      : input.description

    let validStaffId: string | null = null
    if (input.created_by) {
      const { data: staff } = await supabase
        .from('outlet_staff')
        .select('id')
        .eq('id', input.created_by)
        .maybeSingle()
      if (staff?.id) {
        validStaffId = staff.id
      }
    }

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        outlet_id: input.outletId,
        category: dbCategory,
        amount: input.amount,
        description: dbDescription,
        expense_date: input.expenseDate,
        period_month: input.periodMonth,
        type: input.type,
        payment_source: input.outletId || input.cashLocationId ? 'petty_cash' : 'transfer_pusat',
        cash_location_id: input.cashLocationId || null,
        created_by: validStaffId,
        receipt_url: input.receipt_url || null
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting single expense:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (err: any) {
    console.error('Exception in createSingleExpenseAction:', err)
    return { success: false, error: err?.message || 'Gagal menyimpan transaksi' }
  }
}

export async function getExpensesAction(filter: { from: string; to: string; outletId: string; source?: string }) {
  try {
    await requireRole(PERAN_KEUANGAN)
    const r = await ambilPengeluaranMentah(getServiceSupabase(), filter)
    return { success: true, expenses: r.expenses, pettyCashExpenses: r.pettyCashExpenses }
  } catch (err: any) {
    console.error('Error in getExpensesAction:', err)
    return {
      success: false,
      error: err?.message || 'Gagal mengambil data pengeluaran',
      expenses: [],
      pettyCashExpenses: []
    }
  }
}

export async function deleteTransactionAction(params: { id: string; isTopup?: boolean }) {
  await requireRole(PERAN_KEUANGAN)
  const supabase = getServiceSupabase()

  if (params.isTopup || params.id.startsWith('topup-')) {
    const rawId = params.id.replace(/^topup-/, '')
    const { error } = await supabase
      .from('petty_cash_topups')
      .delete()
      .eq('id', rawId)
    if (error) throw new Error(error.message)
    return { success: true }
  }

  const { error: err1 } = await supabase
    .from('expenses')
    .delete()
    .eq('id', params.id)

  const { error: err2 } = await supabase
    .from('petty_cash_expenses')
    .delete()
    .eq('id', params.id)

  if (err1 && err2) {
    throw new Error(err1.message || err2.message)
  }

  return { success: true }
}

export async function updateSingleExpenseAction(input: {
  id: string
  outletId: string | null
  category: string
  amount: number
  description: string
  expenseDate: string
  periodMonth?: string
  receipt_url?: string | null
  recipient_name?: string | null
  division?: string | null
  /** undefined = tidak diubah; null = lepas dari rekening pusat. */
  cashLocationId?: string | null
}) {
  try {
    await requireRole(PERAN_KEUANGAN)
    if (adalahJointExpenseDisembunyikan({ category: input.category, expense_date: input.expenseDate })) {
      return { success: false, error: PESAN_JOINT_EXPENSE_DITOLAK }
    }

    const supabase = getServiceSupabase()

    if (input.outletId && input.outletId !== 'PUSAT') {
      const { data: targetOutlet } = await supabase
        .from('outlets')
        .select('name, type')
        .eq('id', input.outletId)
        .maybeSingle()

      if (targetOutlet?.type === 'mitra') {
        const cat = (input.category || '').toLowerCase()
        const desc = (input.description || '').toLowerCase()
        if (
          cat === 'gaji_staff_kantor' ||
          cat === 'pengeluaran_global' ||
          desc.includes('gaji kantor') ||
          desc.includes('staf kantor') ||
          desc.includes('staff kantor') ||
          desc.includes('kantor pusat')
        ) {
          return {
            success: false,
            error: `Pengeluaran gaji staf kantor / kantor pusat dilarang dialokasikan ke outlet mitra (${targetOutlet.name}). Harap alokasikan ke Pusat atau outlet internal.`
          }
        }
      }
    }

    const isPusat = !input.outletId || input.outletId === 'PUSAT'
    const actualOutletId = isPusat ? null : input.outletId

    const { data: currentExpense, error: fetchErr } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', input.id)
      .maybeSingle()

    if (fetchErr) {
      console.error('Error fetching expense to update:', fetchErr)
      return { success: false, error: fetchErr.message }
    }

    if (!currentExpense) {
      const { data: currentPetty } = await supabase
        .from('petty_cash_expenses')
        .select('*')
        .eq('id', input.id)
        .maybeSingle()

      if (currentPetty) {
        // Kas kecil boleh ditandai RAB (ditanggung dana investasi): saldo kas kecil
        // tetap berkurang, tetapi tidak dihitung OPEX/laba. Outletnya tetap outlet asal.
        const pettyKeRab = adalahKategoriRab(input.category)
        const pettyDariRab = currentPetty.type === TIPE_RAB
        if (pettyKeRab || pettyDariRab) {
          const galat = cekAturanRab({
            kategoriBaru: input.category,
            outletId: currentPetty.outlet_id,
            tanggalBaru: input.expenseDate,
            tipeLama: currentPetty.type ?? 'expense',
            tanggalLama: currentPetty.expense_date,
          })
          if (galat) return { success: false, error: galat }
        }
        const kategoriPetty = pettyKeRab
          ? KATEGORI_RAB
          : (!isPusat && input.category) ? input.category : currentPetty.category
        const { data: updatedPetty, error: updatePettyErr } = await supabase
          .from('petty_cash_expenses')
          .update({
            category: kategoriPetty,
            ...(pettyKeRab ? { type: TIPE_RAB } : pettyDariRab ? { type: 'expense' } : {}),
            amount: input.amount,
            description: input.description,
            expense_date: input.expenseDate,
            receipt_url: input.receipt_url !== undefined ? input.receipt_url : currentPetty.receipt_url
          })
          .eq('id', input.id)
          .select()
          .single()

        if (updatePettyErr) throw updatePettyErr
        return { success: true, data: updatedPetty }
      }

      return { success: false, error: 'Data transaksi tidak ditemukan' }
    }

    // Pindah dari/ke RAB: aturan sama dengan DB (trg_expenses_jaga_rab).
    const keRab = adalahKategoriRab(input.category)
    const dariRab = currentExpense.type === TIPE_RAB
    if (keRab || dariRab) {
      const galat = cekAturanRab({
        kategoriBaru: input.category,
        outletId: actualOutletId,
        tanggalBaru: input.expenseDate,
        tipeLama: currentExpense.type ?? 'expense',
        tanggalLama: currentExpense.expense_date,
      })
      if (galat) return { success: false, error: galat }
    }
    if (keRab) {
      const payloadRab: Record<string, any> = {
        outlet_id: actualOutletId,
        category: KATEGORI_RAB,
        type: TIPE_RAB,
        amount: input.amount,
        description: input.description,
        expense_date: input.expenseDate,
        period_month: input.periodMonth || `${input.expenseDate.slice(0, 7)}-01`,
      }
      if (input.receipt_url !== undefined) payloadRab.receipt_url = input.receipt_url
      // undefined = rekening tidak diubah; null = lepas dari rekening pusat.
      if (input.cashLocationId !== undefined) payloadRab.cash_location_id = input.cashLocationId || null
      const rekeningRab = input.cashLocationId !== undefined ? input.cashLocationId : currentExpense.cash_location_id
      payloadRab.payment_source = rekeningRab ? 'petty_cash' : 'transfer_pusat'
      const { data, error: rabErr } = await supabase
        .from('expenses')
        .update(payloadRab)
        .eq('id', input.id)
        .select()
        .single()
      if (rabErr) return { success: false, error: rabErr.message }
      return { success: true, data }
    }

    let dbCategory = input.category
    let dbDescription = input.description

    if (currentExpense.description && currentExpense.description.includes('[OFFICE_VCR]')) {
      const v = deserializeVoucherFromRow(currentExpense)
      if (v) {
        dbCategory = isPusat ? 'pengeluaran_global' : input.category
        dbDescription = serializeVoucherToDescription({
          voucherNumber: v.voucherNumber,
          division: input.division || v.division,
          recipientName: input.recipient_name || v.recipientName,
          category: input.category,
          reason: input.description,
          advanceAmount: v.advanceAmount,
          realizedAmount: input.amount,
          refundAmount: Math.max(0, v.advanceAmount - input.amount),
          status: v.status,
          verifiedAt: v.verifiedAt,
          verifiedBy: v.verifiedBy,
          notes: v.notes
        })
      }
    } else {
      if (isPusat) {
        if (input.category === 'gaji_staff_kantor') {
          dbCategory = 'gaji_staff_kantor'
        } else {
          dbCategory = 'pengeluaran_global'
        }
        if (input.category !== 'pengeluaran_global' && input.category !== 'gaji_staff_kantor') {
          dbDescription = `[Kategori: ${input.category}] ${input.description}`
        }
      }
    }

    const yyyyMm = input.expenseDate.slice(0, 7)
    const periodMonth = input.periodMonth || `${yyyyMm}-01`

    const updatePayload: Record<string, any> = {
      outlet_id: actualOutletId,
      category: dbCategory,
      amount: input.amount,
      description: dbDescription,
      expense_date: input.expenseDate,
      period_month: periodMonth,
      payment_source: actualOutletId ? 'petty_cash' : 'transfer_pusat'
    }
    // Keluar dari RAB: kembali menjadi pengeluaran biasa (dihitung OPEX).
    if (dariRab) {
      updatePayload.type = 'expense'
    }

    if (input.receipt_url !== undefined) {
      updatePayload.receipt_url = input.receipt_url
    }

    if (input.cashLocationId !== undefined) {
      updatePayload.cash_location_id = input.cashLocationId || null
    }
    const rekeningPembayar = input.cashLocationId !== undefined ? input.cashLocationId : currentExpense.cash_location_id
    if (rekeningPembayar) {
      updatePayload.payment_source = 'petty_cash'
    }

    const { data, error: updateErr } = await supabase
      .from('expenses')
      .update(updatePayload)
      .eq('id', input.id)
      .select()
      .single()

    if (updateErr) {
      console.error('Error updating single expense:', updateErr)
      return { success: false, error: updateErr.message }
    }

    return { success: true, data }
  } catch (err: any) {
    console.error('Exception in updateSingleExpenseAction:', err)
    return { success: false, error: err?.message || 'Gagal memperbarui transaksi' }
  }
}

const URUTAN_GRUP_PEMBAYAR = ['utama', 'bahan_baku', 'petty_cash']

/** Rekening pusat aktif yang boleh membayar pengeluaran (semua grup; rekening lama tanpa grup tidak). */
export async function daftarRekeningPembayarAction(): Promise<{ id: string; label: string; kind: string; grup: string; saldo: number }[]> {
  await requireRole(PERAN_KEUANGAN)
  const { data, error } = await getServiceSupabase()
    .from('cash_location')
    .select('id, label, kind, grup, cash_balance(saldo)')
    .not('grup', 'is', null)
    .eq('is_active', true)
  if (error) throw new Error(error.message)
  return (data ?? [])
    .map((r: any) => {
      const bal = Array.isArray(r.cash_balance) ? r.cash_balance[0] : r.cash_balance
      return { id: r.id, label: r.label, kind: r.kind, grup: r.grup, saldo: Number(bal?.saldo ?? 0) }
    })
    .sort((x, y) =>
      URUTAN_GRUP_PEMBAYAR.indexOf(x.grup) - URUTAN_GRUP_PEMBAYAR.indexOf(y.grup) || x.kind.localeCompare(y.kind),
    )
}

/** Rekening pembayar yang tersimpan di satu baris pengeluaran (untuk mode edit). */
export async function ambilRekeningPembayarAction(expenseId: string): Promise<string | null> {
  await requireRole(PERAN_KEUANGAN)
  const { data, error } = await getServiceSupabase()
    .from('expenses')
    .select('cash_location_id')
    .eq('id', expenseId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data?.cash_location_id as string | null) ?? null
}
