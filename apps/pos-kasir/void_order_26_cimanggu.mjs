import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('./.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const orderId = 'ba11401f-c24e-471b-a674-618ef380d809';
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('orders')
    .update({
      status: 'cancelled',
      void_reason: 'salah input, void by admin',
      void_at: now,
      cancellation_status: 'approved',
      cancellation_reason: 'salah input, void by admin',
      updated_at: now
    })
    .eq('id', orderId)
    .select();

  if (error) {
    console.error('Error voiding order:', error);
  } else {
    console.log('Successfully voided order:', data);
  }
}

run();
