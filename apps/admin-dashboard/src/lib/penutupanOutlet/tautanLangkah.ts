/**
 * Ke mana tiap langkah papan Penutupan dikerjakan. Kunci harus sama dengan
 * keluaran RPC `status_penutupan_outlet`. `null` = dikerjakan langsung di papan
 * (tombol Nolkan sisa stok / centang) atau hanya informasi.
 */
type App = 'hr' | 'distribusi' | 'finance'

const ENV_APP: Record<App, string | undefined> = {
  hr: process.env.NEXT_PUBLIC_APP_URL_HR,
  distribusi: process.env.NEXT_PUBLIC_APP_URL_DISTRIBUSI,
  finance: process.env.NEXT_PUBLIC_APP_URL_FINANCE,
}

function urlApp(app: App, path: string): string {
  const base = ENV_APP[app] || `https://${app}.sukashawarma.com`
  return `${base.replace(/\/$/, '')}${path}`
}

const PETA: Record<string, { app: App | null; path: string } | null> = {
  crew: { app: 'hr', path: '/staff' },
  penugasan: { app: 'hr', path: '/staff' },
  order: { app: null, path: '/dashboard/reports/rekap-struk' },
  sj: { app: 'distribusi', path: '/distribusi/surat-jalan' },
  kas_kecil: { app: 'finance', path: '/approval' },
  kanal_online: { app: null, path: '/dashboard/app-retail/outlet' },
  mitra: { app: null, path: '/dashboard/owner/kelola-mitra' },
  stok: null,
  pesanan_nyasar: null,
  merchant_ojol: null,
  aset: null,
  biaya_rutin: null,
}

export function tautanLangkahPenutupan(kunci: string): { href: string; eksternal: boolean } | null {
  const t = PETA[kunci]
  if (!t) return null
  return t.app ? { href: urlApp(t.app, t.path), eksternal: true } : { href: t.path, eksternal: false }
}
