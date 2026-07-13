const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Get outlets named Kitchen or similar
  const { data: outlets, error: outletErr } = await supabase.from('outlets').select('*').ilike('name', '%kitchen%');
  if (outletErr) {
    console.error('Outlet error:', outletErr);
    return;
  }
  console.log('Kitchen Outlets:', outlets);

  if (outlets.length > 0) {
    const kitchenId = outlets[0].id;
    // Get stock balances for kitchen
    const { data: stocks, error: stockErr } = await supabase.from('stok_balance').select(`
      *,
      bahan_baku(nama, satuan)
    `).eq('outlet_id', kitchenId).limit(10);
    
    if (stockErr) {
        console.error('Stock error:', stockErr);
    } else {
        console.log(`Stock for Kitchen (${kitchenId}):`, stocks);
    }
  } else {
    // Just get all outlets
    const { data: allOutlets } = await supabase.from('outlets').select('*');
    console.log('All outlets:', allOutlets);
  }
}

main();
