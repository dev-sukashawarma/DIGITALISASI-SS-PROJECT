'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { revalidatePath } from 'next/cache'
import type { MenuItem } from '@/pos-types'
import { syncMenuToOrderOnline } from './order-online-sync'
import { alasanTolakHapus, lokasiGambar, PESAN_TANPA_IZIN, type PemakaianMenu } from '@/lib/pos/hapusMenu'

async function getSupabase() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })
}

async function markSync(supabase: any, id: string, status: string, error?: string | null) {
  await supabase.from('menu_items').update({
    order_online_sync_status: status,
    order_online_sync_error: error || null,
    order_online_sync_updated_at: new Date().toISOString(),
  }).eq('id', id)
}

async function enqueueSync(supabase: any, id: string | null, operation: 'upsert' | 'delete', payload: any) {
  if (!id) return
  await supabase.from('order_online_menu_sync_queue').delete().eq('menu_item_id', id).in('status', ['pending', 'failed'])
  await supabase.from('order_online_menu_sync_queue').insert({ menu_item_id: id, operation, payload, status: 'pending', next_attempt_at: new Date().toISOString() })
}

async function syncOrQueue(supabase: any, row: any, operation: 'upsert' | 'delete') {
  try {
    await syncMenuToOrderOnline(supabase, row, operation)
    if (operation === 'upsert') await markSync(supabase, row.id, 'synced')
  } catch (err: any) {
    const message = err?.message || 'Sinkronisasi Order-Online gagal'
    await enqueueSync(supabase, row.id, operation, row)
    if (operation === 'upsert') await markSync(supabase, row.id, 'pending', message)
    throw new Error(`Perubahan Admin tersimpan, tetapi sinkronisasi Order-Online tertunda: ${message}`)
  }
}

export async function toggleMenuAvailability(id: string, currentStatus: boolean) {
  const supabase = await getSupabase()
  const { data, error } = await supabase.from('menu_items').update({ is_available: !currentStatus }).eq('id', id).select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error(PESAN_TANPA_IZIN)
  
  revalidatePath('/dashboard/pos-admin/menu')
}

/**
 * Hasil hapus/nonaktifkan dikembalikan sebagai objek, BUKAN dilempar: pesan
 * error server action disensor Next.js di produksi, jadi pengguna tak akan
 * pernah membaca alasannya.
 */
export type HasilUbahMenu =
  | { ok: true }
  | { ok: false; alasan: string; bisaNonaktif: boolean }

/** Berapa kali menu terjual & berapa paket LAIN yang memakainya sebagai isi. */
async function pemakaianMenu(supabase: any, id: string): Promise<PemakaianMenu> {
  const [terjual, isi, pilihan] = await Promise.all([
    supabase.from('order_items').select('id', { count: 'exact', head: true }).eq('menu_item_id', id),
    supabase.from('menu_packages').select('id', { count: 'exact', head: true }).eq('menu_item_id', id).neq('package_id', id),
    supabase.from('menu_packages').select('id', { count: 'exact', head: true }).eq('or_menu_item_id', id).neq('package_id', id),
  ])
  const galat = terjual.error || isi.error || pilihan.error
  if (galat) throw new Error(`Gagal memeriksa pemakaian menu: ${galat.message}`)
  return { terjual: terjual.count ?? 0, jadiIsiPaket: (isi.count ?? 0) + (pilihan.count ?? 0) }
}

async function hapusGambar(supabase: any, imageUrl: string | null) {
  const lokasi = lokasiGambar(imageUrl)
  if (lokasi) await supabase.storage.from(lokasi.bucket).remove([lokasi.path])
}

/**
 * Hapus permanen HANYA untuk menu yang tak pernah terjual dan bukan isi paket
 * lain (lihat `lib/pos/hapusMenu.ts` untuk apa yang rusak kalau tidak).
 * Selebihnya ditolak dengan tawaran menonaktifkan.
 */
export async function deleteMenuItem(id: string, imageUrl: string | null): Promise<HasilUbahMenu> {
  const supabase = await getSupabase()
  const { data: row } = await supabase.from('menu_items').select('*').eq('id', id).maybeSingle()
  if (!row) return { ok: false, alasan: 'Menu tidak ditemukan (mungkin sudah dihapus).', bisaNonaktif: false }

  const alasan = alasanTolakHapus(row.name, await pemakaianMenu(supabase, id))
  if (alasan) return { ok: false, alasan, bisaNonaktif: true }

  // .select() supaya penolakan RLS (0 baris terhapus) tidak lagi terbaca "berhasil".
  const { data: terhapus, error: deleteError } = await supabase.from('menu_items').delete().eq('id', id).select('id')
  if (deleteError) {
    return { ok: false, alasan: `Menu tidak bisa dihapus: ${deleteError.message}. Nonaktifkan saja.`, bisaNonaktif: true }
  }
  if (!terhapus || terhapus.length === 0) return { ok: false, alasan: PESAN_TANPA_IZIN, bisaNonaktif: false }

  await hapusGambar(supabase, imageUrl)
  try { await syncOrQueue(supabase, row, 'delete') } catch { /* queue retains retry */ }

  revalidatePath('/dashboard/pos-admin/menu')
  return { ok: true }
}

