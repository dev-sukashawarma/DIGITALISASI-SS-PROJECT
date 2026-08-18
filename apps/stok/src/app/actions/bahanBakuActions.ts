'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function makeServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL! || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjMyOTIsImV4cCI6MjA5NjUzOTI5Mn0.RdsvP6OKs6aiRnqqd02BYiv5gzbh4uGqO88dapo0Gso'
  return createClient(url, key)
}

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
    const supabase = makeServiceClient()

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

    revalidatePath('/stok/harga-bahan')
    return { success: true, data: bahanBaku }
  } catch (err: any) {
    console.error('createBahanBakuAction error in stok:', err)
    return { success: false, error: err.message || 'Terjadi kesalahan internal server' }
  }
}
