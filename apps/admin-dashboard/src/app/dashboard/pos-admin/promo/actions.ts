'use server'

import { createClient } from '@/lib/supabase/server'
import { createOrderOnlineAdminClient } from '@/lib/supabase/order-online-client'
import { getPromoStatus, validateSchedule } from '@/lib/promoSchedule'
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

  // Jadwal divalidasi di server juga — Server Action adalah endpoint POST
  // publik, guard di form saja tidak cukup. DB punya CHECK constraint yang
  // sama, tapi pesannya tak terbaca kasir kalau sampai lolos ke sana.
  // Hanya promo yang AKTIF yang divalidasi — item promo lama yang sudah
  // dimatikan (is_active=false) bisa saja masih menyimpan start_date/end_date
  // basi dari sebelum field "Nama Promo" ada, dan seharusnya tak memblokir
  // penyimpanan promo lain yang sedang benar-benar diedit.
  for (const p of promos) {
    if (!p.is_active) continue
    if (p.discount_type === 'buy_one_get_one') {
      if (p.scope !== 'item' || !p.menu_item_id) {
        return { success: false, error: 'Promo Buy X Get Y hanya dapat dipasang pada satu menu.' }
      }
      p.buy_quantity = Number(p.buy_quantity)
      p.get_quantity = Number(p.get_quantity)
      if (!Number.isInteger(p.buy_quantity) || p.buy_quantity < 1 || !Number.isInteger(p.get_quantity) || p.get_quantity < 1) {
        return { success: false, error: 'Jumlah beli dan gratis Buy X Get Y wajib bilangan bulat minimal 1.' }
      }
      // Fitur ini hanya untuk transaksi POS kasir; jangan percaya state form saja.
      p.apply_to_food_apps = false
      p.sync_to_order_online = false
      p.min_purchase = null
      p.discount_value = 0.01
    }
    const scheduleError = validateSchedule(p)
    if (scheduleError) return { success: false, error: scheduleError }
    if ((p.start_date || p.end_date) && !String(p.promo_name || '').trim()) {
      const label = p.scope === 'global' ? 'Promo Semua Menu' : `Promo menu (${p.menu_item_id})`
      return { success: false, error: `${label}: nama promo wajib diisi untuk promo terjadwal.` }
    }
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
        discount_value: p.discount_type === 'buy_one_get_one' ? 0.01 : Math.max(0.01, Number(p.discount_value) || 0),
        is_active: p.is_active,
        min_purchase: p.min_purchase,
        usage_limit: p.usage_limit,
        start_date: p.start_date ?? null,
        end_date: p.end_date ?? null,
        daily_start_time: p.daily_start_time ?? null,
        daily_end_time: p.daily_end_time ?? null,
        apply_to_food_apps: p.discount_type === 'buy_one_get_one' ? false : (p.apply_to_food_apps || false)
        ,promo_name: String(p.promo_name || '').trim() || null,
        buy_quantity: p.discount_type === 'buy_one_get_one' ? Number(p.buy_quantity) : 1,
        get_quantity: p.discount_type === 'buy_one_get_one' ? Number(p.get_quantity) : 1
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
        // Buy 1 Get 1 sengaja tidak pernah masuk ke Order Online/food apps.
        if (p.discount_type === 'buy_one_get_one') continue
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
          // Order Online belum punya kolom jadwal mulai, jadi promo yang masih
          // "Terjadwal" dikirim non-aktif ke sana. Saat jadwalnya tiba, admin
          // perlu menyimpan ulang halaman ini agar ikut menyala di website.
          is_active: p.is_active && getPromoStatus(p) === 'berjalan',
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
