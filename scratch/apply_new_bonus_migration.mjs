import dotenv from 'dotenv';
dotenv.config({ path: 'apps/admin-dashboard/.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: 'apps/admin-dashboard/.env' });
}
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  const sqlPath = 'supabase/migrations/20260826153000_new_pcs_based_bonus_system.sql';
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log('Applying migration:', sqlPath);
  
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error('Error applying migration:', error.message);
    process.exit(1);
  } else {
    console.log('Migration applied successfully!');
  }
}

run();
