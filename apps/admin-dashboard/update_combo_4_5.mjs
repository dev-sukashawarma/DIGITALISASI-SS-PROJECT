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
  await supabase
      .from('menu_items')
      .update({ hpp_override: 45600, price: 68000, sort_order: 23 })
      .eq('name', 'Combo 4')

  await supabase
      .from('menu_items')
      .update({ hpp_override: 40600, price: 60000, sort_order: 24 })
      .eq('name', 'Combo 5')

  console.log("Combo 4 and 5 updated!")
}
run()
