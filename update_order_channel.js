require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const orderId = '1446b15b-34bc-4e2f-9231-a548337aa16b';
  
  const { data, error } = await supabase
    .from('orders')
    .update({ 
      channel: 'gofood',
      sales_source: 'gofood' 
    })
    .eq('id', orderId)
    .select();
    
  if (error) {
    console.error('Error updating order:', error);
  } else {
    console.log('Successfully updated order:', data);
  }
}
run();
