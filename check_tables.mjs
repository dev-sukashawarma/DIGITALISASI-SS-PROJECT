import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  // Try to find tables related to cash or mutation
  const { data: tables, error } = await supabase.rpc('get_tables_info')
  if (error) {
     // fallback if rpc is not defined
     console.error("RPC failed, maybe not defined.", error)
  } else {
     console.log("Tables:", tables)
  }
}

run()
