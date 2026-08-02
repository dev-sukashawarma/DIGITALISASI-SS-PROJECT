const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function run() {
  const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';

  const { data: shift } = await admin
    .from('shifts')
    .select('*')
    .eq('outlet_id', cicurugId)
    .order('start_time', { ascending: false })
    .limit(1)
    .maybeSingle();
    
  console.log("Latest Shift:", shift);
  
  const { data: topups } = await admin
    .from('petty_cash_topups')
    .select('*')
    .eq('outlet_id', cicurugId)
    .order('created_at', { ascending: false })
    .limit(2);
    
  console.log("Latest Topups:", topups);
}
run();
