import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase
    .from('petty_cash_topups')
    .select('status')
    
  if (error) {
    console.error("Error:", error)
  } else {
    const statuses = [...new Set(data.map(d => d.status))]
    console.log("Available statuses:", statuses)
  }
}

run()
