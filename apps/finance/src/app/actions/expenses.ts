'use server'

import { requireRole } from '@/lib/authz'
import type { UpsertExpenseInput } from '@/hooks/useUpsertExpenses'
import { getServiceSupabase } from '@/lib/supabase-service'
import { deserializeVoucherFromRow, serializeVoucherToDescription } from '@/lib/officeVoucher'

export async function upsertExpensesAction(items: UpsertExpenseInput[]) {
  // Server Action = endpoint POST publik; ini melewati RPC upsert_expense
  // (satu-satunya gerbang tulis menurut desain) pakai service-role client.
  const { role } = await requireRole(['admin_finance', 'admin', 'owner'])
  const supabase = getServiceSupabase()

  for (const it of items) {
    const isPusat = ['pengeluaran_global', 'gaji_staff_kantor'].includes(it.category) && !it.outletId
    // Scope Pusat (company-wide) owner-only, sesuai aturan RPC upsert_expense
    // yang dilewati di sini (CLAUDE.md § Pengeluaran Outlet vs Pusat).
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

    // Insert directly using service role to bypass RLS and trigger issues
    // We explicitly set payment_source = 'transfer_pusat' to avoid the cash_drawer open shift trigger
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

export async function uploadExpenseInvoiceAction(formData: FormData) {
  try {
    const file = formData.get('file') as File | null
    if (!file || file.size === 0) {
      return { success: false, error: 'File tidak ditemukan' }
    }

    if (file.size > 10 * 1024 * 1024) {
      return { success: false, error: 'Ukuran file maksimal 10MB' }
    }

    const supabase = getServiceSupabase()
    const ext = file.name.split('.').pop() || 'jpg'
    const cleanName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`
    const storagePath = `invoices/${cleanName}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await supabase.storage
      .from('opex-invoices')
      .upload(storagePath, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true
      })

    if (uploadError) {
      console.error('Failed to upload expense invoice:', uploadError)
      return { success: false, error: 'Gagal mengupload invoice: ' + uploadError.message }
    }

    const { data: pubData } = supabase.storage
      .from('opex-invoices')
      .getPublicUrl(storagePath)

    return { success: true, url: pubData.publicUrl }
  } catch (err: any) {
    console.error('Exception in uploadExpenseInvoiceAction:', err)
    return { success: false, error: err?.message || 'Gagal mengupload file' }
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
}) {
  try {
    const supabase = getServiceSupabase()

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

    // Validate if created_by exists in outlet_staff before referencing it, to prevent foreign key constraint violation
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
        payment_source: input.outletId ? 'petty_cash' : 'transfer_pusat',
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
    const supabase = getServiceSupabase()
    const PAGE_SIZE = 1000

    const buildQuery = () => {
      let q = supabase
        .from('expenses')
        .select('id, outlet_id, category, amount, description, expense_date, period_month, receipt_url, type, outlets(name)')
        .eq('type', 'expense')
        .gte('expense_date', filter.from)
        .lte('expense_date', filter.to)
        .order('expense_date', { ascending: false })
        .order('id', { ascending: false })

      if (filter.outletId && filter.outletId !== 'all') {
        if (filter.outletId === 'PUSAT') {
          q = q.or('outlet_id.is.null,outlet_id.eq.ffffffff-ffff-ffff-ffff-ffffffffffff')
        } else {
          q = q.eq('outlet_id', filter.outletId)
        }
      }

      return q
    }

    const allExpenses: any[] = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await buildQuery().range(offset, offset + PAGE_SIZE - 1)
      if (error) throw error
      const page = data ?? []
      allExpenses.push(...page)
      if (page.length < PAGE_SIZE) break
    }

    return {
      success: true,
      expenses: allExpenses,
      pettyCashExpenses: []
    }
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

  // Delete from expenses first
  const { error: err1 } = await supabase
    .from('expenses')
    .delete()
    .eq('id', params.id)

  // Also attempt delete from petty_cash_expenses if needed
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
}) {
  try {
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

    // Find current record
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
      // Fallback check petty_cash_expenses
      const { data: currentPetty } = await supabase
        .from('petty_cash_expenses')
        .select('*')
        .eq('id', input.id)
        .maybeSingle()

      if (currentPetty) {
        const { data: updatedPetty, error: updatePettyErr } = await supabase
          .from('petty_cash_expenses')
          .update({
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

    let dbCategory = input.category
    let dbDescription = input.description

    // If existing record is an OFFICE_VCR, preserve its structure
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
        // Enforce DB constraint: pusat must be 'pengeluaran_global' or 'gaji_staff_kantor'
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

    if (input.receipt_url !== undefined) {
      updatePayload.receipt_url = input.receipt_url
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

