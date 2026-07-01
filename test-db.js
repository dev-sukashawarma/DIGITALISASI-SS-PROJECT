const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://khpkoreaaucvyqfhynfq.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8');

async function run() {
  const { data: attendance } = await supabase.from('attendance')
    .select('id, created_at, ts_client, gps_lat, gps_lng, distance_m, status')
    .neq('status', 'alpha') // Abaikan cron job
    .order('created_at', { ascending: false })
    .limit(10);
  console.log("\nATTENDANCE LOGS (REAL):");
  console.log(attendance);
}
run();
