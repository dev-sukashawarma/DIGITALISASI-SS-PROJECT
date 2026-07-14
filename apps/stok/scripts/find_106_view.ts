import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function run() {
  const { data, error } = await supabase
    .from('monitoring_view_crew')
    .select('outlet_id, outlet_name, item_name, current_qty, threshold, status')
    .gte('current_qty', 106)
    .lt('current_qty', 107);
    
  if (error) {
    console.error('Error fetching data:', error);
  } else {
    console.log('Found rows near 106 in VIEW:', data);
  }
}

run();
