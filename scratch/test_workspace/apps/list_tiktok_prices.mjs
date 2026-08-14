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
      .select('name, price, channel_prices, is_available_online, available_online_channels, sort_order')
      .order('sort_order', { ascending: true })

  if (error) {
    console.error(error)
    return
  }

  const tiktokGoItems = menuItems.filter(item => {
    // Check if channel is active
    let isActive = false
    if (!item.is_available_online) {
      isActive = false
    } else if (!item.available_online_channels) {
      // null means available everywhere online
      isActive = true
    } else {
      const channels = item.available_online_channels.map(c => c.toLowerCase().replace(/\s+/g, ''))
      isActive = channels.includes('tiktokgo') || channels.includes('tiktok_go') || channels.includes('tiktok')
    }
    
    // Or if it explicitly has a tiktok price
    const hasPrice = item.channel_prices && (
      item.channel_prices.tiktokgo !== undefined || 
      item.channel_prices.tiktok_go !== undefined ||
      item.channel_prices.tiktok !== undefined
    )
    
    return isActive || hasPrice
  })

  console.log("| No | Nama Menu | Harga Jual (TikTok Go) | Harga Dasar (Offline) |")
  console.log("|---|---|---|---|")
  
  let i = 1;
  for (const item of tiktokGoItems) {
    const basePriceStr = item.price ? `Rp ${item.price.toLocaleString('id-ID')}` : '-'
    
    const tiktokPrice = item.channel_prices?.tiktokgo ?? item.channel_prices?.tiktok_go ?? item.channel_prices?.tiktok ?? item.price
    const tiktokPriceStr = tiktokPrice ? `Rp ${tiktokPrice.toLocaleString('id-ID')}` : '-'
    
    console.log(`| ${i++} | ${item.name} | **${tiktokPriceStr}** | ${basePriceStr} |`)
  }
}
run()
