const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data: testItem } = await supabase
    .from('bahan_baku')
    .select('id')
    .eq('nama', 'test')
    .single()

  if (!testItem) {
    console.log('test item not found')
    return
  }

  console.log('Found test item:', testItem.id)

  // Delete from dependent tables first
  const tables = ['stok_balance', 'opname_item', 'waste', 'ledger', 'delivery_item', 'transfer_item']
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq('bahan_baku_id', testItem.id)
    if (error) {
      console.log(`Skipped or error in ${table}:`, error.message)
    } else {
      console.log(`Deleted from ${table}`)
    }
  }

  // Delete the item itself
  const { data: deleteData, error: deleteError } = await supabase
    .from('bahan_baku')
    .delete()
    .eq('id', testItem.id)
    .select()

  if (deleteError) {
    console.error('Error deleting test item:', deleteError)
  } else {
    console.log(`Successfully deleted test item.`)
  }
}

run()
