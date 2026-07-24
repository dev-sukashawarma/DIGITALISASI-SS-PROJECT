import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  process.exit(1)
}
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: menuItems, error } = await supabase
      .from('menu_items')
      .select('name, price, channel_prices')
      .in('name', ['ORIGINAL AYAM SEDANG', 'COMBO #1', 'EXTRA KEJU'])
      .order('name')

  if (error) {
    console.error(error)
    return
  }

  console.log("=== VERIFIKASI DATA HARGA ===")
  for (const item of menuItems) {
    console.log(`Menu: ${item.name}`)
    console.log(`- Base Price (Offline): ${item.price}`)
    console.log(`- Channel Prices (Online):`, item.channel_prices)
    console.log(`- Yang ditarik POS Kasir: ${item.price} (untuk offline)`)
    console.log("---------------------------------")
  }
}
run()
