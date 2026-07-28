const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data: updateData, error: updateError } = await supabase
    .from('bahan_baku')
    .update({ 
      faktor_tampilan: 25,
      satuan_tengah: 'Pcs',
      faktor_tengah: 25
    })
    .eq('nama', 'TUTUP')
    .select()
    
  if (updateError) {
    console.error('Error updating TUTUP factors:', updateError)
  } else {
    console.log('Updated TUTUP factors:', updateData)
  }
}

run()
