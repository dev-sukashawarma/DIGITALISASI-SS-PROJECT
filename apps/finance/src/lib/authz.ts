import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'



async function getAuthedClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) =>
      toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options as any)),
  })
}

/**
 * Gerbang otorisasi server-side untuk Server Action `finance` yang memakai
 * service-role client. 'use server' TIDAK berarti privat — tiap export
 * adalah endpoint POST yang bisa dipanggil langsung tanpa lewat UI, dan
 * middleware `hasAppAccess(role, 'finance')` meloloskan `leader`/`area_manager`
 * juga (mereka memang perlu app ini untuk tahap forward, TAPI bukan untuk
 * approve/proses tahap Finance). Audit lintas-app 2026-07-27.
 *
 * WAJIB dipanggil sebelum memanggil RPC SECURITY DEFINER / menulis lewat
 * service-role client. `userId` HARUS diambil dari hasil fungsi ini (session
 * ter-verifikasi), jangan pernah dari body request client.
 */
export async function requireRole(
  allowedRoles: string[]
): Promise<{ userId: string; role: string }> {
  const authedClient = await getAuthedClient()
  const {
    data: { user },
    error,
  } = await authedClient.auth.getUser()
  if (error || !user) {
    throw new Error('Unauthorized: sesi tidak ditemukan')
  }

  const { data: staff, error: staffError } = await authedClient
    .from('outlet_staff')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (staffError) throw new Error(staffError.message)
  if (!staff || staff.status !== 'active' || !allowedRoles.includes(staff.role)) {
    throw new Error(`Forbidden: aksi ini hanya untuk role ${allowedRoles.join('/')}`)
  }

  return { userId: user.id, role: staff.role }
}
