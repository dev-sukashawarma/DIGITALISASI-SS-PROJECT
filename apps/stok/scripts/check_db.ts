import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function run() {
  const { data, error } = await supabase
    .from('monitoring_view_spv')
    .select('*')
    .eq('status', 'below');
    
  if (error) {
    console.error('Error fetching data:', error);
  } else {
    console.log(`Found ${data?.length} rows with status = 'below'`);
    if (data && data.length > 0) {
      console.log('Sample:', data[0]);
    }
  }
}

run();
