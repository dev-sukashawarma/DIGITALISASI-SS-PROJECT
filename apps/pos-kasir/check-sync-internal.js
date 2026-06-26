
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const posDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const external_order_id = '75b485f0-a27c-4883-9663-6a3dc24049a7'; // #140

  const { data: order, error: findError } = await posDb
    .from('orders')
    .select('id, status')
    .eq('external_order_id', external_order_id)
    .eq('source', 'online')
    .maybeSingle();

  console.log('order:', order);
  console.log('findError:', findError);

  if (order) {
    const { error: updateError } = await posDb
      .from('orders')
      .update({ status: 'completed' })
      .eq('id', order.id);
    
    console.log('updateError:', updateError);
  }
}

run();
