import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function test() {
  const { data, error } = await supabase
    .from('global_settings')
    .upsert([
      { key: 'brand_logo', value: null }
    ])
    .select()

  console.log('Upsert null:', data, error)
  
  const { data: get, error: err } = await supabase
    .from('global_settings')
    .select('*')
    
  console.log('Get:', get, err)
  if (get && get.length > 0) {
    console.log('Type of value:', typeof get[0].value)
  }
}
test()
