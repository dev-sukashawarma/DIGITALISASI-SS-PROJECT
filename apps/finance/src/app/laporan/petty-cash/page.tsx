import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@suka/auth'
import { presetRange } from '@/lib/period'
import { requireRole, PERAN_KEUANGAN } from '@/lib/authz'
import { getPettyCashData } from '@/lib/server/pettyCashReport'
import { TEST_OUTLET_ID } from '@/lib/outletFilters'
import PettyCashPageClient from './PettyCashPageClient'
import type { SalesSource, PeriodFilterValue, Outlet } from '@/lib/types'

export const dynamic = 'force-dynamic'

/** Salinan halaman "Petty Cash (Khusus)" admin-dashboard (/dashboard/owner/petty-cash). */
export default async function LaporanPettyCashPage({ searchParams }: { searchParams: Promise<any> }) {
  try {
    await requireRole(PERAN_KEUANGAN)
  } catch {
    redirect('/')
  }

  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const sp = await searchParams
  const defaultRange = presetRange('today')
  const filter: PeriodFilterValue = {
    from: sp.from || defaultRange.from,
    to: sp.to || defaultRange.to,
    outletId: sp.outletId || 'all',
    source: (sp.source as SalesSource) || 'all',
  }

  const { data: outlets } = await supabase
    .from('outlets')
    .select('id, slug, name, address, lat, lng, type, is_active')
    .neq('id', TEST_OUTLET_ID)
    .order('name')

  const list = (outlets ?? []) as Outlet[]
  const { transactions, dailySummaries } = await getPettyCashData(filter, list)

  return (
    <PettyCashPageClient
      filter={filter}
      outlets={list}
      lockedOutletId={null}
      pettyCashTransactions={transactions}
      dailySummaries={dailySummaries}
    />
  )
}
