import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseService = createClient(supabaseUrl, supabaseKey)

async function getOutlets() {
  const { data: outlets } = await supabaseService.from('outlets').select('id, name')
  console.log("POS-KASIR Outlets:")
  console.log(JSON.stringify(outlets, null, 2))
}

getOutlets()
