import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import ReportsView from './ReportsView'
import { getPosReport } from '@/app/actions/posReport'
import { isTestOutlet } from '@/lib/outletFilters'
import { addDaysStr, jakartaDate } from '@/lib/ownerDashboardCache'

export const dynamic = 'force-dynamic'

export default async function AdminReportsPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  // Pre-fetch outlets to avoid loading state for filters
  const { data: outletsData } = await supabase.from('outlets').select('*').order('name')

  const initialOutlets = outletsData || []

  // Data laporan untuk filter bawaan disiapkan di server, supaya halaman
  // langsung tampil berisi (tanpa menunggu browser mengirim permintaan kedua).
  // Objek ini WAJIB sama persis — isi dan urutan kunci — dengan `reportRequest`
  // pertama di ReportsView; kalau berbeda (mis. zona waktu browser lain),
  // browser tinggal meminta ulang seperti biasa.
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
    search: '',
    page: 1,
    pageSize: 10,
    isPawoonVisible: new Date(from) < new Date('2026-08-01'),
  }

  let initialReport = null
  try {
    initialReport = await getPosReport(initialRequest)
  } catch (err) {
    // Gagal di server bukan akhir: browser akan mencoba lagi & menampilkan pesan.
    console.error('[reports/pos] gagal menyiapkan data awal:', err)
  }

  return (
    <ReportsView
      initialOutlets={initialOutlets as any}
      initialReport={initialReport}
      initialRequestKey={initialReport ? JSON.stringify(initialRequest) : null}
    />
  )
}
