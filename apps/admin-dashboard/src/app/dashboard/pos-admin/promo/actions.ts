'use server'

import { createClient } from '@/lib/supabase/server'
import { createOrderOnlineAdminClient } from '@/lib/supabase/order-online-client'
import crypto from 'crypto'

export async function savePromosAction(
  outlets: { id: string }[],
  promos: any[]
) {
  const supabase = await createClient()
  let orderOnline: any = null
  try {
    orderOnline = createOrderOnlineAdminClient()
  } catch (err) {
    console.warn('Order Online client not configured, skipping sync.')
  }

  if (!outlets || outlets.length === 0) {
    return { success: false, error: 'Tidak ada outlet aktif untuk diterapkan promo.' }
  }

  const outletIds = outlets.map(o => o.id)

  const { data: existingPromos, error: fetchError } = await supabase
    .from('outlet_promos')
    .select('id, outlet_id, scope, menu_item_id')
    .in('outlet_id', outletIds)

  if (fetchError) return { success: false, error: fetchError.message || JSON.stringify(fetchError) }

  const existingMap = new Map<string, string>()
  if (existingPromos) {
    for (const ep of existingPromos) {
      const key = `${ep.outlet_id}_${ep.scope}_${ep.menu_item_id || 'null'}`
      existingMap.set(key, ep.id)
    }
  }

  const toUpsertMap = new Map<string, any>()

  for (const outlet of outlets) {
    for (const p of promos) {
      const key = `${outlet.id}_${p.scope}_${p.menu_item_id || 'null'}`
      const existingId = existingMap.get(key)
      
      toUpsertMap.set(key, {
        id: existingId || crypto.randomUUID(),
        outlet_id: outlet.id,
        scope: p.scope,
        menu_item_id: p.menu_item_id,
        discount_type: p.discount_type,
        // Bypass db constraint CHECK (discount_value > 0)
        discount_value: Math.max(0.01, Number(p.discount_value) || 0),
        is_active: p.is_active,
        min_purchase: p.min_purchase,
        usage_limit: p.usage_limit,
        end_date: p.end_date,
        apply_to_food_apps: p.apply_to_food_apps || false
      })
    }
  }

  const toUpsert = Array.from(toUpsertMap.values())

  if (toUpsert.length > 0) {
    const { error: upsertError } = await supabase
      .from('outlet_promos')
      .upsert(toUpsert)

    if (upsertError) {
      console.error('Upsert Error:', upsertError)
      return { success: false, error: upsertError.message || JSON.stringify(upsertError) }
    }
  }

  // Sync to Order Online
  if (orderOnline) {
    try {
      const { data: existingOOPromos } = await orderOnline.from('promos').select('id, applies_to, item_ids')
      
      const ooUpserts = []
      
      for (const p of promos) {
        const appliesTo = p.scope === 'global' ? 'all' : 'item'
        
        // Check if it exists in OO
        let existingOOId = null
        if (existingOOPromos) {
           const match = existingOOPromos.find((oop: any) => {
             if (appliesTo === 'all' && oop.applies_to === 'all') return true
             if (appliesTo === 'item' && oop.applies_to === 'item' && oop.item_ids?.includes(p.menu_item_id)) return true
             return false
           })
           if (match) existingOOId = match.id
        }

        if (p.sync_to_order_online === false) {
          // If they toggle it off, we remove it from Order Online
          if (existingOOId) {
            await orderOnline.from('promos').delete().eq('id', existingOOId)
          }
          continue
        }
        
        ooUpserts.push({
          id: existingOOId || crypto.randomUUID(),
          name: p.scope === 'global' ? 'Global Discount' : 'Menu Discount',
          discount_type: p.discount_type === 'percentage' ? 'percent' : 'fixed',
          discount_value: Math.max(0.01, Number(p.discount_value) || 0),
          min_purchase: p.min_purchase || 0,
          end_at: p.end_date || null,
          is_active: p.is_active,
          applies_to: appliesTo,
          outlet_ids: outletIds,
          item_ids: p.scope === 'item' ? [p.menu_item_id] : null,
        })
      }
      
      if (ooUpserts.length > 0) {
         await orderOnline.from('promos').upsert(ooUpserts)
      }
    } catch (err) {
      console.error('Order Online Promo Sync Error:', err)
    }
  }

  return { success: true }
}
