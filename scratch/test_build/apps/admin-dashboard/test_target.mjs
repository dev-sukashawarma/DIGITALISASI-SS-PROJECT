import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('set_daily_target', {
    p_outlet: null,
    p_amount: 5000000,
    p_per_item_bonus: 0
  });
  console.log("Result:", data, error);
}
run();
