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
  const { data: menuItems } = await supabase.from('menu_items').select('name, available_outlets, available_online_channels, channel_prices')
  const { data: outlets } = await supabase.from('outlets').select('id, name')
  const outletMap = {}
  if(outlets) outlets.forEach(o => outletMap[o.id] = o.name)

  console.log("=== Menu Combo dengan Outlet Terbatas ===")
  menuItems.forEach(m => {
    const isCombo = m.name.toUpperCase().includes('COMBO') || m.name.toUpperCase().includes('PAKET')
    
    // Check if it's available in TikTok Go
    let isTTGo = false
    if (m.available_online_channels) {
       const channels = m.available_online_channels.map(c => c.toLowerCase().replace(/\s+/g, ''))
       isTTGo = channels.includes('tiktokgo') || channels.includes('tiktok_go') || channels.includes('tiktok')
    }
    const hasTTGoPrice = m.channel_prices && (m.channel_prices.tiktokgo || m.channel_prices.tiktok_go || m.channel_prices.tiktok)
    
    if (isCombo && (isTTGo || hasTTGoPrice)) {
      if (m.available_outlets && m.available_outlets.length > 0) {
        const outletNames = m.available_outlets.map(id => outletMap[id] || id).join(', ')
        console.log(`Menu: ${m.name} | Outlets: ${outletNames}`)
      } else {
        console.log(`Menu: ${m.name} | Outlets: SEMUA OUTLET`)
      }
    }
  })
}
run()
