import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getOutletStaff, accessibleApps, getVerifiedUserId } from '@suka/auth'
import type { AppName } from '@suka/auth'
import LogoutButton from '@/components/LogoutButton'
import AppGrid, { type PortalAppItem } from '@/components/AppGrid'
import { MapPin, Clock, CheckCircle2, Store, Users } from 'lucide-react'
import LiveClock from '@/components/LiveClock'

import { headers } from 'next/headers'

// URL app: env-driven (NEXT_PUBLIC_APP_URL_<APP>) agar benar di lokal & prod,
// fallback ke subdomain produksi bila env kosong. Lihat ADR-008.

const getAppUrls = async () => {
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1')

  return {
    'admin-dashboard': isLocal ? 'http://localhost:3005' : (process.env.NEXT_PUBLIC_APP_URL_ADMIN_DASHBOARD || 'https://admin.sukashawarma.com'),
    stok:              isLocal ? 'http://localhost:3001' : (process.env.NEXT_PUBLIC_APP_URL_STOK || 'https://stok.sukashawarma.com'),
    absensi:           isLocal ? 'http://localhost:3001' : (process.env.NEXT_PUBLIC_APP_URL_ABSENSI || 'https://absensi.sukashawarma.com'),
    distribusi:        isLocal ? 'http://localhost:3002' : (process.env.NEXT_PUBLIC_APP_URL_DISTRIBUSI || 'https://distribusi.sukashawarma.com'),
    'pos-kasir':       isLocal ? 'http://localhost:3004' : (process.env.NEXT_PUBLIC_APP_URL_POS_KASIR || 'https://pos.sukashawarma.com'),
    'owner-dashboard': isLocal ? 'http://localhost:3003' : (process.env.NEXT_PUBLIC_APP_URL_OWNER_DASHBOARD || 'https://owner.sukashawarma.com'),
    finance:           isLocal ? 'http://localhost:3020' : (process.env.NEXT_PUBLIC_APP_URL_FINANCE || 'https://finance.sukashawarma.com'),
    manager:           isLocal ? 'http://localhost:3000' : (process.env.NEXT_PUBLIC_APP_URL_MANAGER || 'https://manager.sukashawarma.com'),
    inventori:         isLocal ? 'http://localhost:3011' : (process.env.NEXT_PUBLIC_APP_URL_INVENTORI || 'https://inventori.sukashawarma.com'),
    monitoring:        isLocal ? 'http://localhost:3030' : (process.env.NEXT_PUBLIC_APP_URL_MONITORING || 'https://monitor.sukashawarma.com'),
    HR:                isLocal ? 'http://localhost:3025' : (process.env.NEXT_PUBLIC_APP_URL_HR || 'https://hr.sukashawarma.com'),
    marcom:            isLocal ? 'http://localhost:3999' : (process.env.NEXT_PUBLIC_APP_URL_MARCOM || 'https://marcom.sukashawarma.com'),
  } as Record<AppName, string>
}


