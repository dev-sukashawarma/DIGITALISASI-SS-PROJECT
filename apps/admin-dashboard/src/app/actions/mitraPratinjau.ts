'use server'

import { cookies } from 'next/headers'
import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import { COOKIE_PRATINJAU_MITRA, ROLE_PRATINJAU_MITRA } from '@/lib/mitraPratinjau'

/**
 * Pilih mitra yang dipratinjau admin di /dashboard/mitra. Hanya menyimpan pilihan
 * di cookie — tidak mengubah data apa pun. Cookie ini baru dibaca layout bila
 * penggunanya privileged dan tidak punya profil mitra sendiri, jadi akun mitra
 * tidak bisa memakainya untuk melihat outlet mitra lain.
 */
export async function pilihMitraPratinjau(mitraId: string): Promise<{ ok: boolean; pesan?: string }> {
  try {
    await requireRole(ROLE_PRATINJAU_MITRA)
  } catch {
    return { ok: false, pesan: 'Mode pratinjau hanya untuk admin, owner, atau developer.' }
  }

  if (typeof mitraId !== 'string' || !mitraId) return { ok: false, pesan: 'Mitra tidak valid.' }

  const svc = createServiceClient()
  const { data: profil } = await svc.from('mitra_profiles').select('id').eq('id', mitraId).maybeSingle()
  if (!profil) return { ok: false, pesan: 'Profil mitra tidak ditemukan.' }

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_PRATINJAU_MITRA, profil.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/dashboard/mitra',
    maxAge: 60 * 60 * 12,
  })
  return { ok: true }
}
