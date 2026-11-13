import { KelolaMitraView } from './KelolaMitraView'
import { presetRange } from '@/lib/period'
import { getMitraComprehensivePnl } from '@/app/actions/mitraPnl'
import { getMitraRealtimeBepBreakdown } from '@/app/actions/mitraRoi'
import { createServiceClient } from '@/lib/supabase/server'
import type { PeriodFilterValue } from '@/lib/types'
import { idOutletKemitraan } from '@/lib/mitra/outletKemitraan'

export const dynamic = 'force-dynamic'

export default async function KelolaMitraPage({ searchParams }: { searchParams: Promise<any> }) {
  const supabase = createServiceClient()
  
  const sp = await searchParams

  // 1-6. Ambil profil mitra, outlet, investasi, saran, staff, dan transfer secara paralel
  const [
    { data: mitraProfiles },
    { data: allOutlets },
    { data: investments },
    { data: suggestions },
    { data: staffList },
    { data: transfers }
  ] = await Promise.all([
    supabase
      .from('mitra_profiles')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('outlets')
      .select('id, name, type, is_active, status, deleted_at')
      .neq('id', 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a')
      .order('name', { ascending: true }),
    supabase
      .from('mitra_investments')
      .select('*'),
    supabase
      .from('mitra_suggestions')
      .select('*, outlets(name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('outlet_staff')
      .select('id, name, role, username')
      .in('role', ['mitra', 'MITRA'])
      .order('name', { ascending: true }),
    supabase
      .from('mitra_transfers')
      .select('*, outlets(name)')
      .order('bulan', { ascending: false })
  ])
    
  // Format user list for dropdown
  const allUsers = (staffList || []).map(s => ({
    id: s.id,
    name: s.name || s.username || 'Tanpa Nama',
    username: s.username || '-',
    role: s.role || 'staff'
  }))

  // 7. Outlet yang tampil sebagai kartu: punya data kemitraan, atau outlet mitra
  //    yang masih aktif/Persiapan. Outlet mitra nonaktif tanpa data disembunyikan.
  const mitraOutletIds = idOutletKemitraan({
    outlets: allOutlets || [],
    profiles: mitraProfiles || [],
    investments: investments || [],
    transfers: transfers || [],
  })

  // 8. Filter Periode
  const defaultRange = presetRange('yesterday')
  const curFilter: PeriodFilterValue = {
    from: sp.from || defaultRange.from,
    to: sp.to || defaultRange.to,
    outletId: sp.outletId || 'all',
    source: 'all'
  }

  // 9. Ambil Comprehensive P&L untuk jaringan mitra & Realtime BEP
  let pnlData = null
  let realtimeBepMap: any = {}
  try {
    if (mitraOutletIds.length > 0) {
      const [pnlRes, bepRes] = await Promise.all([
        getMitraComprehensivePnl(
          curFilter,
          curFilter.outletId === 'all' ? 'all' : curFilter.outletId,
          mitraOutletIds
        ),
        getMitraRealtimeBepBreakdown(mitraOutletIds)
      ])
      pnlData = pnlRes
      realtimeBepMap = bepRes
    }
  } catch (err) {
    console.error('Error fetching internal mitra PnL / BEP:', err)
  }

  return (
    <KelolaMitraView 
      mitraProfiles={mitraProfiles || []} 
      allOutlets={allOutlets || []} 
      investments={investments || []}
      suggestions={suggestions || []}
      allUsers={allUsers}
      transfers={transfers || []}
      initialPnlData={pnlData}
      currentFilter={curFilter}
      mitraOutletIds={mitraOutletIds}
      realtimeBepMap={realtimeBepMap}
    />
  )
}
