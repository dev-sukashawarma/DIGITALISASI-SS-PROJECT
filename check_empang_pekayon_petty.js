import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: 'apps/finance/.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase
    .from('petty_cash_topups')
    .select(`
      *,
      outlets!petty_cash_topups_outlet_id_fkey(name)
    `)
    .gte('created_at', '2026-08-04T17:00:00.000Z')
    .order('created_at', { ascending: false })

  if (error) {
    console.error("Error:", error)
  } else {
    const targets = data.filter(r => r.outlets?.name?.toLowerCase().includes('empang') || r.outlets?.name?.toLowerCase().includes('pekayon'))
    console.log(JSON.stringify(targets, null, 2))
  }
}
run()
