import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getOutletStaff, accessibleApps } from '@suka/auth'
import type { AppName } from '@suka/auth'
import LogoutButton from '@/components/LogoutButton'
import AppTile from '@/components/AppTile'
import { Avatar } from '@suka/design-system'
import { MapPin, Clock, CloudSun, AlertTriangle, Truck, CheckCircle2, ArrowRight } from 'lucide-react'
import ClockAndDate from '@/components/ClockAndDate'

// URL app: env-driven (NEXT_PUBLIC_APP_URL_<APP>) agar benar di lokal & prod,
// fallback ke subdomain produksi bila env kosong. Lihat ADR-008.
const APP_URL: Record<AppName, string> = {
  'admin-dashboard': process.env.NEXT_PUBLIC_APP_URL_ADMIN_DASHBOARD  ?? 'https://admin.sukashawarma.com',
  stok:              process.env.NEXT_PUBLIC_APP_URL_STOK            ?? 'https://stok.sukashawarma.com',
  absensi:           process.env.NEXT_PUBLIC_APP_URL_ABSENSI         ?? 'https://absensi.sukashawarma.com',
  distribusi:        process.env.NEXT_PUBLIC_APP_URL_DISTRIBUSI      ?? 'https://distribusi.sukashawarma.com',
  'pos-kasir':       process.env.NEXT_PUBLIC_APP_URL_POS_KASIR       ?? 'https://pos.sukashawarma.com',
  'owner-dashboard': process.env.NEXT_PUBLIC_APP_URL_OWNER_DASHBOARD ?? 'https://owner.sukashawarma.com',
}

