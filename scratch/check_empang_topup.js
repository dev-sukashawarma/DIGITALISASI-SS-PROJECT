const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkEmpangTopup() {
  const targetId = 'a303d96b-b6d4-4708-92f4-c653b6d22309';
  const { data: topup, error } = await supabase
    .from('petty_cash_topups')
    .select('*')
    .eq('id', targetId)
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Topup record details:', JSON.stringify(topup, null, 2));
  }
}

checkEmpangTopup();
