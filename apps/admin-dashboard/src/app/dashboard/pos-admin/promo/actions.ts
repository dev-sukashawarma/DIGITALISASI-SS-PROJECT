'use server'

import { createClient } from '@/lib/supabase/server'
import { createOrderOnlineAdminClient } from '@/lib/supabase/order-online-client'
import { getPromoStatus, validateSchedule } from '@/lib/promoSchedule'
import { findPromoOutletOverlaps, isRowAssigned, promoOutletKey, resolvePromoOutletIds } from '@/lib/promoOutlets'
import { resolveRewardMenuForOutlet, LEGACY_REWARD_MENU_NAME } from '@/lib/promoReward'
import crypto from 'crypto'

/**
 * Simpan seluruh promo dari layar admin.
 *
 * Satu entri `promos` = satu promo logis dengan daftar outletnya sendiri.
 * Beberapa entri boleh berbagi scope + menu yang sama (mis. dua "promo semua
 * menu" berbeda untuk dua kelompok outlet) selama daftar outletnya tidak
 * beririsan — kasir membaca tepat satu baris `outlet_promos` per (outlet,
 * scope, menu), jadi tabrakan ditolak di sini, bukan dibiarkan saling timpa.
 */
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

  // Reward BxGy dipilih admin (reward_menu_item_id); promo lama tanpa pilihan
  // tetap Original Ayam Reguler. Resolusi per outlet dilakukan di server agar
  // tiap outlet menerima menu_id yang ada di katalog POS-nya, bukan state browser.
  const { data: availableMenuItems, error: menuError } = await supabase
    .from('menu_items')
    .select('id, outlet_id, name, is_package')
    .eq('is_available', true)

  if (menuError) return { success: false, error: menuError.message || JSON.stringify(menuError) }

  const rewardMenuForOutlet = (p: any, outletId: string) =>
    resolveRewardMenuForOutlet(availableMenuItems || [], outletId, p.reward_menu_item_id || null)

  const promoKey = (p: any) => promoOutletKey(p)
  const menuNameById = new Map<string, string>((availableMenuItems || []).map((m: any) => [String(m.id), String(m.name)]))
  const labelOf = (p: any) => {
    const name = String(p.promo_name || '').trim()
    const base = p.scope === 'global' ? 'Promo semua menu' : `Promo menu ${menuNameById.get(String(p.menu_item_id)) || p.menu_item_id}`
    return name ? `${base} "${name}"` : base
  }

  // Pengecualian menu hanya bermakna untuk promo global persentase/nominal.
  // Id disaring ke katalog menu yang benar-benar ada supaya kolom uuid[] di DB
  // tidak menolak input sampah, dan supaya menu yang sudah dihapus tidak
  // terus terbawa. Urutan mengikuti katalog agar hasil simpan stabil.
  const knownMenuIds = Array.from(new Set<string>((availableMenuItems || []).map((item: any) => String(item.id))))
  const sanitizeExcludedMenuIds = (p: any): string[] => {
    if (p.scope !== 'global' || p.discount_type === 'buy_one_get_one') return []
    const raw = Array.isArray(p.excluded_menu_item_ids) ? p.excluded_menu_item_ids : []
    const wanted = new Set(raw.map((id: unknown) => String(id)))
    return knownMenuIds.filter(id => wanted.has(id))
  }

  // Outlet tujuan tiap promo, diindeks per posisi — beberapa promo bisa
  // berbagi kunci (scope, menu). Daftar yang tidak diisi tetap berarti "semua
  // outlet aktif", jadi payload lama yang belum mengenal pemilihan outlet tidak
  // berubah artinya.
  const targets: string[][] = promos.map(p => resolvePromoOutletIds(p, outletIds))

  // Satu outlet hanya boleh ada di satu promo per kunci — kasir membaca satu
  // baris per (outlet, scope, menu). Diperiksa untuk SEMUA promo, aktif maupun
  // tidak, karena baris di DB tidak bisa menyimpan dua konfigurasi sekaligus.
  const overlaps = findPromoOutletOverlaps(promos, outletIds)
  if (overlaps.length > 0) {
    const first = overlaps[0]
    const names = first.promoIndexes.map(i => labelOf(promos[i])).join(' dan ')
    const extra = overlaps.length > 1 ? ` (dan ${overlaps.length - 1} outlet lain)` : ''
    return {
      success: false,
      error: `Outlet ${outletNameById.get(first.outletId) || first.outletId} dipilih di ${names} sekaligus${extra}. Satu outlet hanya bisa ikut satu promo untuk menu yang sama.`,
    }
  }

  // Jadwal divalidasi di server juga — Server Action adalah endpoint POST
  // publik, guard di form saja tidak cukup. DB punya CHECK constraint yang
  // sama, tapi pesannya tak terbaca kasir kalau sampai lolos ke sana.
  // Hanya promo yang AKTIF yang divalidasi — item promo lama yang sudah
  // dimatikan (is_active=false) bisa saja masih menyimpan start_date/end_date
  // basi dari sebelum field "Nama Promo" ada, dan seharusnya tak memblokir
  // penyimpanan promo lain yang sedang benar-benar diedit.
  for (let i = 0; i < promos.length; i++) {
    const p = promos[i]
    if (!p.is_active) continue

    const promoTargets = targets[i]
    if (promoTargets.length === 0) {
      return { success: false, error: `${labelOf(p)}: pilih minimal satu outlet yang masih aktif.` }
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
      p.reward_menu_item_id = p.reward_menu_item_id ? String(p.reward_menu_item_id) : null
      const rewardLabel = p.reward_menu_item_id
        ? (availableMenuItems || []).find((m: any) => m.id === p.reward_menu_item_id)?.name || 'yang dipilih'
        : LEGACY_REWARD_MENU_NAME
      const outletWithoutReward = promoTargets.find(outletId => !rewardMenuForOutlet(p, outletId))
      if (outletWithoutReward) {
        return {
          success: false,
          error: `${labelOf(p)}: menu hadiah ${rewardLabel} tidak tersedia (habis, paket, atau bukan menu outlet) di outlet ${outletNameById.get(outletWithoutReward) || outletWithoutReward}.`,
        }
      }
    }
    const scheduleError = validateSchedule(p)
    if (scheduleError) return { success: false, error: `${labelOf(p)}: ${scheduleError}` }
    const hasDailySchedule = Array.isArray(p.daily_schedule) && p.daily_schedule.length > 0
    if ((p.start_date || p.end_date || hasDailySchedule) && !String(p.promo_name || '').trim()) {
      return { success: false, error: `${labelOf(p)}: nama promo wajib diisi untuk promo terjadwal.` }
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

  const existingForKey = (key: string) => (existingPromos || []).filter((ep: any) => promoKey(ep) === key)
  const existingForPromo = (i: number) => {
    const wanted = new Set(targets[i])
    return existingForKey(promoKey(promos[i])).filter((ep: any) => wanted.has(ep.outlet_id))
  }

  // Satu pool kuota per PROMO LOGIS (bukan per kunci): dua promo BxGy global
  // untuk dua kelompok outlet punya kuota gabungan masing-masing. Pool lama
  // dipakai ulang supaya menyimpan form tidak mereset pemakaian; pool yang
  // sudah diklaim promo lain di simpanan ini tidak boleh dipakai dua kali —
  // itu terjadi kalau admin memecah satu promo lama jadi dua.
  const quotaPoolByPromoIndex = new Map<number, { id: string; current_usage: number }>()
  const claimedPoolIds = new Set<string>()

  for (let i = 0; i < promos.length; i++) {
    const p = promos[i]
    if (p.discount_type !== 'buy_one_get_one' || p.quota_scope !== 'global') continue

    const matchingRows = existingForPromo(i)
    const candidatePoolIds = Array.from(
      new Set<string>(matchingRows.map((row: any) => row.quota_pool_id).filter(Boolean)),
    ).filter(id => !claimedPoolIds.has(id))
    // Pool yang dikirim form didahulukan — itu pool yang pemakaiannya sedang
    // ditampilkan ke admin — selama memang milik outlet-outlet promo ini.
    const preferredPoolId = p.quota_pool_id && candidatePoolIds.includes(String(p.quota_pool_id)) ? String(p.quota_pool_id) : candidatePoolIds[0]

    if (preferredPoolId) {
      const { data: pool, error: poolError } = await supabase
        .from('promo_quota_pools')
        .select('id, current_usage')
        .eq('id', preferredPoolId)
        .maybeSingle()
      if (poolError) return { success: false, error: poolError.message || 'Pool kuota promo tidak ditemukan.' }
      if (pool) {
        const { error: updatePoolError } = await supabase
          .from('promo_quota_pools')
          .update({ usage_limit: p.usage_limit })
          .eq('id', pool.id)
        if (updatePoolError) {
          return { success: false, error: updatePoolError.message || JSON.stringify(updatePoolError) }
        }
        claimedPoolIds.add(pool.id)
        quotaPoolByPromoIndex.set(i, { id: pool.id, current_usage: Number(pool.current_usage) || 0 })
        continue
      }
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
    claimedPoolIds.add(poolId)
    quotaPoolByPromoIndex.set(i, { id: poolId, current_usage: seededUsage })
  }

  const toUpsertMap = new Map<string, any>()

  for (let i = 0; i < promos.length; i++) {
    const p = promos[i]
    for (const outletId of targets[i]) {
      const key = `${outletId}_${p.scope}_${p.menu_item_id || 'null'}`
      const existingId = existingMap.get(key)
      const isBuyOneGetOne = p.discount_type === 'buy_one_get_one'
      const quotaScope = isBuyOneGetOne && p.quota_scope === 'global' ? 'global' : 'per_outlet'
      const quotaPool = quotaScope === 'global' ? quotaPoolByPromoIndex.get(i) : null
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
          ? rewardMenuForOutlet(p, outletId)?.id || null
          : null,
        excluded_menu_item_ids: sanitizeExcludedMenuIds(p)
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
  //
  // Dilepas = outlet yang tidak diklaim promo MANA PUN pada kunci itu (gabungan
  // semua promo logis yang berbagi kunci), bukan per promo — kalau per promo,
  // promo kedua pada kunci yang sama akan melepas outlet milik promo pertama.
  const claimedByKey = new Map<string, Set<string>>()
  for (let i = 0; i < promos.length; i++) {
    const key = promoKey(promos[i])
    const set = claimedByKey.get(key) || new Set<string>()
    for (const outletId of targets[i]) set.add(outletId)
    claimedByKey.set(key, set)
  }

  const idsToUnassign: string[] = []
  for (const [key, claimed] of claimedByKey) {
    for (const ep of existingForKey(key) as any[]) {
      if (!ep.outlet_id || claimed.has(ep.outlet_id)) continue
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
      const { data: existingOOPromos } = await orderOnline.from('promos').select('id, applies_to, item_ids, outlet_ids')

      const sameKeyAsOO = (p: any, oop: any) => {
        const appliesTo = p.scope === 'global' ? 'all' : 'item'
        if (appliesTo === 'all') return oop.applies_to === 'all'
        return oop.applies_to === 'item' && oop.item_ids?.includes(p.menu_item_id)
      }
      const sameOutletSet = (a: string[], b: unknown) => {
        if (!Array.isArray(b)) return false
        const sa = [...a].sort().join(',')
        const sb = [...b].map(String).sort().join(',')
        return sa === sb
      }

      const ooUpserts: any[] = []
      const claimedOOIds = new Set<string>()

      // Tiap promo logis yang disinkronkan mengambil satu promo Order Online —
      // yang daftar outletnya sama persis didahulukan, lalu yang belum diklaim
      // promo lain pada kunci itu. Sisanya (promo yang sinkronnya dimatikan,
      // BxGy yang memang tak pernah ke website, atau pecahan lama) dihapus.
      for (let i = 0; i < promos.length; i++) {
        const p = promos[i]
        if (p.discount_type === 'buy_one_get_one') continue
        if (p.sync_to_order_online === false) continue

        const candidates = (existingOOPromos || []).filter((oop: any) => sameKeyAsOO(p, oop) && !claimedOOIds.has(oop.id))
        const match = candidates.find((oop: any) => sameOutletSet(targets[i], oop.outlet_ids)) || candidates[0]
        const existingOOId = match?.id || null
        if (existingOOId) claimedOOIds.add(existingOOId)

        ooUpserts.push({
          id: existingOOId || crypto.randomUUID(),
          name: String(p.promo_name || '').trim() || (p.scope === 'global' ? 'Global Discount' : 'Menu Discount'),
          discount_type: p.discount_type === 'percentage' ? 'percent' : 'fixed',
          discount_value: Math.max(0.01, Number(p.discount_value) || 0),
          min_purchase: p.min_purchase || 0,
          end_at: p.end_date || null,
          // Order Online belum punya kolom jadwal mulai, jadi promo yang masih
          // "Terjadwal" dikirim non-aktif ke sana. Saat jadwalnya tiba, admin
          // perlu menyimpan ulang halaman ini agar ikut menyala di website.
          is_active: p.is_active && getPromoStatus(p) === 'berjalan',
          applies_to: p.scope === 'global' ? 'all' : 'item',
          // Website hanya boleh menawarkan promo ini di outlet yang dipilih admin.
          outlet_ids: targets[i],
          item_ids: p.scope === 'item' ? [p.menu_item_id] : null,
          // Catatan: skema promo Order Online belum punya kolom pengecualian menu,
          // jadi excluded_menu_item_ids tidak ikut ke website — di sana promo
          // global tetap berlaku untuk semua menu.
        })
      }

      // Hanya kunci yang ada di payload yang dibersihkan — promo Order Online
      // untuk menu yang tidak dikirim layar ini dibiarkan apa adanya.
      const keysInPayload = new Set(promos.map(promoKey))
      const ooIdsToDelete = (existingOOPromos || [])
        .filter((oop: any) => !claimedOOIds.has(oop.id))
        .filter((oop: any) => promos.some(p => keysInPayload.has(promoKey(p)) && sameKeyAsOO(p, oop)))
        .map((oop: any) => oop.id)

      if (ooIdsToDelete.length > 0) {
        await orderOnline.from('promos').delete().in('id', ooIdsToDelete)
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
