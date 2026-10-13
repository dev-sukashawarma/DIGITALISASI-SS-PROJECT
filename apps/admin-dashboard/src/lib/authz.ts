import { cache } from 'react'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getVerifiedUserId } from '@suka/auth'

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
  const userId = await getVerifiedUserId(supabase)
  if (!userId) {
    throw new Error('Unauthorized: sesi tidak ditemukan')
  }

  const { data: staff, error: staffError } = await supabase
    .from('outlet_staff')
    .select('role, status')
    .eq('id', userId)
    .maybeSingle()

  if (staffError) throw new Error(staffError.message)
  // developer = superuser teknis: lolos semua daftar role.
  const hasAccess = allowedRoles.includes(staff?.role) || staff?.role === 'developer'
  if (!staff || staff.status !== 'active' || !hasAccess) {
    throw new Error(`Forbidden: aksi ini hanya untuk role ${allowedRoles.join('/')}`)
  }

  return { userId, role: staff.role }
}

/**
 * Peran yang diberi menu keuangan di admin-dashboard (Buku Kas, Laba Rugi,
 * Analisis Pengeluaran, Rekap Bulanan). `developer` otomatis lolos requireRole.
 */
export const PERAN_KEUANGAN = ['owner', 'admin']

/**
 * Saring daftar outlet mitra menurut hak pemanggil: owner/admin/developer boleh
 * semua; mitra hanya outlet di `mitra_profiles.outlet_ids` miliknya; peran lain
 * ditolak. Dipakai Server Action dashboard mitra yang menerima daftar outlet
 * dari browser — daftar itu tidak boleh dipercaya begitu saja.
 */
export async function batasiOutletMitra(outletIds: string[]): Promise<string[]> {
  const supabase = await createClient()
  const userId = await getVerifiedUserId(supabase)
  if (!userId) throw new Error('Unauthorized: sesi tidak ditemukan')

  const service = createServiceClient()
  const { data: staff, error } = await service
    .from('outlet_staff')
    .select('role, status')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!staff || staff.status !== 'active') throw new Error('Forbidden: akun tidak aktif')

  if (['owner', 'admin', 'developer'].includes(staff.role)) return outletIds
  if (staff.role !== 'mitra') throw new Error('Forbidden: aksi ini hanya untuk owner/admin/mitra')

  const { data: profil } = await service
    .from('mitra_profiles')
    .select('outlet_ids')
    .eq('user_id', userId)
    .maybeSingle()
  const milik = new Set<string>((profil?.outlet_ids as string[] | null) ?? [])
  return outletIds.filter(id => milik.has(id))
}

/**
 * `accessible_outlet_ids()` milik caller, di-memo per request lewat React
 * `cache()` — beberapa assert dalam satu render/action cukup 1 RPC.
 */
const getAccessibleOutletSet = cache(async (): Promise<Set<string>> => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('accessible_outlet_ids')
  if (error) throw new Error(error.message)
  return new Set(
    (Array.isArray(data) ? data : [])
      .map((row: unknown) =>
        typeof row === 'string'
          ? row
          : (row as { accessible_outlet_ids?: string } | null)?.accessible_outlet_ids
      )
      .filter((id): id is string => !!id)
  )
})

/**
 * Scope-check outlet_id yang dikirim client terhadap `accessible_outlet_ids()`
 * milik caller (sumber kebenaran yang sama dipakai RLS). Pakai ini untuk
 * action yang menerima `outletId` dari client — role check saja tidak cukup
 * untuk role multi-outlet-scoped (leader/korlap).
 */
export async function assertOutletAccessible(outletId: string): Promise<void> {
  const allowed = await getAccessibleOutletSet()
  if (!allowed.has(outletId)) {
    throw new Error('Forbidden: outlet di luar scope akses Anda')
  }
}
