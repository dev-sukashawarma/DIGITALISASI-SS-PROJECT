// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('sales_channels')
    .select('id, name, color')
    .eq('is_active', true)
    .order('name');
    
  console.log("Query sales_channels with color:");
  console.log("Error:", error);
  console.log("Data:", data);
}
run();
