'use server'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { revalidatePath } from 'next/cache'
import { turunkanFaktorSatuan } from '@/lib/stok/satuanBahan'

function makeServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL! || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

export type CreateBahanBakuInput = {
  nama: string
  kategori: string
  satuan: string
  satuan_tengah?: string
  faktor_tengah?: number
  satuan_kecil?: string
  /**
   * Isian form "1 {tengah} = ... {kecil}" — satuan kecil per satuan TENGAH,
   * BUKAN faktor penuh. Faktor penuh dihitung turunkanFaktorSatuan().
   */
  faktor_tampilan?: number
  harga_beli?: number
}

// Master bahan baku: hanya admin & owner (spec 2026-09-23 K1). Action ini
// memakai service key, dan tiap export 'use server' adalah endpoint POST
// publik — tombol yang disembunyikan tidak melindungi apa pun.
const ROLE_PEMBUAT_BAHAN = ['admin', 'owner']

async function requirePembuatBahan(): Promise<string> {
  const cookieStore = await cookies()
  const authed = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) =>
      toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options as any)),
  })
  const { data: { user }, error } = await authed.auth.getUser()
  if (error || !user) throw new Error('Sesi login tidak ditemukan. Silakan login ulang.')

  const { data: staff, error: staffErr } = await makeServiceClient()
    .from('outlet_staff')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()
  if (staffErr) throw new Error(staffErr.message)
  if (!staff || staff.status !== 'active' || !ROLE_PEMBUAT_BAHAN.includes(staff.role)) {
    throw new Error('Hanya admin atau owner yang boleh menambah bahan baku.')
  }
  return user.id
}

export async function createBahanBakuAction(input: CreateBahanBakuInput) {
  try {
    const userId = await requirePembuatBahan()
    const supabase = makeServiceClient()

    const faktor = turunkanFaktorSatuan({
      satuan: input.satuan,
      satuan_tengah: input.satuan_tengah,
      faktor_tengah: input.faktor_tengah,
      satuan_kecil: input.satuan_kecil,
      isiKecilPerTengah: input.faktor_tampilan,
    })
    if (faktor.faktor_tampilan === null || faktor.faktor_konversi === null) {
      throw new Error('Isi satuan tidak valid: faktor harus angka lebih dari 0.')
    }

    // 1. Insert ke tabel bahan_baku
    const { data: bahanBaku, error: bbError } = await supabase
      .from('bahan_baku')
      .insert({
        nama: input.nama,
        kategori: input.kategori,
        ...faktor,
        is_active: true,
        is_fisik_checked: false
      })
      .select('id')
      .single()

    if (bbError) {
      throw new Error(`Gagal menyimpan bahan baku: ${bbError.message}`)
    }

    // 2. Insert ke tabel bahan_baku_sku sebagai default SKU (Satuan Besar)
    const { error: skuError } = await supabase
      .from('bahan_baku_sku')
      .insert({
        bahan_baku_id: bahanBaku.id,
        nama_kemasan: faktor.satuan,
        qty_isi: 1,
        harga_beli: input.harga_beli || 0,
        is_default: true,
        is_active: true
      })

    if (skuError) {
      throw new Error(`Gagal menyimpan default SKU: ${skuError.message}`)
    }

    // 3. Harga awal. Kolomnya harga_updated_at (bukan updated_at — sebelum
    //    2026-09-23 salah nama kolom + galat tak diperiksa → harga bahan baru
    //    hilang diam-diam). kemasan_qty = faktor_tampilan (invarian basis harga).
    if (input.harga_beli && input.harga_beli > 0) {
      const { error: hargaError } = await supabase
        .from('bahan_baku_harga')
        .upsert({
          bahan_baku_id: bahanBaku.id,
          harga_beli: input.harga_beli,
          kemasan_qty: faktor.faktor_tampilan,
          kemasan_satuan: faktor.satuan_kecil,
          harga_updated_at: new Date().toISOString(),
          updated_by: userId,
        }, { onConflict: 'bahan_baku_id' })
      if (hargaError) {
        throw new Error(`Bahan tersimpan, tetapi harga gagal disimpan: ${hargaError.message}`)
      }

      const { error: histError } = await supabase
        .from('bahan_baku_harga_history')
        .insert({
          bahan_baku_id: bahanBaku.id,
          harga_lama: null,
          harga_baru: input.harga_beli,
          changed_by: userId,
          catatan: 'Harga awal saat bahan dibuat',
        })
      if (histError) console.warn('Gagal mencatat riwayat harga awal:', histError.message)
    }

    revalidatePath('/stok/harga-bahan')
    return { success: true, data: bahanBaku }
  } catch (err: any) {
    console.error('createBahanBakuAction error in stok:', err)
    return { success: false, error: err.message || 'Terjadi kesalahan internal server' }
  }
}
