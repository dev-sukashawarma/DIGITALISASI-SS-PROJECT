'use server'

import { getPosSupabase } from '@/lib/supabase-pos'
import { getPromoStatus, validateSchedule } from '@/lib/promoSchedule'
import { isRowAssigned, promoOutletKey, resolvePromoOutletIds } from '@/lib/promoOutlets'
import crypto from 'crypto'

export async function savePromosAction(
  outlets: { id: string; name?: string }[],
  promos: any[]
) {
  const supabase = getPosSupabase()

  if (!outlets || outlets.length === 0) {
    return { success: false, error: 'Tidak ada outlet aktif untuk diterapkan promo.' }
  }

  const outletIds = outlets.map((o) => o.id)
  const outletNameById = new Map<string, string>(outlets.map((o) => [o.id, o.name || o.id]))

  // Ambil data menu aktif untuk validasi reward BxGy dan pengecualian
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

  const knownMenuIds = Array.from(new Set<string>((availableMenuItems || []).map((item: any) => String(item.id))))
  const sanitizeExcludedMenuIds = (p: any): string[] => {
    if (p.scope !== 'global' || p.discount_type === 'buy_one_get_one') return []
    const raw = Array.isArray(p.excluded_menu_item_ids) ? p.excluded_menu_item_ids : []
    const wanted = new Set(raw.map((id: unknown) => String(id)))
    return knownMenuIds.filter((id) => wanted.has(id))
  }

  const targetOutletsByPromo = new Map<string, string[]>()
  for (const p of promos) {
    targetOutletsByPromo.set(promoKey(p), resolvePromoOutletIds(p, outletIds))
  }
  const targetsFor = (p: any): string[] => targetOutletsByPromo.get(promoKey(p)) || []

  // Validasi promo yang aktif
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
      p.apply_to_food_apps = false
      p.sync_to_order_online = false
      p.min_purchase = null
      p.discount_value = 0.01

      const outletWithoutReward = targets.find((outletId) => !rewardMenuForOutlet(outletId))
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

  // Global BxGy quota shared via pool
  for (const p of promos) {
    if (p.discount_type !== 'buy_one_get_one' || p.quota_scope !== 'global') continue

    const matchingRows = existingForPromo(p)
    const poolIds = Array.from(new Set(matchingRows.map((row: any) => row.quota_pool_id).filter(Boolean)))
    if (poolIds.length > 1) {
      return { success: false, error: 'Promo Buy X Get Y memiliki beberapa pool kuota global yang tidak konsisten.' }
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
        discount_value: p.discount_type === 'buy_one_get_one' ? 0.01 : Math.max(0.01, Number(p.discount_value) || 0),
        is_active: p.is_active,
        is_assigned: true,
        min_purchase: p.min_purchase,
        usage_limit: usageLimit,
        quota_scope: quotaScope,
        quota_pool_id: quotaPool?.id || null,
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
        apply_to_food_apps: p.discount_type === 'buy_one_get_one' ? false : (p.apply_to_food_apps || false),
        promo_name: String(p.promo_name || '').trim() || null,
        buy_quantity: p.discount_type === 'buy_one_get_one' ? Number(p.buy_quantity) : 1,
        get_quantity: p.discount_type === 'buy_one_get_one' ? Number(p.get_quantity) : 1,
        reward_menu_item_id: p.discount_type === 'buy_one_get_one'
          ? rewardMenuForOutlet(outletId)?.id || null
          : null,
        excluded_menu_item_ids: sanitizeExcludedMenuIds(p),
      })
    }
  }

  const toUpsert = Array.from(toUpsertMap.values())

  if (toUpsert.length > 0) {
    const { error: upsertError } = await supabase.from('outlet_promos').upsert(toUpsert)

    if (upsertError) {
      console.error('Upsert Error:', upsertError)
      return { success: false, error: upsertError.message || JSON.stringify(upsertError) }
    }
  }

  // Baris outlet yang dicoret dimatikan (is_active = false, is_assigned = false)
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

  return { success: true }
}
