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
  
  // Calculate total for August 4th (from 2026-08-03T17:00:00Z to 2026-08-04T17:00:00Z)
  const { data: aug4Orders, error: aug4Error } = await supabase
    .from('orders')
    .select('id, created_at, status, total_amount')
    .eq('outlet_id', outletId)
    .gte('created_at', '2026-08-03T17:00:00Z')
    .lt('created_at', '2026-08-04T17:00:00Z')
    .eq('status', 'completed')
    
  if (aug4Error) {
    console.error("Error fetching Aug 4 orders:", aug4Error)
  } else {
    const total = aug4Orders.reduce((sum, o) => sum + o.total_amount, 0)
    console.log(`Total amount of completed orders on Aug 4th: ${total}`)
    console.log(`Number of orders: ${aug4Orders.length}`)
  }
}

run()
