const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLeaders() {
  const { data: leaders, error } = await supabase
    .from('outlet_staff')
    .select('id, name, role, username')
    .eq('role', 'leader');

  if (error) {
    console.error('Error fetching leaders:', error);
    return;
  }

  console.log(`Found ${leaders.length} leaders:`);
  console.table(leaders);
}

checkLeaders();
