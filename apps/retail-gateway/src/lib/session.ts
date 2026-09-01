import { SignJWT, jwtVerify } from 'jose'

const MASA_BERLAKU_HARI = 30
const ISSUER = 'suka-retail-gateway'
const AUDIENCE = 'sukashawarma-app'

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET belum di-set atau kurang dari 32 karakter')
  }
  return new TextEncoder().encode(s)
}

export async function issueSession(
  customerId: string
): Promise<{ token: string; expiresAt: string }> {
  const kedaluwarsa = new Date(Date.now() + MASA_BERLAKU_HARI * 86_400_000)

  const token = await new SignJWT({ sub: customerId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(kedaluwarsa)
    .sign(secret())

  return { token, expiresAt: kedaluwarsa.toISOString() }
}

export async function verifySession(
  token: string
): Promise<{ customerId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    })
    if (typeof payload.sub !== 'string') return null
    return { customerId: payload.sub }
  } catch {
    return null
  }
}
