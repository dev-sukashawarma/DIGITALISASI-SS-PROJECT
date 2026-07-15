import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const { data, error } = await supabase.from('permintaan_bahan').select('*')
  console.log('Permintaan count:', data?.length)
  if (data?.length) {
     console.log(data[0])
     const staffIds = [...new Set(data.map(d => d.dibuat_oleh).filter(Boolean))]
     console.log('Unique created_by:', staffIds)
     if (staffIds.length > 0) {
        const { data: staff, error: staffErr } = await supabase.from('outlet_staff').select('*').in('id', staffIds)
        console.log('Staff info:', staff)
     }
  }
}

run()
