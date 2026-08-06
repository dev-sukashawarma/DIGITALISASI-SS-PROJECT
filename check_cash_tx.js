import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: 'apps/finance/.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: topups } = await supabase
    .from('petty_cash_topups')
    .select('*')
    .in('outlet_id', ['550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440018'])
    .gte('created_at', '2026-08-04T17:00:00.000Z')
    
  console.log("All topups for Empang and Pekayon today:", topups)
}
run()
