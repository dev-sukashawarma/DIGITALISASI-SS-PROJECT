import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fetchDistinctMenus() {
  let allItems: any[] = []
  let from = 0
  let step = 999
  let hasMore = true

  console.log('Fetching orders for July 2026...')

  while (hasMore) {
    const { data: ordersPage, error } = await supabase
      .from('orders')
      .select('order_items(*)')
      .eq('status', 'completed')
      .gte('created_at', '2026-07-01T00:00:00+07:00')
      .lt('created_at', '2026-08-01T00:00:00+07:00')
      .range(from, from + step)

    if (error) {
      console.error(error)
      process.exit(1)
    }

    if (ordersPage && ordersPage.length > 0) {
      allItems = allItems.concat(ordersPage)
      from += step + 1
    } else {
      hasMore = false
    }
  }

  const menuSet = new Set<string>()
  for (const order of allItems) {
    for (const item of (order.order_items || [])) {
      const name = item.menu_item_name || item.name || item.menu_name || item.item_name || ''
      menuSet.add(name.trim().toUpperCase())
    }
  }

  console.log('--- DISTINCT MENU NAMES IN DATABASE (JULY) ---')
  Array.from(menuSet).sort().forEach(m => console.log(m))
}

fetchDistinctMenus().catch(console.error)
