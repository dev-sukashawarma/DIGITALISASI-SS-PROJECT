'use server'

import { createClient } from '@/lib/supabase/server'

export async function savePromosAction(
  outlets: { id: string }[],
  promos: any[]
) {
  const supabase = await createClient()

  if (!outlets || outlets.length === 0) {
    throw new Error('Tidak ada outlet aktif untuk diterapkan promo.')
  }

  const outletIds = outlets.map(o => o.id)

  const { data: existingPromos, error: fetchError } = await supabase
    .from('outlet_promos')
    .select('id, outlet_id, scope, menu_item_id')
    .in('outlet_id', outletIds)

  if (fetchError) throw fetchError

  const existingMap = new Map<string, string>()
  if (existingPromos) {
    for (const ep of existingPromos) {
      const key = `${ep.outlet_id}_${ep.scope}_${ep.menu_item_id || 'null'}`
      existingMap.set(key, ep.id)
    }
  }

  const toUpsert: any[] = []

  for (const outlet of outlets) {
    for (const p of promos) {
      const key = `${outlet.id}_${p.scope}_${p.menu_item_id || 'null'}`
      const existingId = existingMap.get(key)
      
      toUpsert.push({
        ...(existingId ? { id: existingId } : {}),
        outlet_id: outlet.id,
        scope: p.scope,
        menu_item_id: p.menu_item_id,
        discount_type: p.discount_type,
        discount_value: p.discount_value,
        is_active: p.is_active,
        min_purchase: p.min_purchase,
        end_date: p.end_date
      })
    }
  }

  if (toUpsert.length > 0) {
    const { error: upsertError } = await supabase
      .from('outlet_promos')
      .upsert(toUpsert)

    if (upsertError) {
      console.error('Upsert Error:', upsertError)
      throw upsertError
    }
  }

  return { success: true }
}
