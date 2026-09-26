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

/**
 * Kolom InputVoucher yang boleh sampai ke DB -- persis 23, urutan tak penting.
 * Server TIDAK BOLEH percaya field lain dari client (id, created_at,
 * created_by, updated_at, dst): panel edit mengirim baris hasil select('*')
 * apa adanya, jadi tanpa whitelist ini client bisa menimpa created_by/
 * created_at/updated_at miliknya sendiri.
 */
const KOLOM_INPUT = [
  'nama', 'deskripsi', 'kode', 'jenis', 'nilai', 'maks_potongan', 'menu_item_id',
  'beli_qty', 'gratis_qty', 'harga_spesial', 'mulai', 'selesai', 'kuota_total',
  'batas_per_pelanggan', 'min_belanja', 'khusus_pesanan_pertama', 'outlet_ids',
  'hari', 'jam_mulai', 'jam_selesai', 'menu_ids', 'kategori_ids', 'is_active',
] as const satisfies readonly (keyof InputVoucher)[]

async function catat(db: ReturnType<typeof createServiceClient>, aksi: Aksi, oleh: string, sasaranId: string, data: unknown) {
  const { error } = await db.from('app_retail_log').insert({ aksi, oleh, sasaran_id: sasaranId, data })
  if (error) throw new Error(`Perubahan tersimpan, tapi log gagal ditulis: ${error.message}`)
}

function rapikan(i: InputVoucher): InputVoucher {
  const dipilih = Object.fromEntries(KOLOM_INPUT.map((k) => [k, i[k]])) as InputVoucher
  const kode = dipilih.kode?.trim().toUpperCase() || null
  const kosongJadiNull = <T,>(a: T[] | null) => (a && a.length > 0 ? a : null)
  return {
    ...dipilih, nama: dipilih.nama.trim(), deskripsi: dipilih.deskripsi?.trim() || null, kode,
    outlet_ids: kosongJadiNull(dipilih.outlet_ids), hari: kosongJadiNull(dipilih.hari),
    menu_ids: kosongJadiNull(dipilih.menu_ids), kategori_ids: kosongJadiNull(dipilih.kategori_ids),
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
