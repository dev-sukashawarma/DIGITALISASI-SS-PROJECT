import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { presetRange, previousRange } from '@/lib/period'
import { getOwnerDashboardData } from '@/app/actions/ownerDashboard'
import { getAggregatedMenuSales } from '@/app/actions/menuSales'
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
  
  // 1. Fetch profil mitra
  const { data: profile } = await supabase
    .from('mitra_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()
    
  if (!profile) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-20 text-center">
        <h2 className="text-xl font-bold mb-2">Profil Mitra Tidak Ditemukan</h2>
        <p className="text-gray-500">Akun Anda belum terdaftar sebagai Mitra. Silakan hubungi admin pusat untuk menambahkan profil Mitra Anda.</p>
      </div>
    )
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
  
  // 4. Hitung trend / omzet menggunakan agregasi Owner Dashboard
  // Kita gunakan preset '30d' sebagai default pandangan Mitra
  const defaultRange = presetRange('30d')
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

  // Fetch current data, previous data, and top menus
  const [curData, prevData, topMenus] = await Promise.all([
    getOwnerDashboardData(curFilter, outlets),
    getOwnerDashboardData(prevFilter, outlets),
    getAggregatedMenuSales({ ...curFilter, outletId: outletIds.length > 0 ? outletIds[0] : 'all' }) // Default fetch for their outlets
  ])
  
  // Fetch Recent Orders for Mitra
  let recentOrders: any[] = []
  if (outletIds.length > 0) {
    const { data: ords } = await supabase
      .from('orders')
      .select('id, created_at, customer_name, total_amount, status, sales_source, receipt_number')
      .in('outlet_id', outletIds)
      .order('created_at', { ascending: false })
      .limit(10)
    if (ords) recentOrders = ords
  }

  // 5. Fetch HPP Rate for outlets
  const hppMap: Record<string, number> = {}
  if (outletIds.length > 0) {
    const { data: hppData } = await supabase.rpc('get_hpp_periode', { 
      start_date: curFilter.from, 
      end_date: curFilter.to 
    })
    if (hppData) {
      hppData.forEach((h: any) => {
        if (outletIds.includes(h.outlet_id)) {
           hppMap[h.outlet_id] = Number(h.hpp_percentage) || 45
        }
      })
    }
  }

  // 6. Fetch Expenses from petty_cash_expenses and expenses
  let expenses: any[] = []
  if (outletIds.length > 0) {
    const [{ data: petty }, { data: regExp }] = await Promise.all([
      supabase.from('petty_cash_expenses')
        .select('*')
        .in('outlet_id', outletIds)
        .is('deleted_at', null)
        .gte('expense_date', curFilter.from)
        .lte('expense_date', curFilter.to),
      supabase.from('expenses')
        .select('*')
        .eq('type', 'out')
        .in('outlet_id', outletIds)
        .gte('expense_date', curFilter.from)
        .lte('expense_date', curFilter.to)
    ])
    
    expenses = [...(petty || []), ...(regExp || [])]
  }
  
  return (
    <MitraDashboardView 
      mitra={profile} 
      outlets={outlets} 
      investasiMap={investasiMap}
      curKpiRows={curData.kpiRows}
      prevKpiRows={prevData.kpiRows}
      hourlyRows={curData.hourlyRows}
      currentFilter={curFilter}
      hppMap={hppMap}
      expenses={expenses}
      topMenus={topMenus}
      recentOrders={recentOrders}
    />
  )
}
