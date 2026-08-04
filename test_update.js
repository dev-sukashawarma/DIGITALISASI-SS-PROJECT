require('dotenv').config({ path: 'apps/pos-kasir/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('orders')
    .insert({
      outlet_id: '550e8400-e29b-41d4-a716-446655440011',
      customer_name: 'TEST_INSERT_UPDATED_AT',
      total_amount: 1000,
      payment_method: 'cash',
      status: 'pending',
      created_at: pastDate,
      updated_at: pastDate
    })
    .select('id, created_at, updated_at')
    .single();

  if (error) { console.error(error); return; }
  console.log('Inserted:', data.updated_at);

  const { data: updateData, error: updateError } = await supabase
    .from('orders')
    .update({ status: 'completed' })
    .eq('id', data.id)
    .select('updated_at')
    .single();

  if (updateError) { console.error(updateError); return; }
  console.log('Updated:', updateData.updated_at);

  await supabase.from('orders').delete().eq('id', data.id);
}
run();
