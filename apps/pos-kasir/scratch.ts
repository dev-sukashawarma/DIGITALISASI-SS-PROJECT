import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! 

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data: outlets, error } = await supabase.from('outlets').select('id, name')
  if (error) console.error(error)
  else console.log("OUTLETS:", JSON.stringify(outlets, null, 2))
}

check()
