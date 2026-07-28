const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data: items } = await supabase
    .from('bahan_baku')
    .select('id, nama, kategori')
    .in('nama', ['CUP', 'TUTUP', 'SEDOTAN', 'STIKER', 'test', 'TEST', 'Test'])
    
  console.log('Found items:', items)
}

run()
