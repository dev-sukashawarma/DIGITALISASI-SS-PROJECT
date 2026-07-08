import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), 'apps/pos-kasir/.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data, error } = await supabase.from('outlet_promos').select('*').eq('outlet_id', '550e8400-e29b-41d4-a716-446655440001')
  console.log('Promos for Pusat:', JSON.stringify(data, null, 2))
  if (error) console.log('Error:', error)
}

check()
