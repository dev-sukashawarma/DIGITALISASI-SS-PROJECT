'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type CreateBahanBakuInput = {
  nama: string
  kategori: string
  satuan: string
  satuan_tengah?: string
  faktor_tengah?: number
  satuan_kecil?: string
  faktor_tampilan?: number
  harga_beli?: number
}

export async function createBahanBakuAction(input: CreateBahanBakuInput) {
  try {
    const supabase = createServiceClient()

    // 1. Insert ke tabel bahan_baku
    const { data: bahanBaku, error: bbError } = await supabase
      .from('bahan_baku')
      .insert({
        nama: input.nama,
        kategori: input.kategori,
        satuan: input.satuan,
        satuan_tengah: input.satuan_tengah || null,
        faktor_tengah: input.faktor_tengah || null,
        satuan_kecil: input.satuan_kecil || null,
        faktor_tampilan: input.faktor_tampilan || null,
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
        nama_kemasan: input.satuan,
        qty_isi: 1,
        harga_beli: input.harga_beli || 0,
        is_default: true,
        is_active: true
      })

    if (skuError) {
      throw new Error(`Gagal menyimpan default SKU: ${skuError.message}`)
    }

    // 3. Jika ada harga_beli, insert juga ke bahan_baku_harga
    if (input.harga_beli && input.harga_beli > 0) {
      await supabase
        .from('bahan_baku_harga')
        .upsert({
          bahan_baku_id: bahanBaku.id,
          harga_beli: input.harga_beli,
          updated_at: new Date().toISOString()
        })
    }

    revalidatePath('/dashboard/bahan-baku')
    return { success: true, data: bahanBaku }
  } catch (err: any) {
    console.error('createBahanBakuAction error:', err)
    return { success: false, error: err.message || 'Terjadi kesalahan internal server' }
  }
}
