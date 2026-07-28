const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDramagaTopup() {
  const { data, error } = await supabase
    .from('petty_cash_topups')
    .select('*, outlets(name)')
    .eq('amount', 400000)
    .order('created_at', { ascending: false });

  if (error) console.error(error);
  else console.log('Dramaga 400k topup:', JSON.stringify(data, null, 2));
}

checkDramagaTopup();
