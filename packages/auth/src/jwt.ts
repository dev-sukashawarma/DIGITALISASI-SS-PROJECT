import { jwtVerify } from 'jose'

/**
 * Verifikasi tanda tangan access token Supabase secara LOKAL (HS256) tanpa
 * panggilan jaringan ke Auth server. `exp` dicek otomatis oleh jose.
 * Kembalikan { sub } bila valid, null bila invalid/kedaluwarsa/sampah.
 */
export async function verifyAccessToken(
  token: string,
  secret: string
): Promise<{ sub: string } | null> {
  try {
    const key = new TextEncoder().encode(secret)
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] })
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null
    return { sub: payload.sub }
  } catch {
    return null
  }
}
