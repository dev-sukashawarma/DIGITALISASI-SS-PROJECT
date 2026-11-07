import { cookies } from 'next/headers'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'
import { presetRange, previousRange, monthRange } from '@/lib/period'
import { getOwnerDashboardData } from '@/app/actions/ownerDashboard'
import { getAggregatedMenuSales } from '@/app/actions/menuSales'
import { getMitraRoiStats } from '@/app/actions/mitraRoi'
import { MitraDashboardView } from './MitraDashboardView'
import { createServiceClient } from '@/lib/supabase/server'
import { COOKIE_PRATINJAU_MITRA, pilihProfilPratinjau } from '@/lib/mitraPratinjau'
import type { PeriodFilterValue } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function MitraDashboardPage({ searchParams }: { searchParams: Promise<any> }) {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })
  
  const sp = await searchParams

  const userId = await getVerifiedUserId(supabase)
  if (!userId) {
    return <div className="p-8 text-center text-gray-500">Akses ditolak. Sesi tidak valid.</div>
  }

  // Check if current user is Admin / Owner
  const { data: staffData } = await supabase
    .from('outlet_staff')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  // Fail-closed. Dulu `|| !staffData` membuat baris outlet_staff yang gagal
  // dibaca (RLS, error jaringan, akun belum ter-link) diperlakukan sebagai
  // admin — dan cabang admin di bawah menarik 5 outlet sembarang untuk
  // ditampilkan. Tidak ada data staff = tidak ada hak istimewa.
  const isAdminOrOwner = staffData?.role === 'admin' || staffData?.role === 'owner' || staffData?.role === 'developer'
  
  // 1. Fetch profil mitra (own profile or admin selected profile)
  let profile: any = null

  // Check if user has their own mitra profile
  const { data: ownProfile } = await supabase
    .from('mitra_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  // Mode pratinjau (admin/owner/developer tanpa profil mitra): data mitra dibaca lewat
  // service client. Perannya sudah diverifikasi di atas, dan RLS tabel mitra_* hanya
  // mengenal admin & owner — tanpa ini developer melihat halaman kosong.
  // Untuk akun mitra, `db` tetap klien miliknya sendiri (tunduk RLS seperti biasa).
  const modePratinjau = isAdminOrOwner && !ownProfile
  const db = modePratinjau ? createServiceClient() : supabase

  if (ownProfile) {
    profile = ownProfile
  } else if (isAdminOrOwner) {
    // Mitra yang dipratinjau = pilihan di cookie; layout.tsx memilih dengan cara yang sama.
    const { data: allProfiles } = await db
      .from('mitra_profiles')
      .select('*')
      .order('nama_mitra', { ascending: true })

    profile = pilihProfilPratinjau(allProfiles || [], cookieStore.get(COOKIE_PRATINJAU_MITRA)?.value) ?? null
  }
    
  // If still no profile (even in admin mode or no mitra exists in DB yet)
  if (!profile) {
    if (isAdminOrOwner) {
      // Fallback for Admin: fetch all outlets to preview dashboard
      const { data: allOutlets } = await db.from('outlets').select('*').limit(5)
      const outletIds = (allOutlets || []).map(o => o.id)
      
      profile = {
        id: 'preview-admin',
        user_id: userId,
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
    const { data: out } = await db
      .from('outlets')
      .select('*')
      .in('id', outletIds)
    outlets = out || []
  }
  
  // 3. Fetch investasi
  const investasiMap: Record<string, number> = {}
  if (outletIds.length > 0) {
    const { data: inv } = await db
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
  const trendSamaDenganCur = !(curFilter.from === curFilter.to && curFilter.from)
  if (!trendSamaDenganCur) {
    const [year, month] = curFilter.from.split('-').map(Number)
    const mRange = monthRange(year, month)
    trendFilter = { ...curFilter, from: mRange.from, to: mRange.to }
  }

  // Outlet yang dipakai menghitung ROI di server. Dikirim ke view supaya angka
  // ini hanya dipakai bila outlet terpilih di browser sama persis.
  const roiOutletKey = outletIds.length === 1 ? outletIds[0] : 'all'

  // Fetch current data, previous data, trend data, top menus, and ROI stats in parallel
  const [curData, prevData, trendDataTerpisah, topMenus, initialRoiData] = await Promise.all([
    getOwnerDashboardData(curFilter, outlets),
    getOwnerDashboardData(prevFilter, outlets),
    // Rentang lebih dari 1 hari: tren = periode utama, tak perlu diambil dua kali.
    trendSamaDenganCur ? null : getOwnerDashboardData(trendFilter, outlets),
    // 'all' = seluruh outlet yang boleh diakses mitra ini (view menu_sales_scoped
    // sudah dibatasi accessible_outlet_ids()). Dulu terkunci ke outletIds[0],
    // jadi mitra multi-outlet selalu melihat menu outlet pertama saja.
    // Pergantian outlet di dropdown ditangani ulang di sisi klien.
    getAggregatedMenuSales({ ...curFilter, outletId: 'all' }),
    outletIds.length > 0 
      ? getMitraRoiStats(roiOutletKey, outletIds).then(r => ({ ...r, ok: true })).catch(() => ({ 
          ok: false,
          roi: 0, 
          bepPercentage: 0,
          totalProfitKumulatif: 0,
          systemProfitMitra: 0,
          historisProfitMitra: 0,
          nilaiInvestasi: 0
        }))
      : Promise.resolve({ 
          roi: 0, 
          bepPercentage: 0,
          totalProfitKumulatif: 0,
          systemProfitMitra: 0,
          historisProfitMitra: 0,
          nilaiInvestasi: 0
        })
  ])
  
  const trendData = trendDataTerpisah ?? curData

  // Order terbaru, transfer, staff, dan saran dulu diambil di sini tetapi tidak
  // pernah dirender MitraDashboardView — dihapus agar tiap load tak menunggu 4 query.

  // Akun mitra hanya menerima baris outletnya sendiri (dibatasi di database). Di mode
  // pratinjau pemanggilnya admin, jadi barisnya mencakup semua outlet — dipersempit di
  // sini supaya grafik tren persis seperti yang dilihat mitra itu.
  const hanyaOutletMitra = <T extends { outlet_id?: string | null }>(rows: T[]): T[] =>
    modePratinjau ? rows.filter(r => !!r.outlet_id && outletIds.includes(r.outlet_id)) : rows

  return (
    <MitraDashboardView 
      mitra={profile} 
      outlets={outlets} 
      investasiMap={investasiMap}
      curKpiRows={hanyaOutletMitra(curData.kpiRows)}
      prevKpiRows={hanyaOutletMitra(prevData.kpiRows)}
      trendKpiRows={hanyaOutletMitra(trendData.kpiRows)}
      trendFilter={trendFilter}
      hourlyRows={curData.hourlyRows}
      currentFilter={curFilter}
      topMenus={topMenus}
      initialRoiStats={initialRoiData}
      roiOutletKey={roiOutletKey}
      lastUpdated={curData.fetchedAt}
      isCached={curData.isCached}
    />
  )
}
