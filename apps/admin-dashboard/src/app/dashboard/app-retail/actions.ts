'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { revalidatePath } from 'next/cache'
import { gabungHargaChannel } from '@/lib/appRetail/hargaAplikasi'
import { periksaBanner, type InputBanner } from '@/lib/appRetail/bannerForm'

async function getSupabase() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })
}

/**
 * Nol baris ter-update BUKAN error di PostgREST.
 *
 * Kebijakan tulis `menu_items`/`outlets` menuntut role `admin` persis
 * (`menu_items_all_admin`, `outlets_all_admin`), sedangkan `owner` role yang
 * berbeda dan bacanya terbuka. Tanpa pemeriksaan ini halaman terbaca normal
 * untuk OWNER sementara setiap tulisan lenyap tanpa suara — panel bahkan
 * menutup diri "seolah tersimpan". Jadi setiap UPDATE wajib `.select('id')`
 * lalu dicek isinya.
 */
function pastikanTerubah(baris: { id: string }[] | null, pesanDitolak: string) {
  if (!baris || baris.length === 0) throw new Error(pesanDitolak)
}

function segarkan() {
  revalidatePath('/dashboard/app-retail')
  revalidatePath('/dashboard/app-retail/menu')
  revalidatePath('/dashboard/app-retail/outlet')
  revalidatePath('/dashboard/app-retail/banner')
}

/**
 * Menyalakan/mematikan menu di aplikasi.
 *
 * Menegasikan `sedangTayang` DI SINI. Pemanggil mengirim keadaan sekarang,
 * bukan keadaan yang diinginkan — kalau kedua sisi sama-sama tidak menegasikan,
 * tombolnya tidak pernah membalik apa pun dan kegagalannya senyap. Pola itu
 * sudah ada di repo ini (`toggleMenuPublished`), jangan ditiru.
 */
export async function toggleTayangDiApp(id: string, sedangTayang: boolean) {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('menu_items')
    .update({ tampil_di_app: !sedangTayang })
    .eq('id', id)
    .select('id')
  if (error) throw new Error(error.message)
  pastikanTerubah(
    data,
    'Status tayang tidak berubah — akun ini belum berhak mengubah pengaturan aplikasi.',
  )
  segarkan()
}

/**
 * Menyimpan tampilan menu di aplikasi.
 *
 * Membaca `channel_prices` lebih dulu lalu menggabungnya: kolom itu memuat
 * harga SEMUA kanal, dan menulisnya utuh akan menghapus harga GoFood dkk.
 * Kolom lain (`price`, `sort_order`, `is_available`, `available_online_channels`)
 * tidak boleh ikut — itu milik POS.
 */
export async function simpanDetailMenuApp(input: {
  id: string
  deskripsiApp: string | null
  fotoApp: string | null
  hargaAplikasi: string
}) {
  const supabase = await getSupabase()

  const { data: baris, error: bacaError } = await supabase
    .from('menu_items')
    .select('channel_prices')
    .eq('id', input.id)
    .maybeSingle()
  if (bacaError) throw new Error(bacaError.message)
  if (!baris) throw new Error('Menu tidak ditemukan')

  const { data: terubah, error } = await supabase
    .from('menu_items')
    .update({
      deskripsi_app: input.deskripsiApp || null,
      foto_app: input.fotoApp || null,
      channel_prices: gabungHargaChannel(baris.channel_prices, input.hargaAplikasi),
    })
    .eq('id', input.id)
    .select('id')
  if (error) throw new Error(error.message)
  pastikanTerubah(
    terubah,
    'Tampilan menu tidak tersimpan — akun ini belum berhak mengubah pengaturan aplikasi.',
  )
  segarkan()
}

/**
 * Menyalakan/mematikan outlet untuk aplikasi.
 *
 * `outlets.app_enabled` adalah satu-satunya gerbang antara outlet dan
 * pelanggan: `GET /api/v1/outlets` menyaring persis kolom ini. Menyalakan
 * outlet sungguhan membuatnya langsung bisa dipesan.
 */
export async function toggleOutletApp(id: string, sedangMenyala: boolean) {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('outlets')
    .update({ app_enabled: !sedangMenyala })
    .eq('id', id)
    .select('id')
  if (error) throw new Error(error.message)
  pastikanTerubah(
    data,
    'Outlet tidak berubah — akun ini belum berhak mengubah pengaturan aplikasi.',
  )
  segarkan()
}

/** Teks kosong dari formulir disimpan sebagai NULL, bukan string kosong. */
function nullBilaKosong(nilai: string): string | null {
  const rapi = nilai.trim()
  return rapi === '' ? null : rapi
}

function barisDariInput(input: InputBanner) {
  return {
    slot: input.slot,
    urutan: input.urutan,
    badge: nullBilaKosong(input.badge),
    judul: input.judul.trim(),
    subjudul: nullBilaKosong(input.subjudul),
    teks_tombol: nullBilaKosong(input.teksTombol),
    gambar_url: nullBilaKosong(input.gambarUrl),
    aksi: input.aksi,
    target_menu_item_id:
      input.aksi === 'menu_item' ? nullBilaKosong(input.targetMenuItemId ?? '') : null,
    diubah_pada: new Date().toISOString(),
  }
}

/**
 * Banner baru lahir NONAKTIF -- `aktif` sengaja tidak ditulis di sini, jadi
 * DEFAULT false dari basis data yang berlaku. Menyimpan draft tidak boleh
 * langsung menayangkannya ke pelanggan; menyalakannya adalah tindakan
 * terpisah dan sadar lewat `toggleBannerAktif`.
 */
export async function simpanBanner(id: string | null, input: InputBanner) {
  const galat = periksaBanner(input)
  if (galat) throw new Error(galat)

  const supabase = await getSupabase()
  const baris = barisDariInput(input)

  const { data, error } = id
    ? await supabase.from('app_banners').update(baris).eq('id', id).select('id')
    : await supabase.from('app_banners').insert(baris).select('id')

  if (error) throw new Error(error.message)
  pastikanTerubah(
    data,
    'Banner tidak tersimpan — akun ini belum berhak mengubah pengaturan aplikasi.',
  )
  segarkan()
}

/**
 * Menegasikan `sedangAktif` DI SINI, sama seperti `toggleTayangDiApp`.
 * Pemanggil mengirim keadaan sekarang, bukan keadaan yang diinginkan.
 */
export async function toggleBannerAktif(id: string, sedangAktif: boolean) {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('app_banners')
    .update({ aktif: !sedangAktif, diubah_pada: new Date().toISOString() })
    .eq('id', id)
    .select('id')
  if (error) throw new Error(error.message)
  pastikanTerubah(
    data,
    'Status banner tidak berubah — akun ini belum berhak mengubah pengaturan aplikasi.',
  )
  segarkan()
}

export async function hapusBanner(id: string) {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('app_banners')
    .delete()
    .eq('id', id)
    .select('id')
  if (error) throw new Error(error.message)
  pastikanTerubah(
    data,
    'Banner tidak terhapus — akun ini belum berhak mengubah pengaturan aplikasi.',
  )
  segarkan()
}
