import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getDefaultDashboardPath, isAdminLike, isMelani } from '@/lib/access-control'
import { getPosSupabase } from '@/lib/supabase-pos'
import ReportsView from '@/components/penjualan/ReportsView'
import { laporanPosUntukScope } from '@/lib/penjualan/posReport/laporan'
import { isTestOutlet } from '@/lib/laba-rugi/outletFilters'
import { addDaysStr, jakartaDate } from '@/lib/penjualan/ownerDashboardCache'

export const dynamic = 'force-dynamic'

export default async function MarcomPenjualanPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!isMelani(user.email) && !isAdminLike(user.role)) {
    redirect(getDefaultDashboardPath(user.email))
  }

  const supabase = getPosSupabase()
  const { data: outletsData } = await supabase
    .from('outlets')
    .select('id, name, address, phone, type, status, is_active, deleted_at, created_at, updated_at')
    .order('name')

  const initialOutlets = outletsData || []
  const visibleOutlets = initialOutlets.filter((o: any) => !isTestOutlet(o))
  const today = jakartaDate(new Date())
  const isSingleOutlet = visibleOutlets.length === 1
  const from = isSingleOutlet ? addDaysStr(today, -1) : `${today.slice(0, 8)}01`
  const to = isSingleOutlet ? from : today
  const initialRequest = {
    from,
    to,
    outlets: isSingleOutlet ? [visibleOutlets[0].id] : ['all'],
    channels: ['all'],
    paymentMethod: 'all',
    receiptFilter: 'all',
    search: '',
    page: 1,
    pageSize: 10,
    isPawoonVisible: new Date(from) < new Date('2026-08-01'),
  }

  let initialReport = null
  try {
    initialReport = await laporanPosUntukScope(initialRequest, {
      supabase,
      scopeKey: 'all',
      allowedOutletIds: 'all',
    })
  } catch (err) {
    console.error('[marcom/penjualan] gagal menyiapkan data awal:', err)
  }

  return (
    <ReportsView
      initialOutlets={initialOutlets as any}
      initialReport={initialReport}
      initialRequestKey={initialReport ? JSON.stringify(initialRequest) : null}
    />
  )
}
