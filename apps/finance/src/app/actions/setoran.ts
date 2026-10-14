'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/authz'
import { getServiceSupabase } from '@/lib/supabase-service'

const FINANCE_ROLES = ['admin_finance', 'admin', 'owner']

export async function updateCashDepositMethodAction(input: {
  id: string
  newLocationId: string
}) {
  await requireRole(FINANCE_ROLES)

  if (!input.id || !input.newLocationId) {
    throw new Error('ID transaksi dan lokasi tujuan wajib diisi')
  }

  const supabase = getServiceSupabase()

  const { data: tx, error: txErr } = await supabase
    .from('cash_transaction')
    .select('id, cash_location_id, status, source_type')
    .eq('id', input.id)
    .maybeSingle()

  if (txErr) throw new Error(txErr.message)
  if (!tx) throw new Error('Data transaksi setoran tidak ditemukan')
  if (tx.source_type !== 'cash_deposit') {
    throw new Error('Hanya transaksi setoran yang dapat diubah melalui fitur ini')
  }

  const { data: loc, error: locErr } = await supabase
    .from('cash_location')
    .select('id, label, kind, scope, is_active')
    .eq('id', input.newLocationId)
    .maybeSingle()

  if (locErr) throw new Error(locErr.message)
  if (!loc || loc.is_active === false) {
    throw new Error('Rekening atau kas tujuan tidak ditemukan / nonaktif')
  }
  if (loc.scope !== 'pusat') {
    throw new Error('Setoran harus ke rekening/kas pusat')
  }

  const newCategory = loc.kind === 'bank' ? 'Setoran Bank' : 'Setoran Tunai'
  const affectsBalance = tx.status === 'reconciled' || tx.status === 'paid'

  if (tx.cash_location_id !== input.newLocationId && affectsBalance) {
    // 1. Ubah status ke 'void' terlebih dahulu agar trigger trg_cash_apply_balance
    //    mengurangi saldo di lokasi kas/bank lama secara atomik.
    const { error: voidErr } = await supabase
      .from('cash_transaction')
      .update({ status: 'void' })
      .eq('id', tx.id)

    if (voidErr) throw new Error(voidErr.message)

    // 2. Pindahkan ke lokasi baru & kembalikan status semula agar trigger
    //    menambahkan saldo ke lokasi kas/bank baru.
    const { error: moveErr } = await supabase
      .from('cash_transaction')
      .update({
        cash_location_id: input.newLocationId,
        category: newCategory,
        status: tx.status,
      })
      .eq('id', tx.id)

    if (moveErr) {
      // Rollback status ke semula jika gagal
      await supabase
        .from('cash_transaction')
        .update({ status: tx.status })
        .eq('id', tx.id)
      throw new Error(moveErr.message)
    }
  } else {
    const { error: updErr } = await supabase
      .from('cash_transaction')
      .update({
        cash_location_id: input.newLocationId,
        category: newCategory,
      })
      .eq('id', tx.id)

    if (updErr) throw new Error(updErr.message)
  }

  revalidatePath('/setoran')
  revalidatePath('/setoran/history')

  return { success: true, locationLabel: loc.label }
}

export async function deleteCashDepositAction(input: { id: string }) {
  await requireRole(FINANCE_ROLES)

  if (!input.id) {
    throw new Error('ID transaksi wajib diisi')
  }

  const supabase = getServiceSupabase()

  const { data: tx, error: txErr } = await supabase
    .from('cash_transaction')
    .select('id, status, source_type')
    .eq('id', input.id)
    .maybeSingle()

  if (txErr) throw new Error(txErr.message)
  if (!tx) throw new Error('Data transaksi setoran tidak ditemukan')
  if (tx.source_type !== 'cash_deposit') {
    throw new Error('Hanya transaksi setoran yang dapat dihapus melalui fitur ini')
  }

  const affectsBalance = tx.status === 'reconciled' || tx.status === 'paid'

  if (affectsBalance) {
    // 1. Set status ke 'void' terlebih dahulu agar trigger trg_cash_apply_balance
    //    membalikkan (mengurangi kembali) saldo pada cash_balance.
    const { error: voidErr } = await supabase
      .from('cash_transaction')
      .update({ status: 'void' })
      .eq('id', tx.id)

    if (voidErr) throw new Error(voidErr.message)
  }

  // 2. Hapus baris transaksi dari cash_transaction
  const { error: delErr } = await supabase
    .from('cash_transaction')
    .delete()
    .eq('id', tx.id)

  if (delErr) {
    if (affectsBalance) {
      await supabase
        .from('cash_transaction')
        .update({ status: tx.status })
        .eq('id', tx.id)
    }
    throw new Error(delErr.message)
  }

  revalidatePath('/setoran')
  revalidatePath('/setoran/history')

  return { success: true }
}
