require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const bnrId = '550e8400-e29b-41d4-a716-446655440001';
  
  const { data: orders } = await supabase
    .from('orders')
    .select('id, created_at, status')
    .eq('outlet_id', bnrId)
    .is('external_order_id', null);

  let morning = 0;
  let nonMorning = 0;
  for (const o of orders) {
    const date = new Date(o.created_at);
    const jktHour = parseInt(date.toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }), 10);
    if (jktHour < 12) morning++;
    else nonMorning++;
  }
  
  console.log(`BNR Total Local Orders: ${orders.length}`);
  console.log(`BNR Morning Orders (<12:00): ${morning}`);
  console.log(`BNR Non-Morning Orders (>=12:00): ${nonMorning}`);
}

main();
