'use server'

import { revalidatePath } from 'next/cache'
import { getPosSupabase } from '@/lib/supabase-pos'
import type { MenuItem } from '@/types/menu'

const PUSAT_OUTLET_ID = '550e8400-e29b-41d4-a716-446655440001'

export async function toggleMenuAvailability(id: string, currentStatus: boolean) {
  const supabase = getPosSupabase()
  const { data, error } = await supabase
    .from('menu_items')
    .update({ is_available: !currentStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) {
    throw new Error('Gagal mengubah ketersediaan: Menu tidak ditemukan atau izin database tidak cukup.')
  }
  revalidatePath('/dashboard/menu')
  revalidatePath('/dashboard/menu', 'layout')
}

export async function toggleTampilDiApp(id: string, currentStatus: boolean) {
  const supabase = getPosSupabase()
  const { data, error } = await supabase
    .from('menu_items')
    .update({ tampil_di_app: !currentStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) {
    throw new Error('Gagal mengubah tampilan di App: Menu tidak ditemukan atau izin database tidak cukup.')
  }
  revalidatePath('/dashboard/menu')
  revalidatePath('/dashboard/menu', 'layout')
}

export async function toggleMenuPublished(id: string, currentStatus: boolean) {
  const supabase = getPosSupabase()
  const { data, error } = await supabase
    .from('menu_items')
    .update({
      is_published_order_online: !currentStatus,
      order_online_sync_status: !currentStatus ? 'pending' : 'not_published',
      order_online_sync_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id')

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) {
    throw new Error('Gagal mengubah status publikasi: Menu tidak ditemukan atau izin database tidak cukup.')
  }
  revalidatePath('/dashboard/menu')
  revalidatePath('/dashboard/menu', 'layout')
}

export async function deleteMenuItem(id: string, imageUrl: string | null) {
  const supabase = getPosSupabase()

  if (imageUrl) {
    const fileName = imageUrl.split('/').pop()?.split('?')[0]
    if (fileName) {
      await supabase.storage.from('menu-images').remove([fileName])
    }
  }

  const { data, error } = await supabase.from('menu_items').delete().eq('id', id).select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) {
    throw new Error('Gagal menghapus menu: Menu tidak ditemukan atau izin database tidak cukup.')
  }

  revalidatePath('/dashboard/menu')
  revalidatePath('/dashboard/menu', 'layout')
}

export async function uploadMenuImage(formData: FormData): Promise<string> {
  const file = formData.get('file') as File | null
  if (!file || !(file instanceof File) || file.size === 0) {
    throw new Error('File gambar tidak ditemukan atau kosong.')
  }
  const supabase = getPosSupabase()
  const ext = file.name.split('.').pop() || 'webp'
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from('menu-images')
    .upload(fileName, buffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    throw new Error(`Upload gambar gagal: ${uploadError.message}`)
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('menu-images').getPublicUrl(fileName)

  return publicUrl
}

export async function saveMenuItem(form: {
  id?: string | null
  name: string
  description?: string | null
  price: number
  strike_price?: number | null
  category_id?: string | null
  image_url?: string | null
  is_available: boolean
  is_available_online?: boolean
  available_online_channels?: string[] | null
  sort_order?: number
  channel_prices?: Record<string, number | string> | null
  is_package?: boolean
  outlet_id?: string | null
  available_outlets?: string[] | null
  is_published_order_online?: boolean
  tampil_di_app?: boolean
}) {
  const supabase = getPosSupabase()

  const cleanPrice = Number(form.price)
  if (isNaN(cleanPrice) || cleanPrice <= 0) {
    throw new Error('Harga menu harus diisi angka yang valid dan lebih dari 0.')
  }

  // Clean channel prices: ensure valid numbers
  const cleanedChannelPrices: Record<string, number> = {}
  if (form.channel_prices) {
    Object.entries(form.channel_prices).forEach(([key, val]) => {
      const num = Number(val)
      if (!isNaN(num) && num >= 0) {
        cleanedChannelPrices[key] = num
      }
    })
  }

  const nowIso = new Date().toISOString()
  const payload: any = {
    name: form.name.trim(),
    description: form.description ? form.description.trim() : null,
    price: cleanPrice,
    strike_price: form.strike_price ? Number(form.strike_price) : null,
    category_id: form.category_id || null,
    image_url: form.image_url || null,
    is_available: form.is_available,
    is_available_online: form.is_available_online ?? true,
    available_online_channels: form.available_online_channels ?? null,
    sort_order: form.sort_order || 0,
    channel_prices: cleanedChannelPrices,
    is_package: form.is_package || false,
    outlet_id: form.outlet_id || null,
    available_outlets: form.available_outlets || null,
    is_published_order_online: form.is_published_order_online ?? false,
    tampil_di_app: form.tampil_di_app ?? false,
    order_online_sync_status: form.is_published_order_online ? 'pending' : 'not_published',
    order_online_sync_updated_at: nowIso,
    updated_at: nowIso,
  }

  const isEdit = Boolean(form.id && String(form.id).trim().length > 0)
  let savedId: string | null = null

  if (isEdit) {
    const { data, error } = await supabase
      .from('menu_items')
      .update(payload)
      .eq('id', String(form.id).trim())
      .select('id')

    if (error) throw new Error(`Gagal update menu: ${error.message}`)
    if (!data || data.length === 0) {
      throw new Error('Gagal update menu: Baris tidak ditemukan atau database menolak perubahan.')
    }
    savedId = data[0].id
  } else {
    const { data, error } = await supabase
      .from('menu_items')
      .insert(payload)
      .select('id')

    if (error) throw new Error(`Gagal menambah menu: ${error.message}`)
    if (!data || data.length === 0) {
      throw new Error('Gagal menambah menu: Data tidak tersimpan ke database.')
    }
    savedId = data[0].id
  }

  revalidatePath('/dashboard/menu')
  revalidatePath('/dashboard/menu', 'layout')
  return { success: true, id: savedId }
}

export async function toggleSettingBadge(itemId: string, key: 'bestseller_ids' | 'upsell_ids' | 'recommendation_ids') {
  const supabase = getPosSupabase()

  const { data: settingRow } = await supabase
    .from('kiosk_settings')
    .select('value')
    .eq('outlet_id', PUSAT_OUTLET_ID)
    .eq('key', key)
    .maybeSingle()

  let currentIds: string[] = []
  try {
    currentIds = settingRow?.value ? JSON.parse(settingRow.value) : []
  } catch {
    currentIds = []
  }

  const exists = currentIds.includes(itemId)
  const newIds = exists ? currentIds.filter((id) => id !== itemId) : [...currentIds, itemId]

  const { data, error } = await supabase
    .from('kiosk_settings')
    .upsert(
      {
        outlet_id: PUSAT_OUTLET_ID,
        key,
        value: JSON.stringify(newIds),
      },
      { onConflict: 'outlet_id, key' }
    )
    .select('outlet_id, key')

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) {
    throw new Error('Gagal memperbarui kiosk setting: Data tidak tersimpan ke database.')
  }
  revalidatePath('/dashboard/menu')
  revalidatePath('/dashboard/menu', 'layout')
}

export async function saveCategory(category: {
  id?: string | null
  name: string
  sort_order: number
}) {
  const supabase = getPosSupabase()
  const payload = {
    name: category.name.trim(),
    sort_order: category.sort_order,
  }

  if (category.id) {
    const { data, error } = await supabase
      .from('categories')
      .update(payload)
      .eq('id', category.id)
      .select('*')
      .single()

    if (error) throw new Error(`Gagal update kategori: ${error.message}`)
    revalidatePath('/dashboard/menu')
    revalidatePath('/dashboard/menu/kategori')
    revalidatePath('/dashboard/menu', 'layout')
    return data
  } else {
    const { data, error } = await supabase
      .from('categories')
      .insert(payload)
      .select('*')
      .single()

    if (error) throw new Error(`Gagal menambah kategori: ${error.message}`)
    revalidatePath('/dashboard/menu')
    revalidatePath('/dashboard/menu/kategori')
    revalidatePath('/dashboard/menu', 'layout')
    return data
  }
}

export async function deleteCategory(id: string) {
  const supabase = getPosSupabase()

  // 1. Lepaskan relasi menu yang menggunakan kategori ini agar menu tidak terhapus
  const { error: unbindError } = await supabase
    .from('menu_items')
    .update({ category_id: null })
    .eq('category_id', id)

  if (unbindError) {
    throw new Error(`Gagal melepaskan relasi menu: ${unbindError.message}`)
  }

  // 2. Hapus kategori dari database dengan verifikasi baris terhapus
  const { data, error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) throw new Error(`Gagal menghapus kategori: ${error.message}`)
  if (!data || data.length === 0) {
    throw new Error('Gagal menghapus kategori: Data tidak ditemukan atau izin database tidak cukup.')
  }

  revalidatePath('/dashboard/menu')
  revalidatePath('/dashboard/menu/kategori')
  revalidatePath('/dashboard/menu', 'layout')
}

export async function reorderCategories(updates: { id: string; sort_order: number }[]) {
  const supabase = getPosSupabase()

  const results = await Promise.all(
    updates.map((u) =>
      supabase
        .from('categories')
        .update({ sort_order: u.sort_order })
        .eq('id', u.id)
        .select('id')
    )
  )

  for (const res of results) {
    if (res.error) throw new Error(`Gagal memperbarui urutan kategori: ${res.error.message}`)
    if (!res.data || res.data.length === 0) {
      throw new Error('Gagal memperbarui urutan kategori: Baris tidak ditemukan atau izin database tidak cukup.')
    }
  }

  revalidatePath('/dashboard/menu')
  revalidatePath('/dashboard/menu/kategori')
  revalidatePath('/dashboard/menu', 'layout')
}
