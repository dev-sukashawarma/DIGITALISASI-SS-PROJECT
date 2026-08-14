// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Use ANON key instead of SERVICE ROLE key
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('sales_channels')
    .select('id, name');
    
  console.log("Anon query result:");
  console.log("Error:", error);
  console.log("Data:", data);
}
run();
