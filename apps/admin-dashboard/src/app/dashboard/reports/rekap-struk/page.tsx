import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'
import RekapStrukView from './RekapStrukView'
import { laporanRekapStrukUntukScope } from '@/lib/posReport/laporanStruk'
import { isTestOutlet } from '@/lib/outletFilters'
import { addDaysStr, isDateStr, jakartaDate } from '@/lib/ownerDashboardCache'

export const dynamic = 'force-dynamic'

interface RekapStrukPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function getStr(val: string | string[] | undefined, fallback = ''): string {
  if (typeof val === 'string') return val
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0]
  return fallback
}

export default async function RekapStrukPage({ searchParams }: RekapStrukPageProps) {
  const params = await searchParams
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
  const defaultFrom = isSingleOutlet ? addDaysStr(today, -1) : `${today.slice(0, 8)}01`
  const defaultTo = isSingleOutlet ? defaultFrom : today

  const rawFrom = getStr(params.from)
  const rawTo = getStr(params.to)
  const from = isDateStr(rawFrom) ? rawFrom : defaultFrom
  const to = isDateStr(rawTo) && rawTo >= from ? rawTo : defaultTo
  const initialRange = getStr(params.range) || (isSingleOutlet ? 'yesterday' : 'thisMonth')
  const rawOutlets = getStr(params.outlets)
  const outlets = rawOutlets
    ? rawOutlets.split(',').map((s) => s.trim()).filter(Boolean)
    : isSingleOutlet
    ? [initialOutlets[0].id]
    : ['all']
  const rawChannels = getStr(params.channels)
  const channels = rawChannels
    ? rawChannels.split(',').map((s) => s.trim()).filter(Boolean)
    : ['all']
  const initialAm = getStr(params.am) || 'all'

  const initialRequest = {
    from,
    to,
    outlets,
    channels,
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
      initialFilterState={{
        range: initialRange as any,
        from,
        to,
        outlets,
        am: initialAm,
        channels,
      }}
    />
  )
}
