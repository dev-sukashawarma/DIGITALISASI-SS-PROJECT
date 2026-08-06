const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function run() {
  const { data, error } = await admin.rpc('run_sql', {
    sql_query: `
      SELECT pg_get_functiondef(oid) 
      FROM pg_proc 
      WHERE proname = 'finance_process_petty_cash_custom';
    `
  });
  
  if (error) {
    // If run_sql doesn't exist, we can't do it via RPC. We need a direct pg connection.
    console.error('Error with run_sql:', error);
  } else {
    console.log(data);
  }
}
run();
