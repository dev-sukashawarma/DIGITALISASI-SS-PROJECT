'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { revalidatePath } from 'next/cache'
import { gabungHargaChannel } from '@/lib/appRetail/hargaAplikasi'

async function getSupabase() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })
}

function segarkan() {
  revalidatePath('/dashboard/app-retail')
  revalidatePath('/dashboard/app-retail/menu')
  revalidatePath('/dashboard/app-retail/outlet')
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
  const { error } = await supabase
    .from('menu_items')
    .update({ tampil_di_app: !sedangTayang })
    .eq('id', id)
  if (error) throw new Error(error.message)
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

  const { error } = await supabase
    .from('menu_items')
    .update({
      deskripsi_app: input.deskripsiApp || null,
      foto_app: input.fotoApp || null,
      channel_prices: gabungHargaChannel(baris.channel_prices, input.hargaAplikasi),
    })
    .eq('id', input.id)
  if (error) throw new Error(error.message)
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
  const { error } = await supabase
    .from('outlets')
    .update({ app_enabled: !sedangMenyala })
    .eq('id', id)
  if (error) throw new Error(error.message)
  segarkan()
}
