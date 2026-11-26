import { cookies } from 'next/headers'
import { createSupabaseServerClient, resolveUserId, type CapturedCookieItem } from '@suka/auth'

async function getAuthedContext(): Promise<{
  authedClient: ReturnType<typeof createSupabaseServerClient>
  userId: string | null
}> {
  const cookieStore = await cookies()
  const rawCookies = cookieStore.getAll()
  const capturedCookies: CapturedCookieItem[] = []

  const applySafeCookie = (name: string, value: string, options?: Record<string, unknown>) => {
    // PENTING: Jangan pernah menghapus cookie sesi (value kosong / maxAge <= 0) dari dalam
    // Server Action (seperti getOfficeVouchersAction yang dipanggil otomatis di latar belakang).
    // Bila browser/middleware baru saja merotasi refresh token, Server Action yang datang dengan
    // cookie lama tidak boleh menembakkan Set-Cookie Max-Age=0 yang menjatuhkan sesi user!
    if (!value || (typeof options?.maxAge === 'number' && options.maxAge <= 0)) return
    try {
      cookieStore.set(name, value, options as any)
    } catch {
      // Abaikan bila dipanggil dari konteks read-only
    }
  }

  const authedClient = createSupabaseServerClient({
    getAll: () => rawCookies,
    setAll: (toSet) => {
      toSet.forEach(({ name, value, options }) => {
        if (!value || (typeof options?.maxAge === 'number' && options.maxAge <= 0)) return
        capturedCookies.push({ name, value, options })
        applySafeCookie(name, value, options)
      })
    },
  })

  const userId = await resolveUserId(authedClient, process.env.SUPABASE_JWT_SECRET, {
    cookies: rawCookies,
    getCapturedCookies: () => capturedCookies,
    replayCookies: (replayed) => {
      replayed.forEach(({ name, value, options }) => applySafeCookie(name, value, options))
    },
  })

  return { authedClient, userId }
}

/**
 * Gerbang otorisasi server-side untuk Server Action `finance` yang memakai
 * service-role client.
 */
export async function requireRole(
  allowedRoles: string[]
): Promise<{ userId: string; role: string }> {
  const { authedClient, userId } = await getAuthedContext()
  if (!userId) {
    throw new Error('Unauthorized: sesi tidak ditemukan')
  }

  // Gunakan service-role untuk membaca profil role/status setelah userId terverifikasi secara kriptografis,
  // supaya tidak memicu pemanggilan getSession() kedua pada authedClient bila access_token mepet kedaluwarsa.
  const { getServiceSupabase } = await import('@/lib/supabase-service')
  const service = getServiceSupabase()
  const { data: staff, error: staffError } = await service
    .from('outlet_staff')
    .select('role, status')
    .eq('id', userId)
    .maybeSingle()

  if (staffError) throw new Error(staffError.message)
  const hasAccess = allowedRoles.includes(staff?.role) || staff?.role === 'developer'
  if (!staff || staff.status !== 'active' || !hasAccess) {
    throw new Error(`Forbidden: aksi ini hanya untuk role ${allowedRoles.join('/')}`)
  }

  void authedClient
  return { userId, role: staff.role }
}

export const PERAN_KEUANGAN = ['admin_finance', 'admin', 'owner']
