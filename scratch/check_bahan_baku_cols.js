const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase.from('bahan_baku').select('*').limit(1);
  if (error) { console.error(error); return; }
  console.log(JSON.stringify(data, null, 2));
}
main();
