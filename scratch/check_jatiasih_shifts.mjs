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
  
  console.log("Found outlets matching jatiasih:", outlets)
  const outletId = outlets[0].id
  
  // Let's check shifts for this outlet today
  const { data: shifts, error: shiftError } = await supabase
    .from('shifts')
    .select('*')
    .eq('outlet_id', outletId)
    .gte('started_at', '2026-08-04T17:00:00Z') // started today
    .order('started_at', { ascending: false })
    
  if (shiftError) {
    console.error("Error fetching shifts:", shiftError)
  } else {
    console.log("Shifts started today:")
    console.log(JSON.stringify(shifts, null, 2))
  }
  
  // Let's also check if there are any open shifts (regardless of when it started)
  const { data: openShifts, error: openShiftError } = await supabase
    .from('shifts')
    .select('*')
    .eq('outlet_id', outletId)
    .is('ended_at', null)
    
  if (openShiftError) {
    console.error("Error fetching open shifts:", openShiftError)
  } else {
    console.log("Currently OPEN shifts:")
    console.log(JSON.stringify(openShifts, null, 2))
  }
  
  // Also check orders again but for the last 24 hours just in case
  const { data: recentOrders, error: orderError } = await supabase
    .from('orders')
    .select('id, created_at, status, total_amount, payment_method')
    .eq('outlet_id', outletId)
    .gte('created_at', '2026-08-04T00:00:00Z') // since yesterday
    .order('created_at', { ascending: false })
    .limit(10)
    
  if (orderError) {
    console.error("Error fetching recent orders:", orderError)
  } else {
    console.log("Recent 10 orders since yesterday (UTC):")
    console.log(JSON.stringify(recentOrders, null, 2))
  }
}

run()
