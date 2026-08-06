import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function fetchTodayOrders(outletId) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  console.log(`Executing fetchTodayOrders for ${outletId}`)
  console.log(`today local: ${today.toString()}`)
  console.log(`today ISO: ${today.toISOString()}`)
  
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, created_at, status, total_amount, source
    `)
    .eq('outlet_id', outletId)
    .or(`created_at.gte.${today.toISOString()},status.in.(pending,preparing)`)
    .order('created_at', { ascending: false })
    
  if (error) {
    console.error("Error:", error)
    return
  }
  
  console.log(`Fetched ${data.length} orders`)
  let completed = data.filter(o => o.status === 'completed')
  let revenue = completed.reduce((sum, o) => sum + o.total_amount, 0)
  console.log(`Completed: ${completed.length}`)
  console.log(`Revenue: ${revenue}`)
  
  // also check offline revenue
  let offlineCompleted = completed.filter(o => o.source !== 'online')
  let offlineRevenue = offlineCompleted.reduce((sum, o) => sum + o.total_amount, 0)
  console.log(`Offline Revenue: ${offlineRevenue}`)
}

async function run() {
  const { data: outlets } = await supabase.from('outlets').select('id, name')
  const cirendeu = outlets.find(o => o.name.toLowerCase().includes('cirendeu'))
  
  await fetchTodayOrders(cirendeu.id)
}

run()
