import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const outletId = '550e8400-e29b-41d4-a716-446655440003';
  
  const { data, error } = await supabase.from('petty_cash_topups').insert([{
    outlet_id: outletId,
    amount: 300000,
    status: 'completed',
    description: 'System injection petty cash 300k',
    created_at: new Date().toISOString(),
    created_by: '0402a5b0-0b01-4d05-8653-02814bab4285' // owner/admin user id
  }]).select();

  console.log("Injected topup:", data, error);
}
run();
