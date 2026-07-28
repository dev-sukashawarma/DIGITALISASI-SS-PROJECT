const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFetchImageUrl() {
  const { data } = await supabase.from('petty_cash_topups').select('id, proof_of_transfer_url').eq('id', 'db7c9f17-0820-412e-89c7-2920b8c6b6eb').single();
  console.log('Full URL for db7c9f17-0820-412e-89c7-2920b8c6b6eb:', data.proof_of_transfer_url);

  // Try HTTP fetch
  try {
    const res = await fetch(data.proof_of_transfer_url);
    console.log('HTTP status:', res.status, res.statusText);
    console.log('Content-Type:', res.headers.get('content-type'));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testFetchImageUrl();
