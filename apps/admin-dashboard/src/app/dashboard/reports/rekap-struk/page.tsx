import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'
import RekapStrukView from './RekapStrukView'
import { laporanRekapStrukUntukScope } from '@/lib/posReport/laporanStruk'
import { isTestOutlet } from '@/lib/outletFilters'
import { addDaysStr, jakartaDate } from '@/lib/ownerDashboardCache'

export const dynamic = 'force-dynamic'

export default async function RekapStrukPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const userId = await getVerifiedUserId(supabase)
  if (!userId) redirect('/login')

  const [{ data: staff }, { data: outletsData }] = await Promise.all([
    supabase
      .from('outlet_staff')
      .select('role')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('outlets')
      .select('id, name, address, phone, type, status, is_active, deleted_at, created_at, updated_at')
      .order('name'),
  ])

  const userRole = staff?.role?.toLowerCase()
  const allowed = ['developer', 'owner', 'admin']
  if (!userRole || !allowed.includes(userRole)) {
    redirect('/dashboard')
  }

  const initialOutlets = (outletsData || []).filter(
    (o: any) => !isTestOutlet(o) && o.type !== 'marketplace'
  )

  const today = jakartaDate(new Date())
  const isSingleOutlet = initialOutlets.length === 1
  const from = isSingleOutlet ? addDaysStr(today, -1) : `${today.slice(0, 8)}01`
  const to = isSingleOutlet ? from : today

  const initialRequest = {
    from,
    to,
    outlets: isSingleOutlet ? [initialOutlets[0].id] : ['all'],
    channels: ['all'],
    skipKindFilter: 'all_not_printed' as const,
    outletDrilldown: 'all',
    cashierDrilldown: 'all',
    paymentMethod: 'all',
    search: '',
    page: 1,
    pageSize: 15,
    isPawoonVisible: new Date(from) < new Date('2026-08-01'),
  }

  let initialReport = null
  try {
    initialReport = await laporanRekapStrukUntukScope(initialRequest, {
      supabase,
      scopeKey: 'all',
      allowedOutletIds: 'all',
    })
  } catch (err) {
    console.error('[reports/rekap-struk] gagal menyiapkan data awal:', err)
  }

  return (
    <RekapStrukView
      initialOutlets={initialOutlets as any}
      initialReport={initialReport}
      initialRequestKey={initialReport ? JSON.stringify(initialRequest) : null}
    />
  )
}
