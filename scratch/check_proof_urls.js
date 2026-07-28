const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProofUrls() {
  const { data, error } = await supabase
    .from('petty_cash_topups')
    .select('id, proof_of_transfer_url')
    .not('proof_of_transfer_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (data) {
    data.forEach(d => console.log('ID:', d.id, '-> URL:', d.proof_of_transfer_url));
  }
}

checkProofUrls();
