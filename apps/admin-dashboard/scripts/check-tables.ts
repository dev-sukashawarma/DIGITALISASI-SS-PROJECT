import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data: menuItems, error } = await supabase
    .from('menu_items')
    .select('name, price, channel_prices, is_available_online, available_online_channels, sort_order')
    .order('sort_order', { ascending: true })

  if (error) { console.error(error); return }

  // Show ALL items, including offline ones
  for (const item of menuItems ?? []) {
    const channels = item.available_online_channels ?? []
    const cpKeys = item.channel_prices ? Object.keys(item.channel_prices) : []
    const allChannels = [...new Set([...channels, ...cpKeys])]
      .filter(c => !c.includes('-') && c !== 'online' && c !== 'all_food_apps') // filter out UUIDs and legacy
      .join(', ')
    console.log(`"${item.name}" | Rp ${item.price?.toLocaleString('id-ID')} | ${allChannels || '(tidak aktif online)'}`)
  }
  console.log(`\nTotal: ${menuItems?.length} menu`)
}

main()
