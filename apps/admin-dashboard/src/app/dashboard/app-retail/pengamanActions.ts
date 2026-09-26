'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'
import { gabungDaftarHabis } from '@/lib/appRetail/menuHabis'
import { periksaPengaturan, normalisasiWa, type InputPengaturan } from '@/lib/appRetail/pengaturanForm'
import { periksaMenuTerlaris } from '@/lib/appRetail/menuTerlaris'

/**
 * Semua aksi tahap 1: cek role DI SERVER -> service client -> log.
 * 'use server' BUKAN privat (setiap export = endpoint POST); guard halaman
 * berjalan di browser dan tak melindungi action ini (Session 2026-07-20).
 */
const PERAN = ['owner', 'admin']

/** Sama dengan apps/retail-gateway/src/lib/menuHabisOutlet.ts PUSAT_OUTLET_ID. */
const PUSAT_OUTLET_ID = '550e8400-e29b-41d4-a716-446655440001'

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

export async function simpanMenuHabis(outletId: string, _idMenuAplikasiKlien: string[], idHabis: string[]) {
  const { userId } = await requireRole(PERAN)
  const db = createServiceClient()
  // Daftar menu aplikasi TIDAK dipercaya dari klien -- muat sendiri, supaya
  // `idHabis` yang disimpan hanya bisa berisi id menu aplikasi yang benar-benar
  // ada (M3). Parameter klien dipertahankan demi kompatibilitas pemanggil,
  // tapi tak dipakai lagi.
  const { data: menuRows, error: menuError } = await db.from('menu_items').select('id').eq('tampil_di_app', true)
  if (menuError) throw new Error(menuError.message)
  const idMenuAplikasi = (menuRows ?? []).map((m) => m.id as string)
  const setMenuAplikasi = new Set(idMenuAplikasi)
  const idHabisSah = idHabis.filter((id): id is string => typeof id === 'string' && setMenuAplikasi.has(id))

  const { data: lama, error: bacaError } = await db.from('kiosk_settings')
    .select('value').eq('outlet_id', outletId).eq('key', 'unavailable_menu_ids').maybeSingle()
  if (bacaError) throw new Error(bacaError.message)
  let lamaValue = lama?.value ?? null
  // Outlet belum punya baris sendiri -> daftar lama yang benar-benar berlaku
  // adalah baris PUSAT (aturan sama dengan POS & gateway, M4).
  if (lamaValue === null) {
    const { data: pusat, error: pusatError } = await db.from('kiosk_settings')
      .select('value').eq('outlet_id', PUSAT_OUTLET_ID).eq('key', 'unavailable_menu_ids').maybeSingle()
    if (pusatError) throw new Error(pusatError.message)
    lamaValue = pusat?.value ?? null
  }
  const nilai = gabungDaftarHabis(lamaValue, idMenuAplikasi, idHabisSah)
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
  const { data: hasil, error } = await db.from('app_pengaturan').update(baru).eq('id', 1).select('id')
  if (error) throw new Error(error.message)
  if (!hasil?.length) throw new Error('Baris pengaturan (id=1) tidak ditemukan -- update tidak mengenai apa pun.')
  await catat(db, 'pengaturan_ubah', userId, null, { sebelum: lama, sesudah: baru })
  segarkan()
}

export async function simpanMenuTerlaris(ids: string[]) {
  const { userId } = await requireRole(PERAN)
  const galat = periksaMenuTerlaris(ids)
  if (galat) throw new Error(galat)
  const db = createServiceClient()
  // Id dari klien TIDAK dipercaya -- hanya menu yang benar-benar tayang di
  // aplikasi yang boleh masuk; urutan kiriman admin dipertahankan.
  let idsSah: string[] = []
  if (ids.length > 0) {
    const { data: menuRows, error: menuError } = await db
      .from('menu_items').select('id').eq('tampil_di_app', true).in('id', ids)
    if (menuError) throw new Error(menuError.message)
    const tayang = new Set((menuRows ?? []).map((m) => m.id as string))
    idsSah = ids.filter((id) => tayang.has(id))
  }
  const { data: lama } = await db.from('app_pengaturan').select('menu_terlaris_ids').eq('id', 1).maybeSingle()
  const { data: hasil, error } = await db.from('app_pengaturan')
    .update({ menu_terlaris_ids: idsSah, diubah_oleh: userId, diubah_pada: new Date().toISOString() })
    .eq('id', 1).select('id')
  if (error) throw new Error(error.message)
  if (!hasil?.length) throw new Error('Baris pengaturan (id=1) tidak ditemukan -- update tidak mengenai apa pun.')
  await catat(db, 'pengaturan_ubah', userId, null, {
    menu_terlaris: { sebelum: lama?.menu_terlaris_ids ?? null, sesudah: idsSah },
  })
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
    .select('id, customer_id, order_id, draft_id, nominal')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('Refund ini sudah diproses.')
  const r = data[0]
  // FK `customer_notifications_order_id_fkey` menunjuk `retail.order_drafts(id)`,
  // BUKAN `public.orders(id)` -- `r.order_id` (kolom POS) tak pernah cocok
  // dengan draft manapun, jadi insert di bawah SELALU gagal FK kalau
  // memakainya. `r.draft_id` yang benar (diverifikasi ke katalog DB live).
  const { data: draft } = await retail.from('order_drafts')
    .select('pos_order_number').eq('id', r.draft_id).maybeSingle()
  const nomorTeks = draft?.pos_order_number != null ? ` #${draft.pos_order_number}` : ''
  const { error: notifError } = await retail.from('customer_notifications').insert({
    customer_id: r.customer_id,
    order_id: r.draft_id,
    type: 'order_status',
    title: 'Dana dikembalikan',
    body: `Dana Rp ${Number(r.nominal).toLocaleString('id-ID')} untuk pesanan${nomorTeks} sudah dikembalikan.`,
    data: { refund_id: r.id, pos_order_id: r.order_id },
  })
  if (notifError) console.error('notifikasi refund gagal', notifError)
  await catat(db, 'refund_selesai', userId, r.order_id, { refund_id: r.id, nominal: r.nominal, catatan: rapi })
  segarkan()
}
