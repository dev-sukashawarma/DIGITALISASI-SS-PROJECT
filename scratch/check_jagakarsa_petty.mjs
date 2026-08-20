import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: outlets } = await supabase
    .from('outlets')
    .select('*')
    .ilike('name', '%jagakarsa%')
    
  if (!outlets || outlets.length === 0) return
  
  const outlet = outlets[0]
  console.log("Outlet:", outlet.name)

  const { data: topups } = await supabase
    .from('petty_cash_topups')
    .select('id, amount, status, created_at, description, outlet_staff!petty_cash_topups_created_by_fkey(name)')
    .eq('outlet_id', outlet.id)
    .order('created_at', { ascending: false })
    .limit(5)
    
  console.log("\n--- Recent Topups ---")
  console.log(topups)
  
  const { data: expenses } = await supabase
    .from('petty_cash_expenses')
    .select('id, amount, category, description, created_at, outlet_staff!petty_cash_expenses_created_by_fkey(name)')
    .eq('outlet_id', outlet.id)
    .order('created_at', { ascending: false })
    .limit(5)
    
  console.log("\n--- Recent Expenses ---")
  console.log(expenses)
  
  const { data: daily } = await supabase
    .from('daily_sales_reports')
    .select('id, total_revenue, petty_cash_balance, shift, created_at')
    .eq('outlet_id', outlet.id)
    .order('created_at', { ascending: false })
    .limit(5)

  console.log("\n--- Recent Daily Reports ---")
  console.log(daily)
}

run()
