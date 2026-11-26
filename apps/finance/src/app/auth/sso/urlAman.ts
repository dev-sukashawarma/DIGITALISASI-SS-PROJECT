const PARAM_TOKEN = ['token_hash', 'tokenHash', 'access_token', 'refresh_token', 'accessToken', 'refreshToken']

/**
 * Tujuan redirect setelah sesi SSO dibuat. Hanya path internal pada origin yang sama.
 */
export function safeInternalPath(value: string | null | undefined, origin: string): string {
  const fallback = '/approval'
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

/** Query string bersih tanpa parameter token agar rahasia sesi tidak tertinggal di riwayat browser. */
export function searchTanpaToken(search: string): string {
  const params = new URLSearchParams(search)
  for (const k of PARAM_TOKEN) params.delete(k)
  const s = params.toString()
  return s ? `?${s}` : ''
}