export default async function LauncherPage() {
  const cookieStore = await cookies()

  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookies) => {
      // Server Component tidak boleh menulis cookie — Next melempar
      // "Cookies can only be modified in a Server Action or Route Handler".
      // Supabase memanggil setAll saat sesi berubah (logout, refresh token
      // gagal/kedaluwarsa) → tanpa try/catch halaman ini 500. Penyegaran
      // cookie sudah ditangani middleware, jadi aman diabaikan di sini.
      try {
        cookies.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
        })
      } catch {
        // dipanggil dari Server Component — abaikan
      }
    },
  })

  const userId = await getVerifiedUserId(supabase)
  if (!userId) redirect('/')

  const { staff, error } = await getOutletStaff(supabase, userId)
  if (error || !staff) redirect('/')

  // Check staff status
  if (staff.status !== 'active') {
    // Inactive or on_leave staff cannot access apps
    await supabase.auth.signOut()
    redirect('/')
  }

  const { data: brandData } = await supabase
    .from('global_settings')
    .select('key, value')
    .in('key', ['brand_name', 'brand_logo'])

  const brandName = brandData?.find((s: any) => s.key === 'brand_name')?.value?.replace(/^"|"$/g, '') || 'Suka Shawarma'
  const brandLogo = brandData?.find((s: any) => s.key === 'brand_logo')?.value?.replace(/^"|"$/g, '') || '/logo.png'

  const APP_URL = await getAppUrls()

  // Mitra, Korlap, dll tidak punya menu operasional di launcher → langsung ke admin-dashboard.
  if (['mitra', 'korlap'].includes(staff.role)) {
    redirect(APP_URL['admin-dashboard'])
  }
  // Staf pusat & crew yang sedang di Kantor Pusat hanya melihat app terbatas.
  const apps = accessibleApps(staff.role, staff.username, staff)

  // Suka Review = app eksternal (Vercel), bukan bagian AppName/@suka/auth.
  // Khusus admin & owner; gerbangnya di server component ini.
  // REVIEW_BYPASS_CODE_ADMIN/_OWNER (server-only) harus PERSIS sama dengan
  // LOGIN_BYPASS_CODE_ADMIN/_OWNER di env Vercel SukaReview — admin & owner
  // sengaja punya kode beda supaya masuk ke akun SukaReview yang beda juga
  // (role masing-masing terjaga di tabel profiles SukaReview, bukan share
  // satu identitas). Kalau kode untuk role staff ini kosong, tile fallback
  // ke halaman login biasa (yang disabled) alih-alih auto-login.
  const REVIEW_BASE_URL = process.env.NEXT_PUBLIC_APP_URL_REVIEW || 'https://suka-review.vercel.app'
  const REVIEW_BYPASS_CODE =
    // developer = superuser teknis → masuk sebagai akun admin SukaReview.
    staff.role === 'admin' || staff.role === 'developer' ? process.env.REVIEW_BYPASS_CODE_ADMIN :
    staff.role === 'owner' ? process.env.REVIEW_BYPASS_CODE_OWNER :
    undefined
  const REVIEW_URL = REVIEW_BYPASS_CODE
    ? `${REVIEW_BASE_URL}/api/auth/bypass?code=${encodeURIComponent(REVIEW_BYPASS_CODE)}`
    : REVIEW_BASE_URL
  const canSeeReview = ['admin', 'owner', 'developer'].includes(staff.role)

  const APP_META: Record<AppName, { label: string; url: string; desc: string; category: string; group: string }> = {
    'admin-dashboard': { 
      label: staff.role === 'leader' ? 'Leader Dashboard' : staff.role === 'purchasing' ? 'Master Supplier & Vendor' : 'Admin Dashboard',  
      url: staff.role === 'purchasing' ? `${APP_URL['admin-dashboard']}/dashboard/pembelian/supplier` : APP_URL['admin-dashboard'], 
      desc: staff.role === 'leader' ? 'Monitoring performa, stok, & top up petty cash' : staff.role === 'purchasing' ? 'Database supplier, kontak vendor & katalog harga' : 'Administrasi staff, akun & sistem',
      category: staff.role === 'purchasing' ? 'Pengadaan' : 'Sistem & Operasi',
      group: 'Manajemen & SDM',
    },
    stok:              { label: 'Stok',             url: APP_URL.stok,              desc: 'Monitoring & ledger stok bahan baku', category: 'Inventori Bahan', group: 'Operasional' },
    absensi:           { label: 'Absensi',          url: APP_URL.absensi,           desc: 'Presensi karyawan dengan verifikasi wajah', category: 'Presensi Kru', group: 'Operasional' },
    distribusi:        { label: 'Distribusi',       url: APP_URL.distribusi,        desc: 'Pengiriman bahan baku & surat jalan', category: 'Logistik & Armada', group: 'Operasional' },
    'pos-kasir':       { label: 'POS Kasir',        url: APP_URL['pos-kasir'],      desc: 'Transaksi penjualan & point of sale', category: 'Point of Sale', group: 'Operasional' },
    'owner-dashboard': { label: 'Owner Dashboard',  url: APP_URL['owner-dashboard'], desc: 'Laporan omzet & analisis keuangan', category: 'Eksekutif & Omzet', group: 'Keuangan & Data' },
    finance:           { 
      label: staff.role === 'purchasing' ? 'Purchasing & PO' : 'Finance', 
      url: ['purchasing', 'purchase'].includes(staff.role) ? `${APP_URL.finance}/pembelian/dashboard` : APP_URL.finance, 
      desc: ['purchasing', 'purchase'].includes(staff.role) ? 'Dashboard pengadaan, buat PO & invoice' : 'Keuangan, petty cash & pengajuan dana',
      category: ['purchasing', 'purchase'].includes(staff.role) ? 'Pengadaan' : 'Keuangan & Kas',
      group: 'Keuangan & Data',
    },
    manager:           { label: staff.role === 'regional_manager' ? 'Regional Manager Dashboard' : 'Manager App', url: APP_URL.manager, desc: 'Persetujuan operasional & monitoring area', category: 'Manajemen Area', group: 'Manajemen & SDM' },
    inventori:         { label: 'Inventaris Outlet', url: APP_URL.inventori, desc: 'Pemeriksaan aset outlet dengan foto oleh Area Manager', category: 'Aset & Audit', group: 'Manajemen & SDM' },
    monitoring:        { label: 'Live Monitor', url: APP_URL.monitoring, desc: 'Kamera outlet on-demand tanpa rekaman', category: 'CCTV & Live', group: 'Manajemen & SDM' },
    HR:                { label: 'HR Dashboard',     url: APP_URL.HR,                desc: 'Database staf, absensi, cuti, payroll & kontrak', category: 'SDM & Payroll', group: 'Manajemen & SDM' },
    marcom:            { label: 'MARCOM & Influencer', url: APP_URL.marcom, desc: 'Digitalisasi marketing, endorsement, ads & konten', category: 'Marketing & Ads', group: 'Pemasaran & Ulasan' },
  }

  // Gabungkan semua modul yang bisa diakses user (termasuk Suka Review jika diizinkan)
  const portalApps: PortalAppItem[] = [
    ...(canSeeReview ? [{
      id: 'suka-review',
      label: 'Suka Review',
      url: REVIEW_URL,
      desc: 'Aplikasi review eksternal Suka Shawarma',
      category: 'Customer Voice',
      badge: 'Eksternal',
      group: 'Pemasaran & Ulasan',
    }] : []),
    ...apps.map(appName => {
      const meta = APP_META[appName]
      return {
        id: appName,
        label: meta.label,
        url: meta.url,
        desc: meta.desc,
        category: meta.category,
        group: meta.group,
      }
    })
  ]

  // Urutkan modul secara alfabetis berdasarkan label tampilan (A - Z)
  portalApps.sort((a, b) => a.label.localeCompare(b.label, 'id', { sensitivity: 'base' }))


  // Configure greeting and styling banners based on user roles
  const getBannerConfig = (role: string) => {
    switch (role) {
      case 'admin':
        return {
          title: 'ADMIN WORKSPACE',
          desc: 'Kelola administrasi, stok, distribusi, dan keuangan.',
          gradient: 'from-suka-ink via-blue-900 to-suka-ink',
          ringColor: 'ring-blue-500/50 shadow-blue-500/10'
        }
      case 'owner':
        return {
          title: 'OWNER ANALYTICS HUB',
          desc: 'Pantau performa bisnis, omzet penjualan, dan profitabilitas seluruh outlet.',
          gradient: 'from-amber-800 via-suka-ink to-amber-950',
          ringColor: 'ring-amber-500/50 shadow-amber-500/10'
        }
      case 'purchasing':
        return {
          title: 'PURCHASING WORKSPACE',
          desc: 'Kelola pengadaan barang, supplier, monitoring stok, dan keuangan.',
          gradient: 'from-emerald-950 via-suka-ink to-emerald-900',
          ringColor: 'ring-emerald-600/50 shadow-emerald-600/10'
        }
      case 'regional_manager':
      case 'area_manager':
      case 'spv':
      case 'leader':
      case 'kitchen':
        return {
          title: 'KITCHEN CONTROLLER PORTAL',
          desc: 'Kelola level stok, lakukan stock opname harian, dan verifikasi distribusi barang.',
          gradient: 'from-suka-brown via-suka-ink to-suka-brown',
          ringColor: 'ring-amber-700/50 shadow-amber-700/10'
        }
      default:
        return {
          title: 'OUTLET WORKSPACE',
          desc: 'Akses modul absensi masuk/pulang kerja dan monitoring penugasan operasional.',
          gradient: 'from-suka-orange via-suka-brown to-suka-ink',
          ringColor: 'ring-suka-orange/50 shadow-suka-orange/10'
        }
    }
  }

  const banner = getBannerConfig(staff.role)

  // 1. Fetch attendance status / operational metrics for today (Asia/Jakarta timezone)
  const todayLocalStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })
  const startOfDay = new Date(`${todayLocalStr}T00:00:00+07:00`).toISOString()
  const endOfDay = new Date(`${todayLocalStr}T23:59:59+07:00`).toISOString()

  let latestAttendance: { type: string; ts_server: string; status: string } | null = null
  let operationalMetrics: {
    openOutletsCount: number
    totalOutletsCount: number
    currentlyWorkingCrew: number
    totalAttendedCount: number
  } | null = null

  const isExecutiveRole = ['owner', 'admin'].includes(staff.role)

  if (isExecutiveRole) {
    const [outletsRes, staffRes, attendanceRes] = await Promise.all([
      supabase.from('outlets').select('id, name, slug, type, is_active, inactive_reason').eq('is_active', true),
      supabase.from('outlet_staff').select('id, name, username, role, account_category, status').eq('status', 'active'),
      supabase
        .from('attendance')
        .select('outlet_id, outlet_staff_id, type, ts_server, status')
        .gte('ts_server', startOfDay)
        .lte('ts_server', endOfDay)
        .order('ts_server', { ascending: true })
    ])

    const outlets = outletsRes.data || []
    const staffList = staffRes.data || []
    const attendance = attendanceRes.data || []

    // 1. Filter outlet fisik operasional riil (kecualikan testing, backup, trial, demo, non-retail, dan outlet non-aktif)
    const OLD_SAWANGAN_ID = '550e8400-e29b-41d4-a716-446655440008'
    const NEW_SAWANGAN_DTC_ID = '5a4df577-5237-476e-b54c-9eb642a5a516'

    const operationalOutlets = outlets.filter((o: any) => {
      if (!o.is_active) return false
      if (o.inactive_reason) return false
      if (o.id === 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a') return false // TEST_OUTLET_ID
      if (o.id === OLD_SAWANGAN_ID || o.slug === 'sawangan-depok-internal' || o.name.includes('(INTERNAL)')) return false
      const type = (o.type || '').toLowerCase()
      if (type !== 'internal' && type !== 'mitra') return false
      const name = (o.name || '').toLowerCase()
      const slug = (o.slug || '').toLowerCase()
      if (['tes', 'test', 'trial', 'demo', 'backup'].some(w => name.includes(w) || slug.includes(w))) return false
      return true
    })
    const operationalOutletIds = new Set(operationalOutlets.map((o: any) => o.id))

    // 2. Filter kru/staf riil aktif (kecualikan bot devai, dummy test, kiosk, owner, mitra investor)
    const realStaffIds = new Set(
      staffList
        .filter((s: any) => {
          if (s.account_category && s.account_category !== 'employee') return false
          const role = (s.role || '').toLowerCase()
          if (['kiosk', 'mitra', 'owner'].includes(role)) return false
          const name = (s.name || '').toLowerCase()
          const user = (s.username || '').toLowerCase()
          if (user.startsWith('devai') || name.startsWith('devai') || user.startsWith('dev_')) return false
          if (['tes', 'test', 'demo', 'trial', 'dummy'].some(w => user.includes(w) || name.includes(w))) return false
          if (user.startsWith('mitra_') || name.startsWith('mitra ')) return false
          if (user.startsWith('superadmin') || user.startsWith('admin2') || user.startsWith('admindev')) return false
          if (['finance', 'admin_finance', 'purchasing', 'staff_pusat'].includes(user)) return false
          return true
        })
        .map((s: any) => s.id)
    )

    const staffLatest = new Map<string, { type: string; outlet_id: string }>()
    const attendedStaffIds = new Set<string>()

    attendance.forEach((r: any) => {
      // Hanya proses staf riil aktif (bukan akun bot / testing)
      if (r.status !== 'alpha' && realStaffIds.has(r.outlet_staff_id)) {
        // Jika ada kru yang masih absen dengan ID Sawangan lama, petakan ke Mitra Sawangan DTC
        const effectiveOutletId = r.outlet_id === OLD_SAWANGAN_ID ? NEW_SAWANGAN_DTC_ID : r.outlet_id
        staffLatest.set(r.outlet_staff_id, { type: r.type, outlet_id: effectiveOutletId })
        if (r.type === 'in') {
          attendedStaffIds.add(r.outlet_staff_id)
        }
      }
    })

    let currentlyWorkingCrew = 0
    const openOutletIds = new Set<string>()

    staffLatest.forEach(st => {
      if (st.type === 'in') {
        currentlyWorkingCrew++
        if (operationalOutletIds.has(st.outlet_id)) {
          openOutletIds.add(st.outlet_id)
        }
      }
    })

    operationalMetrics = {
      openOutletsCount: openOutletIds.size,
      totalOutletsCount: operationalOutlets.length,
      currentlyWorkingCrew,
      totalAttendedCount: attendedStaffIds.size,
    }
  } else {
    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('type, ts_server, status')
      .eq('outlet_staff_id', staff.id)
      .gte('ts_server', startOfDay)
      .lte('ts_server', endOfDay)
      .order('ts_server', { ascending: false })
      .limit(1)

    latestAttendance = attendanceData?.[0] || null
  }

  // Time-aware greeting + full date + live time, computed in Asia/Jakarta (server render)
  const jakartaHour = parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }),
    10,
  )
  const greeting =
    jakartaHour < 11 ? 'Selamat pagi' :
    jakartaHour < 15 ? 'Selamat siang' :
    jakartaHour < 18 ? 'Selamat sore' : 'Selamat malam'
  const dateLabel = new Date().toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const initialWibTime = `${new Date().toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(/\./g, ':')} WIB`

  return (
    <main className="h-full w-full bg-suka-cream/50 relative overflow-y-auto overflow-x-hidden bg-grain select-none py-4 sm:py-8 md:py-12 px-3 sm:px-6">
      {/* Background soft glowing blur blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-suka-orange/5 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[45vw] h-[45vw] rounded-full bg-suka-brown/5 blur-[120px] pointer-events-none z-0" />

      <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6 relative z-10">
        
        {/* Profile & Workspace Card */}
        <div className={`relative overflow-hidden rounded-[22px] sm:rounded-[28px] bg-gradient-to-br ${banner.gradient} p-4 sm:p-6 md:p-7 text-white shadow-2xl shadow-suka-brown/25 ring-1 ring-white/10 border-t border-white/15`}>
          {/* Decorative glows + subtle dot grid */}
          <div className="absolute right-0 top-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute left-1/4 bottom-0 -mb-16 w-52 h-52 bg-suka-orange/25 rounded-full blur-[90px] pointer-events-none" />
          <div
            className="absolute inset-0 opacity-[0.12] pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)', backgroundSize: '22px 22px' }}
          />

          <div className="relative z-10">
            {/* Mobile Top Bar (Title Badge + Clock + Logout) */}
            <div className="flex sm:hidden items-center justify-between gap-2 border-b border-white/10 pb-3 mb-3">
              <span className="inline-block text-[9px] font-black tracking-[0.18em] text-white/90 uppercase bg-white/15 px-2.5 py-0.5 rounded-full leading-none backdrop-blur-sm">
                {banner.title}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <LiveClock initialTime={initialWibTime} />
                <LogoutButton />
              </div>
            </div>

            {/* Main Identity & Desktop Action Row */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
                <div className="relative flex items-center justify-center p-1 sm:p-1.5 rounded-2xl bg-white/95 ring-2 ring-white/30 shadow-lg shadow-black/15 shrink-0 overflow-hidden w-[46px] h-[46px] sm:w-[54px] sm:h-[54px]">
                  <img
                    src={brandLogo || "/logo.png"}
                    alt={brandName}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  {/* Desktop Title Badge */}
                  <span className="hidden sm:inline-block text-[9px] font-black tracking-[0.2em] text-white/90 uppercase bg-white/15 px-2.5 py-1 rounded-full leading-none backdrop-blur-sm">
                    {banner.title}
                  </span>
                  <h1 className="text-base sm:text-2xl font-black text-white font-display tracking-tight sm:tracking-wide leading-tight sm:mt-2">
                    <span className="text-white/85 font-medium">{greeting}, </span>
                    <span className="font-black text-white">{staff.name}</span>
                  </h1>
                  <div className="mt-1 sm:mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] sm:text-[11px] font-semibold text-white/70 leading-none">
                    <span className="capitalize inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-suka-orange" />
                      {staff.role.replace('_', ' ')}
                    </span>
                    <span className="text-white/25">|</span>
                    <span className="flex items-center gap-1 min-w-0 truncate">
                      <MapPin size={11} className="text-white/70 shrink-0" />
                      <span className="truncate">{staff.outlets?.name ?? 'Semua Outlet'}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Desktop Logout & Clock (hidden on mobile) */}
              <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
                <LogoutButton />
                <div className="flex flex-col items-end gap-1">
                  <LiveClock initialTime={initialWibTime} />
                  <span className="text-[10px] font-bold text-white/55 text-right leading-tight capitalize">
                    {dateLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Status strip: Executive operational metrics (Owner & Admin) vs Non-executive attendance */}
            <div className="mt-3.5 sm:mt-4 pt-3.5 sm:pt-4 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5">
              {isExecutiveRole ? (
                operationalMetrics && (
                  <>
                    {/* Outlet Buka Metric */}
                    <div className="inline-flex items-center justify-between sm:justify-start gap-2 bg-emerald-500/20 border border-emerald-500/35 text-emerald-100 text-xs font-bold px-3 sm:px-3.5 py-2 sm:py-1.5 rounded-xl shadow-xs backdrop-blur-sm select-none">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                        </span>
                        <Store size={14} className="text-emerald-300 shrink-0" />
                        <span className="text-emerald-200/90 text-[11px] sm:text-xs">Status Outlet:</span>
                      </div>
                      <span>
                        <strong className="text-white font-black">{operationalMetrics.openOutletsCount} / {operationalMetrics.totalOutletsCount}</strong> Outlet Buka
                      </span>
                    </div>

                    {/* Kru Bertugas Metric */}
                    <div
                      title={`${operationalMetrics.currentlyWorkingCrew} kru sedang aktif di outlet saat ini. Dari total ${operationalMetrics.totalAttendedCount} kru yang masuk hari ini, ${operationalMetrics.totalAttendedCount - operationalMetrics.currentlyWorkingCrew} kru sudah absen pulang (shift selesai).`}
                      className="inline-flex items-center justify-between sm:justify-start gap-2 bg-amber-500/20 border border-amber-500/35 text-amber-100 text-xs font-bold px-3 sm:px-3.5 py-2 sm:py-1.5 rounded-xl shadow-xs backdrop-blur-sm select-none"
                    >
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-amber-300 shrink-0" />
                        <span>
                          <strong className="text-white font-black">{operationalMetrics.currentlyWorkingCrew}</strong> Kru Aktif Bekerja
                        </span>
                      </div>
                      <span className="text-amber-200/80 font-semibold text-[10px] sm:text-[11px] sm:border-l sm:border-amber-400/20 sm:pl-2">
                        {operationalMetrics.totalAttendedCount} total hadir hari ini
                      </span>
                    </div>
                  </>
                )
              ) : (
                latestAttendance ? (
                  latestAttendance.type === 'in' ? (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-500/25 border border-emerald-500/35 text-emerald-100 text-[10px] sm:text-xs font-extrabold px-3 py-1.5 rounded-xl">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      <span>Absen Masuk: {new Date(latestAttendance.ts_server).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })} WIB</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 bg-amber-500/25 border border-amber-500/35 text-amber-100 text-[10px] sm:text-xs font-extrabold px-3 py-1.5 rounded-xl">
                      <CheckCircle2 size={12} className="text-amber-300" />
                      <span>Absen Pulang: {new Date(latestAttendance.ts_server).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })} WIB</span>
                    </span>
                  )
                ) : (
                  <a
                    href="/absensi"
                    className="inline-flex items-center justify-center gap-1.5 bg-red-500/25 border border-red-500/40 text-red-100 hover:bg-red-500/40 active:scale-95 transition-all text-[11px] sm:text-xs font-extrabold px-3.5 py-1.5 rounded-xl cursor-pointer"
                  >
                    <Clock size={12} className="animate-pulse text-red-300" />
                    <span>Belum Absen Masuk • Klik Untuk Absen</span>
                  </a>
                )
              )}
            </div>
          </div>
        </div>

        {/* Applications Grid (Alphabetically Sorted with Search & Category Filters) */}
        <AppGrid apps={portalApps} />

        {/* Footer */}
        <footer className="pt-6 border-t border-suka-orange/10 flex flex-wrap justify-between items-center text-[10px] text-suka-gray-400 font-bold gap-2">
          <p>© {new Date().getFullYear()} {brandName}. Hak Cipta Dilindungi.</p>
          <p>Sistem Operasional v2.8.0</p>
        </footer>
      </div>
    </main>
  )
}
