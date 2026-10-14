import { cookies } from 'next/headers'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'
import { presetRange, previousRange, diffDays } from '@/lib/period'
import { buildLeaderboard } from '@/lib/leaderboard'
import { getOwnerDashboardDataFast } from '@/app/actions/ownerDashboard'
import OwnerDashboardView from './OwnerDashboardView'
import DashboardLoadError from './DashboardLoadError'
import type { SalesSource, PeriodFilterValue } from '@/lib/types'
import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/outletFilters'
import { hitungOpexLabaRugi, hitungWastePeriode } from '@/lib/server/opexLabaRugi'
import { requireRole, PERAN_KEUANGAN } from '@/lib/authz'
import { resolveCallerScope } from '@/lib/server/callerScope'

/** Di atas ini, hitungan acuan Laba Rugi terlalu berat untuk halaman pendaratan. */
const BATAS_HARI_ACUAN = 62

export const dynamic = 'force-dynamic'

export default async function OwnerDashboardPage({ searchParams }: { searchParams: Promise<any> }) {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {}
  })
  
  const [sp, userId] = await Promise.all([
    searchParams,
    getVerifiedUserId(supabase),
  ])
  
  // 1. Fetch User Profile, Outlets, Caller Scope & Financial Role Check in parallel
  const [
    { data: profile },
    { data: rawOutlets = [] },
    callerScope,
    hasKeuanganRole,
  ] = await Promise.all([
    supabase.from('users').select('role, outlet_id').eq('id', userId || '').maybeSingle(),
    supabase
      .from('outlets')
      .select('id, slug, name, address, lat, lng, type, is_active, marquee_warning_threshold')
      .neq('id', TEST_OUTLET_ID)
      .order('name'),
    resolveCallerScope().catch(() => undefined),
    requireRole(PERAN_KEUANGAN).then(() => true, () => false),
  ])

  const isReadOnly = profile?.role === 'MITRA'
  const lockedOutletId = isReadOnly ? profile?.outlet_id : null

  // 2. Build Filter from searchParams or Default (Default: Kemarin)
  const defaultRange = presetRange('yesterday')
  const filter: PeriodFilterValue = {
    from: sp.from || defaultRange.from,
    to: sp.to || defaultRange.to,
    outletId: lockedOutletId || sp.outletId || 'all',
    source: (sp.source as SalesSource) || 'all'
  }
  const prevFilter: PeriodFilterValue = { 
    ...filter, 
    ...previousRange({ from: filter.from, to: filter.to }) 
  }

  // 3. Prepare Outlets (Exclude Test Outlets)
  const outlets = (rawOutlets ?? []).filter(o => !isTestOutlet(o))
  const allOutletsWithSS = [
    { id: 'ss-online', name: 'SS ONLINE', type: 'online' } as any,
    ...outlets
  ]
  const scopedOutlets = lockedOutletId 
    ? outlets.filter(o => o.id === lockedOutletId) 
    : allOutletsWithSS

  // OPEX & waste mengacu ke Laba Rugi / Buku Kas (OPEX): angka RPC ringkasan
  // tidak memuat gaji & bonus HR. Dihitung di luar cache harian RPC karena gaji
  // bulan berjalan diprorata per hari. Hanya dipakai bila artinya memang sama
  // dengan Laba Rugi; di luar itu angka RPC (dan teks lama) tetap dipakai:
  //  - peran keuangan saja (mitra tidak boleh memuat data gaji),
  //  - tanpa filter kanal (OPEX tidak bisa dipecah per kanal penjualan),
  //  - rentang paling lama BATAS_HARI_ACUAN hari (jumlah kueri naik per bulan),
  //  - semua outlet atau satu outlet sungguhan.
  const pakaiAcuan =
    !isReadOnly &&
    filter.source === 'all' &&
    filter.outletId !== 'ss-online' &&
    filter.outletId !== 'PUSAT' &&
    diffDays(filter.from, filter.to) <= BATAS_HARI_ACUAN &&
    hasKeuanganRole

  const acuanLabaRugi = async (f: PeriodFilterValue) => {
    if (!pakaiAcuan) return null
    try {
      const [opex, waste] = await Promise.all([
        hitungOpexLabaRugi(f, outlets, { skipRoleCheck: true }),
        hitungWastePeriode(supabase, f),
      ])
      return { opex: opex.total, waste }
    } catch (err) {
      console.error('[owner-dashboard] OPEX acuan Laba Rugi gagal, memakai angka RPC:', err)
      return null
    }
  }

  // 4. Run Fast Aggregations in parallel (semua agregasi di PostgreSQL via RPC)
  // allSettled: kegagalan satu periode tidak boleh menjatuhkan seluruh halaman
  // jadi error 500 seperti sebelumnya. Acuan Laba Rugi ikut berjalan bersamaan
  // (tidak pernah melempar) supaya tidak menambah waktu tunggu.
  const [curRes, prevRes, curAcuan, prevAcuan] = await Promise.all([
    getOwnerDashboardDataFast(filter, scopedOutlets, callerScope).then(
      value => ({ status: 'fulfilled' as const, value }),
      reason => ({ status: 'rejected' as const, reason }),
    ),
    getOwnerDashboardDataFast(prevFilter, scopedOutlets, callerScope).then(
      value => ({ status: 'fulfilled' as const, value }),
      reason => ({ status: 'rejected' as const, reason }),
    ),
    acuanLabaRugi(filter),
    acuanLabaRugi(prevFilter),
  ])
  if (curRes.status === 'rejected') {
    console.error('[owner-dashboard] gagal memuat periode utama:', curRes.reason)
    return <DashboardLoadError />
  }
  const curData = curRes.value
  // Periode pembanding gagal → dashboard tetap tampil, hanya tanpa ▲▼%.
  const comparisonUnavailable = prevRes.status === 'rejected'
  if (comparisonUnavailable) {
    console.error('[owner-dashboard] gagal memuat periode pembanding:', prevRes.reason)
  }
  const prevData = prevRes.status === 'fulfilled'
    ? prevRes.value
    : { kpiRows: [], menuRows: [], totalCogs: 0, totalOpex: 0, totalCogsOpex: 0 }

  const curOpex = curAcuan ? curAcuan.opex : curData.totalOpex
  // Pembanding hanya sah bila kedua periode memakai rumus yang sama; kalau
  // tidak, ▲▼% OPEX dan Laba Bersih disembunyikan (bukan dihitung dari nol).
  const pembandingSepadan = curAcuan ? Boolean(prevAcuan) : true
  const prevOpex = curAcuan ? (prevAcuan?.opex ?? 0) : prevData.totalOpex
  const curWaste = curAcuan?.waste ?? 0
  const prevWaste = curAcuan ? (prevAcuan?.waste ?? 0) : 0
  // Margin pasokan bahan mitra: Laba Rugi Global mengakuinya sebagai pendapatan
  // pusat (HPP mitra di kartu COGS sudah ber-markup 10%). Hanya saat semua
  // outlet digabung — di situ kedua kantongnya sama-sama ada di layar.
  const akuiMargin = Boolean(curAcuan) && filter.outletId === 'all'
  const curMarginMitra = akuiMargin ? Number((curData as any).totalMitraMarkup || 0) : 0
  const prevMarginMitra = akuiMargin ? Number((prevData as any).totalMitraMarkup || 0) : 0

  const buyOneGetOne = curData.buyOneGetOne || { transactions: 0, giftUnits: 0 }
  // menu_rows sudah include dalam respons RPC masing-masing periode
  const menuSales     = curData.menuRows
  const prevMenuSales = prevData.menuRows

  const daysCount = diffDays(filter.from, filter.to)
  const leaderboard = buildLeaderboard(curData.kpiRows, prevData.kpiRows, daysCount)

  // 5. Send pre-computed data to Client View
  return (
    <OwnerDashboardView 
      filter={filter}
      outlets={scopedOutlets}
      lockedOutletId={lockedOutletId}
      isReadOnly={isReadOnly}
      role={profile?.role}
      curKpiRows={curData.kpiRows}
      prevKpiRows={prevData.kpiRows}
      hourlyRows={curData.hourlyRows}
      menuRows={menuSales}
      prevMenuRows={prevMenuSales}
      leaderboard={leaderboard}
      curCogs={curData.totalCogs}
      prevCogs={prevData.totalCogs}
      curOpex={curOpex}
      prevOpex={prevOpex}
      curCogsOpex={curData.totalCogs + curOpex}
      prevCogsOpex={prevData.totalCogs + prevOpex}
      curWaste={curWaste}
      prevWaste={prevWaste}
      curMarginMitra={curMarginMitra}
      prevMarginMitra={prevMarginMitra}
      opexAcuanLabaRugi={Boolean(curAcuan)}
      pembandingLabaSepadan={pembandingSepadan}
      cogsBreakdown={{ cogs: curData.totalCogs, opex: curOpex }}
      buyOneGetOne={buyOneGetOne}
      lastUpdated={curData.fetchedAt}
      isCached={curData.isCached}
      comparisonUnavailable={comparisonUnavailable}
    />
  )
}
