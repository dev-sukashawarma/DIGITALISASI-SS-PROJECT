import { verifySession } from './session'

/**
 * Gerbang setiap endpoint privat. Identitas pelanggan SELALU diturunkan
 * dari token, tidak pernah dari isi permintaan -- Gateway memakai service
 * role, jadi percaya pada body sama dengan membuka seluruh database.
 */
export async function requireCustomer(
  request: Request
): Promise<{ customerId: string } | null> {
  const header = request.headers.get('authorization')
  if (!header) return null

  const [skema, token] = header.split(' ')
  if (skema !== 'Bearer' || !token) return null

  return verifySession(token)
}
