import Link from 'next/link'

export type TabOutlet = 'semua' | 'persiapan' | 'penutupan'

/**
 * Tab menu "Outlet": Semua Outlet (/dashboard/outlets), Persiapan
 * (/dashboard/pembukaan-outlet), dan Penutupan (/dashboard/penutupan-outlet).
 * Alamat lama tetap dipertahankan supaya tautan papan & wizard tidak putus;
 * tab ini yang menyatukannya di layar.
 * Hanya untuk admin/developer — owner tidak bisa membuka /dashboard/outlets.
 */
export function OutletTabs({
  aktif,
  jumlahPersiapan,
  jumlahPenutupan,
}: {
  aktif: TabOutlet
  jumlahPersiapan?: number
  jumlahPenutupan?: number
}) {
  const tab = (id: TabOutlet, href: string, label: string, angka?: number) => {
    const terpilih = aktif === id
    return (
      <Link
        href={href}
        aria-current={terpilih ? 'page' : undefined}
        className={`inline-flex min-h-[44px] items-center gap-2 border-b-2 px-4 py-2 text-sm font-bold transition-colors ${
          terpilih
            ? 'border-suka-orange text-suka-ink'
            : 'border-transparent text-suka-gray-500 hover:text-suka-ink'
        }`}
      >
        {label}
        {angka !== undefined && angka > 0 && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              terpilih ? 'bg-suka-orange text-white' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {angka}
          </span>
        )}
      </Link>
    )
  }

  return (
    <nav aria-label="Bagian menu Outlet" className="flex gap-1 border-b border-suka-gray-200">
      {tab('semua', '/dashboard/outlets', 'Semua Outlet')}
      {tab('persiapan', '/dashboard/pembukaan-outlet', 'Persiapan', jumlahPersiapan)}
      {tab('penutupan', '/dashboard/penutupan-outlet', 'Penutupan', jumlahPenutupan)}
    </nav>
  )
}
