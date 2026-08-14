import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function run() {
  const { data, error } = await supabase.from('menu_items').select('*').limit(1)
  if (error) {
    console.error(error)
  } else {
    console.log('=== MENU_ITEM COLUMNS ===', Object.keys(data[0] || {}))
  }
}
run()
