import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getOutletStaff, accessibleApps } from '@suka/auth'
import type { AppName } from '@suka/auth'
import LogoutButton from '@/components/LogoutButton'
import AppTile from '@/components/AppTile'
import { Avatar } from '@suka/design-system'
import { MapPin, Clock, CheckCircle2 } from 'lucide-react'

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
  } as Record<AppName, string>
}

export default async function LauncherPage() {
  const cookieStore = await cookies()

  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookies) => {
      cookies.forEach(({ name, value, options }) => {
        cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
      })
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { staff, error } = await getOutletStaff(supabase, user.id)
  if (error || !staff) redirect('/')

  // Check staff status
  if (staff.status !== 'active') {
    // Inactive or on_leave staff cannot access apps
    await supabase.auth.signOut()
    redirect('/')
  }

  const APP_URL = await getAppUrls()

  // Admin, Owner, Area Manager, dan Mitra tidak punya menu operasional di launcher → langsung ke admin-dashboard.
  // Chokepoint tunggal: berlaku utk login baru, akses /launcher langsung, & revisit.
  if (['admin', 'owner', 'mitra', 'area_manager', 'korlap'].includes(staff.role)) {
    redirect(APP_URL['admin-dashboard'])
  }
  const apps = accessibleApps(staff.role)

  const APP_META: Record<AppName, { label: string; url: string; desc: string }> = {
    'admin-dashboard': { 
      label: staff.role === 'area_manager' ? 'Area Manager Dashboard' : staff.role === 'leader' ? 'Leader Dashboard' : 'Admin Dashboard',  
      url: APP_URL['admin-dashboard'], 
      desc: staff.role === 'area_manager' ? 'Approval petty cash & monitoring cabang' : staff.role === 'leader' ? 'Monitoring performa, stok, & top up petty cash' : 'Administrasi staff, akun & sistem' 
    },
    stok:              { label: 'Stok',             url: APP_URL.stok,              desc: 'Monitoring & ledger stok bahan baku' },
    absensi:           { label: 'Absensi',          url: APP_URL.absensi,           desc: 'Presensi karyawan dengan verifikasi wajah' },
    distribusi:        { label: 'Distribusi',       url: APP_URL.distribusi,        desc: 'Pengiriman bahan baku & surat jalan' },
    'pos-kasir':       { label: 'POS Kasir',        url: APP_URL['pos-kasir'],      desc: 'Transaksi penjualan & point of sale' },
    'owner-dashboard': { label: 'Owner Dashboard',  url: APP_URL['owner-dashboard'], desc: 'Laporan omzet & analisis keuangan' },
    finance:           { label: 'Finance',          url: APP_URL.finance,           desc: 'Keuangan, petty cash & pengajuan dana' },
  }

  // Configure greeting and styling banners based on user roles
  const getBannerConfig = (role: string) => {
    switch (role) {
      case 'owner':
        return {
          title: 'OWNER ANALYTICS HUB',
          desc: 'Pantau performa bisnis, omzet penjualan, dan profitabilitas seluruh outlet.',
          gradient: 'from-amber-800 via-suka-ink to-amber-950',
          ringColor: 'ring-amber-500/50 shadow-amber-500/10'
        }
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



  // 1. Fetch attendance status for today (Asia/Jakarta timezone)
  const todayLocalStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })
  const startOfDay = new Date(`${todayLocalStr}T00:00:00+07:00`).toISOString()
  const endOfDay = new Date(`${todayLocalStr}T23:59:59+07:00`).toISOString()

  const { data: attendanceData } = await supabase
    .from('attendance')
    .select('type, ts_server, status')
    .eq('outlet_staff_id', staff.id)
    .gte('ts_server', startOfDay)
    .lte('ts_server', endOfDay)
    .order('ts_server', { ascending: false })

  const latestAttendance = attendanceData?.[0] || null

  // Time-aware greeting + full date, computed in Asia/Jakarta (server render)
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

  return (
    <main className="h-full w-full bg-suka-cream/50 relative overflow-y-auto overflow-x-hidden bg-grain select-none py-8 md:py-12 px-4 sm:px-6">
      {/* Background soft glowing blur blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-suka-orange/5 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[45vw] h-[45vw] rounded-full bg-suka-brown/5 blur-[120px] pointer-events-none z-0" />

      <div className="max-w-4xl mx-auto space-y-6 relative z-10">
        
        {/* Profile & Workspace Card */}
        <div className={`relative overflow-hidden rounded-[28px] bg-gradient-to-br ${banner.gradient} p-6 sm:p-7 text-white shadow-2xl shadow-suka-brown/25 ring-1 ring-white/10 border-t border-white/15`}>
          {/* Decorative glows + subtle dot grid */}
          <div className="absolute right-0 top-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute left-1/4 bottom-0 -mb-16 w-52 h-52 bg-suka-orange/25 rounded-full blur-[90px] pointer-events-none" />
          <div
            className="absolute inset-0 opacity-[0.12] pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)', backgroundSize: '22px 22px' }}
          />

          <div className="relative z-10">
            {/* Top row: identity + logout/date */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="p-0.5 rounded-2xl ring-2 ring-white/25 shadow-lg shrink-0">
                  <Avatar name={staff.name} size={54} className="rounded-[14px] border border-white/40" />
                </div>
                <div className="min-w-0">
                  <span className="inline-block text-[9px] font-black tracking-[0.2em] text-white/90 uppercase bg-white/15 px-2.5 py-1 rounded-full leading-none backdrop-blur-sm">
                    {banner.title}
                  </span>
                  <h1 className="mt-2 text-xl sm:text-2xl font-black text-white truncate font-display tracking-wide leading-tight">
                    {greeting}, {staff.name}
                  </h1>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-semibold text-white/70 leading-none">
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

              <div className="flex flex-col items-end gap-2 shrink-0">
                <LogoutButton />
                <span className="hidden sm:block text-[10px] font-bold text-white/55 text-right leading-tight capitalize">
                  {dateLabel}
                </span>
              </div>
            </div>

            {/* Attendance status strip */}
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 flex-wrap">
              {latestAttendance ? (
                latestAttendance.type === 'in' ? (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-500/25 border border-emerald-500/35 text-emerald-100 text-[10px] font-extrabold px-3 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>Absen Masuk: {new Date(latestAttendance.ts_server).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })} WIB</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-amber-500/25 border border-amber-500/35 text-amber-100 text-[10px] font-extrabold px-3 py-1 rounded-full">
                    <CheckCircle2 size={11} className="text-amber-300" />
                    <span>Absen Pulang: {new Date(latestAttendance.ts_server).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })} WIB</span>
                  </span>
                )
              ) : (
                <a
                  href="/absensi"
                  className="inline-flex items-center gap-1.5 bg-red-500/25 border border-red-500/40 text-red-100 hover:bg-red-500/40 active:scale-95 transition-all text-[10px] font-extrabold px-3 py-1 rounded-full cursor-pointer"
                >
                  <Clock size={11} className="animate-pulse text-red-300" />
                  <span>Belum Absen Masuk • Klik Untuk Absen</span>
                </a>
              )}
            </div>
          </div>
        </div>


        {/* Applications Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-suka-orange/10 pb-2">
            <h2 className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-suka-orange">
              Aplikasi Anda
            </h2>
            <span className="text-[10px] font-black text-suka-brown/40 tabular-nums">
              {apps.length} modul
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {apps.map(appName => {
              const meta = APP_META[appName]
              return (
                <AppTile 
                  key={appName} 
                  label={meta.label} 
                  url={meta.url} 
                  desc={meta.desc} 
                />
              )
            })}
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-6 border-t border-suka-orange/10 flex flex-wrap justify-between items-center text-[10px] text-suka-gray-400 font-bold gap-2">
          <p>© {new Date().getFullYear()} Suka Shawarma. Hak Cipta Dilindungi.</p>
          <p>Sistem Operasional v2.8.0</p>
        </footer>
      </div>
    </main>
  )
}

