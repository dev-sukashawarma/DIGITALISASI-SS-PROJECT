import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: order, error: orderError } = await supabase
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
    .eq('id', '21c30f9e-1a19-4466-a023-81ec92065b2a')
    
  if (orderError) {
    console.error("Error fetching order:", orderError)
  } else {
    console.log("Order details:")
    console.log(JSON.stringify(order, null, 2))
  }
}

run()
