import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data: items } = await supabase
    .from('order_items')
    .select('menu_item_name, quantity, unit_price, subtotal, order_id')
    .eq('menu_item_name', 'SHAWARMA DUO COMBO')
    .limit(5)
  console.log(items)
  
  const { data: menu } = await supabase
    .from('menu_items')
    .select('name, price, channel_prices')
    .eq('name', 'SHAWARMA DUO COMBO')
    .limit(1)
  console.log('MENU TABLE:', menu)
}
main()
