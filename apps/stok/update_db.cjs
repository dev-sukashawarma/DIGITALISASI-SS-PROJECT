const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  console.log('Connecting to Supabase...')
  
  // 1. Rename "CUP + TUTUP" to "CUP"
  const { data: updateData, error: updateError } = await supabase
    .from('bahan_baku')
    .update({ nama: 'CUP' })
    .eq('nama', 'CUP + TUTUP')
    .select()
    
  if (updateError) {
    console.error('Error renaming CUP + TUTUP:', updateError)
  } else {
    console.log('Renamed CUP + TUTUP to CUP:', updateData)
  }

  // 2. Check if "TUTUP" exists
  const { data: tutupData, error: tutupError } = await supabase
    .from('bahan_baku')
    .select('*')
    .eq('nama', 'TUTUP')
    
  if (tutupError) {
    console.error('Error checking for TUTUP:', tutupError)
  } else if (tutupData.length > 0) {
    console.log('TUTUP already exists.')
  } else {
    // 3. Insert "TUTUP"
    const { data: insertData, error: insertError } = await supabase
      .from('bahan_baku')
      .insert({
        nama: 'TUTUP',
        kategori: 'kemasan',
        satuan: 'pcs',
        satuan_kecil: 'Pcs',
        faktor_konversi: 1,
        is_active: true
      })
      .select()
      
    if (insertError) {
      console.error('Error inserting TUTUP:', insertError)
    } else {
      console.log('Inserted TUTUP:', insertData)
    }
  }
}

run()
