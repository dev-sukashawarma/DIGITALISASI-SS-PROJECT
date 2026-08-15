const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deleteOutletTes2() {
  const { data: outlets, error: outletError } = await supabase
    .from('outlets')
    .select('id, name')
    .eq('name', 'tes2');
    
  if (outletError || outlets.length === 0) {
    console.error('Error finding outlet tes2 or not found:', outletError);
    return;
  }
  
  const outletId = outlets[0].id;
  console.log('Found tes2 outlet with ID:', outletId);

  // 1. Delete orders and order_items
  const { data: orders } = await supabase.from('orders').select('id').eq('outlet_id', outletId);
  const orderIds = orders?.map(o => o.id) || [];
  
  if (orderIds.length > 0) {
    console.log(`Deleting ${orderIds.length} orders and their items...`);
    await supabase.from('order_items').delete().in('order_id', orderIds);
    await supabase.from('orders').delete().in('id', orderIds);
  } else {
    console.log('No orders to delete.');
  }

  // 2. Delete shifts
  console.log('Deleting shifts...');
  const { error: shiftError } = await supabase.from('shifts').delete().eq('outlet_id', outletId);
  if (shiftError) console.log('Error deleting shifts:', shiftError.message);

  // 3. Delete petty cash
  console.log('Deleting petty_cash...');
  const { error: pettyError } = await supabase.from('petty_cash').delete().eq('outlet_id', outletId);
  if (pettyError) console.log('Error deleting petty_cash:', pettyError.message);

  // 4. Delete staff_outlets mapping
  console.log('Deleting staff_outlets...');
  const { error: mappingError } = await supabase.from('staff_outlets').delete().eq('outlet_id', outletId);
  if (mappingError) console.log('Error deleting staff_outlets:', mappingError.message);

  // 5. Delete area_manager_outlets mapping
  console.log('Deleting area_manager_outlets...');
  const { error: amMappingError } = await supabase.from('area_manager_outlets').delete().eq('outlet_id', outletId);
  if (amMappingError) console.log('Error deleting area_manager_outlets:', amMappingError.message);

  // 6. Delete outlet
  console.log('Deleting outlet tes2...');
  const { error: finalError } = await supabase.from('outlets').delete().eq('id', outletId);
  if (finalError) {
    console.error('Error deleting outlet:', finalError.message);
  } else {
    console.log('Successfully deleted outlet tes2!');
  }
}

deleteOutletTes2().catch(console.error);
