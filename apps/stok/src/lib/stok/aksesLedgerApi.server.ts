// Hanya untuk route handler / server (memakai next/headers).
import { cookies } from 'next/headers'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'
import type { SupabaseClient } from '@supabase/supabase-js'
import { assertStaffCanAccessOutlet } from '@/lib/stok/outletAccess'
import { bolehInvalidasiSemuaOutlet, statusHttpGalatAkses } from '@/lib/stok/aksesLedgerApi'

export type HasilAksesLedger =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 | 500; error: string }

/**
 * Gerbang route /api/ledger*. Route ini membaca/menghapus cache ledger dengan
 * service-role client (bypass RLS), jadi WAJIB memeriksa sesi + scope outlet
 * sendiri — middleware hanya memastikan role boleh membuka app stok, sehingga
 * crew outlet A dulu bisa membaca ledger outlet B lewat ?outletId=.
 *
 * outletId kosong (invalidasi semua outlet) hanya untuk role pusat.
 */
export async function periksaAksesLedger(
  serviceClient: SupabaseClient,
  outletId: string | null | undefined
): Promise<HasilAksesLedger> {
  const cookieStore = await cookies()
  const authed = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    // Route handler: refresh token tidak perlu ditulis balik di sini.
    setAll: () => {},
  })

  const userId = await getVerifiedUserId(authed)
  if (!userId) return { ok: false, status: 401, error: 'Unauthorized: sesi tidak valid' }

  if (outletId) {
    try {
      await assertStaffCanAccessOutlet(serviceClient, userId, outletId)
      return { ok: true, userId }
    } catch (err) {
      return {
        ok: false,
        status: statusHttpGalatAkses(err),
        error: err instanceof Error ? err.message : 'Forbidden',
      }
    }
  }

  const { data: staff, error } = await serviceClient
    .from('outlet_staff')
    .select('role, status')
    .eq('id', userId)
    .maybeSingle()
  if (error) return { ok: false, status: 500, error: error.message }
  if (!staff || staff.status !== 'active' || !bolehInvalidasiSemuaOutlet(staff.role)) {
    return { ok: false, status: 403, error: 'Forbidden: outletId wajib untuk role Anda' }
  }
  return { ok: true, userId }
}
