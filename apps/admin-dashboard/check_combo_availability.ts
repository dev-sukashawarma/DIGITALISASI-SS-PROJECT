import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('menu_items')
    .select('id, name, is_available, is_available_online, available_online_channels')
    .ilike('name', '%Combo%')
    .limit(5);
    
  console.log("Error:", error);
  console.log("Combo items:", JSON.stringify(data, null, 2));
}
run();
