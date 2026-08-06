const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/stok/.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('outlets')
    .select('id, name, is_active')
    .order('name');
  
  if (error) {
    console.error(error);
  } else {
    console.log("ALL OUTLETS:");
    data.forEach(o => {
      console.log(`- ${o.name} (Active: ${o.is_active})`);
    });
  }
}

run();
