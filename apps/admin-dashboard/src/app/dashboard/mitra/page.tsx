import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { presetRange, previousRange, monthRange } from '@/lib/period'
import { getOwnerDashboardData } from '@/app/actions/ownerDashboard'
import { getAggregatedMenuSales } from '@/app/actions/menuSales'
import { getMitraRoiStats } from '@/app/actions/mitraRoi'
import { MitraDashboardView } from './MitraDashboardView'
import type { PeriodFilterValue } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function MitraDashboardPage({ searchParams }: { searchParams: Promise<any> }) {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })
  
  const sp = await searchParams

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return <div className="p-8 text-center text-gray-500">Akses ditolak. Sesi tidak valid.</div>
  }

  // Check if current user is Admin / Owner
  const { data: staffData } = await supabase
    .from('outlet_staff')
    .select('role')
    .eq('id', user.id)
    .single()
  
  const isAdminOrOwner = staffData?.role === 'admin' || staffData?.role === 'owner' || !staffData
  
  // 1. Fetch profil mitra (own profile or admin selected profile)
  let profile: any = null
  let allMitraProfiles: any[] = []

  // Check if user has their own mitra profile
  const { data: ownProfile } = await supabase
    .from('mitra_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (ownProfile) {
    profile = ownProfile
  } else if (isAdminOrOwner) {
    // Admin mode: fetch all mitra profiles
    const { data: allProfiles } = await supabase
      .from('mitra_profiles')
      .select('*')
      .order('nama_mitra', { ascending: true })
    
    allMitraProfiles = allProfiles || []

    if (sp.mitraId) {
      profile = allMitraProfiles.find(p => p.id === sp.mitraId || p.user_id === sp.mitraId)
    }
    
    if (!profile && allMitraProfiles.length > 0) {
      profile = allMitraProfiles[0]
    }
  }
    
  // If still no profile (even in admin mode or no mitra exists in DB yet)
  if (!profile) {
    if (isAdminOrOwner) {
      // Fallback for Admin: fetch all outlets to preview dashboard
      const { data: allOutlets } = await supabase.from('outlets').select('*').limit(5)
      const outletIds = (allOutlets || []).map(o => o.id)
      
      profile = {
        id: 'preview-admin',
        user_id: user.id,
        nama_mitra: 'Mitra Preview (Admin Mode)',
        outlet_ids: outletIds,
        bank_name: 'BCA',
        bank_account_number: '123-456-7890',
        bank_account_holder: 'Mitra Suka Shawarma',
        no_pks: 'PKS-PREVIEW/2026/001',
        tanggal_pks: '2026-01-01',
        tanggal_berakhir_pks: '2027-01-01',
        profit_sharing_pct: 50,
        status: 'aktif'
      }
    } else {
      return (
        <div className="p-8 max-w-lg mx-auto mt-20 text-center bg-white rounded-3xl border border-gray-200 shadow-sm">
          <h2 className="text-xl font-bold mb-2 text-gray-900">Profil Mitra Tidak Ditemukan</h2>
          <p className="text-gray-500 text-sm">Akun Anda belum terdaftar sebagai Mitra aktif. Silakan hubungi admin pusat Suka Shawarma untuk menambahkan profil Mitra Anda.</p>
        </div>
      )
    }
  }
  
  // 2. Fetch outlets
  const outletIds: string[] = profile.outlet_ids || []
  let outlets: any[] = []
  if (outletIds.length > 0) {
    const { data: out } = await supabase
      .from('outlets')
      .select('*')
      .in('id', outletIds)
    outlets = out || []
  }
  
  // 3. Fetch investasi
  const investasiMap: Record<string, number> = {}
  if (outletIds.length > 0) {
    const { data: inv } = await supabase
      .from('mitra_investments')
      .select('outlet_id, nilai_investasi')
      .in('outlet_id', outletIds)
      
    if (inv) {
      inv.forEach(i => {
        investasiMap[i.outlet_id] = Number(i.nilai_investasi)
      })
    }
  }
  
  // 4. Hitung trend / omzet menggunakan preset
  const defaultRange = presetRange('yesterday')
  const curFilter: PeriodFilterValue = {
    from: sp.from || defaultRange.from,
    to: sp.to || defaultRange.to,
    outletId: 'all',
    source: 'all'
  }
  
  const prevFilter: PeriodFilterValue = {
    ...curFilter,
    ...previousRange({ from: curFilter.from, to: curFilter.to })
  }

  let trendFilter = { ...curFilter }
  if (curFilter.from === curFilter.to && curFilter.from) {
    const [year, month] = curFilter.from.split('-').map(Number)
    const mRange = monthRange(year, month)
    trendFilter = { ...curFilter, from: mRange.from, to: mRange.to }
  }

  // Fetch current data, previous data, trend data, top menus, and ROI stats in parallel
  const [curData, prevData, trendData, topMenus, initialRoiData] = await Promise.all([
    getOwnerDashboardData(curFilter, outlets),
    getOwnerDashboardData(prevFilter, outlets),
    getOwnerDashboardData(trendFilter, outlets),
    getAggregatedMenuSales({ ...curFilter, outletId: outletIds.length > 0 ? outletIds[0] : 'all' }),
    outletIds.length > 0 
      ? getMitraRoiStats(outletIds.length === 1 ? outletIds[0] : 'all', outletIds).catch(() => ({ roi: 0, bepPercentage: 0 }))
      : Promise.resolve({ roi: 0, bepPercentage: 0 })
  ])
  
  // 5. Fetch Recent Orders for Mitra
  let recentOrders: any[] = []
  if (outletIds.length > 0) {
    const { data: ords } = await supabase
      .from('orders')
      .select('id, created_at, customer_name, total_amount, status, sales_source, receipt_number, outlet_id')
      .in('outlet_id', outletIds)
      .order('created_at', { ascending: false })
      .limit(10)
    if (ords) recentOrders = ords
  }

  // 6. Fetch Transfers
  let transfers: any[] = []
  if (outletIds.length > 0) {
    const { data: tf } = await supabase
      .from('mitra_transfers')
      .select('*')
      .in('outlet_id', outletIds)
      .order('bulan', { ascending: false })
    if (tf) transfers = tf
  }

  // 7. Fetch Staff (Crew & Leader)
  let staffList: any[] = []
  if (outletIds.length > 0) {
    const { data: st } = await supabase
      .from('outlet_staff')
      .select('id, name, role, status, outlet_id')
      .in('outlet_id', outletIds)
      .in('role', ['crew', 'leader'])
    if (st) {
      const hiddenNames = ['staff_new', 'Aang', 'Kasir Paledang', 'Test Cicurug']
      staffList = st.filter(s => !hiddenNames.includes(s.name))
    }
  }

  // 8. Fetch Saran / Suggestions
  let suggestionsList: any[] = []
  const { data: sg } = await supabase
    .from('mitra_suggestions')
    .select('*')
    .eq('user_id', profile.user_id || user.id)
    .order('created_at', { ascending: false })
  if (sg) suggestionsList = sg

  return (
    <MitraDashboardView 
      mitra={profile} 
      outlets={outlets} 
      investasiMap={investasiMap}
      curKpiRows={curData.kpiRows}
      prevKpiRows={prevData.kpiRows}
      trendKpiRows={trendData.kpiRows}
      trendFilter={trendFilter}
      hourlyRows={curData.hourlyRows}
      currentFilter={curFilter}
      topMenus={topMenus}
      recentOrders={recentOrders}
      initialTransfers={transfers}
      initialStaff={staffList}
      initialSuggestions={suggestionsList}
      initialRoiStats={initialRoiData}
      isAdminMode={isAdminOrOwner && !ownProfile}
      allMitraProfiles={allMitraProfiles}
    />
  )
}
