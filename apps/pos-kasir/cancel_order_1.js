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
      cancellation_status: 'approved' 
    })
    .eq('id', '28e15c00-5458-42a8-8923-123bd4a4a7f4')
    .select();

  if (error) {
    console.error("Error updating order:", error);
  } else {
    console.log("Successfully cancelled order:", data);
  }
}

run();