// Metadata per app
const APP_META: Record<AppName, { label: string; url: string; desc: string }> = {
  'admin-dashboard': { label: 'Admin Dashboard',  url: APP_URL['admin-dashboard'], desc: 'Administrasi staff, akun & sistem' },
  stok:              { label: 'Stok',             url: APP_URL.stok,              desc: 'Monitoring & ledger stok bahan baku' },
  absensi:           { label: 'Absensi',          url: APP_URL.absensi,           desc: 'Presensi karyawan dengan verifikasi wajah' },
  distribusi:        { label: 'Distribusi',       url: APP_URL.distribusi,        desc: 'Pengiriman bahan baku & surat jalan' },
  'pos-kasir':       { label: 'POS Kasir',        url: APP_URL['pos-kasir'],      desc: 'Transaksi penjualan & point of sale' },
  'owner-dashboard': { label: 'Owner Dashboard',  url: APP_URL['owner-dashboard'], desc: 'Laporan omzet & analisis keuangan' },
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

  // Admin tidak punya menu operasional di launcher → langsung ke admin-dashboard.
  // Chokepoint tunggal: berlaku utk login baru, akses /launcher langsung, & revisit.
  if (staff.role === 'admin') {
    redirect(APP_URL['admin-dashboard'])
  }

  const apps = accessibleApps(staff.role)

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

  // Get current date string in Indonesian formatting
  const formattedDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

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

  // 2. Fetch critical low stock items count (status = 'below')
  let lowStockCount = 0
  if (staff.role === 'owner' || staff.role === 'spv') {
    const { data: lowStockData } = await supabase
      .from('monitoring_view_spv')
      .select('bahan_baku_id')
      .eq('status', 'below')
    if (lowStockData) lowStockCount = lowStockData.length
  } else if (staff.outlet_id) {
    const { data: lowStockData } = await supabase
      .from('monitoring_view_spv')
      .select('bahan_baku_id')
      .eq('outlet_id', staff.outlet_id)
      .eq('status', 'below')
    if (lowStockData) lowStockCount = lowStockData.length
  }

  // 3. Fetch shipments in transit count (status = 'dikirim' or 'dikirim_lengkap')
  let inTransitCount = 0
  if (staff.role === 'owner' || staff.role === 'spv') {
    const { data: shipmentsData } = await supabase
      .from('surat_jalan')
      .select('id')
      .in('status', ['dikirim', 'dikirim_lengkap'])
    if (shipmentsData) inTransitCount = shipmentsData.length
  } else if (staff.outlet_id) {
    const { data: shipmentsData } = await supabase
      .from('surat_jalan')
      .select('id')
      .eq('outlet_id', staff.outlet_id)
      .in('status', ['dikirim', 'dikirim_lengkap'])
    if (shipmentsData) inTransitCount = shipmentsData.length
  }

  return (
    <main className="min-h-screen w-screen bg-suka-cream/50 relative overflow-y-auto overflow-x-hidden bg-grain select-none py-8 md:py-12 px-4 sm:px-6">
      {/* Background soft glowing blur blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-suka-orange/5 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[45vw] h-[45vw] rounded-full bg-suka-brown/5 blur-[120px] pointer-events-none z-0" />

      <div className="max-w-4xl mx-auto space-y-6 relative z-10">
        
        {/* Unified Glassmorphic Profile & Workspace Card */}
        <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${banner.gradient} p-5 sm:p-6 text-white shadow-xl shadow-suka-brown/15 border border-white/10`}>
          {/* Soft background glow circles */}
          <div className="absolute right-0 top-0 -mt-6 -mr-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute left-1/3 bottom-0 -mb-10 w-48 h-48 bg-suka-orange/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col gap-5">
            {/* Top Row: Avatar & Profile + Weather & Logout (always inline) */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="p-0.5 rounded-full ring-2 ring-white/30 flex-shrink-0">
                  <Avatar name={staff.name} size={50} className="shadow border border-white flex-shrink-0" />
                </div>
                <div className="min-w-0">
                  <span className="inline-block text-[9px] font-black tracking-widest text-suka-orange uppercase bg-white/15 px-2 py-0.5 rounded-md leading-none">
                    {banner.title}
                  </span>
                  <h1 className="text-lg sm:text-xl font-black text-white truncate font-display tracking-wide mt-1.5 leading-tight">
                    Halo, {staff.name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[11px] text-white/70 font-semibold leading-none">
                    <span className="capitalize">{staff.role.replace('_', ' ')}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 min-w-0 truncate">
                      <MapPin size={10} className="text-white/80 shrink-0" />
                      <span className="truncate">{staff.outlets?.name ?? 'Semua Outlet'}</span>
                    </span>
                  </div>
                  
                  {/* Attendance Quick Status */}
                  <div className="mt-2.5 flex items-center gap-2">
                    {latestAttendance ? (
                      latestAttendance.type === 'in' ? (
                        <span className="inline-flex items-center gap-1.5 bg-emerald-500/25 border border-emerald-500/35 text-emerald-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                          <span>Absen Masuk: {new Date(latestAttendance.ts_server).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })} WIB</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-amber-500/25 border border-amber-500/35 text-amber-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                          <CheckCircle2 size={10} className="text-amber-400" />
                          <span>Absen Pulang: {new Date(latestAttendance.ts_server).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })} WIB</span>
                        </span>
                      )
                    ) : (
                      <a
                        href="/absensi"
                        className="inline-flex items-center gap-1.5 bg-red-500/25 border border-red-500/40 text-red-200 hover:bg-red-500/35 active:scale-95 transition-all text-[10px] font-extrabold px-2.5 py-0.5 rounded-full cursor-pointer"
                      >
                        <Clock size={10} className="animate-pulse text-red-400" />
                        <span>Belum Absen Masuk • Klik Untuk Absen</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 shrink-0">
                {/* Weather Info (shown on desktop or tablet) */}
                <div className="hidden sm:flex flex-col items-end text-[9px] text-white/60 font-bold leading-tight mr-1">
                  <span className="flex items-center gap-1">
                    <CloudSun size={11} className="text-suka-orange" />
                    Jabodetabek • 27°C
                  </span>
                  <span className="mt-0.5 flex items-center gap-0.5 font-mono">
                    <Clock size={9} />
                    WIB GMT+7
                  </span>
                </div>
                <LogoutButton />
              </div>
            </div>

            {/* Subtle Divider */}
            <div className="w-full h-px bg-white/10"></div>

            {/* Bottom Row: Description & Dynamic Clock */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <p className="text-xs sm:text-sm text-white/80 font-medium leading-relaxed max-w-xl">
                {banner.desc}
              </p>
              <div className="w-full md:w-auto shrink-0">
                <ClockAndDate initialDate={formattedDate} />
              </div>
            </div>
          </div>
        </div>

        {/* Operational Alerts Banner */}
        {(lowStockCount > 0 || inTransitCount > 0) && (
          <div className="bg-white/80 backdrop-blur-md border border-suka-orange/10 rounded-2xl p-4 shadow-sm shadow-suka-brown/5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex flex-col gap-2 md:gap-3 flex-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-suka-orange animate-pulse"></span>
                <h3 className="text-xs font-black text-suka-brown uppercase tracking-wider font-display">
                  Pemberitahuan Operasional
                </h3>
              </div>
              <div className="flex flex-col gap-2">
                {lowStockCount > 0 && (
                  <div className="flex items-start gap-2.5 text-xs text-suka-gray-600 font-semibold">
                    <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      {staff.role === 'owner' || staff.role === 'spv' ? (
                        <span>Ada <strong className="text-suka-brown font-black">{lowStockCount} bahan baku</strong> kritis (di bawah reorder point) di beberapa outlet.</span>
                      ) : (
                        <span>Ada <strong className="text-suka-brown font-black">{lowStockCount} bahan baku</strong> kritis (di bawah reorder point) di outlet Anda.</span>
                      )}
                    </div>
                  </div>
                )}
                {inTransitCount > 0 && (
                  <div className="flex items-start gap-2.5 text-xs text-suka-gray-600 font-semibold">
                    <Truck size={15} className="text-suka-orange shrink-0 mt-0.5" />
                    <div>
                      {staff.role === 'owner' || staff.role === 'spv' ? (
                        <span>Ada <strong className="text-suka-brown font-black">{inTransitCount} pengiriman</strong> logistik sedang dalam perjalanan.</span>
                      ) : (
                        <span>Ada <strong className="text-suka-brown font-black">{inTransitCount} pengiriman</strong> sedang dikirim ke outlet Anda.</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch gap-2 shrink-0 md:self-center">
              {lowStockCount > 0 && (
                <a
                  href="/stok"
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 border border-suka-orange/20 text-suka-brown hover:bg-suka-orange/5 active:bg-suka-orange/10 active:scale-95 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer bg-white"
                >
                  <span>Pantau Stok</span>
                  <ArrowRight size={13} />
                </a>
              )}
              {inTransitCount > 0 && (
                <a
                  href="/distribusi"
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-suka-orange hover:bg-orange-600 active:bg-orange-700 active:scale-95 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm shadow-suka-orange/20"
                >
                  <span>Verifikasi Kiriman</span>
                  <ArrowRight size={13} />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Applications Grid */}
        <section className="space-y-4">
          <h2 className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-suka-orange border-b border-suka-orange/10 pb-2">
            Aplikasi Anda
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <p>Sistem Operasional v2.7.0</p>
        </footer>
      </div>
    </main>
  )
}

