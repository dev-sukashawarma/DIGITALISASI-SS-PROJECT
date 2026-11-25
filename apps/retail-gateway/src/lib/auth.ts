import { verifySession } from './session'
import { createRetailClient } from './supabase'

/**
 * Gerbang setiap endpoint privat. Identitas pelanggan SELALU diturunkan
 * dari token, tidak pernah dari isi permintaan -- Gateway memakai service
 * role, jadi percaya pada body sama dengan membuka seluruh database.
 *
 * Juga menolak token milik akun yang sudah dihapus atau dianonimkan
 * (email/name/phone semuanya null) agar JWT lama tidak bisa terus dipakai.
 */
export async function requireCustomer(
  request: Request
): Promise<{ customerId: string } | null> {
  const header = request.headers.get('authorization')
  if (!header) return null

  const [skema, token] = header.split(' ')
  if (skema !== 'Bearer' || !token) return null

  const sesi = await verifySession(token)
  if (!sesi) return null

  try {
    const { data, error } = await createRetailClient()
      .from('customers')
      .select('id, name, email, phone')
      .eq('id', sesi.customerId)
      .maybeSingle()

    if (error) return null
    if (!data) return null
    if (data.email === null && data.name === null && data.phone === null) {
      return null
    }
  } catch {
    return null
  }

  return sesi
}
