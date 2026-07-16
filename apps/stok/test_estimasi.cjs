require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function test() {
  const outletId = 'f76dcb8c-c6f3-4246-86db-38fc718227b6'; // Or query it

  const { data: resepData, error: resepError } = await supabase
    .from('resep')
    .select(`
      id, 
      nama, 
      resep_item (
        id, 
        bahan_baku_id, 
        qty_per_porsi, 
        satuan,
        bahan_baku (
          id, 
          nama, 
          satuan, 
          satuan_kecil, 
          faktor_konversi
        )
      )
    `)
    .eq('is_active', true)
    .limit(5)
    
  console.log(JSON.stringify(resepData, null, 2))
}

test().catch(console.error)
