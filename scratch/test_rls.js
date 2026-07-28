const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const targetId = 'a303d96b-b6d4-4708-92f4-c653b6d22309'; // SUKA SHAWARMA EMPANG 500.000 topup from earlier log!

async function testRls() {
  console.log('Testing with Service Key:');
  const supabaseService = createClient(url, serviceKey);
  const { data: sData, error: sErr } = await supabaseService
    .from('petty_cash_topups')
    .select('*')
    .eq('id', targetId)
    .single();
  console.log('Service Key result:', sErr ? sErr : sData ? sData.id : 'null');

  console.log('\nTesting with Anon Key (without user auth):');
  const supabaseAnon = createClient(url, anonKey);
  const { data: aData, error: aErr } = await supabaseAnon
    .from('petty_cash_topups')
    .select('*')
    .eq('id', targetId)
    .single();
  console.log('Anon Key result:', aErr ? aErr.message : aData ? aData.id : 'null');
}

testRls();
