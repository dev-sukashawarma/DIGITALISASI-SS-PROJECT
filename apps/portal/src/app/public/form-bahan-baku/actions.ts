'use server'

import { createServerClient } from '@supabase/ssr'
import { revalidatePath } from 'next/cache'

const MAGIC_TOKEN = process.env.GUDANG_MAGIC_TOKEN || 'SUKA-GUDANG-2026'

export async function createBahanBaku(token: string, nama: string, satuan: string) {
  if (token !== MAGIC_TOKEN) return { success: false, error: 'Akses ditolak' }
  const supabase = createServiceClient()
  if (!nama || !satuan) return { success: false, error: 'Nama dan satuan wajib diisi' }
  
  const { data, error } = await supabase.from('bahan_baku').insert({
    nama,
    satuan,
    kategori: 'Lain-lain',
    is_active: true,
    is_fisik_checked: false
  }).select(`id, nama, kategori, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan, image_url, image_url_tengah, image_url_kecil, is_fisik_checked`).single()
  
  if (error) return { success: false, error: error.message }
  revalidatePath('/public/form-bahan-baku')
  return { success: true, data }
}

function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return [] }, setAll() {} } }
  )
}

export async function getBahanBakuList(token: string) {
  try {
    if (token !== MAGIC_TOKEN) {
      return { success: false, error: 'Akses ditolak: Token tidak valid' }
    }
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('bahan_baku')
      .select('id, nama, kategori, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan, image_url, image_url_tengah, image_url_kecil, is_fisik_checked, bahan_baku_sku(id, nama_kemasan, qty_isi, harga_beli, is_default, is_active, created_at)')
      .eq('is_active', true)
      .order('nama')
    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err.message || 'Internal error' }
  }
}

export async function submitBahanBaku(formData: FormData) {
  try {
    const token = formData.get('token')?.toString()
    if (token !== MAGIC_TOKEN) throw new Error('Akses ditolak: Token tidak valid')

    const id = formData.get('id')?.toString()
    if (!id) throw new Error('Pilih bahan baku terlebih dahulu')

    const satuan = formData.get('satuan')?.toString()
    if (!satuan) throw new Error('Satuan wajib diisi')

    const satuan_tengah = formData.get('satuan_tengah')?.toString() || null
    const faktor_tengah = formData.get('faktor_tengah') ? Number(formData.get('faktor_tengah')) : null
    const satuan_kecil = formData.get('satuan_kecil')?.toString() || null
    const faktor_tampilan = formData.get('faktor_tampilan') ? Number(formData.get('faktor_tampilan')) : null

    const image = formData.get('image') as File | null
    const image_tengah = formData.get('image_tengah') as File | null
    const image_kecil = formData.get('image_kecil') as File | null

    const supabase = createServiceClient()

    let updateData: any = {
      satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan,
      is_fisik_checked: true
    }

    const uploadImage = async (file: File) => {
      const ext = file.name.split('.').pop()
      const filename = `gudang_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
      const { error } = await supabase.storage.from('bahan-baku').upload(filename, file)
      if (error) throw new Error(`Gagal upload gambar: ${error.message}`)
      const { data: { publicUrl } } = supabase.storage.from('bahan-baku').getPublicUrl(filename)
      return publicUrl
    }

    if (image && image.size > 0) updateData.image_url = await uploadImage(image)
    if (image_tengah && image_tengah.size > 0) updateData.image_url_tengah = await uploadImage(image_tengah)
    if (image_kecil && image_kecil.size > 0) updateData.image_url_kecil = await uploadImage(image_kecil)

    const { error: updateError } = await supabase.from('bahan_baku').update(updateData).eq('id', id)
    if (updateError) throw new Error(`Gagal menyimpan data: ${updateError.message}`)

    revalidatePath('/public/form-bahan-baku')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function addBahanBakuSku(token: string, vars: { bahan_baku_id: string; nama_kemasan: string; qty_isi: number; harga_beli: number; is_default: boolean }) {
  if (token !== MAGIC_TOKEN) return { success: false, error: 'Akses ditolak' }
  const supabase = createServiceClient()
  if (vars.is_default) {
    await supabase.from('bahan_baku_sku').update({ is_default: false }).eq('bahan_baku_id', vars.bahan_baku_id)
  }
  const { error } = await supabase.from('bahan_baku_sku').insert({
    bahan_baku_id: vars.bahan_baku_id,
    nama_kemasan: vars.nama_kemasan,
    qty_isi: vars.qty_isi,
    harga_beli: vars.harga_beli,
    is_default: vars.is_default,
    is_active: true
  })
  if (error) return { success: false, error: error.message }
  revalidatePath('/public/form-bahan-baku')
  return { success: true }
}

export async function deleteBahanBakuSku(token: string, sku_id: string) {
  if (token !== MAGIC_TOKEN) return { success: false, error: 'Akses ditolak' }
  const supabase = createServiceClient()
  const { error } = await supabase.from('bahan_baku_sku').delete().eq('id', sku_id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/public/form-bahan-baku')
  return { success: true }
}

export async function setDefaultBahanBakuSku(token: string, bahan_baku_id: string, sku_id: string) {
  if (token !== MAGIC_TOKEN) return { success: false, error: 'Akses ditolak' }
  const supabase = createServiceClient()
  await supabase.from('bahan_baku_sku').update({ is_default: false }).eq('bahan_baku_id', bahan_baku_id)
  const { error } = await supabase.from('bahan_baku_sku').update({ is_default: true }).eq('id', sku_id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/public/form-bahan-baku')
  return { success: true }
}
