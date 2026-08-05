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
    .select(`
      *,
      outlets!petty_cash_topups_outlet_id_fkey(name)
    `)
    .gte('created_at', '2026-08-04T00:00:00.000Z')
    .order('created_at', { ascending: false })

  if (error) {
    console.error("Error:", error)
  } else {
    // Filter for Kalisari
    const kalisari = data.filter(r => r.outlets?.name?.toLowerCase().includes('kalisari'))
    console.log(JSON.stringify(kalisari, null, 2))
  }
}

run()
