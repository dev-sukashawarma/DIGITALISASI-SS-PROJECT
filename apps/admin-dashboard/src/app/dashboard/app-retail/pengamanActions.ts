'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import { gabungDaftarHabis } from '@/lib/appRetail/menuHabis'
import { periksaPengaturan, normalisasiWa, type InputPengaturan } from '@/lib/appRetail/pengaturanForm'

/**
 * Semua aksi tahap 1: cek role DI SERVER -> service client -> log.
 * 'use server' BUKAN privat (setiap export = endpoint POST); guard halaman
 * berjalan di browser dan tak melindungi action ini (Session 2026-07-20).
 */
const PERAN = ['owner', 'admin']

type Aksi = 'pengaturan_ubah' | 'tutup_sementara' | 'buka_sekarang' | 'jam_ubah' | 'menu_habis_ubah' | 'refund_selesai'

async function catat(db: ReturnType<typeof createServiceClient>, aksi: Aksi, oleh: string, sasaranId: string | null, data: unknown) {
  const { error } = await db.from('app_retail_log').insert({ aksi, oleh, sasaran_id: sasaranId, data })
  // Log gagal = aksi dianggap gagal dilaporkan; perubahan sudah terjadi, jadi
  // galat dilempar supaya admin tahu jejaknya tak tercatat.
  if (error) throw new Error(`Perubahan tersimpan, tapi log gagal ditulis: ${error.message}`)
}

function segarkan() {
  revalidatePath('/dashboard/app-retail')
  revalidatePath('/dashboard/app-retail/outlet')
  revalidatePath('/dashboard/app-retail/pesanan')
  revalidatePath('/dashboard/app-retail/pengaturan')
}

const JAM = /^([01]\d|2[0-3]):[0-5]\d$/

export async function ubahJamOutlet(outletId: string, openHour: string, closeHour: string) {
  const { userId } = await requireRole(PERAN)
  if (!JAM.test(openHour) || !JAM.test(closeHour)) throw new Error('Format jam harus HH:MM.')
  if (openHour === closeHour) throw new Error('Jam buka dan tutup tidak boleh sama.')
  const db = createServiceClient()
  const { data: lama } = await db.from('outlets').select('open_hour, close_hour').eq('id', outletId).maybeSingle()
  const { data, error } = await db.from('outlets')
    .update({ open_hour: `${openHour}:00`, close_hour: `${closeHour}:00` })
    .eq('id', outletId).select('id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('Outlet tidak ditemukan.')
  await catat(db, 'jam_ubah', userId, outletId, { sebelum: lama, sesudah: { openHour, closeHour } })
  segarkan()
}

export async function tutupSementara(outletId: string | null, sampaiIso: string, alasan: string) {
  const { userId } = await requireRole(PERAN)
  const sampai = new Date(sampaiIso)
  if (!Number.isFinite(sampai.getTime()) || sampai.getTime() <= Date.now()) throw new Error('Waktu "sampai" sudah lewat.')
  const rapi = alasan.trim()
  if (rapi.length > 120) throw new Error('Alasan maksimal 120 huruf.')
  const db = createServiceClient()
  const { data, error } = await db.from('outlet_tutup_sementara')
    .insert({ outlet_id: outletId, sampai: sampai.toISOString(), alasan: rapi || null, dibuat_oleh: userId })
    .select('id').single()
  if (error) throw new Error(error.message)
  await catat(db, 'tutup_sementara', userId, outletId, { id: data.id, sampai: sampai.toISOString(), alasan: rapi || null })
  segarkan()
}

export async function bukaSekarang(tutupId: string) {
  const { userId } = await requireRole(PERAN)
  const db = createServiceClient()
  const { data, error } = await db.from('outlet_tutup_sementara')
    .update({ dicabut_oleh: userId, dicabut_pada: new Date().toISOString() })
    .eq('id', tutupId).is('dicabut_pada', null).select('id, outlet_id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('Penutupan ini sudah tidak aktif.')
  await catat(db, 'buka_sekarang', userId, data[0].outlet_id, { id: tutupId })
  segarkan()
}

export async function simpanMenuHabis(outletId: string, idMenuAplikasi: string[], idHabis: string[]) {
  const { userId } = await requireRole(PERAN)
  const db = createServiceClient()
  const { data: lama, error: bacaError } = await db.from('kiosk_settings')
    .select('value').eq('outlet_id', outletId).eq('key', 'unavailable_menu_ids').maybeSingle()
  if (bacaError) throw new Error(bacaError.message)
  const nilai = gabungDaftarHabis(lama?.value ?? null, idMenuAplikasi, idHabis)
  const { error } = await db.from('kiosk_settings')
    .upsert({ outlet_id: outletId, key: 'unavailable_menu_ids', value: nilai }, { onConflict: 'outlet_id,key' })
  if (error) throw new Error(error.message)
  await catat(db, 'menu_habis_ubah', userId, outletId, { sebelum: lama?.value ?? null, sesudah: nilai })
  segarkan()
}

export async function simpanPengaturan(input: InputPengaturan) {
  const { userId } = await requireRole(PERAN)
  const galat = periksaPengaturan(input)
  if (galat) throw new Error(galat)
  const db = createServiceClient()
  const { data: lama } = await db.from('app_pengaturan').select('*').eq('id', 1).maybeSingle()
  const baru = {
    menit_pesan_terakhir: input.menitPesanTerakhir,
    menit_tertahan: input.menitTertahan,
    estimasi_siap: input.estimasiSiap.trim(),
    wa_cs: normalisasiWa(input.waCs),
    versi_minimum_android: input.versiMinimumAndroid,
    url_syarat: input.urlSyarat.trim() || null,
    url_privasi: input.urlPrivasi.trim() || null,
    diubah_oleh: userId,
    diubah_pada: new Date().toISOString(),
  }
  const { error } = await db.from('app_pengaturan').update(baru).eq('id', 1)
  if (error) throw new Error(error.message)
  await catat(db, 'pengaturan_ubah', userId, null, { sebelum: lama, sesudah: baru })
  segarkan()
}

export async function tandaiRefundSelesai(refundId: string, catatan: string) {
  const { userId } = await requireRole(PERAN)
  const rapi = catatan.trim()
  if (rapi === '') throw new Error('Catatan/referensi transfer wajib diisi.')
  const db = createServiceClient()
  const retail = db.schema('retail')
  const { data, error } = await retail.from('refund_pesanan')
    .update({ status: 'sudah', catatan: rapi, diproses_oleh: userId, diproses_pada: new Date().toISOString() })
    .eq('id', refundId).eq('status', 'perlu')
    .select('id, customer_id, order_id, nominal')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('Refund ini sudah diproses.')
  const r = data[0]
  const { error: notifError } = await retail.from('customer_notifications').insert({
    customer_id: r.customer_id,
    order_id: r.order_id,
    type: 'order_status',
    title: 'Dana dikembalikan',
    body: `Dana Rp ${Number(r.nominal).toLocaleString('id-ID')} untuk pesananmu sudah dikembalikan.`,
    data: { refund_id: r.id },
  })
  if (notifError) console.error('notifikasi refund gagal', notifError)
  await catat(db, 'refund_selesai', userId, r.order_id, { refund_id: r.id, nominal: r.nominal, catatan: rapi })
  segarkan()
}
