const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data: tutupBahan } = await supabase
    .from('bahan_baku')
    .select('*')
    .eq('nama', 'TUTUP')
    .single()
    
  if (!tutupBahan) {
    console.log('TUTUP not found in bahan_baku')
    return
  }

  const { data: balances } = await supabase
    .from('stok_balance')
    .select('*')
    .eq('bahan_baku_id', tutupBahan.id)
    
  console.log(`Found ${balances?.length || 0} stok_balance records for TUTUP`)
  
  if (balances && balances.length === 0) {
    // Let's get all active outlets
    const { data: outlets } = await supabase.from('outlets').select('id').eq('is_active', true)
    
    if (outlets) {
      console.log(`Inserting 0 balance for ${outlets.length} outlets...`)
      const inserts = outlets.map(o => ({
        outlet_id: o.id,
        bahan_baku_id: tutupBahan.id,
        saldo: 0
      }))
      
      const { error: insertError } = await supabase.from('stok_balance').insert(inserts)
      if (insertError) {
        console.error('Error inserting balances:', insertError)
      } else {
        console.log('Successfully initialized stok_balance for TUTUP')
      }
    }
  }
}

run()
