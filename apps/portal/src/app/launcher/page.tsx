import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getOutletStaff, accessibleApps } from '@suka/auth'
import type { AppName } from '@suka/auth'
import LogoutButton from '@/components/LogoutButton'
import AppCard from '@/components/AppCard'

// Metadata per app
const APP_META: Record<AppName, { label: string; url: string; desc: string }> = {
  stok:              { label: 'Stok',             url: 'https://stok.sukashawarma.com',          desc: 'Monitoring & ledger stok' },
  absensi:           { label: 'Absensi',          url: 'https://absensi.sukashawarma.com',       desc: 'Presensi karyawan' },
  distribusi:        { label: 'Distribusi',       url: 'https://distribusi.sukashawarma.com',    desc: 'Pengiriman & surat jalan' },
  'pos-kasir':       { label: 'POS Kasir',        url: 'https://kasir.sukashawarma.com',         desc: 'Point of Sale' },
  'owner-dashboard': { label: 'Owner Dashboard',  url: 'https://owner.sukashawarma.com',         desc: 'Laporan omzet & analitik' },
}

export default async function LauncherPage() {
  const cookieStore = await cookies()

  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { staff, error } = await getOutletStaff(supabase, user.id)
  if (error || !staff) redirect('/')

  const apps = accessibleApps(staff.role)

  return (
    <main className="min-h-screen p-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Selamat datang, {staff.name}</h1>
          <p className="text-sm text-gray-500 capitalize">{staff.role.replace('_', ' ')}</p>
        </div>
        <LogoutButton />
      </header>

      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-gray-400">
          Aplikasi kamu
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map(appName => {
            const meta = APP_META[appName]
            return <AppCard key={appName} label={meta.label} url={meta.url} desc={meta.desc} />
          })}
        </div>
      </section>
    </main>
  )
}
