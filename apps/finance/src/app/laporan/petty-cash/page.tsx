import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@suka/auth'
import { presetRange } from '@/lib/period'
import { requireRole, PERAN_KEUANGAN } from '@/lib/authz'
import { getPettyCashData } from '@/lib/server/pettyCashReport'
import { ambilSaldoPettyCash } from '@/lib/server/saldoPettyCash'
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
  // Saldo terkini: outlet operasional aktif saja (internal & mitra, tanpa SS Backup).
  const outletKas = list.filter((o) => o.is_active && (o.type === 'internal' || o.type === 'mitra') && o.slug !== 'ss-backup')
  const [{ transactions, dailySummaries }, saldoOutlet] = await Promise.all([
    getPettyCashData(filter, list),
    ambilSaldoPettyCash(outletKas),
  ])

  return (
    <PettyCashPageClient
      filter={filter}
      outlets={list}
      lockedOutletId={null}
      pettyCashTransactions={transactions}
      dailySummaries={dailySummaries}
      saldoOutlet={saldoOutlet}
    />
  )
}
