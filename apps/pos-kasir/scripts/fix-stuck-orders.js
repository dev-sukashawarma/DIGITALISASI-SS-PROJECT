const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixOrders() {
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'preparing' })
    .eq('source', 'online')
    .eq('status', 'pending');

  if (error) {
    console.error('Error fixing orders:', error);
  } else {
    console.log('Fixed stuck online orders to preparing status.');
  }
}

fixOrders();
