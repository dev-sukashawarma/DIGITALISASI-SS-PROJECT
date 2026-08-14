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
  { name: "COMBO #1 SAPI SEDANG", hpp: 21300, price: 32000 },
  { name: "COMBO #1 UP SIZE BESAR", hpp: 23800, price: 36000 },
  { name: "COMBO #1 UP SIZE JUMBO", hpp: 28800, price: 45000 },
  { name: "COMBO #2", hpp: 19300, price: 29000 },
  { name: "COMBO #2 UP SIZE BESAR", hpp: 21800, price: 33000 },
  { name: "COMBO #2 UP SIZE JUMBO", hpp: 26300, price: 38000 },
  { name: "COMBO #3", hpp: 25300, price: 40000 },
  { name: "COMBO #3 UP SIZE JUMBO", hpp: 31800, price: 50000 },
  { name: "COMBO #4", hpp: 45600, price: 68000 },
  { name: "COMBO #5", hpp: 40600, price: 60000 }
]

async function run() {
  console.log('Starting price injection for combos...')
  
  for (const item of data) {
    let { data: menuItems, error: searchError } = await supabase
      .from('menu_items')
      .select('id, name')
      .ilike('name', item.name)

    if (searchError) {
      console.error(`Error searching for ${item.name}:`, searchError)
      continue
    }

    if (!menuItems || menuItems.length === 0) {
      console.warn(`Exact match not found for: ${item.name}. Trying partial match...`)
      
      const { data: partialMatch } = await supabase
        .from('menu_items')
        .select('id, name')
        .ilike('name', `%${item.name}%`)
        
      if (!partialMatch || partialMatch.length === 0) {
         // Try splitting name
         const firstWord = item.name.split(' ').slice(0, 2).join(' ')
         const { data: fuzzy } = await supabase
          .from('menu_items')
          .select('id, name')
          .ilike('name', `%${firstWord}%`)
         console.warn(`Still not found. Suggestions starting with ${firstWord}:`, fuzzy?.map(f => f.name))
         continue
      } else {
         console.log(`Found partial match: ${partialMatch[0].name} for ${item.name}. Using it.`)
         menuItems = partialMatch
      }
    }

    const targetId = menuItems[0].id
    const targetName = menuItems[0].name
    console.log(`Updating ${targetName} (ID: ${targetId}) with HPP: ${item.hpp}, Price: ${item.price}...`)

    const { error: updateError } = await supabase
      .from('menu_items')
      .update({
        hpp_override: item.hpp,
        price: item.price
      })
      .eq('id', targetId)

    if (updateError) {
      console.error(`Error updating ${targetName}:`, updateError)
    } else {
      console.log(`Successfully updated ${targetName}`)
    }
  }

  console.log('Combo Injection complete.')
}

run()
