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
    .select('id, created_at, status, total_amount, source')
    .eq('outlet_id', outletId)
    .eq('status', 'completed')
    
  const byDate = {}
  orders.forEach(o => {
    const d = new Date(o.created_at)
    d.setHours(d.getHours() + 7)
    const dateStr = d.toISOString().split('T')[0]
    
    if (!byDate[dateStr]) byDate[dateStr] = { offlineTotal: 0, offlineCount: 0 }
    if (o.source !== 'online') {
      byDate[dateStr].offlineTotal += o.total_amount
      byDate[dateStr].offlineCount++
    }
  })
  
  for (const date in byDate) {
    const data = byDate[date]
    if (data.offlineTotal === 1192727 || data.offlineCount === 27) {
      console.log(`BINGO! Cirendeu on ${date}: Offline Total=${data.offlineTotal}, Count=${data.offlineCount}`)
    }
  }
  console.log("Checked all history for Cirendeu.")
}

run()
