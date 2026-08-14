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
  // Get all items that have sort_order <= 0 or null
  const { data: menuItems, error } = await supabase
      .from('menu_items')
      .select('id, sort_order')
      .or('sort_order.is.null,sort_order.lte.0')

  if (error) {
    console.error(error)
    return
  }

  for (const item of menuItems) {
    await supabase
      .from('menu_items')
      .update({ sort_order: 999 })
      .eq('id', item.id)
  }
  
  console.log("Fixed other items sort order to 999.")
}
run()
