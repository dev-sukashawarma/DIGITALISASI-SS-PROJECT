const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function run() {
  const { data, error } = await admin.rpc('get_function_def', { func_name: 'open_shift' });
  if (error) {
    // If get_function_def doesn't exist, we query pg_proc directly
    const { data: procs, error: pgErr } = await admin.from('pg_proc').select('prosrc').eq('proname', 'open_shift');
    if (pgErr) {
       // Maybe we use SQL via a different way. Let's just fetch from views or just use the REST if we can.
       console.log("Could not fetch pg_proc:", pgErr);
    } else {
       console.log(procs);
    }
  } else {
    console.log(data);
  }
}
run();
