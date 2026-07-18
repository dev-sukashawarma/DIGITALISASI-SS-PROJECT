const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';
const supabase = createClient(url, key);

async function main() {
  const { data: outlet, error } = await supabase.from('outlets').select('*').eq('slug', 'tebet-mitra').single();
  if (error) {
    console.error('Error fetching outlet:', error);
    return;
  }
  console.log('Outlet:', outlet);

  const outletId = outlet.id;

  // Check relations
  const tables = ['staff', 'outlets_ledger', 'attendances', 'cash_advance', 'leaves', 'payroll_slips', 'pos_orders'];
  
  for (const table of tables) {
    const { count, error: countErr } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('outlet_id', outletId);
    if (countErr) {
      console.error(`Error counting ${table}:`, countErr.message);
    } else {
      console.log(`${table}: ${count} records`);
    }
  }
}

main();
