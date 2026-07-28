import React from 'react'
import { FinancePettyCashList } from './components/FinancePettyCashList'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { Wallet } from 'lucide-react'
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
    <div className="space-y-6 animate-fade-in">
      <div className="mb-4">
        <h1 className="text-2xl font-black text-suka-brown tracking-tight flex items-center gap-2.5">
          <Wallet className="w-7 h-7 text-suka-orange" />
          Pencairan Petty Cash (Treasury Finance)
        </h1>
        <p className="text-sm font-medium text-suka-gray-500 mt-2">
          Review pengajuan dana dari cabang-cabang dan proses pencairan via Transfer Bank atau Kas Pusat.
        </p>
      </div>

      <FinancePettyCashList initialRequests={initialRequests} />
    </div>
  )
}
