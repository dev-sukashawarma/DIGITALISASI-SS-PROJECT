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
      .select('name, price, hpp_override, sort_order')
      .order('sort_order', { ascending: true })

  if (error) {
    console.error(error)
    return
  }

  console.log("| No | Nama Menu | HPP (Override/BOM) | Harga Jual (Offline/POS) |")
  console.log("|---|---|---|---|")
  
  let i = 1;
  for (const item of menuItems) {
    const priceStr = item.price ? `Rp ${item.price.toLocaleString('id-ID')}` : '-'
    const hppStr = item.hpp_override ? `Rp ${item.hpp_override.toLocaleString('id-ID')}` : '-'
    console.log(`| ${i++} | ${item.name} | ${hppStr} | ${priceStr} |`)
  }
}
run()
