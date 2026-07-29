import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  console.time('fetch_orders');
  
  let fromIndex = 0;
  const step = 1000;
  const allOrders = [];
  while (true) {
    const { data, error } = await supabase.from('orders').select('id').not('external_order_id', 'is', null).eq('source', 'pos').range(fromIndex, fromIndex + step - 1);
    if (data) allOrders.push(...data);
    if (!data || data.length < step) break;
    fromIndex += step;
  }
  console.timeEnd('fetch_orders');
  console.log('total orders:', allOrders.length);
  
  console.time('fetch_items');
  const orderIds = allOrders.map(o => o.id);
  const allOrderItems = [];
  
  // Parallel fetch
  const chunks = [];
  for (let i = 0; i < orderIds.length; i += 500) {
      chunks.push(orderIds.slice(i, i + 500));
  }
  
  // batch promises 10 at a time
  for (let i = 0; i < chunks.length; i += 10) {
      const batch = chunks.slice(i, i + 10);
      const promises = batch.map(chunk => 
          supabase
              .from('order_items')
              .select('order_id, menu_item_id, quantity, subtotal, menu_items(hpp_override)')
              .in('order_id', chunk)
      );
      const results = await Promise.all(promises);
      results.forEach(r => {
          if (r.data) allOrderItems.push(...r.data);
      });
  }
  console.timeEnd('fetch_items');
  console.log('total items:', allOrderItems.length);
}
run();
