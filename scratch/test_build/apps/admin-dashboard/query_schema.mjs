import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql: `
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('orders', 'order_items', 'outlets', 'sales_channels', 'menus') 
      AND table_schema = 'public';
    ` 
  });
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}
run();
