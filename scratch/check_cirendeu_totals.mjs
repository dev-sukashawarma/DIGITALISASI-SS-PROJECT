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
    .gte('created_at', '2026-08-03T17:00:00Z') // Aug 4 00:00 WIB
    .lt('created_at', '2026-08-04T17:00:00Z')  // Aug 5 00:00 WIB
    .order('created_at', { ascending: true }) // chronological
    
  let runningTotal = 0;
  let runningOffline = 0;
  let runningOnline = 0;
  
  let found = false;
  for (const o of orders) {
    runningTotal += o.total_amount
    if (o.source === 'online') {
      runningOnline += o.total_amount
    } else {
      runningOffline += o.total_amount
    }
    
    if (runningTotal === 1192727 || runningOffline === 1192727 || runningOnline === 1192727) {
      console.log(`BINGO! Reached 1192727 at ${o.created_at}. Total=${runningTotal}, Offline=${runningOffline}, Online=${runningOnline}`)
      found = true;
    }
  }
  
  if (!found) {
    console.log(`Did not hit exact number on Aug 4. Final Offline sum: ${runningOffline}`)
  }
}

run()
