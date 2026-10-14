import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'
import ReportsView from './ReportsView'
import { laporanPosUntukScope } from '@/lib/posReport/laporan'
import { isTestOutlet } from '@/lib/outletFilters'
import { addDaysStr, jakartaDate } from '@/lib/ownerDashboardCache'

export const dynamic = 'force-dynamic'

export default async function AdminReportsPage() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const userId = await getVerifiedUserId(supabase)
  if (!userId) redirect('/login')

  // Jalankan pengecekan role dan pengambilan daftar outlet secara paralel,
  // serta pilih kolom spesifik sesuai standar optimasi database.
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
    // Role sudah terverifikasi di atas (developer/owner/admin → cakupan 'all'),
    // panggil laporanPosUntukScope langsung agar tidak mengulang getVerifiedUserId + query outlet_staff.
    initialReport = await laporanPosUntukScope(initialRequest, {
      supabase,
      scopeKey: 'all',
      allowedOutletIds: 'all',
    })
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
