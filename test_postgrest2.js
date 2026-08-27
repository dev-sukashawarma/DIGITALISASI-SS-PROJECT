const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabase.from('checklist_categories').select('*').eq('phase', 'tutup');
  console.log(JSON.stringify(data, null, 2));
}
run();
