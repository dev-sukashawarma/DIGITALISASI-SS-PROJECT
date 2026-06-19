require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { error } = await supabase.rpc('exec_sql', { sql: `
    ALTER TABLE outlets 
      ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'owned' CHECK (type IN ('owned', 'mitra')),
      ADD COLUMN IF NOT EXISTS open_hour TIME DEFAULT '09:00:00',
      ADD COLUMN IF NOT EXISTS close_hour TIME DEFAULT '22:00:00',
      ADD COLUMN IF NOT EXISTS inactive_reason TEXT;
  `});
  if (error) console.error('Error with RPC:', error.message);
  else console.log('Success via RPC');
}
run();
