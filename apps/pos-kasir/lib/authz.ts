import { createClient, createServiceClient } from '@/lib/supabase/server'

export type RequestStaff = {
  id: string
  role: string
  outlet_id: string | null
}

/**
 * Identitas caller untuk endpoint approval magic-link (bypass absensi,
 * top-up petty cash, cancel order). Endpoint ini SENGAJA dikeluarkan dari
 * gate login `middleware.ts` (`isApiPath` skip) supaya link WA bisa dibuka
 * tanpa login — TAPI itu berarti route handler-nya sendiri WAJIB verifikasi
 * sesi sebelum memproses approve/reject, bukan cuma percaya `id`/token di
 * query string. Baca cookie sesi lewat `next/headers` (jalan di Route
 * Handler App Router), bukan dari body/query client.
 *
 * Return `null` kalau tak ada sesi valid ATAU staff tidak aktif — pemanggil
 * WAJIB membedakan ini dari "role tidak diizinkan" di pesan yang ditampilkan
 * (lihat requireApprover).
 */
export async function getRequestStaff(): Promise<RequestStaff | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: staff } = await supabase
    .from('outlet_staff')
    .select('id, role, outlet_id, status')
    .eq('id', user.id)
    .maybeSingle()

  if (!staff || staff.status !== 'active') return null
  return { id: staff.id, role: staff.role, outlet_id: staff.outlet_id }
}

export type ApprovalCheck =
  | { ok: true; staff: RequestStaff }
  | { ok: false; reason: 'not_logged_in' | 'wrong_role' | 'self_approval' | 'outlet_mismatch' }

/**
 * Gerbang otorisasi untuk approval magic-link. `requesterId` HARUS berasal
 * dari kolom `requested_by`/`created_by` yang di-stempel DB (trigger
 * `stamp_requested_by_from_auth`/`stamp_petty_cash_created_by_from_auth`,
 * migration 20260728110000) — bukan dari payload client, supaya tak bisa
 * dipalsukan untuk mengelabui cek approver≠requester.
 */
export async function requireApprover(
  allowedRoles: string[],
  requesterId: string | null,
  requesterOutletId?: string | null
): Promise<ApprovalCheck> {
  const staff = await getRequestStaff()
  if (!staff) return { ok: false, reason: 'not_logged_in' }
  if (!allowedRoles.includes(staff.role)) return { ok: false, reason: 'wrong_role' }
  if (requesterId && staff.id === requesterId) return { ok: false, reason: 'self_approval' }

  if (requesterOutletId) {
    // Jangan bandingkan outlet_id staff langsung — leader bisa multi-outlet
    // via staff_outlets (lihat CLAUDE.md § Outlet Model). accessible_outlet_ids()
    // adalah sumber kebenaran yang sama dipakai RLS di seluruh project.
    const supabase = await createClient()
    const { data } = await supabase.rpc('accessible_outlet_ids')
    const allowed = new Set(
      (Array.isArray(data) ? data : [])
        .map((row: unknown) =>
          typeof row === 'string'
            ? row
            : (row as { accessible_outlet_ids?: string } | null)?.accessible_outlet_ids
        )
        .filter((id): id is string => !!id)
    )
    if (!allowed.has(requesterOutletId)) return { ok: false, reason: 'outlet_mismatch' }
  }

  return { ok: true, staff }
}
