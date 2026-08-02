const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(url, serviceKey);

async function run() {
  const { data: locs, error: locErr } = await admin
    .from('cash_location')
    .select('*, outlets(name)');

  if (locErr) {
    console.error("Error cash_location:", locErr);
    return;
  }
  
  console.log("All Cash Locations:");
  locs.forEach(loc => {
    console.log(`- ${loc.name} (Type: ${loc.type}) [Outlet: ${loc.outlets?.name || 'none'}]`);
  });
}
run();
