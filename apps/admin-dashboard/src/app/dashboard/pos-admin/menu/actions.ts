'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { revalidatePath } from 'next/cache'
import type { MenuItem } from '@/pos-types'
import { syncMenuToOrderOnline } from './order-online-sync'

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
  const { error } = await supabase.from('menu_items').update({ is_available: !currentStatus }).eq('id', id)
  if (error) throw new Error(error.message)
  
  revalidatePath('/dashboard/pos-admin/menu')
}

export async function deleteMenuItem(id: string, imageUrl: string | null) {
  const supabase = await getSupabase()
  const { data: row } = await supabase.from('menu_items').select('*').eq('id', id).maybeSingle()
  
  if (imageUrl) {
    const fileName = imageUrl.split('/').pop()
    if (fileName) {
      await supabase.storage.from('menu_images').remove([fileName])
    }
  }
  
  const { error: deleteError } = await supabase.from('menu_items').delete().eq('id', id)
  if (deleteError) throw new Error(deleteError.message)
  if (row) {
    try { await syncOrQueue(supabase, row, 'delete') } catch { /* queue retains retry */ }
  }
  
  revalidatePath('/dashboard/pos-admin/menu')
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
    order_online_sync_status: form.is_published_order_online ? 'pending' : 'not_published',
    order_online_sync_error: null,
    order_online_sync_updated_at: new Date().toISOString(),
  }

  let finalId = form.id;

  if (form.id) {
    const { error: updateError } = await supabase.from('menu_items').update(payload).eq('id', form.id)
    if (updateError) throw new Error(`Update menu error: ${updateError.message}`)
    
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

export async function deleteAllMenuItems(items: MenuItem[]) {
  const supabase = await getSupabase()
  
  const fileNames = items.map(item => item.image_url?.split('/').pop()).filter(Boolean) as string[]
  
  if (fileNames.length > 0) {
    await supabase.storage.from('menu_images').remove(fileNames)
  }
  
  const ids = items.map(i => i.id)
  await supabase.from('menu_items').delete().in('id', ids)
  
  for (const item of items) {
    try { await syncOrQueue(supabase, item, 'delete') } catch { /* queue retains retry */ }
  }
  
  revalidatePath('/dashboard/pos-admin/menu')
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
  await supabase.from('kiosk_settings').upsert({
    outlet_id: '550e8400-e29b-41d4-a716-446655440001',
    key,
    value: JSON.stringify(newIds)
  })
  await supabase.from('kiosk_settings').delete().neq('outlet_id', '550e8400-e29b-41d4-a716-446655440001').eq('key', key)
  revalidatePath('/dashboard/pos-admin/menu')
}

export async function updateMenuChannelPrices(menuId: string, channelPrices: Record<string, number>) {
  const supabase = await getSupabase()
  await supabase.from('menu_items').update({ channel_prices: channelPrices }).eq('id', menuId)
  revalidatePath('/dashboard/pos-admin/menu')
}



