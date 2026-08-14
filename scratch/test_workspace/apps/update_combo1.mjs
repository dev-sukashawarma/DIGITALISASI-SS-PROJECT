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
  const { data, error } = await supabase
      .from('menu_items')
      .update({
        hpp_override: 21300,
        price: 32000,
        sort_order: 15
      })
      .eq('name', 'Combo #1')

  console.log("Updated Combo #1 (COMBO #1 SAPI SEDANG)", error ? error : "Success")
}
run()
