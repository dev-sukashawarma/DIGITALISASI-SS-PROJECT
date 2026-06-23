const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDM5NzkxOSwiZXhwIjoyMDUwMDc3OTE5fQ.q8P-R3wFm28w2l4J7d8o-MWehB7yS5N40D5aO8G5sX8'
);

async function run() {
  const { data, error } = await supabase
    .from('orders')
    .select('created_at');
    
  if (error) console.error(error);
  else {
    const dates = data.map(o => o.created_at.split('T')[0]);
    const counts = {};
    for (const d of dates) counts[d] = (counts[d] || 0) + 1;
    console.log(counts);
  }
}
run();
