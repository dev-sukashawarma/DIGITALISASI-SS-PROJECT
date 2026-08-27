import { createOrderOnlineAdminClient } from '@/lib/supabase/order-online-client'

type AdminClient = any
type MenuRow = {
  id: string
  name: string
  description: string | null
  price: number
  strike_price: number | null
  image_url: string | null
  category_id: string | null
  sort_order: number
  is_available: boolean
}

async function resolveOnlineCategory(admin: AdminClient, online: AdminClient, categoryId: string) {
  const { data: category, error: categoryError } = await admin.from('categories').select('id,name,sort_order').eq('id', categoryId).single()
  if (categoryError) throw new Error(`Kategori Admin tidak ditemukan: ${categoryError.message}`)

  const { data: mapping } = await admin.from('order_online_category_mapping').select('*').eq('admin_category_id', categoryId).maybeSingle()
  if (mapping) {
    const { error } = await online.from('categories').update({ name: category.name, sort_order: category.sort_order, is_active: true }).eq('id', mapping.online_category_id)
    if (error) throw new Error(`Update kategori Order-Online gagal: ${error.message}`)
    await admin.from('order_online_category_mapping').update({ admin_name_snapshot: category.name, updated_at: new Date().toISOString() }).eq('admin_category_id', categoryId)
    return mapping.online_category_id
  }

  const { data: existing } = await online.from('categories').select('id').ilike('name', category.name).limit(1).maybeSingle()
  let onlineCategoryId = existing?.id
  if (!onlineCategoryId) {
    const { data: created, error } = await online.from('categories').insert({ name: category.name, sort_order: category.sort_order, is_active: true }).select('id').single()
    if (error) {
      const retry = await online.from('categories').select('id').ilike('name', category.name).limit(1).maybeSingle()
      if (!retry.data?.id) throw new Error(`Buat kategori Order-Online gagal: ${error.message}`)
      onlineCategoryId = retry.data.id
    } else onlineCategoryId = created.id
  }
  const { error: mapError } = await admin.from('order_online_category_mapping').upsert({
    admin_category_id: categoryId,
    online_category_id: onlineCategoryId,
    admin_name_snapshot: category.name,
    updated_at: new Date().toISOString(),
  })
  if (mapError) throw new Error(`Simpan mapping kategori gagal: ${mapError.message}`)
  return onlineCategoryId
}

export function toOrderOnlineMenu(row: MenuRow, onlineCategoryId: string | null) {
  return {
    id: row.id,
    category_id: onlineCategoryId,
    name: row.name,
    description: row.description,
    photo_url: row.image_url,
    base_price: Number(row.price),
    compare_price: row.strike_price == null ? null : Number(row.strike_price),
    is_active: true,
    sort_order: row.sort_order || 0,
  }
}

export async function syncMenuToOrderOnline(admin: AdminClient, row: MenuRow, operation: 'upsert' | 'delete') {
  const online = createOrderOnlineAdminClient()
  if (operation === 'delete') {
    const { error } = await online.from('menu_items').delete().eq('id', row.id)
    if (error) throw new Error(`Hapus menu Order-Online gagal: ${error.message}`)
    return
  }
  if (!row.category_id) throw new Error('Menu harus memiliki kategori sebelum dipublikasikan')
  const onlineCategoryId = await resolveOnlineCategory(admin, online, row.category_id)
  const { error } = await online.from('menu_items').upsert(toOrderOnlineMenu(row, onlineCategoryId), { onConflict: 'id' })
  if (error) throw new Error(`Sinkronisasi menu Order-Online gagal: ${error.message}`)
}
