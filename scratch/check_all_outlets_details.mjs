import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: outlets } = await supabase.from('outlets').select('id, name')
  const { data: orders } = await supabase
    .from('orders')
    .select('id, outlet_id, created_at, status, total_amount, source')
    .eq('status', 'completed')
    .gte('created_at', '2026-08-03T17:00:00Z')
    .lt('created_at', '2026-08-05T17:00:00Z')
    
  const byOutletAndDate = {}
  orders.forEach(o => {
    const d = new Date(o.created_at)
    d.setHours(d.getHours() + 7)
    const dateStr = d.toISOString().split('T')[0]
    
    if (!byOutletAndDate[o.outlet_id]) byOutletAndDate[o.outlet_id] = {}
    if (!byOutletAndDate[o.outlet_id][dateStr]) byOutletAndDate[o.outlet_id][dateStr] = 0
    byOutletAndDate[o.outlet_id][dateStr] += o.total_amount
  })
  
  for (const outlet of outlets) {
    console.log(`Outlet: ${outlet.name} (ID: ${outlet.id})`)
    console.log(`  Aug 4: ${byOutletAndDate[outlet.id]?.[`2026-08-04`] || 0}`)
    console.log(`  Aug 5: ${byOutletAndDate[outlet.id]?.[`2026-08-05`] || 0}`)
  }
}

run()
