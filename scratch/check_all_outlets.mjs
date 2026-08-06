import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, outlet_id, created_at, status, total_amount, source')
    .eq('status', 'completed')
    .gte('created_at', '2026-08-04T00:00:00Z') // Since yesterday
    .order('created_at', { ascending: false })
    
  if (error) {
    console.error("Error fetching orders:", error)
    return
  }
  
  // Group by outlet and by day
  const byOutletDay = {}
  orders.forEach(o => {
    const d = new Date(o.created_at)
    d.setHours(d.getHours() + 7) // WIB
    const dateStr = d.toISOString().split('T')[0]
    
    if (!byOutletDay[o.outlet_id]) byOutletDay[o.outlet_id] = {}
    if (!byOutletDay[o.outlet_id][dateStr]) byOutletDay[o.outlet_id][dateStr] = { total: 0, offline: 0, online: 0 }
    
    byOutletDay[o.outlet_id][dateStr].total += o.total_amount
    if (o.source === 'online') {
      byOutletDay[o.outlet_id][dateStr].online += o.total_amount
    } else {
      byOutletDay[o.outlet_id][dateStr].offline += o.total_amount
    }
  })
  
  console.log("Daily totals for all outlets (WIB):")
  for (const outlet in byOutletDay) {
    for (const date in byOutletDay[outlet]) {
      const data = byOutletDay[outlet][date]
      if (data.total === 1192727 || data.offline === 1192727 || data.online === 1192727) {
        console.log(`BINGO! Outlet ${outlet} on ${date}: Total=${data.total}, Offline=${data.offline}, Online=${data.online}`)
      }
    }
  }
  console.log("Finished checking exact matches.")
  
  // Let's also just print out all August 5 totals to see what's happening
  console.log("August 5 totals:")
  for (const outlet in byOutletDay) {
    if (byOutletDay[outlet]['2026-08-05']) {
      console.log(`Outlet ${outlet}:`, byOutletDay[outlet]['2026-08-05'])
    }
  }
}

run()
