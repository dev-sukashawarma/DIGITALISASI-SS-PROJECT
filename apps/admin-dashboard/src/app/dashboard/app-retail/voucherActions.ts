'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import { periksaVoucher, type InputVoucher } from '@/lib/appRetail/voucher'

/**
 * 'use server' BUKAN privat -- setiap export adalah endpoint POST. Role dicek
 * DI SINI, bukan hanya di halaman (Session 2026-07-20).
 * `catat` sengaja TIDAK diekspor: fungsi async yang diekspor dari berkas ini
 * akan jadi endpoint publik.
 */
const PERAN = ['owner', 'admin']
type Aksi = 'voucher_buat' | 'voucher_ubah' | 'voucher_aktif' | 'voucher_hapus'

async function catat(db: ReturnType<typeof createServiceClient>, aksi: Aksi, oleh: string, sasaranId: string, data: unknown) {
  const { error } = await db.from('app_retail_log').insert({ aksi, oleh, sasaran_id: sasaranId, data })
  if (error) throw new Error(`Perubahan tersimpan, tapi log gagal ditulis: ${error.message}`)
}

function rapikan(i: InputVoucher): InputVoucher {
  const kode = i.kode?.trim().toUpperCase() || null
  const kosongJadiNull = <T,>(a: T[] | null) => (a && a.length > 0 ? a : null)
  return {
    ...i, nama: i.nama.trim(), deskripsi: i.deskripsi?.trim() || null, kode,
    outlet_ids: kosongJadiNull(i.outlet_ids), hari: kosongJadiNull(i.hari),
    menu_ids: kosongJadiNull(i.menu_ids), kategori_ids: kosongJadiNull(i.kategori_ids),
  }
}

export async function simpanVoucher(input: InputVoucher, id: string | null): Promise<{ id: string }> {
  const { userId } = await requireRole(PERAN)
  const data = rapikan(input)
  const galat = periksaVoucher(data)
  if (galat) throw new Error(galat)
  const retail = createServiceClient().schema('retail')
  const db = createServiceClient()
  if (id) {
    const { data: lama } = await retail.from('vouchers').select('*').eq('id', id).maybeSingle()
    const { data: hasil, error } = await retail.from('vouchers')
      .update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select('id')
    if (error) throw new Error(error.code === '23505' ? 'Kode voucher sudah dipakai voucher lain.' : error.message)
    if (!hasil?.length) throw new Error('Voucher tidak ditemukan.')
    await catat(db, 'voucher_ubah', userId, id, { sebelum: lama, sesudah: data })
    revalidatePath('/dashboard/app-retail/voucher')
    return { id }
  }
  const { data: baru, error } = await retail.from('vouchers')
    .insert({ ...data, created_by: userId }).select('id').single()
  if (error) throw new Error(error.code === '23505' ? 'Kode voucher sudah dipakai voucher lain.' : error.message)
  await catat(db, 'voucher_buat', userId, baru.id as string, data)
  revalidatePath('/dashboard/app-retail/voucher')
  return { id: baru.id as string }
}

export async function ubahAktifVoucher(id: string, aktif: boolean): Promise<void> {
  const { userId } = await requireRole(PERAN)
  const db = createServiceClient()
  const { data, error } = await db.schema('retail').from('vouchers')
    .update({ is_active: aktif, updated_at: new Date().toISOString() }).eq('id', id).select('id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('Voucher tidak ditemukan.')
  await catat(db, 'voucher_aktif', userId, id, { is_active: aktif })
  revalidatePath('/dashboard/app-retail/voucher')
}

export async function hapusVoucher(id: string): Promise<void> {
  const { userId } = await requireRole(PERAN)
  const db = createServiceClient()
  const { data, error } = await db.schema('retail').from('vouchers').delete().eq('id', id).select('id')
  // 23503 = masih dirujuk voucher_pemakaian (FK RESTRICT).
  if (error) throw new Error(error.code === '23503' ? 'Voucher sudah pernah dipakai. Nonaktifkan saja.' : error.message)
  if (!data?.length) throw new Error('Voucher tidak ditemukan.')
  await catat(db, 'voucher_hapus', userId, id, {})
  revalidatePath('/dashboard/app-retail/voucher')
}
