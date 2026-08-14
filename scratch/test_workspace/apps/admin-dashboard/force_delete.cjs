const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';
const supabase = createClient(url, key);

async function main() {
  const outletSlug = 'tebet-mitra';
  const { data: outlet, error: outletErr } = await supabase.from('outlets').select('id').eq('slug', outletSlug).single();
  
  if (outletErr) {
    console.error('Outlet not found:', outletErr.message);
    return;
  }
  
  const id = outlet.id;
  console.log(`Found outlet with ID: ${id}`);
  
  const tables = ['bypass_requests', 'bypass_request'];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq('outlet_id', id);
    if (!error) console.log(`Cleared ${table}.`);
  }
  
  // Finally delete the outlet
  const { error: finalErr } = await supabase.from('outlets').delete().eq('id', id);
  if (finalErr) {
    console.error('Failed to delete outlet:', finalErr.message);
  } else {
    console.log('Outlet deleted successfully.');
  }
}

main();
