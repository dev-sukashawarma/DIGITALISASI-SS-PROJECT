// Pembantu URL untuk halaman serah-terima sesi (/auth/sso).

const PARAM_TOKEN = ['access_token', 'refresh_token', 'accessToken', 'refreshToken']

/**
 * Tujuan redirect setelah sesi dibuat. Hanya path di origin sendiri.
 * Browser menormalkan `\` menjadi `/`, jadi `/\evil.com` = `//evil.com`
 * (protocol-relative → domain lain). Karakter kendali (tab/newline) juga
 * dibuang browser dari URL, jadi ikut ditolak.
 */
export function safeInternalPath(value: string | null | undefined, origin: string): string {
  const fallback = '/dashboard'
  if (!value || !value.startsWith('/')) return fallback
  if (value.startsWith('//') || value.includes('\\')) return fallback
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback
  try {
    const url = new URL(value, origin)
    if (url.origin !== new URL(origin).origin) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

/** Query string tanpa parameter token (token tidak boleh tertinggal di riwayat). */
export function searchTanpaToken(search: string): string {
  const params = new URLSearchParams(search)
  for (const k of PARAM_TOKEN) params.delete(k)
  const s = params.toString()
  return s ? `?${s}` : ''
}
