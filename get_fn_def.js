const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  // Query pg_proc via RPC if possible. We can just execute a raw query if we have pg_query or something.
  // Unfortunately, Supabase JS client doesn't support arbitrary SQL execution via service role key out of the box unless we have a specific RPC for it (like 'exec_sql' or 'run_sql').
  // Let's check if 'run_sql' exists.
  const { data, error } = await supabase.rpc('run_sql', { query: "SELECT pg_get_functiondef('public.accessible_outlet_ids'::regproc)" });
  
  if (error) {
    console.error('RPC run_sql error:', error.message);
  } else {
    console.log(data);
  }
}

main();
