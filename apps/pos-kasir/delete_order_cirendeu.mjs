import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('./.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const orderId = 'fd404f6b-27f3-40aa-af1c-162c29f2553f';

  console.log('Deleting items for order', orderId);
  const { error: errItems } = await supabase.from('order_items').delete().eq('order_id', orderId);
  if (errItems) console.error('Error deleting items:', errItems);

  console.log('Deleting order', orderId);
  const { error: errOrder } = await supabase.from('orders').delete().eq('id', orderId);
  if (errOrder) console.error('Error deleting order:', errOrder);
  else console.log('Successfully deleted order 3 in Cirendeu.');
}

run();
