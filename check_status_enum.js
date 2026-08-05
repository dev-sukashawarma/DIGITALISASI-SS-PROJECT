import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: 'apps/finance/.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase.rpc('get_enum_values', { enum_name: 'petty_cash_topup_status' })
  console.log("Enum values via RPC (if exists):", data, error)
  
  // Or just query information_schema
  const query = `
    SELECT enumlabel 
    FROM pg_enum 
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
    WHERE pg_type.typname = 'petty_cash_topup_status';
  `
  // since we can't run raw SQL easily via postgrest, let's just query a unique set of statuses
  const { data: statuses, error: e2 } = await supabase
    .from('petty_cash_topups')
    .select('status')
    
  if (statuses) {
    const unique = [...new Set(statuses.map(s => s.status))]
    console.log("Existing statuses:", unique)
  }
}
run()
