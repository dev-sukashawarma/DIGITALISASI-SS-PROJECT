const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listFolder() {
  const { data, error } = await supabase.storage.from('finance-proofs').list('finance-proofs');
  console.log('Files inside finance-proofs/finance-proofs:', data, error);

  if (data && data.length > 0) {
    const file = data[0];
    const publicUrl = supabase.storage.from('finance-proofs').getPublicUrl(`finance-proofs/${file.name}`).data.publicUrl;
    console.log('Generated publicUrl:', publicUrl);
    const res = await fetch(publicUrl);
    console.log('Fetch status:', res.status, res.statusText);
  }
}

listFolder();
