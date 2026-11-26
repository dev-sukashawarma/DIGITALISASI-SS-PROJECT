import { cookies } from 'next/headers'
import {
  createSupabaseServerClient,
  hasActiveSessionCookieWrite,
  resolveUserId,
  type CapturedCookieItem,
} from '@suka/auth'

async function getAuthedContext(): Promise<{
  authedClient: ReturnType<typeof createSupabaseServerClient>
  userId: string | null
}> {
  const cookieStore = await cookies()
  const rawCookies = cookieStore.getAll()
  const capturedCookies: CapturedCookieItem[] = []

  const applySafeBatch = (batch: CapturedCookieItem[]) => {
    // Hanya terapkan penulisan cookie bila batch tersebut membawa sesi baru yang aktif
    // (termasuk penghapusan chunk lama yang berlebih dalam batch yang sama).
    // Abaikan batch yang isinya murni penghapusan akibat kegagalan refresh paralel.
    if (!hasActiveSessionCookieWrite(batch)) return
    for (const { name, value, options } of batch) {
      try {
        cookieStore.set(name, value, options as any)
      } catch {
        // Abaikan bila dipanggil dari konteks read-only
      }
    }
  }

  const authedClient = createSupabaseServerClient({
    getAll: () => rawCookies,
    setAll: (toSet) => {
      if (!hasActiveSessionCookieWrite(toSet)) return
      toSet.forEach((item) => capturedCookies.push(item))
      applySafeBatch(toSet)
    },
  })

  const userId = await resolveUserId(authedClient, process.env.SUPABASE_JWT_SECRET, {
    cookies: rawCookies,
    getCapturedCookies: () => capturedCookies,
    replayCookies: (replayed) => applySafeBatch(replayed),
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