/** Menonaktifkan menu di kasir, food apps, dan aplikasi. Data & riwayat tidak disentuh. */
export async function nonaktifkanMenu(id: string): Promise<HasilUbahMenu> {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('menu_items')
    .update({ is_available: false, is_available_online: false, tampil_di_app: false })
    .eq('id', id)
    .select('*')
  if (error) return { ok: false, alasan: `Gagal menonaktifkan: ${error.message}`, bisaNonaktif: false }
  if (!data || data.length === 0) return { ok: false, alasan: PESAN_TANPA_IZIN, bisaNonaktif: false }
  if (data[0].is_published_order_online) {
    try { await syncOrQueue(supabase, data[0], 'upsert') } catch { /* queue retains retry */ }
  }
  revalidatePath('/dashboard/pos-admin/menu')
  return { ok: true }
}

export async function saveMenuItem(form: Partial<MenuItem> & { package_items_to_save?: { menu_item_id: string, or_menu_item_id?: string | null, quantity: number }[], available_outlets?: string[] | null }) {
  const supabase = await getSupabase()
  
  const payload = {
    name: form.name,
    description: form.description || null,
    price: Number(form.price),
    strike_price: form.strike_price ? Number(form.strike_price) : null,
    category_id: form.category_id || null,
    image_url: form.image_url,
    is_available: form.is_available,
    is_available_online: form.is_available_online ?? true,
    available_online_channels: form.available_online_channels ?? null,
    sort_order: form.sort_order || 0,
    channel_prices: form.channel_prices || {},
    is_package: form.is_package || false,
    outlet_id: form.outlet_id || null,
    available_outlets: form.available_outlets || null,
    is_published_order_online: form.is_published_order_online ?? false,
    tampil_di_app: form.tampil_di_app ?? false,
    order_online_sync_status: form.is_published_order_online ? 'pending' : 'not_published',
    order_online_sync_error: null,
    order_online_sync_updated_at: new Date().toISOString(),
  }

  let finalId = form.id;

  if (form.id) {
    const { data: updated, error: updateError } = await supabase.from('menu_items').update(payload).eq('id', form.id).select('id')
    if (updateError) throw new Error(`Update menu error: ${updateError.message}`)
    if (!updated || updated.length === 0) throw new Error(PESAN_TANPA_IZIN)
    
    if (payload.is_package) {
      await supabase.from('menu_packages').delete().eq('package_id', finalId);
      if (form.package_items_to_save && form.package_items_to_save.length > 0) {
        const { error: pkgError } = await supabase.from('menu_packages').insert(
          form.package_items_to_save.map(pi => ({
            package_id: finalId,
            menu_item_id: pi.menu_item_id,
            or_menu_item_id: pi.or_menu_item_id || null,
            quantity: pi.quantity
          }))
        )
        if (pkgError) throw new Error(`Package items error: ${pkgError.message}`)
      }
    }
  } else {
    const { data, error: insertError } = await supabase.from('menu_items').insert([payload]).select().single()
    if (insertError) throw new Error(`Insert menu error: ${insertError.message}`)
    if (data) {
      finalId = data.id
      if (payload.is_package && form.package_items_to_save && form.package_items_to_save.length > 0) {
        const { error: pkgError } = await supabase.from('menu_packages').insert(
          form.package_items_to_save.map(pi => ({
            package_id: finalId,
            menu_item_id: pi.menu_item_id,
            or_menu_item_id: pi.or_menu_item_id || null,
            quantity: pi.quantity
          }))
        )
        if (pkgError) throw new Error(`Package items error: ${pkgError.message}`)
      }
    }
  }
  
  if (finalId) {
    const { data: saved } = await supabase.from('menu_items').select('*').eq('id', finalId).single()
    if (saved) {
      try {
        if (saved.is_published_order_online) await syncOrQueue(supabase, saved, 'upsert')
        else {
          await syncOrQueue(supabase, saved, 'delete').catch(() => undefined)
          await markSync(supabase, finalId, 'not_published')
        }
      } catch (err) {
        revalidatePath('/dashboard/pos-admin/menu')
        throw err
      }
    }
  }
  
  revalidatePath('/dashboard/pos-admin/menu')
}

/**
 * "Hapus semua" kini hanya menghapus menu yang aman dihapus (tak pernah
 * terjual & bukan isi paket lain). Sisanya dilewati dan dilaporkan.
 */
