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
    <div className="space-y-8 font-sans animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-suka-orange font-bold uppercase tracking-wider text-sm mb-1">Pengajuan Cabang</p>
          <h1 className="font-display text-4xl md:text-5xl text-suka-brown tracking-wide flex items-center gap-3">
            <Wallet className="w-10 h-10 text-suka-orange" />
            Pencairan Petty Cash
          </h1>
          <p className="text-suka-ink/60 mt-2 font-medium">
            Review pengajuan dana dari cabang-cabang dan proses pencairan via Transfer Bank atau Kas Pusat.
          </p>
        </div>
      </div>

      <FinancePettyCashList initialRequests={initialRequests} />
    </div>
  )
}
