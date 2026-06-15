import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getOutletStaff, accessibleApps } from '@suka/auth'
import type { AppName } from '@suka/auth'
import LogoutButton from '@/components/LogoutButton'
import AppCard from '@/components/AppCard'
import { Avatar } from '@suka/design-system'

// Metadata per app
const APP_META: Record<AppName, { label: string; url: string; desc: string }> = {
  stok:              { label: 'Stok',             url: 'http://localhost:3001',                  desc: 'Monitoring & ledger stok bahan baku' },
  absensi:           { label: 'Absensi',          url: 'https://absensi.sukashawarma.com',       desc: 'Presensi karyawan dengan verifikasi wajah' },
  distribusi:        { label: 'Distribusi',       url: 'https://distribusi.sukashawarma.com',    desc: 'Pengiriman bahan baku & surat jalan' },
  'pos-kasir':       { label: 'POS Kasir',        url: 'https://kasir.sukashawarma.com',         desc: 'Transaksi penjualan & point of sale' },
  'owner-dashboard': { label: 'Owner Dashboard',  url: 'https://owner.sukashawarma.com',         desc: 'Laporan omzet & analisis keuangan' },
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

  const apps = accessibleApps(staff.role)

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 md:py-12 space-y-6">
      {/* Compact Header Card */}
      <header className="bg-white border border-suka-orange/15 rounded-2xl p-4 shadow-sm shadow-suka-brown/5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <Avatar name={staff.name} size={44} className="shadow shadow-suka-brown/5 border border-suka-cream flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-extrabold text-suka-brown truncate">
              Halo, {staff.name}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="bg-suka-orange/10 text-suka-orange px-2 py-0.5 text-[10px] font-bold rounded-full capitalize truncate">
                {staff.role.replace('_', ' ')}
              </span>
              <span className="text-[10px] text-suka-gray-400 font-semibold flex-shrink-0">•</span>
              <span className="text-[10px] text-suka-gray-500 font-bold truncate">
                {staff.outlets?.name ?? 'Semua Outlet'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0">
          <LogoutButton />
        </div>
      </header>

      {/* Kitchen Controller Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-suka-brown via-suka-ink to-suka-brown p-5 md:p-6 text-white shadow-md shadow-suka-brown/5">
        <div className="absolute right-0 top-0 -mt-4 -mr-4 w-24 h-24 bg-suka-orange/15 rounded-full blur-xl"></div>
        <div className="relative z-10 space-y-1">
          <h2 className="text-md font-extrabold tracking-wider text-suka-cream uppercase">
            KITCHEN CONTROLLER PORTAL
          </h2>
          <p className="text-[11px] text-suka-cream/80 font-medium leading-relaxed max-w-lg">
            Akses modul operasional harian Anda di bawah ini.
          </p>
        </div>
      </div>

      {/* Applications List */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-extrabold uppercase tracking-wider text-suka-orange">
          Aplikasi Anda
        </h2>
        <div className="flex flex-col gap-3">
          {apps.map(appName => {
            const meta = APP_META[appName]
            return <AppCard key={appName} label={meta.label} url={meta.url} desc={meta.desc} />
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="pt-4 border-t border-suka-orange/10 flex flex-wrap justify-between items-center text-[10px] text-suka-gray-400 font-semibold gap-2">
        <p>© {new Date().getFullYear()} Suka Shawarma. Hak Cipta Dilindungi.</p>
        <p>Sistem Operasional v2.6.0</p>
      </footer>
    </main>
  )
}
