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
  const jatiasih = outlets.find(o => o.name.toLowerCase().includes('jatiasih'))
  
  const { data: orders } = await supabase
    .from('orders')
    .select('id, created_at, status, total_amount, source, payment_method')
    .eq('outlet_id', jatiasih.id)
    .eq('status', 'completed')
    .gte('created_at', '2026-08-04T05:58:08+00:00') // Shift start time
    
  let offTotal = 0
  let offCount = 0
  let onTotal = 0
  let onCount = 0
  for (const o of orders) {
    if (o.source !== 'online') {
      offTotal += o.total_amount
      offCount++
    } else {
      onTotal += o.total_amount
      onCount++
    }
  }
  
  console.log(`Jatiasih since shift start (Aug 4 12:58 WIB):`)
  console.log(`Offline: ${offTotal} (${offCount} orders)`)
  console.log(`Online: ${onTotal} (${onCount} orders)`)
  console.log(`Total: ${offTotal + onTotal}`)
}

run()
