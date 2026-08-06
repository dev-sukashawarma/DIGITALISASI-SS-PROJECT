const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/stok/.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('stok_balance')
    .select('outlet_id, outlets(name)');
    
  if (error) {
    console.error(error);
  } else {
    const counts = {};
    data.forEach(row => {
      const name = row.outlets ? row.outlets.name : 'Unknown';
      counts[name] = (counts[name] || 0) + 1;
    });
    console.log("Stok Balance counts:");
    console.log(counts);
  }
}

run();
