import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Looking for orders with cancellation_status = 'pending_approval'");
  
  // First, find them
  const { data: toDelete, error: findErr } = await supabase
    .from('orders')
    .select('id')
    .eq('cancellation_status', 'pending_approval');
    
  if (findErr) {
    console.error("Error finding orders:", findErr);
    return;
  }
  
  console.log(`Found ${toDelete.length} orders to delete.`);
  
  if (toDelete.length > 0) {
    const { data, error } = await supabase
      .from('orders')
      .delete()
      .eq('cancellation_status', 'pending_approval')
      .select('id');

    if (error) {
      console.error("Error deleting orders:", error);
    } else {
      console.log("Deleted orders:", data.length);
    }
  }
}
run();
