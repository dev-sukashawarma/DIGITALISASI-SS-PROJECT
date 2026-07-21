require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('orders')
    .update({ 
      status: 'cancelled',
      cancellation_status: 'approved',
      cancellation_reason: 'Dibatalkan oleh user',
      void_reason: 'Dibatalkan oleh user',
      void_at: new Date().toISOString()
    })
    .eq('id', '619f5dc0-8224-44e4-90db-96cb56cc7e9b')
    .select();

  if (error) {
    console.error("Error updating order:", error);
  } else {
    console.log("Successfully cancelled order:", data);
  }
}

run();
