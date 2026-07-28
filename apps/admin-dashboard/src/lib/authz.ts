import { createClient } from '@/lib/supabase/server'

/**
 * Gerbang otorisasi server-side untuk Server Action yang memakai service-role
 * client (bypass RLS). 'use server' TIDAK berarti privat — tiap export adalah
 * endpoint POST yang bisa dipanggil langsung oleh siapa pun yang punya sesi,
 * tanpa lewat halaman/komponen mana pun. Middleware hanya cek
 * `hasAppAccess(role, 'admin-dashboard')` (mitra pun lolos), dan guard di UI
 * berjalan di browser — keduanya tidak melindungi Server Action. Audit
 * lintas-app 2026-07-27 menemukan banyak action di app ini memakai
 * service-role client tanpa cek role sama sekali (lihat memory
 * `server-action-authz-gap`).
 *
 * WAJIB dipanggil sebelum menyentuh service-role client di action mana pun
 * yang menulis data atau membaca data privileged.
 */
export async function requireRole(
  allowedRoles: string[]
): Promise<{ userId: string; role: string }> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('Unauthorized: sesi tidak ditemukan')
  }

  const { data: staff, error: staffError } = await supabase
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

/**
 * Scope-check outlet_id yang dikirim client terhadap `accessible_outlet_ids()`
 * milik caller (sumber kebenaran yang sama dipakai RLS). Pakai ini untuk
 * action yang menerima `outletId` dari client — role check saja tidak cukup
 * untuk role multi-outlet-scoped (leader/korlap).
 */
export async function assertOutletAccessible(outletId: string): Promise<void> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('accessible_outlet_ids')
  if (error) throw new Error(error.message)
  const allowed = new Set(
    (Array.isArray(data) ? data : [])
      .map((row: unknown) =>
        typeof row === 'string'
          ? row
          : (row as { accessible_outlet_ids?: string } | null)?.accessible_outlet_ids
      )
      .filter((id): id is string => !!id)
  )
  if (!allowed.has(outletId)) {
    throw new Error('Forbidden: outlet di luar scope akses Anda')
  }
}
