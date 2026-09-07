'use server'

import { createClient } from '@/lib/supabase/server'
import { createOrderOnlineAdminClient } from '@/lib/supabase/order-online-client'
import { getPromoStatus, validateSchedule } from '@/lib/promoSchedule'
import { isRowAssigned, promoOutletKey, resolvePromoOutletIds } from '@/lib/promoOutlets'
import crypto from 'crypto'

export async function savePromosAction(
  outlets: { id: string; name?: string }[],
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
  const outletNameById = new Map<string, string>(outlets.map(o => [o.id, o.name || o.id]))

  // Reward BxGy adalah menu tetap, bukan menu pemicu. Resolusi dilakukan di
  // server agar semua outlet menerima menu_id yang sama dengan katalog POS dan
  // tidak bergantung pada state browser.
  const { data: availableMenuItems, error: menuError } = await supabase
    .from('menu_items')
    .select('id, outlet_id, name')
    .eq('is_available', true)

  if (menuError) return { success: false, error: menuError.message || JSON.stringify(menuError) }

  const normalizeMenuName = (value: unknown) => String(value || '').trim().toLocaleLowerCase('id-ID')
  const rewardMenuForOutlet = (outletId: string) => {
    const candidates = (availableMenuItems || []).filter((item: any) => {
      const belongsToOutlet = item.outlet_id == null || item.outlet_id === outletId
      const name = normalizeMenuName(item.name)
      return belongsToOutlet && name === 'original ayam reguler'
    })
    return candidates.sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)))[0] || null
  }

  const promoKey = (p: any) => promoOutletKey(p)

  // Outlet tujuan tiap promo. Daftar kosong tetap berarti "semua outlet aktif",
  // jadi payload lama yang belum mengenal pemilihan outlet tidak berubah artinya.
  const targetOutletsByPromo = new Map<string, string[]>()
  for (const p of promos) {
    targetOutletsByPromo.set(promoKey(p), resolvePromoOutletIds(p, outletIds))
  }
  const targetsFor = (p: any): string[] => targetOutletsByPromo.get(promoKey(p)) || []

  // Jadwal divalidasi di server juga — Server Action adalah endpoint POST
  // publik, guard di form saja tidak cukup. DB punya CHECK constraint yang
  // sama, tapi pesannya tak terbaca kasir kalau sampai lolos ke sana.
  // Hanya promo yang AKTIF yang divalidasi — item promo lama yang sudah
  // dimatikan (is_active=false) bisa saja masih menyimpan start_date/end_date
  // basi dari sebelum field "Nama Promo" ada, dan seharusnya tak memblokir
  // penyimpanan promo lain yang sedang benar-benar diedit.
  for (const p of promos) {
    if (!p.is_active) continue

    const targets = targetsFor(p)
    if (targets.length === 0) {
      const label = p.scope === 'global' ? 'Promo Semua Menu' : `Promo menu (${p.menu_item_id})`
      return { success: false, error: `${label}: pilih minimal satu outlet yang masih aktif.` }
    }

    if (p.discount_type === 'buy_one_get_one') {
      if (p.scope === 'item' && !p.menu_item_id) {
        return { success: false, error: 'Promo Buy X Get Y per-menu membutuhkan menu pemicu.' }
      }
      if (p.scope !== 'item' && p.scope !== 'global') {
        return { success: false, error: 'Scope promo Buy X Get Y tidak valid.' }
      }
      if (p.quota_scope !== undefined && p.quota_scope !== 'global' && p.quota_scope !== 'per_outlet') {
        return { success: false, error: 'Pola batas kuota Buy X Get Y tidak valid.' }
      }
      p.buy_quantity = Number(p.buy_quantity)
      p.get_quantity = Number(p.get_quantity)
      if (!Number.isInteger(p.buy_quantity) || p.buy_quantity < 1 || !Number.isInteger(p.get_quantity) || p.get_quantity < 1) {
        return { success: false, error: 'Jumlah beli dan gratis Buy X Get Y wajib bilangan bulat minimal 1.' }
      }
      if (p.usage_limit !== null && p.usage_limit !== undefined && p.usage_limit !== '') {
        p.usage_limit = Number(p.usage_limit)
        if (!Number.isInteger(p.usage_limit) || p.usage_limit < 1) {
          return { success: false, error: 'Batas kuota Buy X Get Y wajib bilangan bulat minimal 1.' }
        }
      } else {
        p.usage_limit = null
      }
      // Fitur ini hanya untuk transaksi POS kasir; jangan percaya state form saja.
      p.apply_to_food_apps = false
      p.sync_to_order_online = false
      p.min_purchase = null
      p.discount_value = 0.01
      // Hanya outlet yang benar-benar dipilih yang perlu punya menu hadiah —
      // outlet lain tidak akan menerima promo ini sama sekali.
      const outletWithoutReward = targets.find(outletId => !rewardMenuForOutlet(outletId))
      if (outletWithoutReward) {
        return {
          success: false,
          error: `Promo Buy X Get Y membutuhkan menu hadiah Original Ayam Reguler yang aktif di outlet ${outletNameById.get(outletWithoutReward) || outletWithoutReward}.`,
        }
      }
    }
    const scheduleError = validateSchedule(p)
    if (scheduleError) return { success: false, error: scheduleError }
    const hasDailySchedule = Array.isArray(p.daily_schedule) && p.daily_schedule.length > 0
    if ((p.start_date || p.end_date || hasDailySchedule) && !String(p.promo_name || '').trim()) {
      const label = p.scope === 'global' ? 'Promo Semua Menu' : `Promo menu (${p.menu_item_id})`
      return { success: false, error: `${label}: nama promo wajib diisi untuk promo terjadwal.` }
    }
  }

  const { data: existingPromos, error: fetchError } = await supabase
    .from('outlet_promos')
    .select('id, outlet_id, scope, menu_item_id, discount_type, quota_scope, quota_pool_id, current_usage, is_assigned')
    .in('outlet_id', outletIds)

  if (fetchError) return { success: false, error: fetchError.message || JSON.stringify(fetchError) }

  const existingMap = new Map<string, string>()
  if (existingPromos) {
    for (const ep of existingPromos) {
      const key = `${ep.outlet_id}_${ep.scope}_${ep.menu_item_id || 'null'}`
      existingMap.set(key, ep.id)
    }
  }

  const existingForPromo = (p: any) => (existingPromos || []).filter((ep: any) => promoKey(ep) === promoKey(p))
  const quotaPoolByPromoKey = new Map<string, { id: string; current_usage: number }>()

  // A global BxGy quota is shared by all cloned outlet_promos rows. Reuse an
  // existing pool when possible so saving the form does not reset usage.
  for (const p of promos) {
    if (p.discount_type !== 'buy_one_get_one' || p.quota_scope !== 'global') continue

    const matchingRows = existingForPromo(p)
    const poolIds = Array.from(new Set(matchingRows.map((row: any) => row.quota_pool_id).filter(Boolean)))
    if (poolIds.length > 1) {
      return { success: false, error: 'Promo Buy X Get Y memiliki beberapa pool kuota global yang tidak konsisten. Periksa data promo terlebih dahulu.' }
    }

    if (poolIds.length === 1) {
      const { data: pool, error: poolError } = await supabase
        .from('promo_quota_pools')
        .select('id, current_usage')
        .eq('id', poolIds[0])
        .single()
      if (poolError || !pool) {
        return { success: false, error: poolError?.message || 'Pool kuota promo tidak ditemukan.' }
      }
      const { error: updatePoolError } = await supabase
        .from('promo_quota_pools')
        .update({ usage_limit: p.usage_limit })
        .eq('id', pool.id)
      if (updatePoolError) {
        return { success: false, error: updatePoolError.message || JSON.stringify(updatePoolError) }
      }
      quotaPoolByPromoKey.set(promoKey(p), { id: pool.id, current_usage: Number(pool.current_usage) || 0 })
      continue
    }

    const seededUsage = matchingRows.reduce((sum: number, row: any) => sum + (Number(row.current_usage) || 0), 0)
    const poolId = crypto.randomUUID()
    const { error: createPoolError } = await supabase
      .from('promo_quota_pools')
      .insert({
        id: poolId,
        usage_limit: p.usage_limit == null || p.usage_limit === '' ? null : Number(p.usage_limit),
        current_usage: seededUsage,
      })
    if (createPoolError) {
      return { success: false, error: createPoolError.message || JSON.stringify(createPoolError) }
    }
    quotaPoolByPromoKey.set(promoKey(p), { id: poolId, current_usage: seededUsage })
  }

  const toUpsertMap = new Map<string, any>()

  for (const p of promos) {
    for (const outletId of targetsFor(p)) {
      const key = `${outletId}_${p.scope}_${p.menu_item_id || 'null'}`
      const existingId = existingMap.get(key)
      const isBuyOneGetOne = p.discount_type === 'buy_one_get_one'
      const quotaScope = isBuyOneGetOne && p.quota_scope === 'global' ? 'global' : 'per_outlet'
      const quotaPool = quotaScope === 'global' ? quotaPoolByPromoKey.get(promoKey(p)) : null
      const usageLimit = p.usage_limit == null || p.usage_limit === '' ? null : Number(p.usage_limit)

      toUpsertMap.set(key, {
        id: existingId || crypto.randomUUID(),
        outlet_id: outletId,
        scope: p.scope,
        menu_item_id: p.menu_item_id,
        discount_type: p.discount_type,
        // Bypass db constraint CHECK (discount_value > 0)
        discount_value: p.discount_type === 'buy_one_get_one' ? 0.01 : Math.max(0.01, Number(p.discount_value) || 0),
        is_active: p.is_active,
        // Outlet ini termasuk yang dipilih admin — kebalikan dari baris yang
        // dilepas di bawah. Kolomnya wajib ikut ditulis supaya baris yang dulu
        // pernah dilepas dan kini dipilih lagi kembali dianggap terpasang.
        is_assigned: true,
        min_purchase: p.min_purchase,
        usage_limit: usageLimit,
        quota_scope: quotaScope,
        quota_pool_id: quotaPool?.id || null,
        // Keep the per-row value useful to existing POS clients. The quota
        // function treats the pool as authoritative for global BxGy quotas.
        ...(quotaPool ? { current_usage: quotaPool.current_usage } : {}),
        start_date: p.start_date ?? null,
        end_date: p.end_date ?? null,
        daily_start_time: p.daily_start_time ?? null,
        daily_end_time: p.daily_end_time ?? null,
        daily_schedule: Array.isArray(p.daily_schedule)
          ? p.daily_schedule.map((row: any) => ({
              date: String(row?.date || ''),
              start_time: String(row?.start_time || ''),
              end_time: String(row?.end_time || ''),
            }))
          : [],
        apply_to_food_apps: p.discount_type === 'buy_one_get_one' ? false : (p.apply_to_food_apps || false)
        ,promo_name: String(p.promo_name || '').trim() || null,
        buy_quantity: p.discount_type === 'buy_one_get_one' ? Number(p.buy_quantity) : 1,
        get_quantity: p.discount_type === 'buy_one_get_one' ? Number(p.get_quantity) : 1,
        reward_menu_item_id: p.discount_type === 'buy_one_get_one'
          ? rewardMenuForOutlet(outletId)?.id || null
          : null
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

  // Outlet yang dicoret dari sebuah promo TIDAK dihapus barisnya: promo_redemptions
  // memakai ON DELETE RESTRICT dan order_items menyimpan promo_id untuk laporan,
  // jadi menghapus baris berarti kehilangan riwayat — atau gagal total. Barisnya
  // cukup dilepas sekaligus dimatikan; kasir memfilter is_active, dan CHECK di
  // tabel menjamin baris yang dilepas tidak mungkin ikut aktif.
  const idsToUnassign: string[] = []
  for (const p of promos) {
    const targets = new Set(targetsFor(p))
    for (const ep of existingForPromo(p) as any[]) {
      if (!ep.outlet_id || targets.has(ep.outlet_id)) continue
      if (!isRowAssigned(ep)) continue
      idsToUnassign.push(ep.id)
    }
  }

  if (idsToUnassign.length > 0) {
    const { error: unassignError } = await supabase
      .from('outlet_promos')
      .update({ is_active: false, is_assigned: false })
      .in('id', idsToUnassign)

    if (unassignError) {
      console.error('Unassign Error:', unassignError)
      return { success: false, error: unassignError.message || JSON.stringify(unassignError) }
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

        // Buy X Get Y sengaja tidak pernah masuk ke Order Online/food apps.
        // Hapus promo lama jika tipe promo sebelumnya pernah tersinkron.
        if (p.discount_type === 'buy_one_get_one') {
          if (existingOOId) {
            await orderOnline.from('promos').delete().eq('id', existingOOId)
          }
          continue
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
          // Website hanya boleh menawarkan promo ini di outlet yang dipilih admin.
          outlet_ids: targetsFor(p),
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
