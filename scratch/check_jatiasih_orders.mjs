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
    .ilike('name', '%jatiasih%')
    
  if (outletError || !outlets || outlets.length === 0) {
    console.error("Error or no outlet found:", outletError)
    return
  }
  
  const outletId = outlets[0].id
  console.log("Found outlet:", outlets[0].name)
  
  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select(`
      id,
      created_at,
      status,
      total_amount,
      customer_name,
      payment_method,
      order_items (
        id,
        quantity,
        menu:menu_items(name)
      )
    `)
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false })
    .limit(5)
    
  if (orderError) {
    console.error("Error fetching orders:", orderError)
  } else {
    console.log(`Found ${orders.length} latest orders:`)
    console.log(JSON.stringify(orders, null, 2))
  }
}

run()
