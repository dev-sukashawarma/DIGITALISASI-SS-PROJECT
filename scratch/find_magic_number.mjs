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
    .gte('created_at', '2026-08-01T00:00:00Z') // Since start of August
    
  if (error) {
    console.error("Error fetching orders:", error)
    return
  }
  
  // Group by outlet and by day (WIB)
  const byOutletDay = {}
  orders.forEach(o => {
    const d = new Date(o.created_at)
    d.setHours(d.getHours() + 7) // WIB
    const dateStr = d.toISOString().split('T')[0]
    
    if (!byOutletDay[o.outlet_id]) byOutletDay[o.outlet_id] = {}
    if (!byOutletDay[o.outlet_id][dateStr]) byOutletDay[o.outlet_id][dateStr] = { 
      offlineTotal: 0, offlineCount: 0,
      onlineTotal: 0, onlineCount: 0,
      total: 0, count: 0
    }
    
    const stats = byOutletDay[o.outlet_id][dateStr]
    stats.total += o.total_amount
    stats.count++
    
    if (o.source === 'online') {
      stats.onlineTotal += o.total_amount
      stats.onlineCount++
    } else {
      stats.offlineTotal += o.total_amount
      stats.offlineCount++
    }
  })
  
  for (const outlet in byOutletDay) {
    for (const date in byOutletDay[outlet]) {
      const data = byOutletDay[outlet][date]
      if (data.offlineTotal === 1192727 || data.offlineCount === 27 || data.total === 1192727) {
        console.log(`Outlet ${outlet} on ${date}: Total=${data.total}(${data.count}), Offline=${data.offlineTotal}(${data.offlineCount}), Online=${data.onlineTotal}(${data.onlineCount})`)
      }
    }
  }
  
  console.log("Finished searching.")
}

run()
