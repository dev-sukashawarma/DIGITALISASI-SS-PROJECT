const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const outletId = '00000000-0000-0000-0000-000000000000';
  const res = await supabase.from('checklist_categories').select('id, checklist_items(id, is_required)').in('outlet_id', [outletId, '00000000-0000-0000-0000-000000000000']).eq('phase', 'tutup');
  console.log(JSON.stringify(res.data, null, 2));
}
run();
