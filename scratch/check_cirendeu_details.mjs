import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: outlets } = await supabase.from('outlets').select('id, name').ilike('name', '%cirendeu%')
  const outletId = outlets[0].id
  
  const { data: orders } = await supabase
    .from('orders')
    .select('id, created_at, status, total_amount, source, payment_method')
    .eq('outlet_id', outletId)
    .eq('status', 'completed')
    .gte('created_at', '2026-08-03T17:00:00Z')
    .lt('created_at', '2026-08-04T17:00:00Z')
    
  let off = 0
  let on = 0
  for (const o of orders) {
    if (o.source !== 'online') {
      off += o.total_amount
    } else {
      on += o.total_amount
    }
  }
  
  console.log(`Cirendeu Aug 4: Offline = ${off}, Online = ${on}, Total = ${off + on}`)
  
  // Is it possible the tablet filters by payment_method?
  // Is it possible some orders are NOT offline, but "dine-in" / "takeaway"?
  // source is 'online', 'dine-in', 'takeaway' etc?
  
  // Group by source:
  const bySource = {}
  orders.forEach(o => {
    bySource[o.source] = (bySource[o.source] || 0) + o.total_amount
  })
  console.log("By source:", bySource)
  
  // Group by payment_method:
  const byPayment = {}
  orders.forEach(o => {
    byPayment[o.payment_method] = (byPayment[o.payment_method] || 0) + o.total_amount
  })
  console.log("By payment:", byPayment)
}

run()
