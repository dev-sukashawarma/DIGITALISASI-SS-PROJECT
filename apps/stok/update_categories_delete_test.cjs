const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  // Update categories
  const { data: updateData, error: updateError } = await supabase
    .from('bahan_baku')
    .update({ kategori: 'minuman' })
    .in('nama', ['CUP', 'TUTUP', 'SEDOTAN', 'STIKER'])
    .select()

  if (updateError) {
    console.error('Error updating categories:', updateError)
  } else {
    console.log(`Updated ${updateData.length} items to 'minuman' category.`)
  }

  // Delete 'test'
  const { data: deleteData, error: deleteError } = await supabase
    .from('bahan_baku')
    .delete()
    .eq('nama', 'test')
    .select()

  if (deleteError) {
    console.error('Error deleting test item:', deleteError)
  } else {
    console.log(`Deleted ${deleteData.length} test item(s).`)
  }
}

run()
