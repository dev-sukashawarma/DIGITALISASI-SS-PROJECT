const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTopupsSchema() {
  const { data, error } = await supabase.from('petty_cash_topups').select('*').limit(1);
  if (error) console.error(error);
  else console.log('petty_cash_topups keys:', Object.keys(data[0] || {}));
}

checkTopupsSchema();
