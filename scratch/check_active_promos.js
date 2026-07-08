const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: 'c:\\Users\\Digital Marketing\\OneDrive\\Desktop\\project\\DIGITALISASI-SS-PROJECT\\apps\\pos-kasir\\.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function run() {
  const { data, error } = await supabase
    .from('outlet_promos')
    .select('*')
    .eq('scope', 'global')
    .eq('is_active', true)
    
  console.log("Global Promos Active:", JSON.stringify(data, null, 2))
}

run()
