import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getOutletStaff, accessibleApps } from '@suka/auth'
import type { AppName } from '@suka/auth'
import LogoutButton from '@/components/LogoutButton'
import AppTile from '@/components/AppTile'
import ChangelogModal from '@/components/ChangelogModal'
import { Avatar } from '@suka/design-system'
import { MapPin, Clock, CheckCircle2 } from 'lucide-react'

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

  // Admin dan Owner tidak punya menu operasional di launcher → langsung ke admin-dashboard.
  // Chokepoint tunggal: berlaku utk login baru, akses /launcher langsung, & revisit.
  if (['admin', 'owner'].includes(staff.role)) {
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



  return (
    <main className="h-full w-full bg-suka-cream/50 relative overflow-y-auto overflow-x-hidden bg-grain select-none py-8 md:py-12 px-4 sm:px-6">
      {/* Background soft glowing blur blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-suka-orange/5 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[45vw] h-[45vw] rounded-full bg-suka-brown/5 blur-[120px] pointer-events-none z-0" />

      <div className="max-w-4xl mx-auto space-y-6 relative z-10">
        
        {/* Unified Glassmorphic Profile & Workspace Card */}
        <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${banner.gradient} p-5 sm:p-6 text-white shadow-xl shadow-suka-brown/15 border border-white/10`}>
          {/* Soft background glow circles */}
          <div className="absolute right-0 top-0 -mt-6 -mr-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute left-1/3 bottom-0 -mb-10 w-48 h-48 bg-suka-orange/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex items-center justify-between gap-4">
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
            
            <div className="shrink-0">
              <LogoutButton />
            </div>
          </div>
        </div>


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
          <p>Sistem Operasional v2.8.0</p>
        </footer>
      </div>

      {/* Changelog Update Modal */}
      <ChangelogModal />
    </main>
  )
}

