'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import { buatKunciBaru } from '@/lib/hermes/kunci'
import { validasiInputKunci, validasiScope } from '@/lib/hermes/validasi'

// Cek role DI DALAM action — guard halaman tidak melindungi server action (Session 2026-07-20).
const PERAN = ['owner', 'admin']
const JALUR = '/dashboard/sistem/hermes'
const UUID = /^[0-9a-f-]{36}$/i

export async function buatKunciHermes(input: { nama: string; scope: string[]; ip: string[] }) {
  const { userId } = await requireRole(PERAN)
  const v = validasiInputKunci(input)
  if (!v.ok) return { ok: false as const, pesan: v.pesan }
  const k = buatKunciBaru()
  const svc = createServiceClient()
  const { error } = await svc.from('hermes_api_key').insert({
    nama: v.nama, prefix: k.prefix, hash_kunci: k.hash, scope: v.scope, ip_diizinkan: v.ip, dibuat_oleh: userId,
  })
  if (error) return { ok: false as const, pesan: `Gagal menyimpan: ${error.message}` }
  revalidatePath(JALUR)
  return { ok: true as const, kunci: k.kunci }
}

export async function cabutKunciHermes(id: string) {
  await requireRole(PERAN)
  if (!UUID.test(id)) return { ok: false, pesan: 'ID tidak valid' }
  const svc = createServiceClient()
  const { error } = await svc.from('hermes_api_key').update({ aktif: false, dicabut_at: new Date().toISOString() }).eq('id', id)
  if (error) return { ok: false, pesan: error.message }
  revalidatePath(JALUR)
  return { ok: true }
}

export async function ubahIpKunciHermes(id: string, ip: string[]) {
  await requireRole(PERAN)
  if (!UUID.test(id)) return { ok: false, pesan: 'ID tidak valid' }
  // Validasi IP memakai validator yang sama (nama & scope pengisi yang pasti sah).
  const v = validasiInputKunci({ nama: 'abc', scope: ['penjualan'], ip })
  if (!v.ok) return { ok: false, pesan: v.pesan }
  const svc = createServiceClient()
  const { error } = await svc.from('hermes_api_key').update({ ip_diizinkan: v.ip }).eq('id', id)
  if (error) return { ok: false, pesan: error.message }
  revalidatePath(JALUR)
  return { ok: true }
}

// Membuka/menutup app untuk kunci yang sudah ada (paket per app, spec 2026-10-08 C5).
export async function ubahScopeKunciHermes(id: string, scope: string[]) {
  await requireRole(PERAN)
  if (!UUID.test(id)) return { ok: false, pesan: 'ID tidak valid' }
  const v = validasiScope(scope)
  if (!v.ok) return { ok: false, pesan: v.pesan }
  const svc = createServiceClient()
  const { error } = await svc.from('hermes_api_key').update({ scope: v.scope }).eq('id', id).eq('aktif', true)
  if (error) return { ok: false, pesan: error.message }
  revalidatePath(JALUR)
  return { ok: true }
}
