const PORTAL_FALLBACK = 'https://app.sukashawarma.com'

/** localhost, 127.x, 192.168.x, 10.x, 172.16-31.x */
const PRIVATE_HOST = /^(localhost$|127\.|0\.0\.0\.0$|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/

/**
 * URL portal untuk logout / kembali ke launcher.
 *
 * NEXT_PUBLIC_PORTAL_URL di-inline webpack saat build, jadi salah isi di panel
 * deploy (mis. tersalin nilai dev `http://192.168.1.24:3010`) membuat logout di
 * produksi melempar user ke IP LAN yang tidak bisa dijangkau. Guard di bawah
 * mengabaikan URL privat kalau halaman ini sendiri dibuka dari host publik.
 */
export function portalUrl(): string {
  const configured = process.env.NEXT_PUBLIC_PORTAL_URL
  if (!configured) return PORTAL_FALLBACK

  try {
    const target = new URL(configured)
    const onPrivatePage =
      typeof window !== 'undefined' && PRIVATE_HOST.test(window.location.hostname)
    if (PRIVATE_HOST.test(target.hostname) && !onPrivatePage) return PORTAL_FALLBACK
    return configured
  } catch {
    return PORTAL_FALLBACK
  }
}
