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

const data = [
  { name: "ORIGINAL AYAM SEDANG", hpp: 14500, price: 24000 },
  { name: "ORIGINAL AYAM BESAR", hpp: 17000, price: 29000 },
  { name: "ORIGINAL AYAM JUMBO", hpp: 21500, price: 34000 },
  { name: "ORIGINAL SAPI SEDANG", hpp: 16500, price: 27000 },
  { name: "ORIGINAL SAPI BESAR", hpp: 19000, price: 32000 },
  { name: "ORIGINAL SAPI JUMBO", hpp: 24000, price: 42000 },
  { name: "ORIGINAL MIX BESAR", hpp: 20500, price: 37000 },
  { name: "ORIGINAL MIX JUMBO", hpp: 27000, price: 47000 },
  { name: "SUKA CHICKEN", hpp: 16500, price: 29000 },
  { name: "SUKA BEEF", hpp: 18500, price: 32000 },
  { name: "SUKA FRIED CHICKEN", hpp: 18000, price: 30000 },
  { name: "SUKA SAMYANG", hpp: 18000, price: 30000 },
  { name: "SHAWARMIE AYAM", hpp: 14500, price: 24000 },
  { name: "SHAWARMIE SAPI", hpp: 16500, price: 27000 },
  { name: "EXTRA KEJU", hpp: 3500, price: 7000 },
  { name: "EXTRA KENTANG", hpp: 3500, price: 9000 }
]

async function run() {
  console.log('Starting price injection...')
  
  for (const item of data) {
    // The user menu names might be case sensitive or have trailing spaces.
    // Let's use ilike or exact match.
    const { data: menuItems, error: searchError } = await supabase
      .from('menu_items')
      .select('id, name')
      .ilike('name', item.name)

    if (searchError) {
      console.error(`Error searching for ${item.name}:`, searchError)
      continue
    }

    if (!menuItems || menuItems.length === 0) {
      console.warn(`Menu not found: ${item.name}`)
      continue
    }

    const targetId = menuItems[0].id
    console.log(`Found ${item.name} (ID: ${targetId}). Updating...`)

    const { error: updateError } = await supabase
      .from('menu_items')
      .update({
        hpp_override: item.hpp,
        price: item.price
      })
      .eq('id', targetId)

    if (updateError) {
      console.error(`Error updating ${item.name}:`, updateError)
    } else {
      console.log(`Successfully updated ${item.name}`)
    }
  }

  console.log('Injection complete.')
}

run()
