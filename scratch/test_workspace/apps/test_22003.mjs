import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const adminId = '6440a568-d9f3-45d3-b7d7-16e4b3166ab2';

  // Let's test calling set_daily_target with null and different amounts
  const res1 = await supabase.rpc('set_daily_target', {
    p_outlet: null,
    p_amount: 5000000000000,
    p_per_item_bonus: 0
  });
  console.log("Res1:", res1.error);

  const res2 = await supabase.rpc('set_daily_target', {
    p_outlet: null,
    p_amount: 5000000,
    p_per_item_bonus: 150000
  });
  console.log("Res2:", res2.error);

}
run();
