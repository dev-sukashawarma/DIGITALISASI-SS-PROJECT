import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const order = [
  "ORIGINAL AYAM SEDANG",
  "ORIGINAL AYAM BESAR",
  "ORIGINAL AYAM JUMBO",
  "ORIGINAL SAPI SEDANG",
  "ORIGINAL SAPI BESAR",
  "ORIGINAL SAPI JUMBO",
  "ORIGINAL MIX BESAR",
  "ORIGINAL MIX JUMBO",
  "SUKA CHICKEN",
  "SUKA BEEF",
  "SUKA FRIED CHICKEN",
  "SUKA SAMYANG",
  "SHAWARMIE AYAM",
  "SHAWARMIE SAPI",
  "COMBO #1 SAPI SEDANG",
  "COMBO #1 UP SIZE BESAR",
  "COMBO #1 UP SIZE JUMBO",
  "COMBO #2",
  "COMBO #2 UP SIZE BESAR",
  "COMBO #2 UP SIZE JUMBO",
  "COMBO #3",
  "COMBO #3 UP SIZE JUMBO",
  "COMBO #4",
  "COMBO #5",
  "EXTRA KEJU",
  "EXTRA KENTANG"
]

async function run() {
  console.log('Starting sort_order injection...')
  
  for (let i = 0; i < order.length; i++) {
    const itemName = order[i]
    const sortOrder = i + 1 // 1-based indexing

    const { data: menuItems, error: searchError } = await supabase
      .from('menu_items')
      .select('id, name')
      .ilike('name', itemName)

    if (searchError) {
      console.error(`Error searching for ${itemName}:`, searchError)
      continue
    }

    if (!menuItems || menuItems.length === 0) {
      console.warn(`Menu not found: ${itemName}`)
      continue
    }

    const targetId = menuItems[0].id

    const { error: updateError } = await supabase
      .from('menu_items')
      .update({
        sort_order: sortOrder
      })
      .eq('id', targetId)

    if (updateError) {
      console.error(`Error updating ${itemName}:`, updateError)
    } else {
      console.log(`Successfully updated ${itemName} to sort_order ${sortOrder}`)
    }
  }

  console.log('Sort order injection complete.')
}

run()
