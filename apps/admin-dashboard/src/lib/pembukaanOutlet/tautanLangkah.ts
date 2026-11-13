/**
 * Ke mana tiap langkah papan persiapan dikerjakan. Kunci harus sama dengan
 * keluaran RPC `status_persiapan_outlet`. `null` = diedit langsung di papan.
 */
type App = 'hr' | 'stok' | 'distribusi' | 'absensi'

const ENV_APP: Record<App, string | undefined> = {
  hr: process.env.NEXT_PUBLIC_APP_URL_HR,
  stok: process.env.NEXT_PUBLIC_APP_URL_STOK,
  distribusi: process.env.NEXT_PUBLIC_APP_URL_DISTRIBUSI,
  absensi: process.env.NEXT_PUBLIC_APP_URL_ABSENSI,
}

function urlApp(app: App, path: string): string {
  const base = ENV_APP[app] || `https://${app}.sukashawarma.com`
  return `${base.replace(/\/$/, '')}${path}`
}

const PETA: Record<string, { app: App | null; path: string } | null> = {
  data_outlet: { app: null, path: '/dashboard/outlets' },
  am: { app: 'hr', path: '/staff' },
  crew: { app: 'hr', path: '/staff' },
  leader: { app: 'hr', path: '/staff' },
  stok_awal: { app: 'distribusi', path: '/distribusi/surat-jalan/new' },
  opname_pertama: { app: 'stok', path: '/stok/opname/new' },
  mitra: { app: null, path: '/dashboard/owner/kelola-mitra' },
  absensi: { app: 'absensi', path: '/dashboard/pengaturan' },
  target_harian: { app: null, path: '/dashboard/owner/targets' },
  masa_rab: null,
  grand_opening: null,
}

export function tautanLangkah(kunci: string, _outletId: string): { href: string; eksternal: boolean } | null {
  const t = PETA[kunci]
  if (!t) return null
  return t.app ? { href: urlApp(t.app, t.path), eksternal: true } : { href: t.path, eksternal: false }
}
