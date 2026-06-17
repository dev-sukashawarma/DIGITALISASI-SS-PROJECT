/**
 * Verifikasi tanda tangan access token Supabase secara LOKAL (HS256) tanpa
 * panggilan jaringan ke Auth server, memakai WebCrypto (`crypto.subtle`) yang
 * tersedia bawaan di Edge runtime (middleware) maupun Node — TANPA dependency
 * eksternal seperti `jose` (yang butuh install & rawan di Edge).
 * Kembalikan { sub } bila valid, null bila invalid/kedaluwarsa/sampah.
 */

/** Decode segmen base64url JWT menjadi bytes (portable Edge + Node). */
function b64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
  const bin = atob(b64 + pad)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function decodeJson(b64url: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(b64url)))
}

export async function verifyAccessToken(
  token: string,
  secret: string
): Promise<{ sub: string } | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [headerB64, payloadB64, sigB64] = parts

    const header = decodeJson(headerB64)
    if (header.alg !== 'HS256') return null

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret) as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      b64urlToBytes(sigB64) as BufferSource,
      new TextEncoder().encode(`${headerB64}.${payloadB64}`) as BufferSource
    )
    if (!valid) return null

    const payload = decodeJson(payloadB64)
    const now = Math.floor(Date.now() / 1000)
    if (typeof payload.exp === 'number' && payload.exp < now) return null
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null
    return { sub: payload.sub }
  } catch {
    return null
  }
}
