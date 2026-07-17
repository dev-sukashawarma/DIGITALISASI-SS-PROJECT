const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data, error } = await supabase.from('checklist_categories').insert({
    name: 'Test Global Checklist',
    phase: 'buka',
    outlet_id: null
  }).select();
  if (error) console.error(error);
  else {
    console.log('Success:', data);
    await supabase.from('checklist_categories').delete().eq('id', data[0].id);
  }
}
main();
