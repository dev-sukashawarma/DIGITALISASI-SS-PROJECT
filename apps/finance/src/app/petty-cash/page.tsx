import React from 'react'
import { FinancePettyCashList } from './components/FinancePettyCashList'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import type { PettyCashTopup } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function FinancePettyCashPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const { data } = await supabase
    .from('petty_cash_topups')
    .select(`
      *,
      outlet_staff!petty_cash_topups_created_by_fkey(name),
      outlets!petty_cash_topups_outlet_id_fkey(name)
    `)
    .order('created_at', { ascending: false })

  let initialRequests: PettyCashTopup[] = []
  if (data) {
    initialRequests = (data as any[]).map(row => ({
      ...row,
      reason: row.description,
      outlet_staff: row.outlet_staff ? { name: row.outlet_staff.name } : null,
      outlet: row.outlets ? { id: row.outlet_id, name: row.outlets.name } : null
    }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-suka-brown">Pencairan Petty Cash</h1>
        <p className="text-suka-gray-500 mt-1">Daftar pengajuan petty cash yang sudah disetujui Leader dan siap dicairkan.</p>
      </div>

      <FinancePettyCashList initialRequests={initialRequests} />
    </div>
  )
}
