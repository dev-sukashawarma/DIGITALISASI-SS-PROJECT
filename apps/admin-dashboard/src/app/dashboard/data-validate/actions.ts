'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'

export type DBMenuData = {
  name: string
  qty: number
}

// ─────────────────────────────────────────────────────────────
// WHITELIST: nama menu (lowercase) yang valid per channel di DB
// Hanya item dalam daftar ini yang akan dihitung dari DB
// ─────────────────────────────────────────────────────────────
const CHANNEL_MENU_WHITELIST: Record<string, Set<string>> = {
  tiktokgo: new Set([
    'best seller (mix jumbo)',
    'best seller 2',
    'best seller 2 (sapi jumbo)', // alias dari input manual lama
    'shawarma duo combo',
    'triple combo',
    'shawarmie duo varian',
    'suka duo favorite',
    'suka premium crispy',
    'suka premius crispy',       // alias typo lama di DB
    'suka triple favorit',
    'triple seru',
    'spesial suka lovers',
    'mix cheese combo',
    'paket nikmat',
    'paket couple',
    'paket mood',
    'double suka',
    'megabite combo',
    'paket nongki 1',
    'paket nongki 2',
  ]),
  tiktokseller: new Set([
    'original ayam sedang',
    'original mix besar',
    'original sapi sedang',
    'original ayam besar',
    'original sapi besar',
    'original sapi jumbo',
    'original mix jumbo',
    'original ayam jumbo',
  ]),
}

export async function getDBDataForValidation(
  outletId: string,
  channel: string,
  dateFrom: string,
  dateTo: string
): Promise<DBMenuData[]> {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options as any)
        })
      } catch {
        // Ignored if called during SSR
      }
    }
  })

  // Date boundaries (explicitly treat as WIB / UTC+7)
  const from = `${dateFrom}T00:00:00+07:00`
  const to   = `${dateTo}T23:59:59+07:00`

  // Map UI channel key → DB channel value
  const CHANNEL_MAP: Record<string, string> = {
    tiktok_go:     'tiktokgo',
    tiktok_seller: 'tiktokseller',
  }
  const dbChannel = CHANNEL_MAP[channel] ?? channel
  const whitelist = CHANNEL_MENU_WHITELIST[dbChannel] ?? null

  // 1. Try high-performance database-side aggregation via RPC (PostgreSQL optimization)
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_channel_validation_db_qty', {
    p_outlet_id: outletId,
    p_channel: dbChannel,
    p_from: from,
    p_to: to,
  })

  if (!rpcError && Array.isArray(rpcData)) {
    const results: DBMenuData[] = []
    for (const row of rpcData) {
      const cleanName = (row.name || '').trim().toLowerCase()
      if (!cleanName) continue
      if (whitelist && !whitelist.has(cleanName)) continue
      results.push({
        name: cleanName,
        qty: Number(row.qty || 0),
      })
    }
    return results
  }

  // 2. Fallback query with channel & sales_source filter if RPC is not yet available
  const channelAliases = dbChannel === 'tiktokseller'
    ? ['tiktokseller', 'tiktok_seller', 'tiktokshop', 'tiktok_shop', 'tiktok']
    : dbChannel === 'tiktokgo'
    ? ['tiktokgo', 'tiktok_go', 'tiktok']
    : [dbChannel]

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(`
      id,
      order_items (
        menu_item_name,
        quantity
      )
    `)
    .eq('outlet_id', outletId)
    .in('status', ['completed', 'fulfilled', 'selesai', 'paid'])
    .or(`channel.in.(${channelAliases.join(',')}),sales_source.in.(${channelAliases.join(',')})`)
    .gte('created_at', from)
    .lte('created_at', to)

  if (ordersError) {
    throw new Error(ordersError.message)
  }

  const agg = new Map<string, DBMenuData>()

  for (const order of orders || []) {
    for (const item of (order as any).order_items || []) {
      const rawName   = item.menu_item_name || ''
      const cleanName = rawName.split('|')[0].trim().toLowerCase()
      if (!cleanName) continue

      // Hanya hitung item yang ada di whitelist channel ini
      if (whitelist && !whitelist.has(cleanName)) continue

      const cur = agg.get(cleanName) ?? { name: cleanName, qty: 0 }
      cur.qty += Number(item.quantity || 0)
      agg.set(cleanName, cur)
    }
  }

  return Array.from(agg.values())
}

export async function getOutletsForSelect() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {}
  })

  const { data, error } = await supabase
    .from('outlets')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  if (error) {
    throw new Error(error.message)
  }

  return data
}
