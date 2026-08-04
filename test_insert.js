require('dotenv').config({ path: 'apps/pos-kasir/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // Create a dummy order
  const { data, error } = await supabase
    .from('orders')
    .insert({
      outlet_id: '550e8400-e29b-41d4-a716-446655440011',
      customer_name: 'TEST_INSERT_UPDATED_AT',
      total_amount: 1000,
      payment_method: 'cash',
      status: 'completed',
      created_at: pastDate,
      updated_at: pastDate // we try to override updated_at
    })
    .select('id, created_at, updated_at')
    .single();

  if (error) {
    console.error('Error inserting:', error);
    return;
  }
  console.log('Inserted:', data);

  // clean up
  await supabase.from('orders').delete().eq('id', data.id);
  console.log('Cleaned up');
}

run();