export async function deleteAllMenuItems(items: MenuItem[]): Promise<{ dihapus: number; dilewati: number; pesan: string | null }> {
  const supabase = await getSupabase()
  let dihapus = 0
  let dilewati = 0
  let tanpaIzin = false

  for (const item of items) {
    const alasan = alasanTolakHapus(item.name, await pemakaianMenu(supabase, item.id))
    if (alasan) { dilewati += 1; continue }
    const { data: terhapus, error } = await supabase.from('menu_items').delete().eq('id', item.id).select('id')
    if (error || !terhapus || terhapus.length === 0) {
      dilewati += 1
      if (!error) tanpaIzin = true
      continue
    }
    dihapus += 1
    await hapusGambar(supabase, item.image_url)
    try { await syncOrQueue(supabase, item, 'delete') } catch { /* queue retains retry */ }
  }

  revalidatePath('/dashboard/pos-admin/menu')
  const pesan = tanpaIzin
    ? PESAN_TANPA_IZIN
    : dilewati > 0
      ? `${dihapus} menu dihapus. ${dilewati} menu dilewati karena pernah terjual atau masih jadi isi paket — nonaktifkan satu per satu bila perlu.`
      : null
  return { dihapus, dilewati, pesan }
}

export async function toggleMenuPublished(id: string, published: boolean) {
  const supabase = await getSupabase()
  const { data: row, error } = await supabase.from('menu_items').update({
    is_published_order_online: published,
    order_online_sync_status: published ? 'pending' : 'not_published',
    order_online_sync_error: null,
    order_online_sync_updated_at: new Date().toISOString(),
  }).eq('id', id).select('*').single()
  if (error || !row) throw new Error(error?.message || 'Menu tidak ditemukan')
  if (published) await syncOrQueue(supabase, row, 'upsert')
  else {
    try { await syncOrQueue(supabase, row, 'delete') } catch { await markSync(supabase, id, 'not_published') }
  }
  revalidatePath('/dashboard/pos-admin/menu')
}

/**
 * Menyalakan/mematikan menu di SukaShawarma APP.
 *
 * Menegasikan `currentStatus` DI SINI, mengikuti `toggleMenuAvailability`.
 * Pemanggil mengirim keadaan sekarang, bukan keadaan yang diinginkan --
 * kalau kedua sisi sama-sama tidak menegasikan, tombolnya tidak pernah
 * membalik apa pun dan kegagalannya senyap.
 *
 * Tidak ada sinkronisasi ke sistem luar: gateway retail membaca
 * `menu_items` langsung, jadi perubahan langsung terasa di aplikasi.
 */
export async function toggleTampilDiApp(id: string, currentStatus: boolean) {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('menu_items')
    .update({ tampil_di_app: !currentStatus })
    .eq('id', id)
    .select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error(PESAN_TANPA_IZIN)
  revalidatePath('/dashboard/pos-admin/menu')
}

export async function retryMenuOnlineSync(id: string) {
  const supabase = await getSupabase()
  const { data: row, error } = await supabase.from('menu_items').select('*').eq('id', id).single()
  if (error || !row) throw new Error(error?.message || 'Menu tidak ditemukan')
  await syncOrQueue(supabase, row, row.is_published_order_online ? 'upsert' : 'delete')
  revalidatePath('/dashboard/pos-admin/menu')
}

export async function syncCategoryOnline(categoryId: string) {
  const supabase = await getSupabase()
  const { data: menus } = await supabase.from('menu_items').select('*').eq('category_id', categoryId).eq('is_published_order_online', true)
  for (const menu of menus || []) {
    try { await syncOrQueue(supabase, menu, 'upsert') } catch { /* each menu keeps its own retry state */ }
  }
  revalidatePath('/dashboard/pos-admin/menu')
}

export async function toggleGlobalSetting(key: string, newIds: string[]) {
  const supabase = await getSupabase()
  const { error: upsertErr } = await supabase.from('kiosk_settings').upsert({
    outlet_id: '550e8400-e29b-41d4-a716-446655440001',
    key,
    value: JSON.stringify(newIds)
  })
  if (upsertErr) throw new Error(`Gagal menyimpan pengaturan: ${upsertErr.message}`)
  const { error: delErr } = await supabase.from('kiosk_settings').delete().neq('outlet_id', '550e8400-e29b-41d4-a716-446655440001').eq('key', key)
  if (delErr) throw new Error(`Gagal menghapus pengaturan lama: ${delErr.message}`)
  revalidatePath('/dashboard/pos-admin/menu')
}

export async function updateMenuChannelPrices(menuId: string, channelPrices: Record<string, number>) {
  const supabase = await getSupabase()
  const { data, error } = await supabase.from('menu_items').update({ channel_prices: channelPrices }).eq('id', menuId).select('id')
  if (error) throw new Error(`Gagal update harga channel: ${error.message}`)
  if (!data || data.length === 0) throw new Error(PESAN_TANPA_IZIN)
  revalidatePath('/dashboard/pos-admin/menu')
}



