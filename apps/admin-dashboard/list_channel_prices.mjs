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

  const formatRp = (val) => val ? `Rp ${val.toLocaleString('id-ID')}` : '-'
  
  // Channels to check
  const channels = ['offline', 'gofood', 'grabfood', 'shopeefood', 'tiktokgo']
  
  console.log("| No | Nama Menu | Offline | GoFood | GrabFood | ShopeeFood | TikTok Go |")
  console.log("|---|---|---|---|---|---|---|")
  
  let i = 1;
  for (const item of menuItems) {
    const isAvail = (ch) => {
        if (!item.is_available_online) return false
        if (!item.available_online_channels) return true
        const chans = item.available_online_channels.map(c => c.toLowerCase().replace(/\s+/g, ''))
        return chans.includes(ch)
    }

    const priceOf = (ch) => {
        if (ch === 'offline') return item.price
        
        // check specific
        if (ch === 'tiktokgo') {
            const hasTT = isAvail('tiktokgo') || isAvail('tiktok_go') || isAvail('tiktok')
            if (!hasTT && !(item.channel_prices?.tiktokgo || item.channel_prices?.tiktok_go || item.channel_prices?.tiktok)) return null
            return item.channel_prices?.tiktokgo ?? item.channel_prices?.tiktok_go ?? item.channel_prices?.tiktok ?? item.price
        }

        const hasCh = isAvail(ch)
        if (!hasCh && !item.channel_prices?.[ch]) return null
        return item.channel_prices?.[ch] ?? item.price
    }

    const pOffline = formatRp(priceOf('offline'))
    const pGoFood = formatRp(priceOf('gofood'))
    const pGrabFood = formatRp(priceOf('grabfood'))
    const pShopeeFood = formatRp(priceOf('shopeefood'))
    const pTikTokGo = formatRp(priceOf('tiktokgo'))

    console.log(`| ${i++} | ${item.name} | ${pOffline} | ${pGoFood} | ${pGrabFood} | ${pShopeeFood} | ${pTikTokGo} |`)
  }
}
run()
