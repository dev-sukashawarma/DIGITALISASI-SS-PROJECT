import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: outlets } = await supabase.from('outlets').select('id, name')
  const cirendeu = outlets.find(o => o.name.toLowerCase().includes('cirendeu'))
  const jatiasih = outlets.find(o => o.name.toLowerCase().includes('jatiasih'))
  
  const { data: shifts } = await supabase
    .from('shifts')
    .select('*')
    .in('outlet_id', [cirendeu.id, jatiasih.id])
    .eq('status', 'open')
    
  console.log("Open shifts for Cirendeu and Jatiasih:")
  console.log(shifts)
}

run()
