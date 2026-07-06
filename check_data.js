const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkData() {
  const { data, error } = await supabase.from('system_guides').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Guides data:', JSON.stringify(data, null, 2));
  }
}

checkData();
