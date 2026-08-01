const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateLeadersToAreaManager() {
  const { data: updated, error } = await supabase
    .from('outlet_staff')
    .update({ role: 'area_manager' })
    .eq('role', 'leader')
    .select('id, name, role, username');

  if (error) {
    console.error('Error updating leaders:', error);
    return;
  }

  console.log(`Successfully updated ${updated.length} accounts to area_manager:`);
  console.table(updated);
}

updateLeadersToAreaManager();
