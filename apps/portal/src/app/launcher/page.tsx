import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getOutletStaff, accessibleApps } from '@suka/auth'
import type { AppName } from '@suka/auth'
import LogoutButton from '@/components/LogoutButton'
import AppCard from '@/components/AppCard'
import { Avatar } from '@suka/design-system'

// Metadata per app
const APP_META: Record<AppName, { label: string; url: string; desc: string }> = {
  stok:              { label: 'Stok',             url: 'https://stok.sukashawarma.com',          desc: 'Monitoring & ledger stok bahan baku' },
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
    <main className="max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-suka-orange/10 pb-6">
        <div className="flex items-center gap-3.5">
          <Avatar name={staff.name} size={48} className="shadow-md shadow-suka-brown/5 border-2 border-white" />
          <div>
            <h1 className="text-xl font-extrabold text-suka-brown">
              Halo, {staff.name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="bg-suka-orange/10 text-suka-orange px-2.5 py-0.5 text-xs font-bold rounded-full capitalize">
                {staff.role.replace('_', ' ')}
              </span>
              <span className="text-xs text-suka-gray-400 font-semibold">•</span>
              <span className="text-xs text-suka-gray-500 font-bold">
                Outlet #{staff.outlet_id || 'Global'}
              </span>
            </div>
          </div>
        </div>
        <LogoutButton />
      </header>

      {/* Brand Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-suka-brown via-suka-ink to-suka-brown p-6 md:p-8 text-white shadow-xl shadow-suka-brown/10">
        <div className="absolute right-0 top-0 -mt-6 -mr-6 w-32 h-32 bg-suka-orange/15 rounded-full blur-2xl"></div>
        <div className="absolute left-1/3 bottom-0 -mb-6 w-24 h-24 bg-suka-orange/10 rounded-full blur-xl"></div>
        <div className="relative z-10 space-y-2">
          <h2 className="text-2xl md:text-3xl font-extrabold font-display tracking-tight text-suka-cream">
            SUKA PORTAL OPERASIONAL
          </h2>
          <p className="text-xs md:text-sm text-suka-cream/80 max-w-xl font-medium leading-relaxed">
            Pusat kendali digitalisasi outlet Sukashawarma. Akses aplikasi Anda berdasarkan peran dan mulailah aktivitas operasional harian.
          </p>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-suka-orange">
          Aplikasi Anda
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map(appName => {
            const meta = APP_META[appName]
            return <AppCard key={appName} label={meta.label} url={meta.url} desc={meta.desc} />
          })}
        </div>
      </section>

      <footer className="pt-6 border-t border-suka-orange/10 flex flex-wrap justify-between items-center text-xs text-suka-gray-400 font-semibold gap-2">
        <p>© {new Date().getFullYear()} Suka Shawarma. Hak Cipta Dilindungi.</p>
        <p>Sistem Operasional v2.6.0</p>
      </footer>
    </main>
  )
}

