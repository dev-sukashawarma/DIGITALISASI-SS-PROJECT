import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function run() {
  const { data, error } = await supabase
    .from('monitoring_view_crew')
    .select('current_qty')
    .order('current_qty', { ascending: false })
    .limit(5);
    
  if (error) {
    console.error('Error fetching data:', error);
  } else {
    console.log('Top quantities in DB:', data);
  }
}

run();
