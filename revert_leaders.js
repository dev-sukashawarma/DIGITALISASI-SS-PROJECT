const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function revertAllAreaManagers() {
  const { data: updated, error } = await supabase
    .from('outlet_staff')
    .update({ role: 'leader' })
    .eq('role', 'area_manager')
    .select('id, name, role');

  if (error) {
    console.error('Error reverting area managers:', error);
    return;
  }

  console.log(`Successfully reverted ${updated.length} accounts back to leader:`);
  console.table(updated);
}

revertAllAreaManagers();
