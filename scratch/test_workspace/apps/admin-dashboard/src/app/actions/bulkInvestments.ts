'use server'

import { createSupabaseServerClient } from '@suka/auth'
import { cookies } from 'next/headers'

export async function bulkUpdateMitraInvestmentsAction(data: { outlet_id: string, nilai_investasi: number, omzet_historis: number }[]) {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  // Verify auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  if (!data || data.length === 0) {
    throw new Error('Data kosong')
  }

  // Get current investments to avoid overwriting other fields like start_date, notes
  const outletIds = data.map(d => d.outlet_id)
  const { data: existing } = await supabase
    .from('mitra_investments')
    .select('*')
    .in('outlet_id', outletIds)

  const existingMap = new Map()
  if (existing) {
    existing.forEach(e => existingMap.set(e.outlet_id, e))
  }

  const upsertPayload = data.map(d => {
    const ex = existingMap.get(d.outlet_id)
    return {
      outlet_id: d.outlet_id,
      nilai_investasi: d.nilai_investasi,
      omzet_historis: d.omzet_historis,
      tanggal_mulai: ex?.tanggal_mulai || new Date().toISOString(),
      catatan: ex?.catatan || null,
      transfer_historis: ex?.transfer_historis || 0,
      is_profit_sharing_active: ex?.is_profit_sharing_active ?? false,
      persentase_bagi_hasil: ex?.persentase_bagi_hasil ?? 50,
      management_fee: ex?.management_fee ?? 0
    }
  })

  const { error } = await supabase
    .from('mitra_investments')
    .upsert(upsertPayload, { onConflict: 'outlet_id' })

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}
