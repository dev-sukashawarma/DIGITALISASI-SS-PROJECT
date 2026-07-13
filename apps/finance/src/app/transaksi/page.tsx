import React from 'react'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { TransaksiView } from './components/TransaksiView'
import type { CashLocation, CashBalance, CashTransaction } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function TransaksiPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const [locationsRes, balancesRes, txsRes] = await Promise.all([
    supabase.from('cash_location').select('*').order('kind', { ascending: true }).order('label', { ascending: true }),
    supabase.from('cash_balance').select('*'),
    supabase.from('cash_transaction').select('*, cash_location:cash_location_id(label, kind), outlet:outlet_id(name)').order('occurred_at', { ascending: false }).limit(100)
  ])

  return (
    <TransaksiView 
      initialLocations={(locationsRes.data as CashLocation[]) || []}
      initialBalances={(balancesRes.data as CashBalance[]) || []}
      initialTxs={(txsRes.data as unknown as CashTransaction[]) || []}
    />
  )
}
