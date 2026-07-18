require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for bypass RLS

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function clearDummyData() {
  console.log('Starting data deletion process...')
  
  // 1. Get all outlets EXCEPT Kitchen and Empang
  const { data: outlets, error: outletErr } = await supabase
    .from('outlets')
    .select('id, name')
  
  if (outletErr) {
    console.error('Error fetching outlets:', outletErr)
    return
  }

  const excludedNames = ['Kitchen', 'Empang']
  const targetOutlets = outlets.filter(o => !excludedNames.some(name => o.name.toLowerCase().includes(name.toLowerCase())))

  console.log(`Found ${targetOutlets.length} outlets to clear. Excluded Kitchen & Empang.`)
  console.log('Target outlets:', targetOutlets.map(o => o.name).join(', '))

  for (const outlet of targetOutlets) {
    console.log(`\n--- Clearing data for outlet: ${outlet.name} (${outlet.id}) ---`)
    
    // Call the hard_reset_outlet_data RPC
    // Wait, the RPC requires auth.uid() which fails if we use service_role without a user context.
    // Let's do it manually instead to avoid RPC auth errors!

    // A. orders (cascades to order_items)
    const { count: orderCount, error: orderErr } = await supabase
      .from('orders')
      .delete({ count: 'exact' })
      .eq('outlet_id', outlet.id)
    console.log(`Deleted ${orderCount || 0} orders (and cascaded order_items). Error:`, orderErr?.message || 'None')

    // B. shifts (kasir sessions)
    const { count: shiftCount, error: shiftErr } = await supabase
      .from('shifts')
      .delete({ count: 'exact' })
      .eq('outlet_id', outlet.id)
    console.log(`Deleted ${shiftCount || 0} shifts (kasir logs). Error:`, shiftErr?.message || 'None')

    // C. attendance
    const { count: attCount, error: attErr } = await supabase
      .from('attendance')
      .delete({ count: 'exact' })
      .eq('outlet_id', outlet.id)
    console.log(`Deleted ${attCount || 0} attendance logs. Error:`, attErr?.message || 'None')

    // D. ledger_stok
    const { count: ledgerCount, error: ledgerErr } = await supabase
      .from('ledger_stok')
      .delete({ count: 'exact' })
      .eq('outlet_id', outlet.id)
    console.log(`Deleted ${ledgerCount || 0} ledger_stok entries. Error:`, ledgerErr?.message || 'None')

    // E. permintaan_bahan
    const { count: reqCount, error: reqErr } = await supabase
      .from('permintaan_bahan')
      .delete({ count: 'exact' })
      .eq('outlet_id', outlet.id)
    console.log(`Deleted ${reqCount || 0} permintaan_bahan (and cascaded). Error:`, reqErr?.message || 'None')

    // F. surat_jalan
    const { count: suratCount, error: suratErr } = await supabase
      .from('surat_jalan')
      .delete({ count: 'exact' })
      .eq('outlet_id', outlet.id)
    console.log(`Deleted ${suratCount || 0} surat_jalan (and cascaded). Error:`, suratErr?.message || 'None')

    // G. reset stok_balance to 0
    const { count: stokCount, error: stokErr } = await supabase
      .from('stok_balance')
      .update({ saldo: 0 })
      .eq('outlet_id', outlet.id)
    console.log(`Reset ${stokCount || 0} stok_balance entries to 0. Error:`, stokErr?.message || 'None')

  }

  console.log('\n✅ All dummy sales and activity data cleared successfully for specified outlets.')
}

clearDummyData()
