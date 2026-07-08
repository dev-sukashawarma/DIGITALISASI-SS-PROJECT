'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { revalidatePath } from 'next/cache'
import type { MenuItem } from '@/pos-types'

async function getSupabase() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })
}

export async function toggleMenuAvailability(id: string, currentStatus: boolean) {
  const supabase = await getSupabase()
  await supabase.from('menu_items').update({ is_available: !currentStatus }).eq('id', id)
  revalidatePath('/dashboard/pos-admin/menu')
}

export async function deleteMenuItem(id: string, imageUrl: string | null) {
  const supabase = await getSupabase()
  
  if (imageUrl) {
    const fileName = imageUrl.split('/').pop()
    if (fileName) {
      await supabase.storage.from('menu_images').remove([fileName])
    }
  }
  
  await supabase.from('menu_items').delete().eq('id', id)
  revalidatePath('/dashboard/pos-admin/menu')
}

export async function saveMenuItem(form: Partial<MenuItem>) {
  const supabase = await getSupabase()
  
  const payload = {
    name: form.name,
    description: form.description || null,
    price: Number(form.price),
    category_id: form.category_id || null,
    image_url: form.image_url,
    is_available: form.is_available,
    sort_order: form.sort_order || 0,
  }

  if (form.id) {
    await supabase.from('menu_items').update(payload).eq('id', form.id)
  } else {
    await supabase.from('menu_items').insert([payload])
  }
  
  revalidatePath('/dashboard/pos-admin/menu')
}

export async function deleteAllMenuItems(items: MenuItem[]) {
  const supabase = await getSupabase()
  
  const fileNames = items.map(item => item.image_url?.split('/').pop()).filter(Boolean) as string[]
  
  if (fileNames.length > 0) {
    await supabase.storage.from('menu_images').remove(fileNames)
  }
  
  await supabase.from('menu_items').delete().not('id', 'is', null)
  revalidatePath('/dashboard/pos-admin/menu')
}
