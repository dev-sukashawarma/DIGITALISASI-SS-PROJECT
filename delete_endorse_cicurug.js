const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const orderId = '025caf70-73b2-43f5-ad9d-edf25f54eecb';
  console.log('Deleting order:', orderId);
  const { data, error } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId)
    .select();
    
  if (error) {
    console.error('Delete Error:', error);
  } else {
    console.log('Successfully deleted:', data);
  }
}
main();
