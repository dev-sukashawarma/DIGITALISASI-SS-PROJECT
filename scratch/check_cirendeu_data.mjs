import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: outlets, error: outletError } = await supabase
    .from('outlets')
    .select('id, name')
    .ilike('name', '%cirendeu%')
    
  if (outletError || !outlets || outlets.length === 0) {
    console.error("Error or no outlet found:", outletError)
    return
  }
  
  const outletId = outlets[0].id
  
  // 2. Check today's orders (August 5)
  const { data: todayOrders, error: orderError } = await supabase
    .from('orders')
    .select('id, created_at, status, total_amount, payment_method')
    .eq('outlet_id', outletId)
    .gte('created_at', '2026-08-04T17:00:00Z') // August 5 00:00 WIB
    .order('created_at', { ascending: false })
    
  if (orderError) {
    console.error("Error fetching today's orders:", orderError)
  } else {
    console.log(`Found ${todayOrders.length} orders for today:`)
    let total = 0
    todayOrders.forEach(o => { if (o.status === 'completed') total += o.total_amount })
    console.log("Total amount of completed orders today:", total)
  }
}

run()
