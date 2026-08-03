import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('./.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: outlet, error: outletError } = await supabase
    .from('outlets')
    .select('id, name')
    .ilike('name', '%pajajaran%')
    .single();

  if (outletError) {
    console.error('Error finding outlet:', outletError);
    return;
  }
  
  console.log('Found outlet:', outlet.name, outlet.id);

  const startOfDay = new Date('2026-08-01T00:00:00+07:00').toISOString();
  const endOfDay = new Date('2026-08-01T23:59:59+07:00').toISOString();
  
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('outlet_id', outlet.id)
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay)
    .eq('order_number', 26);
    
  if (error) {
    console.error('Error querying orders:', error);
  } else {
    console.log(`Found ${orders.length} orders for #26.`);
    
    for (const order of orders) {
      console.log('\n================================');
      console.log('Order Details:', JSON.stringify(order, null, 2));
      
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          *,
          menu_items (name, price)
        `)
        .eq('order_id', order.id);
        
      if (!itemsError) {
        console.log('Order items:', JSON.stringify(items, null, 2));
      }
    }
  }
}

run();
