'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { revalidatePath } from 'next/cache'
import type { MenuItem } from '@/pos-types'
import { createOrderOnlineAdminClient } from '@/lib/supabase/order-online-client'

async function getSupabase() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })
}

export async function toggleMenuAvailability(id: string, currentStatus: boolean) {
  const supabase = await getSupabase()
  let orderOnline: any = null
  try { orderOnline = createOrderOnlineAdminClient() } catch (e) { console.warn('Order Online not configured, skipping sync') }
  
  await supabase.from('menu_items').update({ is_available: !currentStatus }).eq('id', id)
  
  if (orderOnline) {
    try {
      await orderOnline.from('menu_items').update({ is_available: !currentStatus }).eq('id', id)
    } catch (err) {
      console.error('Failed to sync toggle menu to order online', err)
    }
  }
  
  revalidatePath('/dashboard/pos-admin/menu')
}

export async function deleteMenuItem(id: string, imageUrl: string | null) {
  const supabase = await getSupabase()
  let orderOnline: any = null
  try { orderOnline = createOrderOnlineAdminClient() } catch (e) { console.warn('Order Online not configured, skipping sync') }
  
  if (imageUrl) {
    const fileName = imageUrl.split('/').pop()
    if (fileName) {
      await supabase.storage.from('menu_images').remove([fileName])
    }
  }
  
  await supabase.from('menu_items').delete().eq('id', id)
  
  if (orderOnline) {
    try {
      await orderOnline.from('menu_items').delete().eq('id', id)
    } catch (err) {
      console.error('Failed to sync delete menu to order online', err)
    }
  }
  
  revalidatePath('/dashboard/pos-admin/menu')
}

export async function saveMenuItem(form: Partial<MenuItem> & { package_items_to_save?: { menu_item_id: string, quantity: number }[] }) {
  const supabase = await getSupabase()
  let orderOnline: any = null
  try { orderOnline = createOrderOnlineAdminClient() } catch (e) { console.warn('Order Online not configured, skipping sync') }
  
  const payload = {
    name: form.name,
    description: form.description || null,
    price: Number(form.price),
    category_id: form.category_id || null,
    image_url: form.image_url,
    is_available: form.is_available,
    sort_order: form.sort_order || 0,
    channel_prices: form.channel_prices || {},
    is_package: form.is_package || false,
  }

  let finalId = form.id;

  if (form.id) {
    await supabase.from('menu_items').update(payload).eq('id', form.id)
    if (payload.is_package) {
      await supabase.from('menu_packages').delete().eq('package_id', finalId);
      if (form.package_items_to_save && form.package_items_to_save.length > 0) {
        await supabase.from('menu_packages').insert(
          form.package_items_to_save.map(pi => ({
            package_id: finalId,
            menu_item_id: pi.menu_item_id,
            quantity: pi.quantity
          }))
        )
      }
    }
  } else {
    const { data } = await supabase.from('menu_items').insert([payload]).select().single()
    if (data) {
      finalId = data.id
      if (payload.is_package && form.package_items_to_save && form.package_items_to_save.length > 0) {
        await supabase.from('menu_packages').insert(
          form.package_items_to_save.map(pi => ({
            package_id: finalId,
            menu_item_id: pi.menu_item_id,
            quantity: pi.quantity
          }))
        )
      }
    }
  }
  
  if (orderOnline) {
    try {
      if (finalId) {
         await orderOnline.from('menu_items').upsert([{ id: finalId, ...payload }])
      }
    } catch (err) {
      console.error('Failed to sync save menu to order online', err)
    }
  }
  
  revalidatePath('/dashboard/pos-admin/menu')
}

export async function deleteAllMenuItems(items: MenuItem[]) {
  const supabase = await getSupabase()
  let orderOnline: any = null
  try { orderOnline = createOrderOnlineAdminClient() } catch (e) { console.warn('Order Online not configured, skipping sync') }
  
  const fileNames = items.map(item => item.image_url?.split('/').pop()).filter(Boolean) as string[]
  
  if (fileNames.length > 0) {
    await supabase.storage.from('menu_images').remove(fileNames)
  }
  
  const ids = items.map(i => i.id)
  await supabase.from('menu_items').delete().in('id', ids)
  
  if (orderOnline) {
    try {
      if (ids.length > 0) {
        await orderOnline.from('menu_items').delete().in('id', ids)
      }
    } catch (err) {
      console.error('Failed to sync delete all menu to order online', err)
    }
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



