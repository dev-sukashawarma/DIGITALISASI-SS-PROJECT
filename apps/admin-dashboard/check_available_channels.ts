import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data } = await supabase
    .from('menu_items')
    .select('name, is_available_online, available_online_channels, channel_prices')
    .order('name');
    
  console.log("Checking available_online_channels...");
  for (const m of data) {
    if (m.name.includes("Original Sapi") || m.name.includes("Original Mix")) {
      console.log(`${m.name} -> is_online: ${m.is_available_online}, available_channels:`, m.available_online_channels, ' prices:', Object.keys(m.channel_prices||{}));
    }
  }
}
run();
