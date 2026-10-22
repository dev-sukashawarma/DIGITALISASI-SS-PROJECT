import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'
import DetailKasirStrukView from './DetailKasirStrukView'
import { laporanDetailKasirStrukUntukScope } from '@/lib/posReport/laporanStruk'
import { isDateStr, jakartaDate } from '@/lib/ownerDashboardCache'

export const dynamic = 'force-dynamic'

interface DetailKasirPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function getStr(val: string | string[] | undefined, fallback = ''): string {
  if (typeof val === 'string') return val
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0]
  return fallback
}

export default async function DetailKasirStrukPage({ searchParams }: DetailKasirPageProps) {
  const params = await searchParams
  const outletId = getStr(params.outletId).trim()
  const cashierName = getStr(params.cashier).trim()

  if (!outletId || !cashierName) {
    redirect('/dashboard/reports/rekap-struk')
  }

  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const userId = await getVerifiedUserId(supabase)
  if (!userId) redirect('/login')

  const { data: staff } = await supabase
    .from('outlet_staff')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  const userRole = staff?.role?.toLowerCase()
  const allowed = ['developer', 'owner', 'admin']
  if (!userRole || !allowed.includes(userRole)) {
    redirect('/dashboard')
  }

  const today = jakartaDate(new Date())
  const rawFrom = getStr(params.from)
  const rawTo = getStr(params.to)
  const from = isDateStr(rawFrom) ? rawFrom : `${today.slice(0, 8)}01`
  const to = isDateStr(rawTo) && rawTo >= from ? rawTo : today

  const rawChannels = getStr(params.channels)
  const channels = rawChannels
    ? rawChannels.split(',').map((s) => s.trim()).filter(Boolean)
    : ['all']

  // Bangun URL kembali ke halaman utama dengan menjaga filter sebelumnya
  const backParams = new URLSearchParams()
  const rangeParam = getStr(params.range)
  const outletsParam = getStr(params.outlets)
  const amParam = getStr(params.am)
  if (rangeParam) backParams.set('range', rangeParam)
  if (from) backParams.set('from', from)
  if (to) backParams.set('to', to)
  if (outletsParam) backParams.set('outlets', outletsParam)
  if (amParam && amParam !== 'all') backParams.set('am', amParam)
  if (rawChannels && rawChannels !== 'all') backParams.set('channels', rawChannels)
  const backHref = `/dashboard/reports/rekap-struk${
    backParams.toString() ? `?${backParams.toString()}` : ''
  }`

  const initialRequest = {
    outletId,
    cashierName,
    from,
    to,
    channels,
    skipKindFilter: 'all_not_printed' as const,
    paymentMethod: 'all',
    search: '',
    sortDir: 'desc' as const,
    page: 1,
    pageSize: 20,
    isPawoonVisible: new Date(from) < new Date('2026-08-01'),
  }

  let initialData = null
  try {
    initialData = await laporanDetailKasirStrukUntukScope(initialRequest, {
      supabase,
      scopeKey: 'all',
      allowedOutletIds: 'all',
    })
  } catch (err) {
    console.error('[reports/rekap-struk/detail] gagal memuat data awal:', err)
  }

  return (
    <DetailKasirStrukView
      outletId={outletId}
      cashierName={cashierName}
      from={from}
      to={to}
      channels={channels}
      backHref={backHref}
      initialData={initialData}
      initialRequestKey={initialData ? JSON.stringify(initialRequest) : null}
    />
  )
}
